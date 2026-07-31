import { all, one, purgeOrg, run } from "./db.server";
import { newId } from "./ids";
import { hashPassword } from "./password.server";
import { addDays, localDay } from "./time";
import { lifeForceMinutesFor } from "./streaks";
import { getPractice, PRACTICES } from "~/content/practices";

/**
 * The seeded demo account.
 *
 * A demo that is empty, stale or broken is worse than no demo. So: it reseeds
 * itself nightly, it self-heals the moment anyone finds it missing, it is
 * exempt from every billing gate, and it never triggers a live outbound
 * integration — no emails, no Stripe calls, nothing that reaches a real person.
 */

export const DEMO_TIMEZONE = "America/Los_Angeles";
const DEMO_NAME = "Ari";

/** Deterministic: the same shape of history every single night. */
const DEMO_HISTORY: Array<{ daysAgo: number; slug: string; minutes: number }> = [
  { daysAgo: 0, slug: "grand-rising-method", minutes: 16 },
  { daysAgo: 1, slug: "grand-rising-method", minutes: 16 },
  { daysAgo: 1, slug: "evening-release", minutes: 12 },
  { daysAgo: 2, slug: "three-minute-return", minutes: 3 },
  { daysAgo: 3, slug: "grand-rising-method", minutes: 16 },
  { daysAgo: 4, slug: "flow-state-reset", minutes: 9 },
  { daysAgo: 5, slug: "grand-rising-method", minutes: 16 },
  { daysAgo: 6, slug: "anxiety-relief", minutes: 8 },
  { daysAgo: 7, slug: "grand-rising-method", minutes: 16 },
  { daysAgo: 8, slug: "breath-of-rapture", minutes: 40 },
  { daysAgo: 9, slug: "three-minute-return", minutes: 3 },
  { daysAgo: 10, slug: "grand-rising-method", minutes: 16 },
  { daysAgo: 11, slug: "inner-child", minutes: 16 },
  { daysAgo: 12, slug: "grand-rising-method", minutes: 16 },
  { daysAgo: 13, slug: "evening-release", minutes: 12 },
  { daysAgo: 15, slug: "grand-rising-method", minutes: 16 },
  { daysAgo: 16, slug: "grand-rising-method", minutes: 16 },
  { daysAgo: 17, slug: "three-minute-return", minutes: 3 },
  { daysAgo: 19, slug: "grand-rising-method", minutes: 16 },
  { daysAgo: 22, slug: "flow-state-reset", minutes: 9 },
  { daysAgo: 25, slug: "grand-rising-method", minutes: 16 },
  { daysAgo: 28, slug: "anxiety-relief", minutes: 8 },
];

const DEMO_RETENTIONS: Array<{ daysAgo: number; seconds: number; comfort: string }> =
  [
    { daysAgo: 27, seconds: 38, comfort: "comfortable" },
    { daysAgo: 21, seconds: 44, comfort: "comfortable" },
    { daysAgo: 16, seconds: 51, comfort: "edge" },
    { daysAgo: 11, seconds: 49, comfort: "comfortable" },
    { daysAgo: 6, seconds: 58, comfort: "edge" },
    { daysAgo: 2, seconds: 63, comfort: "comfortable" },
  ];

const DEMO_NOTES: Record<number, string> = {
  1: "Shoulders let go about halfway through. Didn't expect that.",
  8: "A lot came up. Glad I left the evening free.",
  13: "Fell asleep before the end, which I'm choosing to call a success.",
};

export function demoEmail(env: Env): string {
  return (env.DEMO_EMAIL || "demo@breathflow.app").toLowerCase();
}

export async function findDemoUser(
  env: Env,
): Promise<{ id: string; org_id: string } | null> {
  return one<{ id: string; org_id: string }>(
    env.DB,
    `SELECT id, org_id FROM users WHERE email = ? AND is_demo = 1`,
    demoEmail(env),
  );
}

export async function wipeDemoAccount(env: Env): Promise<void> {
  const demo = await findDemoUser(env);
  if (!demo) return;
  await purgeOrg(env.DB, demo.org_id);
}

/**
 * Build the demo from scratch. The password is random and never revealed —
 * `/demo` signs you in directly, so there is nothing to leak.
 */
