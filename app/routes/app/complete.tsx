import { useEffect, useState } from "react";
import { Form, Link, redirect } from "react-router";
import type { Route } from "./+types/complete";
import { runtimeFrom } from "~/lib/context";
import { appUrl } from "~/lib/seo";
import { safeFormData } from "~/lib/form.server";
import { requireOnboardedUser } from "~/lib/auth.server";
import { one, run } from "~/lib/db.server";
import { getPractice } from "~/content/practices";
import {
  grantAchievements,
  loadPracticeStats,
  loadRetentionStats,
} from "~/lib/stats.server";
import { lifeForceMinutesFor, streakMilestoneReached } from "~/lib/streaks";
import { levelCrossed, minuteMilestoneCrossed } from "~/lib/levels";
import { localDay } from "~/lib/time";
import { EVENTS, track } from "~/lib/analytics.server";
import { milestoneEmail, sendEmail } from "~/lib/email.server";
import { Button, Card } from "~/components/ui";
import { privateNoStore } from "~/lib/cache.server";

/**
 * Session completion.
 *
 * The order here is deliberate and comes straight from the brief: a quiet
 * moment first, then the metrics, then a one-tap state check, then an optional
 * note — and only after all of that, maybe, a share card. Nothing is asked of
 * someone who has just finished a forty-minute somatic journey until they have
 * had a beat to land.
 */

const STATE_CHECKS = [
  { value: "lighter", label: "Lighter" },
  { value: "grounded", label: "Grounded" },
  { value: "energized", label: "Energized" },
  { value: "emotional", label: "Emotional" },
  { value: "processing", label: "Still processing" },
] as const;

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env, ctx } = runtimeFrom(context);
  const user = await requireOnboardedUser(request, env);

  const practice = getPractice(params.slug);
  if (!practice) throw new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session") ?? "";
  const partial = url.searchParams.get("partial") === "1";

  const session = await one<{
    id: string;
    status: string;
    elapsed_seconds: number;
    credited_minutes: number;
    state_check: string | null;
    note: string | null;
  }>(
    env.DB,
    `SELECT id, status, elapsed_seconds, credited_minutes, state_check, note
       FROM practice_sessions WHERE id = ? AND user_id = ?`,
    sessionId,
    user.id,
  );
  if (!session) throw redirect("/home");

  // Life Force Minutes before this session is banked, so we can tell whether a
  // milestone was crossed *by* this session.
  const before = await loadPracticeStats(env, user);

  // Bank the session exactly once. Re-visiting this URL must not re-credit it.
  if (session.status === "in_progress") {
    const now = Date.now();
    const elapsed = Math.min(
      practice.seconds,
      Math.max(session.elapsed_seconds, Number(url.searchParams.get("elapsed") ?? 0)),
    );
    await run(
      env.DB,
      `UPDATE practice_sessions
          SET status = 'completed', elapsed_seconds = ?, credited_minutes = ?,
              local_day = ?, completed_at = ?, updated_at = ?
        WHERE id = ? AND user_id = ? AND status = 'in_progress'`,
      Math.floor(elapsed),
      lifeForceMinutesFor(elapsed),
      localDay(now, user.timezone),
      now,
      now,
      sessionId,
      user.id,
    );
    ctx.waitUntil(
      track(env, {
        name: EVENTS.practiceCompleted,
        orgId: user.org_id,
        userId: user.id,
        props: {
          slug: practice.slug,
          minutes: lifeForceMinutesFor(elapsed),
          partial,
        },
      }),
    );
  }

  // Recompute after banking.
  const [after, retention] = await Promise.all([
    loadPracticeStats(env, user),
    loadRetentionStats(env, user.id),
  ]);

  const earned = await grantAchievements(
    env,
    user,
    {
      totalSessions: after.totalSessions,
      lifeForceMinutes: after.lifeForceMinutes,
      currentStreak: after.currentStreak,
      longestStreak: after.longestStreak,
      completedSlugs: new Set(after.completedSlugs),
      retentionCount: retention.count,
      bestRetentionSeconds: retention.best,
      previousBestRetentionSeconds: retention.best,
      reflectionCount: after.reflectionCount,
    },
  );

  const minuteMilestone = minuteMilestoneCrossed(
    before.lifeForceMinutes,
    after.lifeForceMinutes,
  );
  const streakMilestone =
    after.currentStreak > before.currentStreak
      ? streakMilestoneReached(after.currentStreak)
      : null;
  const newLevel = levelCrossed(before.lifeForceMinutes, after.lifeForceMinutes);

  // A milestone note by email — never for an ordinary session, and never to
  // the demo account, which must not trigger outbound anything.
  if ((minuteMilestone || streakMilestone) && user.is_demo === 0) {
    const headline = minuteMilestone
      ? `You have cultivated ${minuteMilestone.toLocaleString()} Life Force Minutes`
      : `${streakMilestone} days in flow`;
    const body = minuteMilestone
      ? `That is ${minuteMilestone.toLocaleString()} minutes of your life spent being alive in it. Keep going gently.`
      : `${streakMilestone} consecutive days of returning to your breath. That is a relationship now, not an experiment.`;
    const message = milestoneEmail({
      name: user.name,
      headline,
      body,
      appUrl: appUrl(env, request),
    });
    ctx.waitUntil(
      sendEmail(env, {
        to: user.email,
        subject: message.subject,
        text: message.text,
        template: "milestone",
        unsubscribeToken: user.id,
      }),
    );
  }

  return {
    partial,
    sessionId,
    practice: { slug: practice.slug, title: practice.title },
    minutes: after.lifeForceMinutes,
    creditedThisSession: lifeForceMinutesFor(session.elapsed_seconds),
    streak: after.currentStreak,
    stateCheck: session.state_check,
    note: session.note,
    earned,
    milestone: minuteMilestone
      ? { kind: "minutes" as const, value: minuteMilestone }
      : streakMilestone
        ? { kind: "streak" as const, value: streakMilestone }
        : newLevel
          ? { kind: "level" as const, value: newLevel.name }
          : null,
    newLevel: newLevel ? { name: newLevel.name, blessing: newLevel.blessing } : null,
    nextUp: suggestNext(practice.slug),
  };
}

