import { describe, expect, it } from "vitest";
import {
  FREE_PRACTICE_SLUGS,
  PLANS,
  annualIsGenuinelyCheaper,
  annualMonthlyEquivalentCents,
  annualSavingsCents,
  annualSavingsPercent,
  entitlementFor,
  formatCents,
} from "./pricing";
import { PRACTICES } from "~/content/practices";

describe("money is integer cents", () => {
  it("every plan amount is a whole number of cents", () => {
    for (const plan of Object.values(PLANS)) {
      expect(Number.isInteger(plan.cents)).toBe(true);
      expect(plan.cents).toBeGreaterThanOrEqual(0);
    }
  });

  it("formats without floating-point artefacts", () => {
    expect(formatCents(0)).toBe("$0");
    expect(formatCents(1299)).toBe("$12.99");
    expect(formatCents(8999)).toBe("$89.99");
    expect(formatCents(100)).toBe("$1");
    expect(formatCents(105)).toBe("$1.05");
    // The classic float trap: 0.1 + 0.2 never enters into it.
    expect(formatCents(10 + 20)).toBe("$0.30");
  });
});

describe("the annual savings claim", () => {
  it("is derived from the real numbers, never hardcoded", () => {
    const expected = PLANS.monthly.cents * 12 - PLANS.annual.cents;
    expect(annualSavingsCents()).toBe(expected);
  });

  it("matches the percentage shown in marketing copy", () => {
    const percent = annualSavingsPercent();
    const recomputed = Math.round(
      (annualSavingsCents() / (PLANS.monthly.cents * 12)) * 100,
    );
    expect(percent).toBe(recomputed);
  });

  it("computes the per-month equivalent honestly", () => {
    expect(annualMonthlyEquivalentCents()).toBe(
      Math.round(PLANS.annual.cents / 12),
    );
    // If we are going to say "X a month", it must be less than the real
    // monthly price — otherwise the claim is a lie.
    expect(annualMonthlyEquivalentCents()).toBeLessThan(PLANS.monthly.cents);
  });

  it("only promotes annual when the saving is genuine", () => {
    expect(annualIsGenuinelyCheaper()).toBe(
      annualSavingsCents() > 0 && annualSavingsPercent() >= 10,
    );
  });

  it("as currently priced, annual is worth promoting", () => {
    expect(annualIsGenuinelyCheaper()).toBe(true);
  });
});

describe("entitlement", () => {
  it("gives premium only to an active or trialing paid plan", () => {
    expect(entitlementFor("monthly", "active")).toBe("premium");
    expect(entitlementFor("annual", "trialing")).toBe("premium");
    expect(entitlementFor("monthly", "past_due")).toBe("free");
    expect(entitlementFor("monthly", "canceled")).toBe("free");
    expect(entitlementFor("free", "active")).toBe("free");
  });
});

describe("free means the same thing everywhere", () => {
  it("every free slug is a real practice", () => {
    const slugs = new Set(PRACTICES.map((p) => p.slug));
    for (const slug of FREE_PRACTICE_SLUGS) {
      expect(slugs.has(slug)).toBe(true);
    }
  });

  it("the free slugs are exactly the practices not marked premium", () => {
    const notPremium = PRACTICES.filter((p) => !p.premium)
      .map((p) => p.slug)
      .sort();
    expect(notPremium).toEqual([...FREE_PRACTICE_SLUGS].sort());
  });

  it("the free plan promises nothing the free slugs cannot deliver", () => {
    // The pricing page claims the Three-Minute Return is free forever.
    expect(FREE_PRACTICE_SLUGS).toContain("three-minute-return");
    const threeMinute = PRACTICES.find(
      (p) => p.slug === "three-minute-return",
    )!;
    expect(threeMinute.premium).toBe(false);
  });
});
