import { useEffect, useMemo, useRef, useState } from "react";
import type { BreathPattern } from "~/content/practices";
import { cycleSeconds } from "~/content/practices";

export type Phase = "inhale" | "holdIn" | "exhale" | "holdOut";

const PHASE_LABEL: Record<Phase, string> = {
  inhale: "Inhale",
  holdIn: "Hold",
  exhale: "Exhale",
  holdOut: "Rest",
};

/**
 * Where in the breath cycle `elapsed` seconds lands.
 *
 * Pure, and exported so breath-orb.test.ts can pin the boundaries — an orb
 * that says "Exhale" while the audio says "Inhale" is worse than no orb.
 */
export function phaseAt(
  pattern: BreathPattern,
  elapsedSeconds: number,
): { phase: Phase; progress: number; remaining: number } {
  const total = cycleSeconds(pattern);
  if (total <= 0) {
    return { phase: "inhale", progress: 0, remaining: 0 };
  }

  const t = ((elapsedSeconds % total) + total) % total;
  const segments: Array<[Phase, number]> = [
    ["inhale", pattern.inhale],
    ["holdIn", pattern.holdIn],
    ["exhale", pattern.exhale],
    ["holdOut", pattern.holdOut],
  ];

  let cursor = 0;
  for (const [phase, duration] of segments) {
    if (duration <= 0) continue;
    if (t < cursor + duration) {
      const into = t - cursor;
      return {
        phase,
        progress: into / duration,
        remaining: duration - into,
      };
    }
    cursor += duration;
  }

  // Floating-point landing exactly on the end of the cycle.
  const last = segments.filter(([, d]) => d > 0).at(-1)!;
  return { phase: last[0], progress: 1, remaining: 0 };
}

/** Orb scale for a phase — 0.62 at empty, 1 at full. */
export function scaleFor(phase: Phase, progress: number): number {
  const MIN = 0.62;
  const MAX = 1;
  const span = MAX - MIN;
  switch (phase) {
    case "inhale":
      return MIN + span * easeInOut(progress);
    case "holdIn":
      return MAX;
    case "exhale":
      return MAX - span * easeInOut(progress);
    case "holdOut":
      return MIN;
  }
}

function easeInOut(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped < 0.5
    ? 2 * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
}

export function usePrefersReducedMotion(forced = false): boolean {
  const [reduced, setReduced] = useState(forced);

  useEffect(() => {
    if (forced) {
      setReduced(true);
      return;
    }
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, [forced]);

  return reduced;
}

type Props = {
  pattern: BreathPattern;
  /** Seconds into the practice. Drives the phase. */
  elapsed: number;
  running: boolean;
  /** Honour the account-level reduced-motion preference too, not just the OS. */
  forceReducedMotion?: boolean;
  /** Hide the phase word — some journeys are guided entirely by voice. */
  showPhaseLabel?: boolean;
  className?: string;
};

/**
 * The breathing visual.
 *
 * Deliberately CSS transforms on a couple of divs rather than canvas: it stays
 * smooth on an old phone, it costs nothing in battery, and it degrades to a
 * static shape when someone has asked for reduced motion.
 */
export function BreathOrb({
  pattern,
  elapsed,
  running,
  forceReducedMotion = false,
  showPhaseLabel = true,
  className = "",
}: Props) {
  const reduced = usePrefersReducedMotion(forceReducedMotion);
  const { phase, progress, remaining } = useMemo(
    () => phaseAt(pattern, elapsed),
    [pattern, elapsed],
  );

  const scale = reduced ? 0.86 : scaleFor(phase, progress);
  const glow = reduced ? 0.5 : 0.35 + 0.45 * ((scale - 0.62) / 0.38);

  // Announce phase changes to screen readers, but only on change — a live
  // region that fires every frame is unusable.
  const lastAnnounced = useRef<Phase | null>(null);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (!running) return;
    if (lastAnnounced.current !== phase) {
      lastAnnounced.current = phase;
      setAnnouncement(PHASE_LABEL[phase]);
    }
  }, [phase, running]);

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      data-phase={phase}
    >
      {/* Outer bloom */}
      <div
        aria-hidden="true"
        className="absolute rounded-full blur-3xl transition-transform duration-1000 ease-[var(--ease-breath)]"
        style={{
          width: "min(78vw, 26rem)",
          height: "min(78vw, 26rem)",
          transform: `scale(${scale * 1.15})`,
          background:
            "radial-gradient(circle, var(--color-amber) 0%, transparent 68%)",
          opacity: glow * 0.55,
        }}
      />
      {/* Core */}
      <div
        aria-hidden="true"
        className="relative rounded-full transition-transform duration-1000 ease-[var(--ease-breath)]"
        style={{
          width: "min(58vw, 19rem)",
          height: "min(58vw, 19rem)",
          transform: `scale(${scale})`,
          background:
            "radial-gradient(circle at 38% 32%, rgba(244,239,229,0.92) 0%, var(--color-amber) 42%, var(--color-copper) 78%, rgba(23,26,24,0.85) 100%)",
          boxShadow: `0 0 ${60 * glow}px rgba(194,138,58,${glow * 0.7})`,
        }}
      />
      {/* Ring */}
      <div
        aria-hidden="true"
        className="absolute rounded-full border transition-transform duration-1000 ease-[var(--ease-breath)]"
        style={{
          width: "min(66vw, 22rem)",
          height: "min(66vw, 22rem)",
          transform: `scale(${scale * 1.04})`,
          borderColor: `rgba(244,239,229,${0.1 + glow * 0.18})`,
        }}
      />

      {showPhaseLabel ? (
        <div className="relative z-10 text-center">
          <p className="font-serif text-2xl tracking-wide text-[var(--color-charcoal)] mix-blend-luminosity">
            {PHASE_LABEL[phase]}
          </p>
          {remaining >= 1 ? (
            <p className="mt-1 text-sm text-[color-mix(in_oklab,var(--color-charcoal)_70%,transparent)] tabular-nums">
              {Math.ceil(remaining)}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