export function headers() {
  return privateNoStore();
}

export function meta() {
  return [
    { title: "You returned to your breath · BreathFLOW" },
    { name: "robots", content: "noindex" },
  ];
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env, ctx } = runtimeFrom(context);
  const user = await requireOnboardedUser(request, env);
  const form = await safeFormData(request);

  const sessionId = String(form.get("sessionId") ?? "");
  const stateCheck = String(form.get("stateCheck") ?? "").trim();
  const note = String(form.get("note") ?? "").trim().slice(0, 2000);

  const valid = STATE_CHECKS.some((s) => s.value === stateCheck);

  await run(
    env.DB,
    `UPDATE practice_sessions
        SET state_check = COALESCE(?, state_check),
            note = COALESCE(NULLIF(?, ''), note),
            updated_at = ?
      WHERE id = ? AND user_id = ?`,
    valid ? stateCheck : null,
    note,
    Date.now(),
    sessionId,
    user.id,
  );

  ctx.waitUntil(
    Promise.all([
      valid
        ? track(env, {
            name: EVENTS.stateCheckSubmitted,
            orgId: user.org_id,
            userId: user.id,
            props: { state: stateCheck },
          })
        : Promise.resolve(),
      note
        ? track(env, {
            name: EVENTS.reflectionWritten,
            orgId: user.org_id,
            userId: user.id,
            // The note itself is never recorded in analytics. Only that it exists.
            props: { length: note.length },
          })
        : Promise.resolve(),
    ]),
  );

  return { saved: true };
}

function suggestNext(slug: string): { slug: string; title: string; note: string } {
  // Never push another long session immediately after a deep one.
  if (slug === "breath-of-rapture" || slug === "inner-child") {
    return {
      slug: "integration",
      title: "Read: integration after a deep journey",
      note: "Give yourself twenty minutes before the next thing.",
    };
  }
  if (slug === "grand-rising-method") {
    return {
      slug: "three-minute-return",
      title: "The Three-Minute Return",
      note: "For later today, if you want a second moment.",
    };
  }
  return {
    slug: "grand-rising-method",
    title: "The Grand Rising Method",
    note: "Tomorrow morning, before the world asks anything of you.",
  };
}

