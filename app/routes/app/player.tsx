import { useCallback, useEffect, useRef, useState } from "react";
import { Link, redirect, useFetcher, useNavigate } from "react-router";
import type { Route } from "./+types/player";
import { runtimeFrom } from "~/lib/context";
import { requireOnboardedUser } from "~/lib/auth.server";
import { one, run } from "~/lib/db.server";
import { newId } from "~/lib/ids";
import { getPractice, INTENSITY_LABEL } from "~/content/practices";
import { accountAgeDays, canPlay, getAccess } from "~/lib/membership.server";
import { EVENTS, track } from "~/lib/analytics.server";
import { clock, humanDuration } from "~/lib/time";
import { BreathOrb } from "~/components/BreathOrb";
import { Button } from "~/components/ui";
import { privateNoStore } from "~/lib/cache.server";

/**
 * The practice player.
 *
 * Visually quiet, cinematic, and usable with eyes half closed. No social
 * buttons, no statistics, nothing that asks anything of the user while they
 * are inside the practice.
 *
 * Progress is beaconed to the server every fifteen seconds and again on
 * pagehide, so a phone call or a locked screen never costs someone their
 * minutes.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env, ctx } = runtimeFrom(context);
  const user = await requireOnboardedUser(request, env);

  const practice = getPractice(params.slug);
  if (!practice) throw new Response("Not found", { status: 404 });

  const access = await getAccess(env, user);
  const gate = canPlay(practice, access, {
    accountAgeDays: accountAgeDays(user.created_at),
  });
  if (!gate.allowed) {
    throw redirect(`/membership?from=${practice.slug}&why=${gate.reason}`);
  }

  // Resume an interrupted session rather than starting a fresh one, so the
  // minutes already spent are never counted twice or thrown away.
  const url = new URL(request.url);
  const resumeId = url.searchParams.get("resume");
  const now = Date.now();

  let sessionId: string;
  let startingElapsed = 0;

  const existing = resumeId
    ? await one<{ id: string; elapsed_seconds: number }>(
        env.DB,
        `SELECT id, elapsed_seconds FROM practice_sessions
          WHERE id = ? AND user_id = ? AND practice_slug = ? AND status = 'in_progress'`,
        resumeId,
        user.id,
        practice.slug,
      )
    : null;

  if (existing) {
    sessionId = existing.id;
    startingElapsed = existing.elapsed_seconds;
  } else {
    sessionId = newId("practiceSession");
    await run(
      env.DB,
      `INSERT INTO practice_sessions
         (id, org_id, user_id, practice_slug, status, planned_seconds,
          elapsed_seconds, credited_minutes, started_at, updated_at)
       VALUES (?, ?, ?, ?, 'in_progress', ?, 0, 0, ?, ?)`,
      sessionId,
      user.org_id,
      user.id,
      practice.slug,
      practice.seconds,
      now,
      now,
    );
    ctx.waitUntil(
      track(env, {
        name: EVENTS.practiceStarted,
        orgId: user.org_id,
        userId: user.id,
        props: { slug: practice.slug },
      }),
    );
  }

  return {
    sessionId,
    startingElapsed,
    reducedMotion: user.reduced_motion === 1,
    practice: {
      slug: practice.slug,
      title: practice.title,
      seconds: practice.seconds,
      intensity: practice.intensity,
      gradient: practice.gradient,
      pattern: practice.pattern,
      preparation: practice.preparation ?? null,
      contraindication: practice.contraindication ?? null,
      hasAudio: Boolean(practice.audioKey),
    },
  };
}

export function headers() {
  return privateNoStore();
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `${loaderData?.practice.title ?? "Practice"} · BreathFLOW` },
    { name: "robots", content: "noindex" },
  ];
}

type Stage = "prepare" | "playing" | "paused" | "exiting";

export default function Player({ loaderData }: Route.ComponentProps) {
  const { sessionId, startingElapsed, practice, reducedMotion } = loaderData;
  const navigate = useNavigate();
  const beacon = useFetcher();

  const needsPreparation = Boolean(
    practice.preparation || practice.contraindication,
  );
  const [stage, setStage] = useState<Stage>(
    needsPreparation ? "prepare" : "playing",
  );
  const [elapsed, setElapsed] = useState(startingElapsed);
  const [dimmed, setDimmed] = useState(false);

  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;

  const remaining = Math.max(0, practice.seconds - elapsed);
  const finished = elapsed >= practice.seconds;

  // ── The clock ───────────────────────────────────────────────────────────
  // Driven off wall-clock deltas rather than a tick count, so a throttled
  // background tab does not silently lose minutes.
  useEffect(() => {
    if (stage !== "playing") return;
    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const delta = (now - last) / 1000;
      last = now;
      setElapsed((current) => Math.min(practice.seconds, current + delta));
    }, 250);
    return () => window.clearInterval(id);
  }, [stage, practice.seconds]);

  // ── Progress saving ─────────────────────────────────────────────────────
  const save = useCallback(
    (seconds: number, keepalive = false) => {
      const body = JSON.stringify({
        sessionId,
        elapsed: Math.floor(seconds),
      });
      if (keepalive && "sendBeacon" in navigator) {
        navigator.sendBeacon(
          "/api/session/heartbeat",
          new Blob([body], { type: "application/json" }),
        );
        return;
      }
      void fetch("/api/session/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive,
      }).catch(() => {
        // A failed heartbeat is not worth interrupting a practice over.
      });
    },
    [sessionId],
  );

  useEffect(() => {
    if (stage !== "playing") return;
    const id = window.setInterval(() => save(elapsedRef.current), 15_000);
    return () => window.clearInterval(id);
  }, [stage, save]);

  // The screen going dark or the tab closing must not lose the session.
  useEffect(() => {
    const onHide = () => save(elapsedRef.current, true);
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onHide();
    });
    return () => window.removeEventListener("pagehide", onHide);
  }, [save]);

  // ── Completion ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!finished || stage !== "playing") return;
    save(practice.seconds);
    // A quiet moment before anything is asked of them. The completion screen
    // holds it for a further beat.
    const id = window.setTimeout(() => {
      navigate(
        `/play/${practice.slug}/complete?session=${sessionId}&elapsed=${Math.floor(
          practice.seconds,
        )}`,
        { replace: true },
      );
    }, 1200);
    return () => window.clearTimeout(id);
  }, [finished, stage, navigate, practice.slug, practice.seconds, sessionId, save]);

  // ── Preparation ─────────────────────────────────────────────────────────
  if (stage === "prepare") {
    return (
      <main
        className={`${practice.gradient} flex min-h-dvh flex-col justify-between px-6 py-10`}
      >
        <div className="mx-auto w-full max-w-md">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-bone-faint)]">
            {INTENSITY_LABEL[practice.intensity]} ·{" "}
            {humanDuration(practice.seconds)}
          </p>
          <h1 className="mt-3 font-serif text-3xl text-[var(--color-bone)]">
            {practice.title}
          </h1>

          <h2 className="mt-10 font-serif text-xl text-[var(--color-bone)]">
            Create space. Silence distractions. Let the body be supported.
          </h2>

          {practice.preparation ? (
            <ul className="mt-6 space-y-3">
              {practice.preparation.map((line) => (
                <li
                  key={line}
                  className="flex gap-3 text-[var(--color-bone-muted)]"
                >
                  <span aria-hidden="true" className="text-[var(--color-amber-bright)]">
                    ·
                  </span>
                  <span className="leading-relaxed">{line}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {practice.contraindication ? (
            <div className="mt-8 rounded-2xl border border-[color-mix(in_oklab,var(--color-copper)_50%,transparent)] bg-[color-mix(in_oklab,var(--color-copper)_15%,transparent)] p-5">
              <h3 className="text-sm font-medium text-[var(--color-bone)]">
                Before you begin
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-bone-muted)]">
                {practice.contraindication}
              </p>
            </div>
          ) : null}
        </div>

        <div className="mx-auto mt-10 w-full max-w-md space-y-3">
          <Button
            size="lg"
            className="w-full"
            onClick={() => setStage("playing")}
          >
            I&rsquo;m ready
          </Button>
          <Link
            to="/home"
            className="block py-2 text-center text-sm text-[var(--color-bone-faint)] underline underline-offset-4"
          >
            Not today
          </Link>
        </div>
      </main>
    );
  }

  // ── The practice ────────────────────────────────────────────────────────
  return (
    <main
      className={`${practice.gradient} relative flex min-h-dvh flex-col justify-between overflow-hidden transition-opacity duration-1000 ${
        dimmed ? "opacity-[0.18]" : "opacity-100"
      }`}
    >
      {/* Tapping anywhere lifts eyes-closed mode. */}
      {dimmed ? (
        <button
          type="button"
          onClick={() => setDimmed(false)}
          className="absolute inset-0 z-30"
          aria-label="Wake the screen"
        />
      ) : null}

      <header className="relative z-20 flex items-center justify-between px-6 pt-6">
        <button
          type="button"
          onClick={() => setStage("exiting")}
          className="rounded-full px-3 py-2 text-sm text-[var(--color-bone-muted)] transition hover:text-[var(--color-bone)]"
        >
          Exit
        </button>
        <p className="font-serif text-sm text-[var(--color-bone-muted)]">
          {practice.title}
        </p>
        <button
          type="button"
          onClick={() => setDimmed(true)}
          className="rounded-full px-3 py-2 text-sm text-[var(--color-bone-muted)] transition hover:text-[var(--color-bone)]"
          aria-label="Dim the screen for eyes-closed practice"
        >
          Dim
        </button>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center">
        <BreathOrb
          pattern={practice.pattern}
          elapsed={elapsed}
          running={stage === "playing"}
          forceReducedMotion={reducedMotion}
          showPhaseLabel={!practice.hasAudio || practice.intensity !== "deep"}
        />
      </div>

      <footer className="relative z-20 px-6 pb-10">
        {/* A calm progress line, not a countdown bar racing to a finish. */}
        <div
          className="h-px w-full bg-[color-mix(in_oklab,var(--color-bone)_18%,transparent)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={practice.seconds}
          aria-valuenow={Math.floor(elapsed)}
          aria-label="Practice progress"
        >
          <div
            className="h-px bg-[var(--color-amber-bright)] transition-[width] duration-1000 ease-linear"
            style={{ width: `${(elapsed / practice.seconds) * 100}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between text-sm tabular-nums text-[var(--color-bone-muted)]">
          <span>{clock(elapsed)}</span>
          <span>−{clock(remaining)}</span>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => {
              save(elapsedRef.current);
              setStage(stage === "playing" ? "paused" : "playing");
            }}
            className="flex h-16 w-16 items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--color-bone)_28%,transparent)] bg-[color-mix(in_oklab,var(--color-bone)_10%,transparent)] text-[var(--color-bone)] transition hover:bg-[color-mix(in_oklab,var(--color-bone)_18%,transparent)]"
            aria-label={stage === "playing" ? "Pause" : "Resume"}
          >
            {stage === "playing" ? <PauseIcon /> : <PlayIcon />}
          </button>
        </div>
      </footer>

      {/* Exit confirmation — a long practice is too easy to lose by accident. */}
      {stage === "exiting" ? (
        <div className="absolute inset-0 z-40 flex items-end bg-black/70 backdrop-blur-sm sm:items-center sm:justify-center">
          <div className="w-full rounded-t-3xl bg-[var(--color-charcoal)] p-6 sm:max-w-sm sm:rounded-3xl">
            <h2 className="font-serif text-2xl text-[var(--color-bone)]">
              Leave this practice?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-bone-muted)]">
              The {humanDuration(elapsed)} you&rsquo;ve already spent will be
              counted. You can come back to the rest whenever you like.
            </p>
            <div className="mt-6 space-y-3">
              <Button
                size="lg"
                className="w-full"
                onClick={() => setStage("playing")}
              >
                Stay with it
              </Button>
              <button
                type="button"
                onClick={() => {
                  const seconds = Math.floor(elapsedRef.current);
                  void fetch("/api/session/abandon", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sessionId, elapsed: seconds }),
                    keepalive: true,
                  }).finally(() => {
                    navigate(
                      seconds >= 150
                        ? `/play/${practice.slug}/complete?session=${sessionId}&elapsed=${seconds}&partial=1`
                        : "/home",
                      { replace: true },
                    );
                  });
                }}
                className="w-full py-3 text-sm text-[var(--color-bone-faint)] underline underline-offset-4"
              >
                Leave for now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {beacon.state === "idle" ? null : <span className="sr-only">Saving</span>}
    </main>
  );
}

function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="4" width="4" height="16" rx="1.5" />
      <rect x="14" y="4" width="4" height="16" rx="1.5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 4.5v15a1 1 0 0 0 1.54.84l11.2-7.5a1 1 0 0 0 0-1.68L8.54 3.66A1 1 0 0 0 7 4.5Z" />
    </svg>
  );
}
