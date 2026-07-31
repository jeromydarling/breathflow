import { newId } from "./ids";
import { one, run } from "./db.server";

/**
 * Email.
 *
 * Runs entirely dark without a key: every send is logged and skipped, and the
 * app stays fully usable. The moment RESEND_API_KEY is set as a Worker secret,
 * the same code starts delivering. Nothing else has to change.
 *
 * Sends are always fire-and-forget via ctx.waitUntil — nobody waits on our
 * mailer to see their practice screen.
 */

export type EmailTemplate =
  | "welcome"
  | "password-reset"
  | "password-changed"
  | "ask-confirmation"
  | "ask-relay"
  | "milestone"
  | "daily-reminder"
  | "self-test";

export type SendResult = {
  status: "sent" | "skipped_no_key" | "suppressed" | "failed";
  detail: string;
};

export type SendInput = {
  to: string;
  subject: string;
  /** Plain text is the source of truth; HTML is generated from it. */
  text: string;
  template: EmailTemplate;
  /** Where a human would actually answer. */
  replyTo?: string;
  /** Transactional mail (reset, receipts) skips the suppression check. */
  transactional?: boolean;
  /** Token that makes one-click unsubscribe work. */
  unsubscribeToken?: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function emailIsConfigured(env: Env): boolean {
  return Boolean(env.RESEND_API_KEY && env.FROM_EMAIL);
}

async function isSuppressed(env: Env, email: string): Promise<boolean> {
  const row = await one(
    env.DB,
    `SELECT 1 AS ok FROM email_suppressions WHERE email = ?`,
    email.toLowerCase(),
  );
  return row !== null;
}

export async function suppress(
  env: Env,
  email: string,
  reason: "unsubscribed" | "bounced" | "complained",
): Promise<void> {
  await run(
    env.DB,
    `INSERT INTO email_suppressions (email, reason, created_at) VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET reason = excluded.reason`,
    email.toLowerCase(),
    reason,
    Date.now(),
  );
}

export async function unsuppress(env: Env, email: string): Promise<void> {
  await run(
    env.DB,
    `DELETE FROM email_suppressions WHERE email = ?`,
    email.toLowerCase(),
  );
}

async function log(
  env: Env,
  to: string,
  template: EmailTemplate,
  result: SendResult,
): Promise<void> {
  try {
    await run(
      env.DB,
      `INSERT INTO email_log (id, to_email, template, status, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      newId("event"),
      to.toLowerCase(),
      template,
      result.status,
      result.detail.slice(0, 500),
      Date.now(),
    );
  } catch (error) {
    console.error("could not write email_log", error);
  }
}

export async function sendEmail(
  env: Env,
  input: SendInput,
): Promise<SendResult> {
  const to = input.to.trim().toLowerCase();

  if (!input.transactional && (await isSuppressed(env, to))) {
    const result: SendResult = {
      status: "suppressed",
      detail: "recipient is on the suppression list",
    };
    await log(env, to, input.template, result);
    return result;
  }

  if (!emailIsConfigured(env)) {
    // Dark mode: log the whole message so it is verifiable in development,
    // and so nothing is silently lost before the key lands.
    console.log(
      `[email:dark] to=${to} template=${input.template} subject=${input.subject}\n${input.text}`,
    );
    const result: SendResult = {
      status: "skipped_no_key",
      detail: "RESEND_API_KEY is not set — logged instead of sent",
    };
    await log(env, to, input.template, result);
    return result;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
  };

  const body: Record<string, unknown> = {
    from: env.FROM_EMAIL,
    to: [to],
    subject: input.subject,
    text: input.text,
    html: textToHtml(input.text),
    reply_to: input.replyTo ?? env.SUPPORT_EMAIL,
  };

  // One-click unsubscribe, the way mailbox providers want to see it.
  if (input.unsubscribeToken && !input.transactional) {
    const url = `${env.APP_URL}/api/unsubscribe?token=${input.unsubscribeToken}`;
    body.headers = {
      "List-Unsubscribe": `<${url}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // Surface the provider's verbatim error — the settings self-test button
      // shows this to the founder, and a paraphrase would waste their time.
      const detail = (await response.text()).slice(0, 500);
      const result: SendResult = {
        status: "failed",
        detail: `${response.status} ${detail}`,
      };
      await log(env, to, input.template, result);
      return result;
    }

    const result: SendResult = { status: "sent", detail: "" };
    await log(env, to, input.template, result);
    return result;
  } catch (error) {
    const result: SendResult = {
      status: "failed",
      detail: error instanceof Error ? error.message : String(error),
    };
    await log(env, to, input.template, result);
    return result;
  }
}

/** Minimal, deliberately boring HTML. Plain text is the real message. */
function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#9b623d">$1</a>',
  );

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;line-height:1.6;color:#171a18;max-width:34rem">
${linked
  .split("\n\n")
  .map((para) => `<p style="margin:0 0 1rem">${para.replace(/\n/g, "<br>")}</p>`)
  .join("\n")}
