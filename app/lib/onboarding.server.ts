import { run } from "./db.server";
import {
  isValidExperience,
  isValidPracticeTime,
  reminderHourFor,
  sanitizeIntentions,
} from "./onboarding";

/**
 * The onboarding draft.
 *
 * Steps 4–7 happen before there is an account to write to, so the answers ride
 * along in a small cookie until a user exists. Nothing sensitive lives here —
 * an intention, an experience level, a preferred time of day — so a plain
 * cookie is the honest amount of machinery. It is cleared the moment the
 * answers are applied.
 */

const DRAFT_COOKIE = "bf_onboarding";

export type OnboardingDraft = {
  intentions?: string;
  experience?: string;
  practiceTime?: string;
  safetyAck?: boolean;
};

export function readDraft(request: Request): OnboardingDraft {
  const header = request.headers.get("cookie");
  if (!header) return {};

  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== DRAFT_COOKIE) continue;
    try {
      const parsed = JSON.parse(decodeURIComponent(rest.join("=")));
      return typeof parsed === "object" && parsed ? (parsed as OnboardingDraft) : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function writeDraft(draft: OnboardingDraft): string {
  const value = encodeURIComponent(JSON.stringify(draft));
  // Session cookie (no Max-Age) — it should not outlive the sitting.
  return `${DRAFT_COOKIE}=${value}; Path=/; SameSite=Lax; Secure`;
}

export function clearDraft(): string {
  return `${DRAFT_COOKIE}=; Path=/; SameSite=Lax; Secure; Max-Age=0`;
}

export function mergeDraft(
  current: OnboardingDraft,
  form: FormData,
): OnboardingDraft {
  const next: OnboardingDraft = { ...current };

  if (form.has("intention")) {
    next.intentions = sanitizeIntentions(form.getAll("intention").map(String));
  }
  const experience = form.get("experience");
  if (typeof experience === "string" && isValidExperience(experience)) {
    next.experience = experience;
  }
  const practiceTime = form.get("practiceTime");
  if (typeof practiceTime === "string" && isValidPracticeTime(practiceTime)) {
    next.practiceTime = practiceTime;
  }
  if (form.has("safetyAck")) {
    next.safetyAck = form.get("safetyAck") === "yes";
  }

  return next;
}

/**
 * Write the draft's answers onto a real user.
 *
 * Deliberately does NOT mark the user onboarded — that is a separate step, so
 * that someone who wanders back to change an answer mid-flow is not silently
 * marked as finished before they reach the final screen. Idempotent.
 */
export async function applyDraft(
  env: Env,
  userId: string,
  draft: OnboardingDraft,
  options: { markOnboarded?: boolean; timezone?: string } = {},
): Promise<void> {
  const now = Date.now();
  const reminderHour = draft.practiceTime
    ? reminderHourFor(draft.practiceTime)
    : null;

  await run(
    env.DB,
    `UPDATE users
        SET intentions       = COALESCE(NULLIF(?, ''), intentions),
            experience_level = COALESCE(?, experience_level),
            preferred_time   = COALESCE(?, preferred_time),
            reminder_hour    = COALESCE(?, reminder_hour),
            safety_ack_at    = COALESCE(safety_ack_at, ?),
            timezone         = COALESCE(NULLIF(?, ''), timezone),
            onboarded_at     = CASE WHEN ? = 1
                                    THEN COALESCE(onboarded_at, ?)
                                    ELSE onboarded_at END
      WHERE id = ?`,
    draft.intentions ?? "",
    draft.experience ?? null,
    draft.practiceTime ?? null,
    reminderHour,
    draft.safetyAck ? now : null,
    options.timezone ?? "",
    options.markOnboarded ? 1 : 0,
    now,
    userId,
  );
}
