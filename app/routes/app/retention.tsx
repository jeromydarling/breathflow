import { useEffect, useRef, useState } from "react";
import { Form, Link, data } from "react-router";
import type { Route } from "./+types/retention";
import { runtimeFrom } from "~/lib/context";
import { safeFormData } from "~/lib/form.server";
import { requireOnboardedUser } from "~/lib/auth.server";
import { run } from "~/lib/db.server";
import { newId } from "~/lib/ids";
import { loadRetentionStats, grantAchievements, loadPracticeStats } from "~/lib/stats.server";
import { consume, peek } from "~/lib/ratelimit.server";
import { EVENTS, track } from "~/lib/analytics.server";
import { localDay } from "~/lib/time";
import { Button, Card, SectionHeading } from "~/components/ui";
import { RetentionGraph } from "~/components/RetentionGraph";
import { privateNoStore } from "~/lib/cache.server";

/**
 * The breath-retention tracker.
 *
 * Safety takes priority over performance, every time. There is no countdown,
 * no target, no comparison to anyone else, and the acknowledgment screen
 * cannot be skipped on a first visit.
 *
 * Launching with one standardized method (hold after a comfortable exhale)
 * because the brief says only to offer the inhale/exhale choice once the
 * practice has taught the distinction — and V1 hasn't.
 */

const MAX_SECONDS = 15 * 60; // a sanity clamp, not a target

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = runtimeFrom(context);
  const user = await requireOnboardedUser(request, env);
  const retention = await loadRetentionStats(env, user.id);

  return {
    best: retention.best,
    recentAverage: retention.recentAverage,
    count: retention.count,
    points: retention.attempts.map((a) => ({
      seconds: a.seconds,
      at: a.created_at,
    })),
    // Someone who has never logged a hold always reads the safety screen.
    mustAcknowledge: retention.count === 0,
  };
}

export function headers() {
  return privateNoStore();
}

export function meta() {
  return [
    { title: "Breath retention · BreathFLOW" },
    { name: "robots", content: "noindex" },
  ];
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env, ctx } = runtimeFrom(context);
  const user = await requireOnboardedUser(request, env);
  const form = await safeFormData(request);

  const seconds = Math.round(Number(form.get("seconds") ?? 0));
  const comfort = String(form.get("comfort") ?? "").trim();
  const note = String(form.get("note") ?? "").trim().slice(0, 500);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return data({ error: "That hold didn't record. Mind trying once more?" }, { status: 400 });
  }
  if (seconds > MAX_SECONDS) {
    return data(
      {
        error:
          "That is longer than we can record, and longer than anyone should be holding unsupervised. Please practise comfortably.",
      },
      { status: 400 },
    );
  }

  const gate = await peek(env.KV, "retention", user.id);
  if (!gate.allowed) {
    return data(
      { error: "That is a lot of holds in a short time. Rest a while first." },
      { status: 429 },
    );
  }
  await consume(env.KV, "retention", user.id);

  const previous = await loadRetentionStats(env, user.id);
  const now = Date.now();

  await run(
    env.DB,
    `INSERT INTO retention_attempts
       (id, org_id, user_id, seconds, method, comfort, note, local_day, created_at)
     VALUES (?, ?, ?, ?, 'after_exhale', ?, ?, ?, ?)`,
    newId("retention"),
    user.org_id,
    user.id,
    seconds,
    ["comfortable", "edge", "strained"].includes(comfort) ? comfort : null,
    note || null,
    localDay(now, user.timezone),
    now,
  );

  const [stats, after] = await Promise.all([
    loadPracticeStats(env, user),
    loadRetentionStats(env, user.id),
  ]);

  const earned = await grantAchievements(env, user, {
    totalSessions: stats.totalSessions,
    lifeForceMinutes: stats.lifeForceMinutes,
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    completedSlugs: new Set(stats.completedSlugs),
    retentionCount: after.count,
    bestRetentionSeconds: after.best,
    previousBestRetentionSeconds: previous.best,
    reflectionCount: stats.reflectionCount,
  });

  ctx.waitUntil(
    track(env, {
      name: EVENTS.retentionLogged,
      orgId: user.org_id,
      userId: user.id,
      props: { seconds, comfort },
    }),
  );

  return data({
    saved: true,
    seconds,
    isPersonalBest: previous.best > 0 && seconds > previous.best,
    earned,
  });
}