export default function Complete({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const {
    partial,
    sessionId,
    minutes,
    creditedThisSession,
    streak,
    earned,
    milestone,
    newLevel,
    nextUp,
    stateCheck,
  } = loaderData;

  // The quiet moment. Metrics do not appear for five seconds — or until the
  // user asks for them.
  const [settled, setSettled] = useState(false);
  const [reflected, setReflected] = useState(Boolean(stateCheck));

  useEffect(() => {
    const id = window.setTimeout(() => setSettled(true), 5000);
    return () => window.clearTimeout(id);
  }, []);

  if (!settled) {
    return (
      <main className="bf-still flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <div
          aria-hidden="true"
          className="bf-orb-motion h-32 w-32 rounded-full bg-[radial-gradient(circle_at_38%_32%,rgba(244,239,229,0.85)_0%,var(--color-amber)_45%,transparent_72%)]"
          style={{ animation: "bf-breathe 9s var(--ease-breath) infinite" }}
        />
        <p className="mt-12 font-serif text-3xl text-[var(--color-bone)]">
          You returned to your breath.
        </p>
        <button
          type="button"
          onClick={() => setSettled(true)}
          className="mt-10 text-sm text-[var(--color-bone-faint)] underline underline-offset-4"
        >
          Continue
        </button>
      </main>
    );
  }

  return (
    <main className="bf-still min-h-dvh px-6 py-12">
      <div className="mx-auto max-w-md space-y-6">
        <header className="text-center">
          <p className="font-serif text-3xl text-[var(--color-bone)]">
            You returned to your breath.
          </p>
          {partial ? (
            <p className="mt-3 text-sm text-[var(--color-bone-muted)]">
              You stopped early, and the time still counts. That is how this
              works.
            </p>
          ) : null}
        </header>

        <Card className="text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-bone-faint)]">
            Life Force Minutes
          </p>
          <p className="mt-2 font-serif text-5xl text-[var(--color-bone)] tabular-nums">
            {minutes.toLocaleString()}
          </p>
          <p className="mt-2 text-sm text-[var(--color-bone-muted)]">
            +{creditedThisSession} today · {streak}-day streak
          </p>
        </Card>

        {newLevel ? (
          <Card className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-bone-faint)]">
              You&rsquo;ve reached
            </p>
            <p className="mt-2 font-serif text-3xl text-[var(--color-bone)]">
              {newLevel.name}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-bone-muted)]">
              {newLevel.blessing}
            </p>
          </Card>
        ) : null}

        {earned.length > 0 ? (
          <Card>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-bone-faint)]">
              {earned.length === 1 ? "A new marker" : "New markers"}
            </p>
            <ul className="mt-3 space-y-3">
              {earned.map((achievement) => (
                <li key={achievement.key}>
                  <p className="text-[var(--color-bone)]">{achievement.name}</p>
                  <p className="mt-0.5 text-sm text-[var(--color-bone-muted)]">
                    {achievement.description}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {/* One-tap state check, then an optional note. */}
        {reflected || actionData?.saved ? (
          <Card className="text-center">
            <p className="text-sm text-[var(--color-bone-muted)]">
              Noted. Thank you for telling the truth about it.
            </p>
          </Card>
        ) : (
          <Form method="post" className="space-y-5">
            <input type="hidden" name="sessionId" value={sessionId} />

            <fieldset>
              <legend className="text-sm text-[var(--color-bone-muted)]">
                How do you feel right now?
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {STATE_CHECKS.map((state) => (
                  <label
                    key={state.value}
                    className="cursor-pointer rounded-full border border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)] px-4 py-2.5 text-sm text-[var(--color-bone-muted)] transition has-[:checked]:border-[var(--color-amber-bright)] has-[:checked]:bg-[color-mix(in_oklab,var(--color-amber)_18%,transparent)] has-[:checked]:text-[var(--color-bone)]"
                  >
                    <input
                      type="radio"
                      name="stateCheck"
                      value={state.value}
                      className="sr-only"
                    />
                    {state.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label
                htmlFor="note"
                className="block text-sm text-[var(--color-bone-muted)]"
              >
                What are you noticing? <span className="text-[var(--color-bone-faint)]">(optional)</span>
              </label>
              <textarea
                id="note"
                name="note"
                rows={3}
                placeholder="Write badly. It counts."
                className="mt-2 w-full rounded-xl border border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)] bg-[color-mix(in_oklab,var(--color-bone)_6%,transparent)] px-4 py-3 text-[var(--color-bone)] placeholder:text-[var(--color-bone-faint)]"
              />
              <p className="mt-2 text-xs text-[var(--color-bone-faint)]">
                Private to you. Never shown on a share card.
              </p>
            </div>

            <div className="space-y-2">
              <Button type="submit" size="lg" className="w-full">
                Save
              </Button>
              <button
                type="button"
                onClick={() => setReflected(true)}
                className="w-full py-2 text-sm text-[var(--color-bone-faint)] underline underline-offset-4"
              >
                Not right now
              </button>
            </div>
          </Form>
        )}

        {/* The share card is offered only after the reflection, and only at a
            genuine milestone — never after every session. */}
        {milestone && (reflected || actionData?.saved) ? (
          <Card className="text-center">
            <p className="font-serif text-xl text-[var(--color-bone)]">
              {milestone.kind === "streak"
                ? `${milestone.value} days in flow`
                : milestone.kind === "minutes"
                  ? `${milestone.value.toLocaleString()} Life Force Minutes`
                  : `${milestone.value}`}
            </p>
            <p className="mt-2 text-sm text-[var(--color-bone-muted)]">
              Worth marking, if you feel like it.
            </p>
            <Button
              to={`/progress/share/${milestone.kind}`}
              variant="ghost"
              className="mt-4"
            >
              Make a share card
            </Button>
          </Card>
        ) : null}

        <Card>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-bone-faint)]">
            When you&rsquo;re ready
          </p>
          <p className="mt-2 text-[var(--color-bone)]">{nextUp.title}</p>
          <p className="mt-1 text-sm text-[var(--color-bone-muted)]">
            {nextUp.note}
          </p>
        </Card>

        <Link
          to="/home"
          className="block py-4 text-center text-sm text-[var(--color-bone-muted)] underline underline-offset-4"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
