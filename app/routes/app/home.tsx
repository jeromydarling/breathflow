import { Link } from "react-router";
import type { Route } from "./+types/home";
import { envFrom } from "~/lib/context";
import { requireOnboardedUser } from "~/lib/auth.server";
import { loadPracticeStats } from "~/lib/stats.server";
import { getAccess, accountAgeDays, canPlay } from "~/lib/membership.server";
import { one } from "~/lib/db.server";
import { getPractice, todaysPractice, INTENSITY_LABEL } from "~/content/practices";
import { greetingFor, humanDuration, localHour } from "~/lib/time";
import { Button, Card, Pill, SectionHeading } from "~/components/ui";
import { privateNoStore } from "~/lib/cache.server";
import { WeeklyRing } from "~/components/WeeklyRing";

/**
 * Home answers exactly one question: what should I do today?
 *
 * No scrolling wall of recommendations. One hero, one CTA, the streak, the
 * Life Force Minutes, the weekly ring, one alternate practice, one piece of
 * inspiration. That is the whole screen, deliberately.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = envFrom(context);
  const user = await requireOnboardedUser(request, env);

  // Independent reads, in parallel. Never serialised.
  const [stats, access, resumable] = await Promise.all([
    loadPracticeStats(env, user),
    getAccess(env, user),
    one<{ id: string; practice_slug: string; elapsed_seconds: number }>(
      env.DB,
      `SELECT id, practice_slug, elapsed_seconds FROM practice_sessions
        WHERE user_id = ? AND status = 'in_progress' AND updated_at > ?
        ORDER BY updated_at DESC LIMIT 1`,
      user.id,
      Date.now() - 24 * 3600_000,
    ),
  ]);

  const hour = localHour(Date.now(), user.timezone);
  const suggestion = todaysPractice({
    hour,
    practicedToday: stats.practicedToday,
    preferredTime: user.preferred_time,
  });

  const ageDays = accountAgeDays(user.created_at);
  const gate = canPlay(suggestion, access, { accountAgeDays: ageDays });

  // The alternate is always short, always different from the hero.
  const alternate =
    suggestion.slug === "three-minute-return"
      ? getPractice("anxiety-relief")!
      : getPractice("three-minute-return")!;

  const resume = resumable ? getPractice(resumable.practice_slug) : null;

  return {
    firstName: user.name.trim().split(/\s+/)[0] ?? "",
    greeting: greetingFor(hour),
    stats: {
      lifeForceMinutes: stats.lifeForceMinutes,
      currentStreak: stats.currentStreak,
      practicedToday: stats.practicedToday,
      justBrokeStreak: stats.justBrokeStreak,
      weeklyRing: stats.weeklyRing,
      levelName: stats.level.name,
    },
    suggestion: {
      slug: suggestion.slug,
      title: suggestion.title,
      outcome: suggestion.outcome,
      seconds: suggestion.seconds,
      intensity: suggestion.intensity,
      gradient: suggestion.gradient,
      locked: !gate.allowed,
      lockReason: gate.reason ?? null,
    },
    alternate: {
      slug: alternate.slug,
      title: alternate.title,
      outcome: alternate.outcome,
      seconds: alternate.seconds,
    },
    resume:
      resume && resumable
        ? {
            sessionId: resumable.id,
            slug: resume.slug,
            title: resume.title,
            elapsed: resumable.elapsed_seconds,
            total: resume.seconds,
          }
        : null,
  };
}

export function headers() {
  return privateNoStore();
}

export function meta() {
  return [
    { title: "Today's breath · BreathFLOW" },
    { name: "robots", content: "noindex" },
  ];
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { firstName, greeting, stats, suggestion, alternate, resume } =
    loaderData;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* 1 — Greeting and emotional context */}
      <header className="pt-2">
        <h1 className="font-serif text-3xl text-[var(--color-bone)]">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-bone-faint)]">
          {stats.practicedToday
            ? "You've already been with your breath today."
            : "Your breath is here whenever you are."}
        </p>
      </header>

      {/* Compassionate copy for a broken streak — and nothing else about it */}
      {stats.justBrokeStreak ? (
        <Card className="border-[color-mix(in_oklab,var(--color-copper)_45%,transparent)] bg-[color-mix(in_oklab,var(--color-copper)_12%,transparent)]">
          <p className="font-serif text-lg text-[var(--color-bone)]">
            Nothing is lost. Your breath is still here.
          </p>
          <p className="mt-1 text-sm text-[var(--color-bone-muted)]">
            Begin again — today counts just as much as any day before it.
          </p>
        </Card>
      ) : null}

      {/* Continue where they left off, when there is somewhere to continue */}
      {resume ? (
        <Card className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <SectionHeading>Continue</SectionHeading>
            <p className="mt-1 truncate text-[var(--color-bone)]">
              {resume.title}
            </p>
            <p className="text-sm text-[var(--color-bone-faint)]">
              {humanDuration(resume.elapsed)} in
            </p>
          </div>
          <Button to={`/play/${resume.slug}?resume=${resume.sessionId}`} size="sm">
            Resume
          </Button>
        </Card>
      ) : null}

      {/* 2 & 3 — Today's practice and the single primary CTA */}
      <section
        className={`${suggestion.gradient} relative overflow-hidden rounded-3xl`}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative p-6">
          <SectionHeading className="text-[color-mix(in_oklab,var(--color-bone)_70%,transparent)]">
            Today&rsquo;s breath
          </SectionHeading>

          <h2 className="mt-3 font-serif text-3xl leading-tight text-[var(--color-bone)]">
            {suggestion.title}
          </h2>
          <p className="mt-3 leading-relaxed text-[var(--color-bone-muted)]">
            {suggestion.outcome}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Pill tone={suggestion.intensity}>
              {INTENSITY_LABEL[suggestion.intensity]}
            </Pill>
            <Pill>{humanDuration(suggestion.seconds)}</Pill>
          </div>

          {suggestion.locked ? (
            <>
              <Button to="/membership" size="lg" className="mt-6 w-full">
                {suggestion.lockReason === "intro-ended"
                  ? "Keep the ritual going"
                  : "Open Deep Practice"}
              </Button>
              <p className="mt-3 text-center text-xs text-[var(--color-bone-muted)]">
                {suggestion.lockReason === "intro-ended"
                  ? "Your first seven days of the Grand Rising Method are complete. The Three-Minute Return stays free forever."
                  : "This one is part of Deep Practice."}
              </p>
            </>
          ) : (
            <Button to={`/play/${suggestion.slug}`} size="lg" className="mt-6 w-full">
              Begin today&rsquo;s breath
            </Button>
          )}
        </div>
      </section>

      {/* 4 & 5 — Streak, weekly consistency, Life Force Minutes */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <SectionHeading>Life Force Minutes</SectionHeading>
            <p className="mt-1 font-serif text-4xl text-[var(--color-bone)] tabular-nums">
              {stats.lifeForceMinutes.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-[var(--color-bone-faint)]">
              {stats.levelName}
            </p>
          </div>
          <div className="text-right">
            <SectionHeading>Streak</SectionHeading>
            <p className="mt-1 font-serif text-4xl text-[var(--color-bone)] tabular-nums">
              {stats.currentStreak}
            </p>
            <p className="mt-1 text-xs text-[var(--color-bone-faint)]">
              {stats.currentStreak === 1 ? "day" : "days"}
            </p>
          </div>
        </div>

        <WeeklyRing days={stats.weeklyRing} className="mt-6" />

        <Link
          to="/progress"
          prefetch="intent"
          className="mt-5 block text-center text-sm text-[var(--color-bone-muted)] underline underline-offset-4 hover:text-[var(--color-bone)]"
        >
          See your progress
        </Link>
      </Card>

      {/* Relief shortcut — small, always reachable, never shouty */}
      <Link
        to="/play/anxiety-relief"
        prefetch="intent"
        className="flex items-center justify-between rounded-2xl border border-[color-mix(in_oklab,var(--color-bone)_14%,transparent)] px-5 py-4 transition hover:bg-[color-mix(in_oklab,var(--color-bone)_6%,transparent)]"
      >
        <span className="text-[var(--color-bone)]">I need relief now</span>
        <span className="text-sm text-[var(--color-bone-faint)]">
          Anxiety Relief · 8 min
        </span>
      </Link>

      {/* 6 — One alternate quick practice */}
      <Card>
        <SectionHeading>If today is a short day</SectionHeading>
        <h3 className="mt-2 text-lg text-[var(--color-bone)]">
          {alternate.title}
        </h3>
        <p className="mt-1 text-sm text-[var(--color-bone-muted)]">
          {alternate.outcome}
        </p>
        <Button
          to={`/play/${alternate.slug}`}
          variant="ghost"
          size="sm"
          className="mt-4"
        >
          {humanDuration(alternate.seconds)} · Begin
        </Button>
      </Card>

      {/* 7 — One piece of inspiration. One. */}
      <figure className="px-2 py-6 text-center">
        <blockquote className="font-serif text-xl leading-relaxed text-[var(--color-bone-muted)]">
          Come back to the body. Come back to the breath. Come back to
          yourself.
        </blockquote>
      </figure>
    </div>
  );
}
