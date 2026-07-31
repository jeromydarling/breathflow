import { describe, expect, it } from "vitest";
import {
  QUALIFYING_SECONDS,
  currentStreak,
  isQualifying,
  lifeForceMinutesFor,
  longestStreak,
  streakJustBroke,
  streakMilestoneReached,
  weekOverWeek,
  weeklyRing,
} from "./streaks";

describe("lifeForceMinutesFor", () => {
  it("credits whole minutes only, and never rounds up", () => {
    expect(lifeForceMinutesFor(0)).toBe(0);
    expect(lifeForceMinutesFor(59)).toBe(0);
    expect(lifeForceMinutesFor(60)).toBe(1);
    expect(lifeForceMinutesFor(119)).toBe(1);
    expect(lifeForceMinutesFor(16 * 60)).toBe(16);
  });

  it("credits partial time from an abandoned session", () => {
    // Left the 16-minute Grand Rising at 4:30 — that is 4 real minutes.
    expect(lifeForceMinutesFor(270)).toBe(4);
  });

  it("refuses to invent minutes from nonsense input", () => {
    expect(lifeForceMinutesFor(-100)).toBe(0);
    expect(lifeForceMinutesFor(Number.NaN)).toBe(0);
    expect(lifeForceMinutesFor(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("isQualifying", () => {
  it("lets a three-minute practice preserve a streak", () => {
    expect(isQualifying(3 * 60)).toBe(true);
  });

  it("pins the exact boundary", () => {
    expect(isQualifying(QUALIFYING_SECONDS - 1)).toBe(false);
    expect(isQualifying(QUALIFYING_SECONDS)).toBe(true);
  });
});

describe("currentStreak", () => {
  const today = "2026-03-12";

  it("is zero with no history", () => {
    expect(currentStreak([], today)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(
      currentStreak(["2026-03-10", "2026-03-11", "2026-03-12"], today),
    ).toBe(3);
  });

  it("does not break just because today hasn't happened yet", () => {
    // Practised yesterday, not yet today. The streak stands.
    expect(currentStreak(["2026-03-10", "2026-03-11"], today)).toBe(2);
  });

  it("breaks once a full day is missed", () => {
    // Nothing yesterday or today — the run ended.
    expect(currentStreak(["2026-03-09", "2026-03-10"], today)).toBe(0);
  });

  it("ignores older runs that are no longer current", () => {
    expect(
      currentStreak(
        ["2026-02-01", "2026-02-02", "2026-02-03", "2026-03-12"],
        today,
      ),
    ).toBe(1);
  });

  it("counts several sessions on one day once", () => {
    expect(currentStreak(["2026-03-12", "2026-03-12"], today)).toBe(1);
  });

  it("crosses a month boundary", () => {
    expect(
      currentStreak(["2026-02-27", "2026-02-28", "2026-03-01"], "2026-03-01"),
    ).toBe(3);
  });
});

describe("longestStreak", () => {
  it("finds the best run anywhere in history", () => {
    expect(
      longestStreak([
        "2026-01-01",
        "2026-01-02",
        "2026-01-03",
        "2026-01-05",
        "2026-02-10",
      ]),
    ).toBe(3);
  });

  it("is 1 for a single day", () => {
    expect(longestStreak(["2026-01-01"])).toBe(1);
  });

  it("is 0 for no days", () => {
    expect(longestStreak([])).toBe(0);
  });

  it("does not care what order the days arrive in", () => {
    expect(longestStreak(["2026-01-03", "2026-01-01", "2026-01-02"])).toBe(3);
  });
});

describe("streakJustBroke", () => {
  const today = "2026-03-12";

  it("stays quiet for someone who simply hasn't practised yet today", () => {
    expect(streakJustBroke(["2026-03-11"], today)).toBe(false);
  });

  it("stays quiet for someone who has practised today", () => {
    expect(streakJustBroke(["2026-03-12"], today)).toBe(false);
  });

  it("stays quiet for a brand new account with no history at all", () => {
    expect(streakJustBroke([], today)).toBe(false);
  });

  it("speaks up only after a full day has been missed", () => {
    expect(streakJustBroke(["2026-03-09", "2026-03-10"], today)).toBe(true);
  });
});

describe("weeklyRing", () => {
  it("marks practised days and today", () => {
    const ring = weeklyRing(["2026-03-10", "2026-03-12"], "2026-03-12");
    expect(ring).toHaveLength(7);
    expect(ring.at(-1)).toEqual({
      day: "2026-03-12",
      practiced: true,
      isToday: true,
    });
    expect(ring.find((d) => d.day === "2026-03-11")?.practiced).toBe(false);
    expect(ring.filter((d) => d.isToday)).toHaveLength(1);
  });
});

describe("weekOverWeek", () => {
  it("compares the trailing seven days with the seven before that", () => {
    const days = [
      // This week (06–12 March)
      "2026-03-12",
      "2026-03-11",
      "2026-03-09",
      // Last week (27 Feb – 05 March)
      "2026-03-05",
      "2026-03-04",
      "2026-03-03",
      "2026-03-02",
      "2026-03-01",
    ];
    expect(weekOverWeek(days, "2026-03-12")).toEqual({
      thisWeek: 3,
      lastWeek: 5,
    });
  });

  it("does not double-count the boundary day", () => {
    // 06 March belongs to this week only.
    const result = weekOverWeek(["2026-03-06"], "2026-03-12");
    expect(result).toEqual({ thisWeek: 1, lastWeek: 0 });
  });
});

describe("streakMilestoneReached", () => {
  it("celebrates the days the brief asks us to", () => {
    for (const day of [3, 7, 14, 21, 30, 40, 60, 90, 180, 365]) {
      expect(streakMilestoneReached(day)).toBe(day);
    }
  });

  it("stays quiet on every other day", () => {
    for (const day of [1, 2, 4, 8, 15, 22, 31, 100, 366]) {
      expect(streakMilestoneReached(day)).toBeNull();
    }
  });
});
