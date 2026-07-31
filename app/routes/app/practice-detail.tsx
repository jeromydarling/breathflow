import { Link } from "react-router";
import type { Route } from "./+types/practice-detail";
import { envFrom } from "~/lib/context";
import { requireOnboardedUser } from "~/lib/auth.server";
import { accountAgeDays, canPlay, getAccess } from "~/lib/membership.server";
import { getGuide } from "~/content/guides";
import { getPractice, INTENSITY_LABEL } from "~/content/practices";
import { one } from "~/lib/db.server";
import { humanDuration } from "~/lib/time";
import { Button, Card, Pill, SectionHeading } from "~/components/ui";
import { privateNoStore } from "~/lib/cache.server";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const env = envFrom(context);
  const user = await requireOnboardedUser(request, env);

  const practice = getPractice(params.slug);
  if (!practice) throw new Response("Not found", { status: 404 });

  const [access, history] = await Promise.all([
    getAccess(env, user),
    one<{ n: number; last: number | null }>(
      env.DB,
      `SELECT COUNT(*) AS n, MAX(completed_at) AS last
         FROM practice_sessions
        WHERE user_id = ? AND practice_slug = ? AND status = 'completed'`,
      user.id,
      practice.slug,
    ),
  ]);

  const gate = canPlay(practice, access, {
    accountAgeDays: accountAgeDays(user.created_at),
  });

  return {
    practice: {
      slug: practice.slug,
      title: practice.title,
      outcome: practice.outcome,
      description: practice.description,
      seconds: practice.seconds,
      intensity: practice.intensity,
      bestFor: practice.bestFor,
      gradient: practice.gradient,
      preparation: practice.preparation ?? null,
      contraindication: practice.contraindication ?? null,
      patternLabel: practice.pattern.label,
    },
    guides: practice.relatedGuides.flatMap((slug) => {
      const guide = getGuide(slug);
      return guide ? [{ slug: guide.slug, title: guide.title }] : [];
    }),
    locked: !gate.allowed,
    lockReason: gate.reason ?? null,
    timesCompleted: history?.n ?? 0,
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

export default function PracticeDetail({ loaderData }: Route.ComponentProps) {
  const { practice, guides, locked, lockReason, timesCompleted } = loaderData;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div
        className={`${practice.gradient} relative -mx-5 -mt-2 overflow-hidden px-5 pb-8 pt-10`}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative">
          <Link
            to="/practice"
            className="text-sm text-[var(--color-bone-muted)] underline underline-offset-4"
          >
            ← Practice
          </Link>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Pill tone={practice.intensity}>
              {INTENSITY_LABEL[practice.intensity]}
            </Pill>
            <Pill>{humanDuration(practice.seconds)}</Pill>
            <Pill>{practice.patternLabel}</Pill>
          </div>

          <h1 className="mt-4 font-serif text-4xl leading-tight text-[var(--color-bone)]">
            {practice.title}
          </h1>
          <p className="mt-3 leading-relaxed text-[var(--color-bone-muted)]">
            {practice.outcome}
          </p>
        </div>
      </div>

      {locked ? (
        <Card>
          <p className="text-[var(--color-bone)]">
            {lockReason === "intro-ended"
              ? "Your first seven days of this ritual are complete."
              : "This one is part of Deep Practice."}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-bone-muted)]">
            {lockReason === "intro-ended"
              ? "The Three-Minute Return stays free forever, and it keeps your streak alive. Deep Practice opens the full Grand Rising Method again, along with everything else."
              : "The Three-Minute Return and your streak stay free forever. Deep Practice adds the longer journeys."}
          </p>
          <Button to="/membership" size="lg" className="mt-5 w-full">
            See what&rsquo;s in Deep Practice
          </Button>
        </Card>
      ) : (
        <Button to={`/play/${practice.slug}`} size="lg" className="w-full">
          Begin
        </Button>
      )}

      <section>
        <SectionHeading>What this is</SectionHeading>
        <p className="mt-3 leading-relaxed text-[var(--color-bone-muted)]">
          {practice.description}
        </p>
      </section>

      <section>
        <SectionHeading>Best for</SectionHeading>
        <p className="mt-2 text-[var(--color-bone-muted)]">
          {practice.bestFor.join(" · ")}
        </p>
      </section>

      {practice.preparation ? (
        <section>
          <SectionHeading>How to set up</SectionHeading>
          <ul className="mt-3 space-y-2">
            {practice.preparation.map((line) => (
              <li key={line} className="flex gap-3 text-[var(--color-bone-muted)]">
                <span aria-hidden="true" className="text-[var(--color-amber-bright)]">
                  ·
                </span>
                <span className="leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {practice.contraindication ? (
        <Card className="border-[color-mix(in_oklab,var(--color-copper)_50%,transparent)] bg-[color-mix(in_oklab,var(--color-copper)_12%,transparent)]">
          <SectionHeading>Before you begin</SectionHeading>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-bone-muted)]">
            {practice.contraindication}
          </p>
        </Card>
      ) : null}

      {guides.length > 0 ? (
        <section>
          <SectionHeading>Read alongside it</SectionHeading>
          <ul className="mt-3 space-y-2">
            {guides.map((guide) => (
              <li key={guide.slug}>
                <Link
                  to={`/library/${guide.slug}`}
                  prefetch="intent"
                  className="flex items-center justify-between rounded-2xl border border-[color-mix(in_oklab,var(--color-bone)_14%,transparent)] px-5 py-4 text-[var(--color-bone)] transition hover:bg-[color-mix(in_oklab,var(--color-bone)_6%,transparent)]"
                >
                  {guide.title}
                  <span aria-hidden="true" className="text-[var(--color-bone-faint)]">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {timesCompleted > 0 ? (
        <p className="pt-2 text-center text-sm text-[var(--color-bone-faint)]">
          You&rsquo;ve completed this {timesCompleted}{" "}
          {timesCompleted === 1 ? "time" : "times"}.
        </p>
      ) : null}
    </div>
  );
}
