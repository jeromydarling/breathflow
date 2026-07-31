import { Form, Link, data, redirect, useSearchParams } from "react-router";
import { safeFormData } from "~/lib/form.server";
import type { Route } from "./+types/membership";
import { runtimeFrom } from "~/lib/context";
import { requireOnboardedUser } from "~/lib/auth.server";
import {
  billingIsLive,
  createCheckoutSession,
  getAccess,
} from "~/lib/membership.server";
import {
  PLANS,
  annualIsGenuinelyCheaper,
  annualMonthlyEquivalentCents,
  annualSavingsPercent,
  formatCents,
} from "~/lib/pricing";
import { EVENTS, track } from "~/lib/analytics.server";
import { originFrom } from "~/lib/seo";
import { Button, Card, FormError, SectionHeading } from "~/components/ui";
import { privateNoStore } from "~/lib/cache.server";

/**
 * The membership screen.
 *
 * Runs entirely dark without Stripe keys: everything is unlocked, and the page
 * says so plainly rather than pretending to sell something it cannot. No fake
 * countdowns, no manipulated discounts, no "limited time".
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env, ctx } = runtimeFrom(context);
  const user = await requireOnboardedUser(request, env);
  const access = await getAccess(env, user);

  ctx.waitUntil(
    track(env, {
      name: EVENTS.paywallViewed,
      orgId: user.org_id,
      userId: user.id,
      props: {
        from: new URL(request.url).searchParams.get("from") ?? "",
        entitlement: access.entitlement,
      },
    }),
  );

  return {
    access: {
      plan: access.plan,
      status: access.status,
      entitlement: access.entitlement,
      isDemo: access.isDemo,
      dark: access.unlockedBecauseBillingIsDark,
      renewsAt: access.renewsAt,
    },
    billingLive: billingIsLive(env),
    plans: {
      free: PLANS.free,
      monthly: PLANS.monthly,
      annual: PLANS.annual,
    },
    annual: {
      perMonth: formatCents(annualMonthlyEquivalentCents()),
      savingsPercent: annualSavingsPercent(),
      worthPromoting: annualIsGenuinelyCheaper(),
    },
  };
}

export function headers() {
  return privateNoStore();
}

export function meta() {
  return [
    { title: "Membership · BreathFLOW" },
    { name: "robots", content: "noindex" },
  ];
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env, ctx } = runtimeFrom(context);
  const user = await requireOnboardedUser(request, env);
  const form = await safeFormData(request);
  const plan = String(form.get("plan") ?? "");

  if (plan !== "monthly" && plan !== "annual") {
    return data({ error: "We didn't catch which plan you meant." }, { status: 400 });
  }

  if (user.is_demo === 1) {
    return data(
      {
        error:
          "The demo already has everything open, so there is nothing to buy here. Create your own practice when you're ready.",
      },
      { status: 400 },
    );
  }

  if (!billingIsLive(env)) {
    return data({
      note:
        "Everything is already open to you — BreathFLOW is in early access and there is nothing to pay for yet. We'll tell you clearly before that changes.",
    });
  }

  const origin = originFrom(request, env);
  const result = await createCheckoutSession(env, {
    plan,
    userId: user.id,
    email: user.email,
    successUrl: `${origin}/membership?welcome=1`,
    cancelUrl: `${origin}/membership`,
  });

  if ("error" in result) return data({ error: result.error }, { status: 502 });

  ctx.waitUntil(
    track(env, {
      name: EVENTS.checkoutStarted,
      orgId: user.org_id,
      userId: user.id,
      props: { plan },
    }),
  );

  return redirect(result.url);
}

export default function Membership({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { access, billingLive, plans, annual } = loaderData;
  const [searchParams] = useSearchParams();
  const why = searchParams.get("why");
  const justSubscribed = searchParams.get("welcome") === "1";

  return (
    <div className="mx-auto max-w-lg space-y-6 pt-2">
      <header>
        <Link
          to="/home"
          className="text-sm text-[var(--color-bone-muted)] underline underline-offset-4"
        >
          ← Home
        </Link>
        <h1 className="mt-4 font-serif text-3xl text-[var(--color-bone)]">
          {access.entitlement === "premium" && !access.dark
            ? "Your membership"
            : "Deep Practice"}
        </h1>
        {why === "intro-ended" ? (
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-bone-muted)]">
            Your first seven days of the Grand Rising Method are complete. The
            Three-Minute Return stays free forever, and it keeps your streak
            alive.
          </p>
        ) : null}
      </header>

      {justSubscribed ? (
        <Card className="border-[color-mix(in_oklab,#7fb3a0_40%,transparent)] bg-[color-mix(in_oklab,#7fb3a0_12%,transparent)]">
          <p className="text-[var(--color-bone)]">
            You&rsquo;re in. The whole library is open.
          </p>
        </Card>
      ) : null}

      {access.dark ? (
        <Card className="border-[color-mix(in_oklab,#7fb3a0_40%,transparent)] bg-[color-mix(in_oklab,#7fb3a0_12%,transparent)]">
          <p className="text-[var(--color-bone)]">
            Everything is open to you right now.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-bone-muted)]">
            BreathFLOW is in early access, so there is nothing to pay for yet
            and nothing hidden from you. When that changes we will say so
            plainly, in advance — never by quietly locking a door you were
            already using.
          </p>
        </Card>
      ) : null}

      {access.isDemo ? (
        <Card>
          <p className="text-sm leading-relaxed text-[var(--color-bone-muted)]">
            This is the demo practice — everything is unlocked and nothing is
            billed. Create your own account whenever you&rsquo;re ready.
          </p>
        </Card>
      ) : null}

      {/* Free */}
      <Card>
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl text-[var(--color-bone)]">
            {plans.free.name}
          </h2>
          <p className="text-[var(--color-bone)]">Free</p>
        </div>
        <p className="mt-1.5 text-sm text-[var(--color-bone-muted)]">
          {plans.free.tagline}
        </p>
        <ul className="mt-4 space-y-2">
          {plans.free.includes.map((item) => (
            <li
              key={item}
              className="flex gap-3 text-sm text-[var(--color-bone-muted)]"
            >
              <span aria-hidden="true" className="text-[var(--color-amber-bright)]">
                ·
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Paid */}
      <Card className="border-[color-mix(in_oklab,var(--color-amber)_45%,transparent)]">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl text-[var(--color-bone)]">
            {plans.monthly.name}
          </h2>
          <p className="text-[var(--color-bone)]">
            {formatCents(plans.monthly.cents)}
            <span className="text-sm text-[var(--color-bone-faint)]">/month</span>
          </p>
        </div>
        <p className="mt-1.5 text-sm text-[var(--color-bone-muted)]">
          {plans.monthly.tagline}
        </p>
        <ul className="mt-4 space-y-2">
          {plans.monthly.includes.map((item) => (
            <li
              key={item}
              className="flex gap-3 text-sm text-[var(--color-bone-muted)]"
            >
              <span aria-hidden="true" className="text-[var(--color-amber-bright)]">
                ·
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {access.entitlement === "premium" && !access.dark ? (
          <p className="mt-5 text-sm text-[var(--color-bone-muted)]">
            You&rsquo;re on the {access.plan === "annual" ? "yearly" : "monthly"}{" "}
            plan.
            {access.renewsAt
              ? ` It renews on ${new Date(access.renewsAt).toLocaleDateString()}.`
              : ""}
          </p>
        ) : (
          <Form method="post" className="mt-5 space-y-3">
            <Button
              type="submit"
              name="plan"
              value="monthly"
              size="lg"
              className="w-full"
              disabled={!billingLive}
            >
              {billingLive
                ? `Join for ${formatCents(plans.monthly.cents)} a month`
                : "Already open to you"}
            </Button>

            {/* The annual plan is only promoted when the saving is real —
                that rule lives in pricing.ts, not in this copy. */}
            {annual.worthPromoting ? (
              <>
                <Button
                  type="submit"
                  name="plan"
                  value="annual"
                  variant="ghost"
                  className="w-full"
                  disabled={!billingLive}
                >
                  Or {formatCents(plans.annual.cents)} a year — {annual.perMonth}{" "}
                  a month, {annual.savingsPercent}% less
                </Button>
                <p className="text-center text-xs text-[var(--color-bone-faint)]">
                  Cancel any time. The yearly plan is a genuine{" "}
                  {annual.savingsPercent}% saving, not a discount that expires.
                </p>
              </>
            ) : null}
          </Form>
        )}

        {actionData && "error" in actionData ? (
          <div className="mt-4">
            <FormError>{actionData.error}</FormError>
          </div>
        ) : null}
        {actionData && "note" in actionData ? (
          <p className="mt-4 text-sm text-[var(--color-bone-muted)]">
            {actionData.note}
          </p>
        ) : null}
      </Card>

      <section>
        <SectionHeading>What we won&rsquo;t do</SectionHeading>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--color-bone-muted)]">
          <li>
            · Interrupt a practice with a paywall. You will never hit one
            mid-session.
          </li>
          <li>· Run a countdown timer that isn&rsquo;t real.</li>
          <li>
            · Take away your streak, your Life Force Minutes or your retention
            history if you stop paying. That is your record, not ours.
          </li>
          <li>· Charge you without telling you first.</li>
        </ul>
      </section>

      <p className="pb-4 text-center text-xs text-[var(--color-bone-faint)]">
        1:1 sessions and retreats are booked separately and are not part of any
        membership.
      </p>
    </div>
  );
}