type Stage = "safety" | "ready" | "holding" | "logging";

export default function Retention({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { best, recentAverage, count, points, mustAcknowledge } = loaderData;
  const [stage, setStage] = useState<Stage>(
    mustAcknowledge ? "safety" : "ready",
  );
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);

  useEffect(() => {
    if (stage !== "holding") return;
    startedAt.current = Date.now();
    const id = window.setInterval(() => {
      setElapsed((Date.now() - startedAt.current) / 1000);
    }, 100);
    return () => window.clearInterval(id);
  }, [stage]);

  if (actionData && "saved" in actionData && actionData.saved) {
    return (
      <div className="mx-auto max-w-lg space-y-6 pt-2">
        <h1 className="font-serif text-3xl text-[var(--color-bone)]">
          Logged
        </h1>
        <Card className="text-center">
          <p className="font-serif text-5xl text-[var(--color-bone)] tabular-nums">
            {formatSeconds(actionData.seconds)}
          </p>
          {actionData.isPersonalBest ? (
            <p className="mt-3 text-[var(--color-amber-bright)]">
              A new personal best — reached comfortably, which is the only way
              it counts.
            </p>
          ) : (
            <p className="mt-3 text-sm text-[var(--color-bone-muted)]">
              Comfortable and controlled beats long. This is a good session.
            </p>
          )}
        </Card>

        {actionData.earned.length > 0 ? (
          <Card>
            <SectionHeading>New marker</SectionHeading>
            <ul className="mt-3 space-y-2">
              {actionData.earned.map((achievement) => (
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

        <div className="space-y-3">
          <Button to="/progress" size="lg" className="w-full">
            See your trend
          </Button>
          <Link
            to="/progress/retention"
            reloadDocument
            className="block py-2 text-center text-sm text-[var(--color-bone-faint)] underline underline-offset-4"
          >
            Log another
          </Link>
        </div>
      </div>
    );
  }

  if (stage === "safety") {
    return (
      <div className="mx-auto max-w-lg space-y-6 pt-2">
        <h1 className="font-serif text-3xl text-[var(--color-bone)]">
          Before you hold your breath
        </h1>

        <Card className="border-[color-mix(in_oklab,var(--color-copper)_50%,transparent)] bg-[color-mix(in_oklab,var(--color-copper)_12%,transparent)] space-y-4 text-sm leading-relaxed text-[var(--color-bone-muted)]">
          <p>
            Practise seated or lying down in a safe place. Never practise
            breath retention in water, while driving, standing somewhere you
            could fall, or anywhere a loss of consciousness could cause harm.
          </p>
          <p>
            Stop immediately if you feel pain, severe dizziness, panic or
            distress.
          </p>
          <p>
            Do not hyperventilate beforehand to inflate the number. That is
            precisely the practice that causes blackouts.
          </p>
          <p>
            Progress should be comfortable and controlled, never forced. If you
            are pregnant, or live with a cardiovascular condition, epilepsy,
            glaucoma, or a history of psychosis or severe panic, please speak
            with a qualified healthcare professional first.
          </p>
        </Card>

        <Button size="lg" className="w-full" onClick={() => setStage("ready")}>
          I understand, and I&rsquo;m somewhere safe
        </Button>
        <Link
          to="/library/retention-basics"
          className="block py-2 text-center text-sm text-[var(--color-bone-faint)] underline underline-offset-4"
        >
          Read the full retention guide first
        </Link>
      </div>
    );
  }

  if (stage === "holding" || stage === "logging") {
    return (
      <div className="mx-auto max-w-lg pt-2">
        <div className="bf-still -mx-5 flex min-h-[60vh] flex-col items-center justify-center rounded-3xl px-6 py-12">
          {/* A calm expanding circle, not a countdown. No pressure to beat. */}
          <div
            aria-hidden="true"
            className="bf-orb-motion h-40 w-40 rounded-full bg-[radial-gradient(circle_at_38%_32%,rgba(244,239,229,0.6)_0%,var(--color-amber)_50%,transparent_74%)]"
            style={{
              animation:
                stage === "holding"
                  ? "bf-breathe 14s var(--ease-breath) infinite"
                  : "none",
            }}
          />

          <p
            className="mt-10 font-serif text-5xl text-[var(--color-bone)] tabular-nums"
            role="timer"
            aria-live="off"
          >
            {formatSeconds(Math.floor(elapsed))}
          </p>

          {stage === "holding" ? (
            <>
              <Button
                size="lg"
                className="mt-10 w-full max-w-xs"
                onClick={() => setStage("logging")}
              >
                Release
              </Button>
              <p className="mt-5 max-w-xs text-center text-sm text-[var(--color-bone-faint)]">
                Release when the urge becomes strong, not when it becomes
                unbearable.
              </p>
            </>
          ) : null}
        </div>

        {stage === "logging" ? (
          <Form method="post" className="mt-6 space-y-5">
            <input
              type="hidden"
              name="seconds"
              value={Math.max(1, Math.floor(elapsed))}
            />

            <fieldset>
              <legend className="text-sm text-[var(--color-bone-muted)]">
                How did that feel?
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { value: "comfortable", label: "Comfortable" },
                  { value: "edge", label: "At my edge" },
                  { value: "strained", label: "Strained" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="cursor-pointer rounded-full border border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)] px-4 py-2.5 text-sm text-[var(--color-bone-muted)] transition has-[:checked]:border-[var(--color-amber-bright)] has-[:checked]:bg-[color-mix(in_oklab,var(--color-amber)_18%,transparent)] has-[:checked]:text-[var(--color-bone)]"
                  >
                    <input
                      type="radio"
                      name="comfort"
                      value={option.value}
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label
                htmlFor="retention-note"
                className="block text-sm text-[var(--color-bone-muted)]"
              >
                Anything to remember? <span className="text-[var(--color-bone-faint)]">(optional)</span>
              </label>
              <input
                id="retention-note"
                name="note"
                className="mt-2 w-full rounded-xl border border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)] bg-[color-mix(in_oklab,var(--color-bone)_6%,transparent)] px-4 py-3 text-[var(--color-bone)]"
              />
            </div>

            {actionData && "error" in actionData ? (
              <p role="alert" className="text-sm text-[var(--color-copper-bright)]">
                {actionData.error}
              </p>
            ) : null}

            <Button type="submit" size="lg" className="w-full">
              Log it
            </Button>
          </Form>
        ) : null}
      </div>
    );
  }

  // stage === "ready"
  return (
    <div className="mx-auto max-w-lg space-y-6 pt-2">
      <header>
        <Link
          to="/progress"
          className="text-sm text-[var(--color-bone-muted)] underline underline-offset-4"
        >
          ← Progress
        </Link>
        <h1 className="mt-4 font-serif text-3xl text-[var(--color-bone)]">
          Breath retention
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-bone-muted)]">
          Breathe normally first. Then hold after a comfortable exhale — not a
          full inhale, and never after hyperventilating.
        </p>
      </header>

      {count > 0 ? (
        <Card>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-bone-faint)]">
                Best
              </p>
              <p className="mt-1 font-serif text-3xl text-[var(--color-bone)] tabular-nums">
                {formatSeconds(best)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-bone-faint)]">
                Recent average
              </p>
              <p className="mt-1 font-serif text-3xl text-[var(--color-bone)] tabular-nums">
                {formatSeconds(recentAverage)}
              </p>
            </div>
          </div>
          {points.length > 1 ? (
            <RetentionGraph points={points} className="mt-5" />
          ) : null}
        </Card>
      ) : null}

      <Button size="lg" className="w-full" onClick={() => setStage("holding")}>
        Start
      </Button>

      <p className="text-center text-xs leading-relaxed text-[var(--color-bone-faint)]">
        Seated or lying down. Never in water, never driving. Stop at once if
        anything hurts.
      </p>

      <Link
        to="/library/retention-basics"
        className="block py-2 text-center text-sm text-[var(--color-bone-muted)] underline underline-offset-4"
      >
        Read the retention guide
      </Link>
    </div>
  );
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}:${String(s).padStart(2, "0")}` : `${m}:00`;
}