export async function seedDemoAccount(env: Env): Promise<{ id: string; org_id: string }> {
  const now = Date.now();
  const email = demoEmail(env);
  const orgId = newId("org");
  const userId = newId("user");

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO orgs (id, name, kind, created_at) VALUES (?, ?, 'demo', ?)`,
    ).bind(orgId, "BreathFLOW demo", now - 40 * 86_400_000),
    env.DB.prepare(
      `INSERT INTO users
         (id, org_id, email, name, password_hash, role, timezone,
          intentions, experience_level, preferred_time, reminder_hour,
          safety_ack_at, onboarded_at, is_demo, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, 'owner', ?, ?, 'some', 'morning', NULL, ?, ?, 1, ?, ?)`,
    ).bind(
      userId,
      orgId,
      email,
      DEMO_NAME,
      // Random and discarded. Nobody logs in with a password here.
      await hashPassword(newId("session", 32)),
      DEMO_TIMEZONE,
      "calm,flow",
      now - 40 * 86_400_000,
      now - 40 * 86_400_000,
      now - 40 * 86_400_000,
      now,
    ),
    env.DB.prepare(
      `INSERT INTO subscriptions (id, org_id, user_id, plan, status, provider, created_at, updated_at)
       VALUES (?, ?, ?, 'annual', 'active', 'none', ?, ?)`,
    ).bind(newId("subscription"), orgId, userId, now, now),
  ]);

  const today = localDay(now, DEMO_TIMEZONE);

  const sessionStatements = DEMO_HISTORY.flatMap((entry) => {
    const practice = getPractice(entry.slug);
    if (!practice) return [];
    const day = addDays(today, -entry.daysAgo);
    const at = now - entry.daysAgo * 86_400_000;
    const elapsed = entry.minutes * 60;

    return [
      env.DB.prepare(
        `INSERT INTO practice_sessions
           (id, org_id, user_id, practice_slug, status, planned_seconds,
            elapsed_seconds, credited_minutes, local_day, state_check, note,
            started_at, completed_at, updated_at)
         VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        newId("practiceSession"),
        orgId,
        userId,
        entry.slug,
        practice.seconds,
        elapsed,
        lifeForceMinutesFor(elapsed),
        day,
        pickStateCheck(entry.daysAgo),
        DEMO_NOTES[entry.daysAgo] ?? null,
        at,
        at + elapsed * 1000,
        at + elapsed * 1000,
      ),
    ];
  });

  const retentionStatements = DEMO_RETENTIONS.map((entry) =>
    env.DB.prepare(
      `INSERT INTO retention_attempts
         (id, org_id, user_id, seconds, method, comfort, local_day, created_at)
       VALUES (?, ?, ?, ?, 'after_exhale', ?, ?, ?)`,
    ).bind(
      newId("retention"),
      orgId,
      userId,
      entry.seconds,
      entry.comfort,
      addDays(today, -entry.daysAgo),
      now - entry.daysAgo * 86_400_000,
    ),
  );

  // Batched into one round trip — a per-row insert loop would blow the
  // subrequest budget before it finished.
  await env.DB.batch([...sessionStatements, ...retentionStatements]);

  return { id: userId, org_id: orgId };
}

/**
 * Self-heal. Called on every /demo hit — if the account is missing or its
 * history has somehow emptied out, rebuild it before letting anyone in.
 */
export async function ensureDemoAccount(
  env: Env,
): Promise<{ id: string; org_id: string }> {
  const existing = await findDemoUser(env);
  if (!existing) return seedDemoAccount(env);

  const sessions = await one<{ n: number }>(
    env.DB,
    `SELECT COUNT(*) AS n FROM practice_sessions WHERE user_id = ?`,
    existing.id,
  );
  if ((sessions?.n ?? 0) > 0) return existing;

  await purgeOrg(env.DB, existing.org_id);
  return seedDemoAccount(env);
}

function pickStateCheck(daysAgo: number): string {
  const states = ["lighter", "grounded", "energized", "emotional", "processing"];
  return states[daysAgo % states.length]!;
}

/** Every practice slug the demo references. Pinned by a test. */
export function demoReferencedSlugs(): string[] {
  return [...new Set(DEMO_HISTORY.map((h) => h.slug))];
}

export { PRACTICES, all };
