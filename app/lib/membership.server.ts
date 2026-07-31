import { one, run } from "./db.server";
import { newId } from "./ids";
import {
  type Entitlement,
  type PlanId,
  FREE_PRACTICE_SLUGS,
  GRAND_RISING_FREE_DAYS,
  PLANS,
  entitlementFor,
} from "./pricing";
import type { Practice } from "~/content/practices";

/**
 * Membership and access.
 *
 * Dark until keys land: with no STRIPE_SECRET_KEY configured, `billingIsLive`
 * is false and every gate opens. The whole app is usable end to end before a
 * single third-party key exists — a paywall that blocks people while billing
 * is half-built is the worst of both worlds.
 */

export type Subscription = {
  id: string;
  org_id: string;
  user_id: string;
  plan: PlanId;
  status: string;
  provider: string;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  current_period_end: number | null;
};

export function billingIsLive(env: Env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_MONTHLY);
}

export async function getSubscription(
  env: Env,
  userId: string,
): Promise<Subscription | null> {
  return one<Subscription>(
    env.DB,
    `SELECT * FROM subscriptions WHERE user_id = ?`,
    userId,
  );
}

export type Access = {
  entitlement: Entitlement;
  plan: PlanId;
  status: string;
  /** True when the gate is open because billing isn't configured yet. */
  unlockedBecauseBillingIsDark: boolean;
  /** True for the demo account, which is exempt from billing entirely. */
  isDemo: boolean;
  renewsAt: number | null;
};

export async function getAccess(
  env: Env,
  user: { id: string; is_demo: number },
): Promise<Access> {
  const sub = await getSubscription(env, user.id);
  const plan = (sub?.plan ?? "free") as PlanId;
  const status = sub?.status ?? "active";

  const dark = !billingIsLive(env);
  const isDemo = user.is_demo === 1;
  const earned = entitlementFor(plan, status);

  return {
    plan,
    status,
    // The demo tenant is exempt from billing gates, and so is everyone while
    // billing is dark.
    entitlement: earned === "premium" || dark || isDemo ? "premium" : "free",
    unlockedBecauseBillingIsDark: dark && earned !== "premium" && !isDemo,
    isDemo,
    renewsAt: sub?.current_period_end ?? null,
  };
}

/**
 * Can this user start this practice right now?
 *
 * The Grand Rising Method is free for the first seven days of an account, per
 * the brief's "introductory access". After that it joins Deep Practice. This
 * is stated plainly in the UI — no silent expiry.
 */
export function canPlay(
  practice: Practice,
  access: Access,
  opts: { accountAgeDays: number },
): { allowed: boolean; reason?: "premium" | "intro-ended" } {
  if (access.entitlement === "premium") return { allowed: true };
  if (!practice.premium) {
    if (
      practice.slug === "grand-rising-method" &&
      opts.accountAgeDays >= GRAND_RISING_FREE_DAYS
    ) {
      return { allowed: false, reason: "intro-ended" };
    }
    return { allowed: true };
  }
  return { allowed: false, reason: "premium" };
}

export function accountAgeDays(createdAt: number, now = Date.now()): number {
  return Math.floor((now - createdAt) / 86_400_000);
}

export function isFreeSlug(slug: string): boolean {
  return (FREE_PRACTICE_SLUGS as readonly string[]).includes(slug);
}

// ── Stripe (server-only, and entirely optional) ────────────────────────────

/**
 * We speak to Stripe over plain fetch rather than pulling the SDK into a
 * Worker bundle. Two endpoints is not worth 400kb, and this keeps the client
 * build clean by construction.
 */
export async function createCheckoutSession(
  env: Env,
  opts: {
    plan: Exclude<PlanId, "free">;
    userId: string;
    email: string;
    successUrl: string;
    cancelUrl: string;
  },
): Promise<{ url: string } | { error: string }> {
  if (!billingIsLive(env)) {
    return { error: "Billing isn't switched on yet." };
  }

  const priceId =
    opts.plan === "annual" ? env.STRIPE_PRICE_ANNUAL : env.STRIPE_PRICE_MONTHLY;
  if (!priceId) {
    return { error: `No Stripe price configured for the ${opts.plan} plan.` };
  }

  const body = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    customer_email: opts.email,
    "metadata[user_id]": opts.userId,
    "subscription_data[metadata][user_id]": opts.userId,
    allow_promotion_codes: "true",
  });

  try {
    const response = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );
    const json = (await response.json()) as { url?: string; error?: { message?: string } };
    if (!response.ok || !json.url) {
      return {
        error: json.error?.message ?? "Stripe wouldn't open a checkout just now.",
      };
    }
    return { url: json.url };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not reach Stripe.",
    };
  }
}

export async function applySubscriptionUpdate(
  env: Env,
  opts: {
    userId: string;
    plan: PlanId;
    status: string;
    customerId?: string | null;
    subscriptionId?: string | null;
    currentPeriodEnd?: number | null;
  },
): Promise<void> {
  const now = Date.now();
  const existing = await getSubscription(env, opts.userId);

  if (existing) {
    await run(
      env.DB,
      `UPDATE subscriptions
          SET plan = ?, status = ?, provider = 'stripe',
              provider_customer_id = COALESCE(?, provider_customer_id),
              provider_subscription_id = COALESCE(?, provider_subscription_id),
              current_period_end = COALESCE(?, current_period_end),
              updated_at = ?
        WHERE user_id = ?`,
      opts.plan,
      opts.status,
      opts.customerId ?? null,
      opts.subscriptionId ?? null,
      opts.currentPeriodEnd ?? null,
      now,
      opts.userId,
    );
    return;
  }

  const user = await one<{ org_id: string }>(
    env.DB,
    `SELECT org_id FROM users WHERE id = ?`,
    opts.userId,
  );
  if (!user) return;

  await run(
    env.DB,
    `INSERT INTO subscriptions
       (id, org_id, user_id, plan, status, provider,
        provider_customer_id, provider_subscription_id, current_period_end,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'stripe', ?, ?, ?, ?, ?)`,
    newId("subscription"),
    user.org_id,
    opts.userId,
    opts.plan,
    opts.status,
    opts.customerId ?? null,
    opts.subscriptionId ?? null,
    opts.currentPeriodEnd ?? null,
    now,
    now,
  );
}

/** Map a Stripe price id back to one of our plans. */
export function planForPriceId(env: Env, priceId: string): PlanId {
  if (priceId && priceId === env.STRIPE_PRICE_ANNUAL) return "annual";
  if (priceId && priceId === env.STRIPE_PRICE_MONTHLY) return "monthly";
  return "free";
}

export { PLANS };