</div>`;
}

// ── Templates ──────────────────────────────────────────────────────────────
// Warm, plain, short. Never guilt, never false urgency, never a claim the
// practice can't back.

export function welcomeEmail(name: string, appUrl: string) {
  const first = name.trim().split(/\s+/)[0] || "there";
  return {
    subject: "Welcome home",
    text: `${first},

Your breath has been waiting for you.

BreathFLOW is a daily practice, not a library to get through. The whole thing works if you do one small session most days — three minutes counts, and it keeps your streak alive.

Start here: ${appUrl}/home

If you have five minutes rather than three, the Grand Rising Method is the ritual everything else is built around.

One honest note before you begin: conscious breathing can support relaxation, attention and emotional awareness. It doesn't diagnose, treat or cure anything, and it isn't a substitute for care you need. Practise seated or lying down, and never hold your breath in or near water.

Deep breath. Deep life.

— The BreathFLOW team`,
  };
}

export function passwordResetEmail(resetUrl: string) {
  return {
    subject: "Reset your BreathFLOW password",
    text: `Someone asked to reset the password for this address.

If that was you, here's the link:
${resetUrl}

It works once and expires in an hour.

If it wasn't you, you can ignore this — nothing has changed, and your account is fine.`,
  };
}

export function passwordChangedEmail(appUrl: string, supportEmail: string) {
  return {
    subject: "Your BreathFLOW password changed",
    text: `Your password was just changed, and every device that was signed in has been signed out.

If that was you, there's nothing to do.

If it wasn't, reset your password straight away at ${appUrl}/forgot and then write to ${supportEmail} so we can help.`,
  };
}

export function askConfirmationEmail(name: string, category: string) {
  const first = name.trim().split(/\s+/)[0] || "there";
  return {
    subject: "We've got your message",
    text: `${first},

Thank you — your message about ${category.toLowerCase()} reached us.

Bezz or the BreathFLOW team will reply as availability allows. We read everything, and we don't send automated answers.

One thing to be clear about: this isn't emergency or medical support. If something urgent is happening, please contact your local emergency services or a qualified professional.

— The BreathFLOW team`,
  };
}

export function askRelayEmail(input: {
  name: string;
  email: string;
  category: string;
  message: string;
}) {
  return {
    subject: `Ask Bezz — ${input.category} — ${input.name}`,
    text: `From: ${input.name} <${input.email}>
Category: ${input.category}

${input.message}

—
Reply directly to this email to answer them.`,
  };
}

export function milestoneEmail(opts: {
  name: string;
  headline: string;
  body: string;
  appUrl: string;
}) {
  const first = opts.name.trim().split(/\s+/)[0] || "there";
  return {
    subject: opts.headline,
    text: `${first},

${opts.body}

See it on your progress page: ${opts.appUrl}/progress

Deep breath. Deep life.`,
  };
}

export function dailyReminderEmail(opts: {
  name: string;
  line: string;
  appUrl: string;
}) {
  const first = opts.name.trim().split(/\s+/)[0] || "there";
  return {
    subject: opts.line,
    text: `${first},

${opts.line}

${opts.appUrl}/home

If you'd rather not get these, you can turn them off any time in settings — no hard feelings, and your practice is yours either way.`,
  };
}

/** Reminder lines from the brief. Rotated so it never feels like a robot. */
export const REMINDER_LINES = [
  "Your breath is waiting.",
  "Before the world asks anything of you, take a few minutes for your life force.",
  "Three conscious minutes can change the direction of this moment.",
  "Return to the body. Return to the breath. Return to yourself.",
  "Your streak is not a test. It is a relationship. Breathe today.",
] as const;

export function reminderLineFor(seed: number): string {
  return REMINDER_LINES[Math.abs(seed) % REMINDER_LINES.length]!;
}
