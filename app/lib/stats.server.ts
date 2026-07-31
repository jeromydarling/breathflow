import { all, batch, one, run } from "./db.server";
import { newId } from "./ids";
import {
  currentStreak,
  longestStreak,
  streakJustBroke,
  weekOverWeek,
  weeklyRing,
} from "./streaks";
import { levelFor, levelProgress, nextLevelFor } from "./levels";
import { localDay } from "./time";
import {
  type AchievementContext,
  ACHIEVEMENT_BY_KEY,
  newlyEarned,
} from "~/content/achievements";

/**
 * Everything the Home and Progress screens need, in as few round trips as
 * possible. Independent reads always go through Promise.all — a loader that
 * serialises four D1 queries is four times slower for no reason.
 */

export type PracticeStats = {
  today: string;
  practicedDays: string[];
  practicedToday: boolean;
  lifeForceMinutes: number;
  totalSessions: number;
  currentStreak: number;
  longestStreak: number;
  justBrokeStreak: boolean;
  weeklyRing: ReturnType<typeof weeklyRing>;
  weekOverWeek: ReturnType<typeof weekOverWeek>;
  completedSlugs: string[];
  reflectionCount: number;
  level: ReturnType<typeof levelFor>;
  nextLevel: ReturnType<typeof nextLevelFor>;
  levelProgress: number;
};

export type RetentionStats = {
  attempts: Array<{ seconds: number; created_at: number; comfort: string | null }>;
  best: number;
  recentAverage: number;
  count: number;
};

export async function loadPracticeStats(
  env: Env,
  user: { id: string; timezone: string },
  now = Date.now(),
): Promise<PracticeStats> {
  const today = localDay(now, user.timezone);

  const [dayRows, totals, slugRows, reflections] = await Promise.all([
    // Distinct qualifying days. Bounded to ~14 months, which is all any of the
    // visualisations need and keeps the read small forever.
    all<{ local_day: string }>(
      env.DB,
      `SELECT DISTINCT local_day FROM practice_sessions
        WHERE user_id = ? AND status = 'completed' AND local_day IS NOT NULL
          AND local_day >= ?
        ORDER BY local_day`,
      user.id,
      shiftDay(today, -400),
    ),
    one<{ minutes: number; sessions: number }>(
      env.DB,
      `SELECT COALESCE(SUM(credited_minutes), 0) AS minutes,
              COUNT(*) AS sessions
         FROM practice_sessions
        WHERE user_id = ? AND status = 'completed'`,
      user.id,
    ),
    all<{ practice_slug: string }>(
      env.DB,
      `SELECT DISTINCT practice_slug FROM practice_sessions
        WHERE user_id = ? AND status = 'completed'`,
      user.id,
    ),
    one<{ n: number }>(
      env.DB,
      `SELECT COUNT(*) AS n FROM practice_sessions
        WHERE user_id = ? AND note IS NOT NULL AND TRIM(note) != ''`,
      user.id,
    ),
  ]);

  const practicedDays = dayRows.map((r) => r.local_day);
  const daySet = new Set(practicedDays);
  const lifeForceMinutes = totals?.minutes ?? 0;

  return {
    today,
    practicedDays,
    practicedToday: daySet.has(today),
    lifeForceMinutes,
    totalSessions: totals?.sessions ?? 0,
    currentStreak: currentStreak(daySet, today),
    longestStreak: longestStreak(daySet),
    justBrokeStreak: streakJustBroke(daySet, today),
    weeklyRing: weeklyRing(daySet, today),
    weekOverWeek: weekOverWeek(daySet, today),
    completedSlugs: slugRows.map((r) => r.practice_slug),
    reflectionCount: reflections?.n ?? 0,
    level: levelFor(lifeForceMinutes),
    nextLevel: nextLevelFor(lifeForceMinutes),
    levelProgress: levelProgress(lifeForceMinutes),
  };
}

