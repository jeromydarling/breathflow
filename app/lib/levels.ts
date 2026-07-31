/**
 * Life Force levels (brief §10.2).
 *
 * The language is elemental and about growth, never competition — there is no
 * leaderboard and there never will be in V1. Thresholds are explicitly
 * placeholders in the brief; they live here alone so tuning them is a one-line
 * change with a test that tells you what moved.
 */
export type Level = {
  key: string;
  name: string;
  /** Life Force Minutes required to reach this level. */
  minutes: number;
  /** One warm line shown when the level is reached. */
  blessing: string;
  gradient: "bf-still" | "bf-night" | "bf-dawn" | "bf-ember";
};

export const LEVELS: readonly Level[] = [
  {
    key: "seed",
    name: "Seed",
    minutes: 0,
    blessing: "You took a first conscious breath. That is the whole beginning.",
    gradient: "bf-still",
  },
  {
    key: "sprout",
    name: "Sprout",
    minutes: 60,
    blessing: "An hour of your life, given back to your body.",
    gradient: "bf-night",
  },
  {
    key: "river",
    name: "River",
    minutes: 300,
    blessing: "The practice is moving on its own now. Let it carry you.",
    gradient: "bf-night",
  },
  {
    key: "flame",
    name: "Flame",
    minutes: 750,
    blessing: "Something in you is lit and staying lit.",
    gradient: "bf-ember",
  },
  {
    key: "mountain",
    name: "Mountain",
    minutes: 1500,
    blessing: "Steady, unhurried, hard to move. This is what devotion builds.",
    gradient: "bf-ember",
  },
  {
    key: "radiance",
    name: "Radiance",
    minutes: 3000,
    blessing: "What you cultivated is reaching the people around you.",
    gradient: "bf-dawn",
  },
  {
    key: "breath-keeper",
    name: "Breath Keeper",
    minutes: 6000,
    blessing: "You carry the practice for others now, simply by living it.",
    gradient: "bf-dawn",
  },
] as const;

export function levelFor(lifeForceMinutes: number): Level {
  const minutes = Math.max(0, lifeForceMinutes);
  let current = LEVELS[0]!;
  for (const level of LEVELS) {
    if (minutes >= level.minutes) current = level;
    else break;
  }
  return current;
}

export function nextLevelFor(lifeForceMinutes: number): Level | null {
  const minutes = Math.max(0, lifeForceMinutes);
  return LEVELS.find((l) => l.minutes > minutes) ?? null;
}

/** 0–1 progress toward the next level. Returns 1 at the final level. */
export function levelProgress(lifeForceMinutes: number): number {
  const minutes = Math.max(0, lifeForceMinutes);
  const current = levelFor(minutes);
  const next = nextLevelFor(minutes);
  if (!next) return 1;
  const span = next.minutes - current.minutes;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (minutes - current.minutes) / span));
}

/** Life Force Minute milestones worth offering a share card for. */
export const MINUTE_MILESTONES = [
  100, 500, 1000, 2500, 5000, 10_000,
] as const;

export function minuteMilestoneCrossed(
  before: number,
  after: number,
): number | null {
  for (const milestone of MINUTE_MILESTONES) {
    if (before < milestone && after >= milestone) return milestone;
  }
  return null;
}

export function levelCrossed(before: number, after: number): Level | null {
  const from = levelFor(before);
  const to = levelFor(after);
  return from.key === to.key ? null : to;
}
