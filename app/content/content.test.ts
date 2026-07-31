import { describe, expect, it } from "vitest";
import {
  GUIDES,
  orderedGuides,
  publicGuides,
  readingMinutes,
  referencedPracticeSlugs,
} from "./guides";
import { PRACTICES, cycleSeconds, getPractice, todaysPractice } from "./practices";
import { ACHIEVEMENTS, newlyEarned } from "./achievements";
import { COMPARISONS } from "./comparisons";
import { CREDENTIALS_VERIFIED, TEACHINGS } from "./bezz";
import { LEVELS, levelFor, levelProgress, nextLevelFor } from "~/lib/levels";
import { publicRoutes, DISALLOWED_PATHS, renderLlmsTxt } from "~/lib/sitemap";
import { demoReferencedSlugs } from "~/lib/demo.server";

const PRACTICE_SLUGS = new Set(PRACTICES.map((p) => p.slug));
const GUIDE_SLUGS = new Set(GUIDES.map((g) => g.slug));

describe("the practice library", () => {
  it("stays small, per the brief's radical simplicity rule", () => {
    expect(PRACTICES.length).toBeLessThanOrEqual(8);
    expect(PRACTICES.length).toBeGreaterThanOrEqual(6);
  });

  it("has unique slugs and unique ordering", () => {
    expect(PRACTICE_SLUGS.size).toBe(PRACTICES.length);
    const orders = PRACTICES.map((p) => p.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("limits best-for tags to two, as the card spec requires", () => {
    for (const practice of PRACTICES) {
      expect(practice.bestFor.length).toBeGreaterThanOrEqual(1);
      expect(practice.bestFor.length).toBeLessThanOrEqual(2);
    }
  });

  it("gives every practice a real breath cycle", () => {
    for (const practice of PRACTICES) {
      expect(cycleSeconds(practice.pattern)).toBeGreaterThan(0);
      expect(practice.pattern.exhale).toBeGreaterThan(0);
    }
  });

  it("matches the durations the brief specifies", () => {
    expect(getPractice("grand-rising-method")!.seconds).toBe(16 * 60);
    expect(getPractice("breath-of-rapture")!.seconds).toBe(40 * 60);
    expect(getPractice("three-minute-return")!.seconds).toBe(3 * 60);

    const anxiety = getPractice("anxiety-relief")!;
    expect(anxiety.seconds).toBeGreaterThanOrEqual(5 * 60);
    expect(anxiety.seconds).toBeLessThanOrEqual(10 * 60);

    const flow = getPractice("flow-state-reset")!;
    expect(flow.seconds).toBeGreaterThanOrEqual(6 * 60);
    expect(flow.seconds).toBeLessThanOrEqual(12 * 60);

    const evening = getPractice("evening-release")!;
    expect(evening.seconds).toBeGreaterThanOrEqual(8 * 60);
    expect(evening.seconds).toBeLessThanOrEqual(15 * 60);

    const innerChild = getPractice("inner-child")!;
    expect(innerChild.seconds).toBeGreaterThanOrEqual(12 * 60);
    expect(innerChild.seconds).toBeLessThanOrEqual(20 * 60);
  });

  it("keeps Anxiety Relief gentle — no retention, longer exhale than inhale", () => {
    const anxiety = getPractice("anxiety-relief")!;
    expect(anxiety.intensity).toBe("gentle");
    expect(anxiety.pattern.holdIn).toBe(0);
    expect(anxiety.pattern.holdOut).toBe(0);
    expect(anxiety.pattern.exhale).toBeGreaterThan(anxiety.pattern.inhale);
  });

  it("uses extended exhales for Evening Release", () => {
    const evening = getPractice("evening-release")!;
    expect(evening.pattern.exhale).toBeGreaterThan(evening.pattern.inhale);
    expect(evening.intensity).toBe("gentle");
  });

  it("gives every deep practice preparation and a contraindication note", () => {
    for (const practice of PRACTICES.filter((p) => p.intensity === "deep")) {
      expect(practice.preparation, practice.slug).toBeTruthy();
      expect(practice.contraindication, practice.slug).toBeTruthy();
      expect(practice.contraindication!.length).toBeGreaterThan(80);
    }
  });

  it("links every practice to guides that exist", () => {
    for (const practice of PRACTICES) {
      for (const slug of practice.relatedGuides) {
        expect(GUIDE_SLUGS.has(slug), `${practice.slug} → ${slug}`).toBe(true);
      }
    }
  });
});

describe("todaysPractice", () => {
  it("offers the morning ritual in the morning", () => {
    expect(todaysPractice({ hour: 7, practicedToday: false }).slug).toBe(
      "grand-rising-method",
    );
  });

  it("offers something calming late at night", () => {
    expect(todaysPractice({ hour: 22, practicedToday: false }).slug).toBe(
      "evening-release",
    );
    expect(todaysPractice({ hour: 2, practicedToday: false }).slug).toBe(
      "evening-release",
    );
  });

  it("never suggests a long journey to someone who already practised", () => {
    for (const hour of [6, 9, 13, 18, 23]) {
      const suggestion = todaysPractice({ hour, practicedToday: true });
      expect(suggestion.seconds).toBeLessThanOrEqual(5 * 60);
    }
  });

  it("always returns a real practice", () => {
    for (let hour = 0; hour < 24; hour++) {
      for (const practicedToday of [true, false]) {
        const suggestion = todaysPractice({ hour, practicedToday });
        expect(PRACTICE_SLUGS.has(suggestion.slug)).toBe(true);
      }
    }
  });
});

describe("the guide library", () => {
  it("has unique slugs and unique ordering", () => {
    expect(GUIDE_SLUGS.size).toBe(GUIDES.length);
    const orders = GUIDES.map((g) => g.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("covers everything the brief lists", () => {
    for (const slug of [
      "the-breathflow-guide",
      "grand-rising-method",
      "prana-life-force",
      "activation-vs-regulation",
      "retention-basics",
      "daily-ritual",
      "integration",
      "journal-prompts",
    ]) {
      expect(GUIDE_SLUGS.has(slug), slug).toBe(true);
    }
  });

  it("meets a minimum depth — no stub articles", () => {
    for (const guide of GUIDES) {
      expect(guide.chapters.length, guide.slug).toBeGreaterThanOrEqual(2);
      expect(readingMinutes(guide), guide.slug).toBeGreaterThanOrEqual(2);
      for (const chapter of guide.chapters) {
        expect(chapter.blocks.length, `${guide.slug}/${chapter.title}`)
          .toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("only links to practices that exist", () => {
    for (const slug of referencedPracticeSlugs()) {
      expect(PRACTICE_SLUGS.has(slug), slug).toBe(true);
    }
  });

  it("keeps the retention guide's safety rules intact", () => {
    const retention = GUIDES.find((g) => g.slug === "retention-basics")!;
    const text = JSON.stringify(retention).toLowerCase();
    expect(text).toContain("water");
    expect(text).toContain("driving");
    expect(text).toContain("lying down");
    expect(retention.category).toBe("safety");
  });

  it("publishes everything, so the SEO surface matches the app", () => {
    expect(publicGuides().length).toBe(orderedGuides().length);
  });
});

describe("achievements", () => {
  it("has unique keys", () => {
    const keys = ACHIEVEMENTS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("never rewards sharing — that would be coercive", () => {
    const text = JSON.stringify(ACHIEVEMENTS).toLowerCase();
    expect(text).not.toMatch(/share \d|for sharing|post to/);
  });

  const emptyContext = {
    totalSessions: 0,
    lifeForceMinutes: 0,
    currentStreak: 0,
    longestStreak: 0,
    completedSlugs: new Set<string>(),
    retentionCount: 0,
    bestRetentionSeconds: 0,
    previousBestRetentionSeconds: 0,
    reflectionCount: 0,
  };

  it("gives a brand-new account nothing", () => {
    expect(newlyEarned(emptyContext, new Set())).toEqual([]);
  });

  it("awards the first breath after one session", () => {
    const earned = newlyEarned(
      { ...emptyContext, totalSessions: 1 },
      new Set(),
    );
    expect(earned.map((a) => a.key)).toContain("first-conscious-breath");
  });

  it("never re-awards something already earned", () => {
    const context = { ...emptyContext, totalSessions: 1 };
    const earned = newlyEarned(context, new Set(["first-conscious-breath"]));
    expect(earned.map((a) => a.key)).not.toContain("first-conscious-breath");
  });

  it("does not call a first retention a personal breakthrough", () => {
    const earned = newlyEarned(
      {
        ...emptyContext,
        retentionCount: 1,
        bestRetentionSeconds: 45,
        previousBestRetentionSeconds: 0,
      },
      new Set(),
    );
    const keys = earned.map((a) => a.key);
    expect(keys).toContain("first-retention");
    expect(keys).not.toContain("retention-breakthrough");
  });

  it("awards a breakthrough only when a previous best was beaten", () => {
    const earned = newlyEarned(
      {
        ...emptyContext,
        retentionCount: 5,
        bestRetentionSeconds: 60,
        previousBestRetentionSeconds: 50,
      },
      new Set(),
    );
    expect(earned.map((a) => a.key)).toContain("retention-breakthrough");
  });
});

describe("levels", () => {
  it("ascends and starts at zero", () => {
    expect(LEVELS[0]!.minutes).toBe(0);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i]!.minutes).toBeGreaterThan(LEVELS[i - 1]!.minutes);
    }
  });

  it("places a brand-new practitioner at Seed", () => {
    expect(levelFor(0).key).toBe("seed");
    expect(levelFor(59).key).toBe("seed");
    expect(levelFor(60).key).toBe("sprout");
  });

  it("clamps progress between 0 and 1, and ends at 1", () => {
    for (const minutes of [0, 1, 59, 60, 299, 300, 5999, 6000, 999_999]) {
      const progress = levelProgress(minutes);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    }
    expect(levelProgress(999_999)).toBe(1);
    expect(nextLevelFor(999_999)).toBeNull();
  });

  it("uses growth language, never competition", () => {
    const text = JSON.stringify(LEVELS).toLowerCase();
    expect(text).not.toMatch(/rank|leaderboard|beat|compete|score|win/);
  });
});

describe("comparison pages", () => {
  it("always admit at least one place the competitor is better", () => {
    for (const comparison of COMPARISONS) {
      expect(
        comparison.theyreBetter.length,
        comparison.slug,
      ).toBeGreaterThanOrEqual(1);
      for (const point of comparison.theyreBetter) {
        expect(point.detail.length).toBeGreaterThan(60);
      }
    }
  });

  it("have unique slugs", () => {
    const slugs = COMPARISONS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("never hardcode a price into the prose", () => {
    // Prices come from pricing.ts at render time so they cannot go stale.
    const text = JSON.stringify(COMPARISONS);
    expect(text).not.toMatch(/\$\d/);
  });
});

describe("founder credentials", () => {
  it("stay unpublished until the founder verifies them", () => {
    // The acceptance criteria require every credential and event reference to
    // be confirmed before publication. Flip CREDENTIALS_VERIFIED once that has
    // happened — this test exists so it cannot be forgotten.
    expect(CREDENTIALS_VERIFIED).toBe(false);
  });

  it("has teachings with unique slugs", () => {
    const slugs = TEACHINGS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("the demo account", () => {
  it("only references practices that exist", () => {
    for (const slug of demoReferencedSlugs()) {
      expect(PRACTICE_SLUGS.has(slug), slug).toBe(true);
    }
  });

  it("shows off enough of the app to be worth looking at", () => {
    expect(demoReferencedSlugs().length).toBeGreaterThanOrEqual(5);
  });
});

describe("the sitemap registry", () => {
  const routes = publicRoutes();

  it("lists every public guide and comparison", () => {
    const paths = new Set(routes.map((r) => r.path));
    for (const guide of publicGuides()) {
      expect(paths.has(`/guides/${guide.slug}`), guide.slug).toBe(true);
    }
    for (const comparison of COMPARISONS) {
      expect(paths.has(`/compare/${comparison.slug}`), comparison.slug).toBe(
        true,
      );
    }
  });

  it("never lists a path that robots.txt disallows", () => {
    for (const route of routes) {
      for (const disallowed of DISALLOWED_PATHS) {
        expect(
          route.path === disallowed || route.path.startsWith(`${disallowed}/`),
          `${route.path} is both listed and disallowed`,
        ).toBe(false);
      }
    }
  });

  it("gives every entry a real summary for llms.txt", () => {
    for (const route of routes) {
      expect(route.summary.length, route.path).toBeGreaterThan(20);
    }
  });

  it("has unique paths", () => {
    const paths = routes.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe("llms.txt", () => {
  const text = renderLlmsTxt("https://breathflow.app", "$12.99");

  it("states the safety position, so an assistant repeats it correctly", () => {
    expect(text).toMatch(/does not diagnose, treat, cure or prevent/i);
    expect(text).toMatch(/never be practised in or near water/i);
  });

  it("describes what the product actually is", () => {
    expect(text).toMatch(/pranayama/i);
    expect(text).toMatch(/Life Force Minutes/);
    expect(text).toMatch(/Three-Minute Return/);
  });

  it("links every public guide", () => {
    for (const guide of publicGuides()) {
      expect(text).toContain(`/guides/${guide.slug}`);
    }
  });
});
