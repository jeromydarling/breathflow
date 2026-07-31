/**
 * Achievements.
 *
 * "Gamification should encourage devotion, not addiction." So: no points that
 * decay, no loss framing, no achievement for sharing, and nothing that a
 * missed day can take away from you. Everything here is a record of something
 * you actually did.
 */

export type AchievementContext = {
  totalSessions: number;
  lifeForceMinutes: number;
  currentStreak: number;
  longestStreak: number;
  completedSlugs: ReadonlySet<string>;
  retentionCount: number;
  bestRetentionSeconds: number;
  previousBestRetentionSeconds: number;
  reflectionCount: number;
};

export type Achievement = {
  key: string;
  name: string;
  /** Earned-state copy. Warm, specific, never congratulatory mush. */
  description: string;
  /** Unearned-state hint. Never phrased as a demand. */
  hint: string;
  group: "beginning" | "consistency" | "minutes" | "journeys" | "retention";
  /** Milestones worth offering a share card for. */
  shareable: boolean;
  earned: (c: AchievementContext) => boolean;
};

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    key: "first-conscious-breath",
    name: "First Conscious Breath",
    description: "You sat down and began. Everything else follows this.",
    hint: "Complete your first practice.",
    group: "beginning",
    shareable: false,
    earned: (c) => c.totalSessions >= 1,
  },
  {
    key: "first-grand-rising",
    name: "First Grand Rising",
    description: "You gave the morning to yourself before you gave it away.",
    hint: "Complete the Grand Rising Method.",
    group: "beginning",
    shareable: true,
    earned: (c) => c.completedSlugs.has("grand-rising-method"),
  },
  {
    key: "seven-days-in-flow",
    name: "Seven Days in Flow",
    description: "A week of returning. This is where it stops being an effort.",
    hint: "Practise seven days in a row.",
    group: "consistency",
    shareable: true,
    earned: (c) => c.longestStreak >= 7,
  },
  {
    key: "twenty-one-days",
    name: "Twenty-One Days",
    description: "Three weeks. The practice is part of your day now.",
    hint: "Practise twenty-one days in a row.",
    group: "consistency",
    shareable: true,
    earned: (c) => c.longestStreak >= 21,
  },
  {
    key: "forty-day-practice",
    name: "Forty-Day Practice",
    description:
      "Forty consecutive days. In every tradition that counts days, this is the one that counts.",
    hint: "Practise forty days in a row.",
    group: "consistency",
    shareable: true,
    earned: (c) => c.longestStreak >= 40,
  },
  {
    key: "minutes-100",
    name: "100 Life Force Minutes",
    description: "A hundred minutes of your life, spent on being alive in it.",
    hint: "Cultivate 100 Life Force Minutes.",
    group: "minutes",
    shareable: true,
    earned: (c) => c.lifeForceMinutes >= 100,
  },
  {
    key: "minutes-500",
    name: "500 Life Force Minutes",
    description: "Eight hours of conscious breath. That is a real body of work.",
    hint: "Cultivate 500 Life Force Minutes.",
    group: "minutes",
    shareable: true,
    earned: (c) => c.lifeForceMinutes >= 500,
  },
  {
    key: "minutes-1000",
    name: "1,000 Life Force Minutes",
    description:
      "A thousand minutes. You are not trying the practice any more — you have one.",
    hint: "Cultivate 1,000 Life Force Minutes.",
    group: "minutes",
    shareable: true,
    earned: (c) => c.lifeForceMinutes >= 1000,
  },
  {
    key: "completed-rapture",
    name: "Breath of Rapture",
    description: "You went the whole forty minutes. Take your time coming back.",
    hint: "Complete the Breath of Rapture journey.",
    group: "journeys",
    shareable: true,
    earned: (c) => c.completedSlugs.has("breath-of-rapture"),
  },
  {
    key: "completed-inner-child",
    name: "Inner Child Journey",
    description: "You made room for something that had been waiting a while.",
    hint: "Complete the Inner Child visualization.",
    group: "journeys",
    shareable: false,
    earned: (c) => c.completedSlugs.has("inner-child"),
  },
  {
    key: "first-retention",
    name: "First Breath Retention",
    description: "You met the urge to breathe and stayed calm inside it.",
    hint: "Log your first breath retention.",
    group: "retention",
    shareable: false,
    earned: (c) => c.retentionCount >= 1,
  },
  {
    key: "retention-breakthrough",
    name: "Personal Retention Breakthrough",
    description:
      "A new personal best — reached comfortably, which is the only way it counts.",
    hint: "Beat your previous best retention.",
    group: "retention",
    shareable: true,
    earned: (c) =>
      c.previousBestRetentionSeconds > 0 &&
      c.bestRetentionSeconds > c.previousBestRetentionSeconds,
  },
  {
    key: "five-reflections",
    name: "Five Reflections",
    description:
      "Five times you told the truth about what you noticed. That is its own practice.",
    hint: "Write five session reflections.",
    group: "retention",
    shareable: false,
    earned: (c) => c.reflectionCount >= 5,
  },
] as const;

export const ACHIEVEMENT_BY_KEY = new Map(
  ACHIEVEMENTS.map((a) => [a.key, a]),
);

/** Keys newly earned given a context and what is already recorded. */
export function newlyEarned(
  context: AchievementContext,
  alreadyEarned: ReadonlySet<string>,
): Achievement[] {
  return ACHIEVEMENTS.filter(
    (a) => !alreadyEarned.has(a.key) && a.earned(context),
  );
}
