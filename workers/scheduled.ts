import { all, one, run } from "../app/lib/db.server";
import { sweepExpiredSessions } from "../app/lib/auth.server";
import {
  dailyReminderEmail,
  reminderLineFor,
  sendEmail,
} from "../app/lib/email.server";
import { localDay, localHour } from "../app/lib/time";
import { appUrl, appUrlIsConfigured } from "../app/lib/seo";
import { seedDemoAccount, wipeDemoAccount } from "../app/lib/demo.server";

/**
 * Cron work.
 *
 * Hourly:   send the one daily reminder to users whose chosen local hour it is.
 * Daily 4am UTC: reset the demo account and sweep expired sessions.
 */
export async function runScheduled(
  event: ScheduledController,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const isDaily = event.cron === "0 4 * * *";

  if (isDaily) {
    await Promise.allSettled([resetDemo(env), sweepExpiredSessions(env)]);
    return;
  }

  await sendDueReminders(env);
}

/**
 * One routine reminder per day, maximum. Never guilt-based, and skipped
 * entirely if the user has already practised today — the point is the
 * practice, not the notification.
 */
async function sendDueReminders(env: Env): Promise<void> {
  const now = Date.now();

  // Cron has no request to derive an origin from, so a reminder can only carry
  // a working link once APP_URL is set. Sending one with a broken link is
  // worse than not sending it, so we skip and say why.
  if (!appUrlIsConfigured(env)) {
    console.log(
      "[cron] skipping daily reminders — APP_URL is not set, so the link in the email would not work",
    );
    return;
  }

  const candidates = await all<{
    id: string;
    email: string;
    name: string;
    timezone: string;
    reminder_hour: number;
  }>(
    env.DB,
    `SELECT id, email, name, timezone, reminder_hour
       FROM users
      WHERE reminder_hour IS NOT NULL AND is_demo = 0`,
  );

  for (const user of candidates) {
    // Only the users for whom it is currently their chosen local hour.
    if (localHour(now, user.timezone) !== user.reminder_hour) continue;

    const today = localDay(now, user.timezone);

    const [practiced, alreadySent] = await Promise.all([
      one(
        env.DB,
        `SELECT 1 AS ok FROM practice_sessions
          WHERE user_id = ? AND local_day = ? AND status = 'completed' LIMIT 1`,
        user.id,
        today,
      ),
      one(
        env.DB,
        `SELECT 1 AS ok FROM email_log
          WHERE to_email = ? AND template = 'daily-reminder' AND created_at > ?
          LIMIT 1`,
        user.email.toLowerCase(),
        now - 20 * 3600_000,
      ),
    ]);

    if (practiced || alreadySent) continue;

    const seed = user.id.charCodeAt(user.id.length - 1) + new Date(now).getDate();
    const message = dailyReminderEmail({
      name: user.name,
      line: reminderLineFor(seed),
      appUrl: appUrl(env),
    });

    await sendEmail(env, {
      to: user.email,
      subject: message.subject,
      text: message.text,
      template: "daily-reminder",
      unsubscribeToken: user.id,
    });
  }
}

/**
 * The demo is the best sales tool we have, so it must never be broken or
 * empty. This wipes it back to a known-good seeded state every night, and
 * `ensureDemo` self-heals if it is ever found missing mid-day.
 */
async function resetDemo(env: Env): Promise<void> {
  try {
    await wipeDemoAccount(env);
    await seedDemoAccount(env);
  } catch (error) {
    console.error("demo reset failed", error);
  }
}

/** Exported so a settings page or a test can trigger a reset deliberately. */
export async function forceDemoReset(env: Env): Promise<void> {
  await resetDemo(env);
}

export { run };
