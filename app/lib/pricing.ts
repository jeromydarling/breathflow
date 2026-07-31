/**
 * The single source of truth for every price in BreathFLOW.
 *
 * Money is integer cents. Never a float, never a string, never a number typed
 * a second time on a marketing page — every surface reads from here.
 *
 * PRICES ARE A PLACEHOLDER PENDING THE FOUNDER'S CALL. Change the two `cents`
 * values below and the paywall, marketing page, comparison table, receipts and
 * tests all follow. pricing.test.ts pins the savings claim to the real maths so
 * the marketing copy can never drift from the actual numbers.
 */

export type PlanId = "free" | "monthly" | "annual";

export type Plan = {
  id: PlanId;
  name: string;
  /** Integer cents. USD. */
  cents: number;
  interval: "forever" | "month" | "year";
  tagline: string;
  /** What you actually get. Written as practice depth, not content volume. */
  includes: readonly string[];
};

export const CURRENCY = "usd" as const;

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Practice",
    cents: 0,
    interval: "forever",
    tagline: "Everything you need to build the habit. Free, and staying free.",
    includes: [
      "The Three-Minute Return, every day",
      "The first seven days of the Grand Rising Method",
      "Streaks and Life Force Minutes",
      "The breath-retention tracker",
      "Share cards for your milestones",
      "Bezz's writing and the founding guides",
    ],
  },
  monthly: {
    id: "monthly",
    name: "Deep Practice",
    cents: 1299,
    interval: "month",
    tagline: "The full library, and the deeper journeys.",
    includes: [
      "The complete Grand Rising Method",
      "Breath of Rapture, the 40-minute signature journey",
      "Every visualization: Anxiety Relief, Inner Child, Flow State, Evening Release",
      "The full guide library",
      "Your complete practice history",
      "Seasonal challenges as they arrive",
    ],
  },
  annual: {
    id: "annual",
    name: "Deep Practice, yearly",
    cents: 8999,
    interval: "year",
    tagline: "The same practice, at a lower rate, paid once.",
    includes: [
      "Everything in Deep Practice",
      "Billed once a year instead of twelve times",
    ],
  },
};

export const PAID_PLANS = [PLANS.monthly, PLANS.annual] as const;

/** "$12.99" — the only place cents become a display string. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}$${(abs / 100).toFixed(2).replace(/\.00$/, "")}`;
}

/** What the annual plan costs per month, in cents, rounded to the cent. */
export function annualMonthlyEquivalentCents(): number {
  return Math.round(PLANS.annual.cents / 12);
}

/** Cents saved in a year by paying annually rather than monthly. */
export function annualSavingsCents(): number {
  return PLANS.monthly.cents * 12 - PLANS.annual.cents;
}

/** Whole-percent saving. Derived, never hardcoded into copy. */
export function annualSavingsPercent(): number {
  const yearOfMonthly = PLANS.monthly.cents * 12;
  if (yearOfMonthly <= 0) return 0;
  return Math.round((annualSavingsCents() / yearOfMonthly) * 100);
}

/**
 * The annual plan is only worth marketing when the saving is real. The brief
 * says to emphasise annual "only when the savings are genuine" — this is that
 * rule, in code, so no one has to remember it.
 */
export function annualIsGenuinelyCheaper(): boolean {
  return annualSavingsCents() > 0 && annualSavingsPercent() >= 10;
}

// ── What free actually includes ────────────────────────────────────────────
// Referenced by the practice registry and the paywall so "free" always means
// exactly the same thing in the library, on the pricing page, and in the gate.

/** Practices anyone can do, forever, without an account upgrade. */
export const FREE_PRACTICE_SLUGS = [
  "three-minute-return",
  "grand-rising-method",
] as const;

/**
 * The Grand Rising Method is free for its first seven days, then becomes part
 * of Deep Practice. This is the "introductory access" the brief describes —
 * long enough to genuinely feel the ritual, honest about ending.
 */
export const GRAND_RISING_FREE_DAYS = 7;

export type Entitlement = "free" | "premium";

export function entitlementFor(plan: PlanId, status: string): Entitlement {
  if (plan === "free") return "free";
  return status === "active" || status === "trialing" ? "premium" : "free";
}
