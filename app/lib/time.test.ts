import { describe, expect, it } from "vitest";
import {
  addDays,
  clock,
  dayRange,
  daysBetween,
  greetingFor,
  humanDuration,
  isValidTimeZone,
  lastSevenDays,
  localDay,
  localHour,
} from "./time";

describe("localDay", () => {
  it("uses the user's timezone, not UTC", () => {
    // 06:30 UTC on 12 March is still 11 March in Los Angeles.
    const at = Date.parse("2026-03-12T06:30:00Z");
    expect(localDay(at, "UTC")).toBe("2026-03-12");
    expect(localDay(at, "America/Los_Angeles")).toBe("2026-03-11");
    expect(localDay(at, "Asia/Tokyo")).toBe("2026-03-12");
  });

  it("puts a late-night practice on the right side of midnight", () => {
    // 23:45 local in Sydney — must not roll into tomorrow just because UTC has.
    const at = Date.parse("2026-06-30T13:45:00Z"); // 23:45 AEST
    expect(localDay(at, "Australia/Sydney")).toBe("2026-06-30");
  });

  it("survives a spring-forward DST transition", () => {
    // US DST begins 08 March 2026. Both instants are still the 8th locally.
    const before = Date.parse("2026-03-08T06:30:00Z");
    const after = Date.parse("2026-03-08T09:30:00Z");
    expect(localDay(before, "America/New_York")).toBe("2026-03-08");
    expect(localDay(after, "America/New_York")).toBe("2026-03-08");
  });

  it("falls back to UTC rather than throwing on a bad timezone", () => {
    const at = Date.parse("2026-03-12T06:30:00Z");
    expect(localDay(at, "Not/AZone")).toBe("2026-03-12");
    expect(localDay(at, "")).toBe("2026-03-12");
  });
});

describe("localHour", () => {
  it("reports the hour in the user's own timezone", () => {
    const at = Date.parse("2026-03-12T14:05:00Z");
    expect(localHour(at, "UTC")).toBe(14);
    expect(localHour(at, "America/Los_Angeles")).toBe(7);
  });

  it("reports midnight as 0, not 24", () => {
    const at = Date.parse("2026-03-12T00:15:00Z");
    expect(localHour(at, "UTC")).toBe(0);
  });
});

describe("daysBetween and addDays", () => {
  it("counts calendar days", () => {
    expect(daysBetween("2026-03-01", "2026-03-02")).toBe(1);
    expect(daysBetween("2026-03-02", "2026-03-01")).toBe(-1);
    expect(daysBetween("2026-03-01", "2026-03-01")).toBe(0);
  });

  it("crosses months and years", () => {
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1); // 2026 is not a leap year
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2); // 2024 is
  });

  it("shifts days without drifting across a DST boundary", () => {
    // Pure date strings — DST must not enter into it at all.
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("lastSevenDays", () => {
  it("returns seven days ending today, oldest first", () => {
    const days = lastSevenDays("2026-03-12");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-03-06");
    expect(days[6]).toBe("2026-03-12");
  });
});

describe("dayRange", () => {
  it("is inclusive at both ends", () => {
    expect(dayRange("2026-03-01", "2026-03-03")).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
    ]);
  });

  it("returns nothing for a backwards range", () => {
    expect(dayRange("2026-03-03", "2026-03-01")).toEqual([]);
  });
});

describe("greetingFor", () => {
  it("never presumes how the day is going", () => {
    expect(greetingFor(2)).toBe("Still awake");
    expect(greetingFor(8)).toBe("Good morning");
    expect(greetingFor(14)).toBe("Good afternoon");
    expect(greetingFor(19)).toBe("Good evening");
    expect(greetingFor(23)).toBe("Late night");
  });
});

describe("formatting", () => {
  it("renders durations as minutes, not deadlines", () => {
    expect(humanDuration(180)).toBe("3 min");
    expect(humanDuration(16 * 60)).toBe("16 min");
    expect(humanDuration(60 * 60)).toBe("1 hr");
    expect(humanDuration(65 * 60)).toBe("1 hr 5 min");
    expect(humanDuration(0)).toBe("0 min");
  });

  it("renders the player clock", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(9)).toBe("0:09");
    expect(clock(605)).toBe("10:05");
    expect(clock(-5)).toBe("0:00");
  });
});

describe("isValidTimeZone", () => {
  it("accepts real zones and rejects nonsense", () => {
    expect(isValidTimeZone("America/Los_Angeles")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Nowhere/Fake")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("x".repeat(200))).toBe(false);
  });
});
