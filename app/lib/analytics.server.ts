import { newId } from "./ids";
import { run } from "./db.server";

/**
 * Analytics.
 *
 * Stored in our own D1, not shipped to a third party. The brief's metric plan
 * (§21) is the complete list of what we track, and nothing here records the
 * contents of a journal note or a session reflection — only that one exists.
 */

export const EVENTS = {
  onboardingStarted: "onboarding_started",
  onboardingCompleted: "onboarding_completed",
  signup: "signup",
  login: "login",
  practiceStarted: "practice_started",
  practiceCompleted: "practice_completed",
  practiceAbandoned: "practice_abandoned",
  stateCheckSubmitted: "state_check_submitted",
  reflectionWritten: "reflection_written",
  retentionLogged: "retention_logged",
  shareCardViewed: "share_card_viewed",
  shareCardShared: "share_card_shared",
  paywallViewed: "paywall_viewed",
  checkoutStarted: "checkout_started",
  subscriptionActivated: "subscription_activated",
  bookingClicked: "booking_clicked",
  askSubmitted: "ask_submitted",
  guideOpened: "guide_opened",
  notificationOptIn: "notification_opt_in",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export type TrackInput = {
  name: EventName;
  orgId?: string | null;
  userId?: string | null;
  props?: Record<string, string | number | boolean | null>;
};

/**
 * Never awaited on the request path — call through ctx.waitUntil. An analytics
 * write must never be the reason a practice screen is slow, or the reason a
 * request fails.
 */
export async function track(env: Env, input: TrackInput): Promise<void> {
  try {
    await run(
      env.DB,
      `INSERT INTO analytics_events (id, org_id, user_id, name, props, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      newId("event"),
      input.orgId ?? null,
      input.userId ?? null,
      input.name,
      JSON.stringify(input.props ?? {}),
      Date.now(),
    );
  } catch (error) {
    console.error("analytics write failed (ignored)", input.name, error);
  }
}

/** Fire-and-forget helper that keeps the call site to one line. */
export function trackAsync(
  ctx: ExecutionContext,
  env: Env,
  input: TrackInput,
): void {
  ctx.waitUntil(track(env, input));
}
