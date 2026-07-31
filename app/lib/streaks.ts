import { addDays, dayRange, daysBetween, lastSevenDays } from "./time";

/**
 * Streak and Life Force Minute arithmetic. All pure, all tested.
 *
 * The brief is explicit that a streak is "a relationship, not a test" — so the
 * rules here are deliberately generous:
 *   • a streak counts calendar days, not completed programs;
 *   • any qualifying session preserves it, including a three-minute one;
 *   • today not having happened *yet* never breaks it.
 */

/** A session only has to be this long to count toward a streak. */
export const QUALIFYING_SECONDS = 150; // 2:30 — a Three-Minute Return counts

/**
 * Life Force Minutes: one minute of completed practice = one Life Force
 * Minute. We floor, so we never inflate someone's number, and we only credit
 * time actually spent — abandoning at 4:30 of a 16-minute session credits 4.
 */
export function lifeForceMinutesFor(elapsedSeconds: number): number {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return 0;
  return Math.floor(elapsedSeconds / 60);
}

export function isQualifying(elapsedSeconds: number): boolean {
  return elapsedSeconds >= QUALIFYING_SECONDS;
}

/**
 * Current streak, counting back from today.
 *
 * `practicedDays` is the set of local 'YYYY-MM-DD' days with at least one
 * qualifying session. If the user has not practised today yet, the streak is
 * measured from yesterday — an unfinished today is not a broken streak, it is
 * an open invitation.
 */
export function currentStreak(
  practicedDays: Iterable<string>,
  today: string,
): number {
  const days = practicedDays instanceof Set ? practicedDays : new Set(practicedDays);
  if (days.size === 0) return 0;

  let cursor = days.has(today) ? today : addDays(today, -1);
  if (!days.has(cursor)) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Longest run of consecutive practised days, ever. */
export function longestStreak(practicedDays: Iterable<string>): number {
  const sorted = [...new Set(practicedDays)].sort();
  if (sorted.length === 0) return 0;

  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (daysBetween(sorted[i - 1]!, sorted[i]!) === 1) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

/**
 * True when the user had a streak going and has now missed at least one full
 * day. This is what triggers the "Nothing is lost" copy — and only that. We
 * never show it to someone who simply hasn't practised yet today.
 */
export function streakJustBroke(
  practicedDays: Iterable<string>,
  today: string,
): boolean {
  const days = practicedDays instanceof Set ? practicedDays : new Set(practicedDays);
  if (days.has(today) || days.has(addDays(today, -1))) return false;
  return days.size > 0;
}

/** The seven-day ring on Home and Progress. Oldest first. */
export function weeklyRing(
  practicedDays: Iterable<string>,
  today: string,
): Array<{ day: string; practiced: boolean; isToday: boolean }> {
  const days = practicedDays instanceof Set ? practicedDays : new Set(practicedDays);
  return lastSevenDays(today).map((day) => ({
    day,
    practiced: days.has(day),
    isToday: day === today,
  }));
}

/** Practised days in the trailing 7 days, and the 7 before that. */
export function weekOverWeek(
  practicedDays: Iterable<string>,
  today: string,
): { thisWeek: number; lastWeek: number } {
  const days = practicedDays instanceof Set ? practicedDays : new Set(practicedDays);
  const count = (from: string, to: string) =>
    dayRange(from, to).filter((d) => days.has(d)).length;

  return {
    thisWeek: count(addDays(today, -6), today),
    lastWeek: count(addDays(today, -13), addDays(today, -7)),
  };
}

/** Milestones the brief asks us to celebrate. */
export const STREAK_MILESTONES = [
  3, 7, 14, 21, 30, 40, 60, 90, 180, 365,
] as const;

/** The milestone reached exactly today, if any. Used to offer a share card. */
export function streakMilestoneReached(streak: number): number | null {
  return STREAK_MILESTONES.includes(streak as (typeof STREAK_MILESTONES)[number])
    ? streak
    : null;
}