export async function loadRetentionStats(
  env: Env,
  userId: string,
): Promise<RetentionStats> {
  const [attempts, aggregate] = await Promise.all([
    all<{ seconds: number; created_at: number; comfort: string | null }>(
      env.DB,
      `SELECT seconds, created_at, comfort FROM retention_attempts
        WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`,
      userId,
    ),
    one<{ best: number; n: number }>(
      env.DB,
      `SELECT COALESCE(MAX(seconds), 0) AS best, COUNT(*) AS n
         FROM retention_attempts WHERE user_id = ?`,
      userId,
    ),
  ]);

  const recent = attempts.slice(0, 5);
  const recentAverage = recent.length
    ? Math.round(recent.reduce((sum, a) => sum + a.seconds, 0) / recent.length)
    : 0;

  return {
    // Oldest first, so the graph reads left to right like time does.
    attempts: [...attempts].reverse(),
    best: aggregate?.best ?? 0,
    recentAverage,
    count: aggregate?.n ?? 0,
  };
}

/**
 * Evaluate achievements and persist anything newly earned.
 * Returns only what was earned *this time*, so the UI can celebrate once.
 */
export async function grantAchievements(
  env: Env,
  user: { id: string; org_id: string },
  context: AchievementContext,
): Promise<Array<{ key: string; name: string; description: string; shareable: boolean }>> {
  const existing = await all<{ key: string }>(
    env.DB,
    `SELECT key FROM achievements WHERE user_id = ?`,
    user.id,
  );
  const already = new Set(existing.map((r) => r.key));
  const fresh = newlyEarned(context, already);
  if (fresh.length === 0) return [];

  const now = Date.now();
  await batch(
    env.DB,
    fresh.map((achievement) =>
      env.DB.prepare(
        `INSERT INTO achievements (id, org_id, user_id, key, earned_at, meta)
         VALUES (?, ?, ?, ?, ?, '{}')
         ON CONFLICT(user_id, key) DO NOTHING`,
      ).bind(newId("achievement"), user.org_id, user.id, achievement.key, now),
    ),
  );

  return fresh.map((a) => ({
    key: a.key,
    name: a.name,
    description: a.description,
    shareable: a.shareable,
  }));
}

export async function loadEarnedAchievements(
  env: Env,
  userId: string,
): Promise<Array<{ key: string; name: string; description: string; earnedAt: number; shareable: boolean }>> {
  const rows = await all<{ key: string; earned_at: number }>(
    env.DB,
    `SELECT key, earned_at FROM achievements WHERE user_id = ? ORDER BY earned_at DESC`,
    userId,
  );
  return rows.flatMap((row) => {
    const definition = ACHIEVEMENT_BY_KEY.get(row.key);
    if (!definition) return [];
    return [
      {
        key: row.key,
        name: definition.name,
        description: definition.description,
        earnedAt: row.earned_at,
        shareable: definition.shareable,
      },
    ];
  });
}

/**
 * Find-or-create a contact from an event, merging the role.
 *
 * The founder should never have to hand-enter someone the system already saw —
 * a signup, a 1:1 enquiry and a retreat question about the same person all
 * land on one row with three roles.
 */
export async function upsertContact(
  env: Env,
  opts: {
    orgId: string;
    email: string;
    name?: string;
    role: string;
    source?: string;
  },
): Promise<void> {
  const email = opts.email.trim().toLowerCase();
  const now = Date.now();

  const existing = await one<{ id: string; roles: string; name: string }>(
    env.DB,
    `SELECT id, roles, name FROM contacts WHERE org_id = ? AND email = ?`,
    opts.orgId,
    email,
  );

  if (!existing) {
    await run(
      env.DB,
      `INSERT INTO contacts (id, org_id, email, name, roles, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      newId("contact"),
      opts.orgId,
      email,
      (opts.name ?? "").trim(),
      opts.role,
      opts.source ?? "",
      now,
      now,
    );
    return;
  }

  const roles = new Set(existing.roles.split(",").filter(Boolean));
  roles.add(opts.role);

  await run(
    env.DB,
    `UPDATE contacts SET roles = ?, name = ?, updated_at = ? WHERE id = ?`,
    [...roles].sort().join(","),
    existing.name || (opts.name ?? "").trim(),
    now,
    existing.id,
  );
}

function shiftDay(day: string, delta: number): string {
  const base = Date.parse(`${day}T00:00:00Z`);
  return new Date(base + delta * 86_400_000).toISOString().slice(0, 10);
}
