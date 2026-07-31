import { describe, expect, it } from "vitest";
import { phaseAt, scaleFor } from "./BreathOrb";
import { PRACTICES, cycleSeconds } from "~/content/practices";

/**
 * The orb has to agree with the audio. A visual that says "Exhale" while the
 * voice says "Inhale" is worse than no visual at all, so the phase boundaries
 * are pinned here.
 */

const SQUARE = { inhale: 4, holdIn: 4, exhale: 4, holdOut: 4, label: "Square" };
const LONG_EXHALE = {
  inhale: 4,
  holdIn: 0,
  exhale: 8,
  holdOut: 0,
  label: "Long exhale",
};

describe("phaseAt", () => {
  it("walks a square breath in order", () => {
    expect(phaseAt(SQUARE, 0).phase).toBe("inhale");
    expect(phaseAt(SQUARE, 3.9).phase).toBe("inhale");
    expect(phaseAt(SQUARE, 4).phase).toBe("holdIn");
    expect(phaseAt(SQUARE, 7.9).phase).toBe("holdIn");
    expect(phaseAt(SQUARE, 8).phase).toBe("exhale");
    expect(phaseAt(SQUARE, 12).phase).toBe("holdOut");
    expect(phaseAt(SQUARE, 15.9).phase).toBe("holdOut");
  });

  it("loops cleanly back to the start of the cycle", () => {
    expect(phaseAt(SQUARE, 16).phase).toBe("inhale");
    expect(phaseAt(SQUARE, 16.5).progress).toBeCloseTo(0.125, 3);
    expect(phaseAt(SQUARE, 160).phase).toBe("inhale");
  });

  it("skips zero-length phases entirely", () => {
    // No holds at all in this pattern — it must go straight to the exhale.
    expect(phaseAt(LONG_EXHALE, 0).phase).toBe("inhale");
    expect(phaseAt(LONG_EXHALE, 4).phase).toBe("exhale");
    expect(phaseAt(LONG_EXHALE, 11.9).phase).toBe("exhale");
    expect(phaseAt(LONG_EXHALE, 12).phase).toBe("inhale");
  });

  it("reports progress from 0 to 1 within a phase", () => {
    expect(phaseAt(SQUARE, 0).progress).toBe(0);
    expect(phaseAt(SQUARE, 2).progress).toBeCloseTo(0.5, 5);
    expect(phaseAt(SQUARE, 3.999).progress).toBeCloseTo(1, 2);
  });

  it("counts down the seconds remaining in the phase", () => {
    expect(phaseAt(SQUARE, 0).remaining).toBe(4);
    expect(phaseAt(SQUARE, 1).remaining).toBe(3);
    expect(phaseAt(SQUARE, 4).remaining).toBe(4); // start of the hold
  });

  it("survives a negative elapsed value without breaking", () => {
    const result = phaseAt(SQUARE, -1);
    expect(["inhale", "holdIn", "exhale", "holdOut"]).toContain(result.phase);
    expect(result.progress).toBeGreaterThanOrEqual(0);
  });

  it("does not divide by zero on an empty pattern", () => {
    const empty = { inhale: 0, holdIn: 0, exhale: 0, holdOut: 0, label: "" };
    expect(phaseAt(empty, 5).phase).toBe("inhale");
    expect(phaseAt(empty, 5).progress).toBe(0);
  });

  it("stays inside the cycle for every real practice", () => {
    for (const practice of PRACTICES) {
      const cycle = cycleSeconds(practice.pattern);
      for (let t = 0; t < cycle * 2; t += 0.25) {
        const { phase, progress } = phaseAt(practice.pattern, t);
        expect(["inhale", "holdIn", "exhale", "holdOut"]).toContain(phase);
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("scaleFor", () => {
  it("is smallest at the start of an inhale and largest at the top", () => {
    expect(scaleFor("inhale", 0)).toBeCloseTo(0.62, 5);
    expect(scaleFor("inhale", 1)).toBeCloseTo(1, 5);
    expect(scaleFor("holdIn", 0.5)).toBe(1);
    expect(scaleFor("exhale", 0)).toBeCloseTo(1, 5);
    expect(scaleFor("exhale", 1)).toBeCloseTo(0.62, 5);
    expect(scaleFor("holdOut", 0.5)).toBe(0.62);
  });

  it("never leaves the 0.62–1 range, whatever it is given", () => {
    for (const phase of ["inhale", "holdIn", "exhale", "holdOut"] as const) {
      for (const progress of [-1, 0, 0.5, 1, 2]) {
        const scale = scaleFor(phase, progress);
        expect(scale).toBeGreaterThanOrEqual(0.62);
        expect(scale).toBeLessThanOrEqual(1);
      }
    }
  });

  it("expands on the inhale and contracts on the exhale", () => {
    // The orb must never move the wrong way — this is the whole point of it.
    expect(scaleFor("inhale", 0.75)).toBeGreaterThan(scaleFor("inhale", 0.25));
    expect(scaleFor("exhale", 0.75)).toBeLessThan(scaleFor("exhale", 0.25));
  });
});
