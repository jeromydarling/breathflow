import { Link } from "react-router";
import type { Route } from "./+types/practice";
import { envFrom } from "~/lib/context";
import { requireOnboardedUser } from "~/lib/auth.server";
import { accountAgeDays, canPlay, getAccess } from "~/lib/membership.server";
import { orderedPractices, INTENSITY_LABEL } from "~/content/practices";
import { all } from "~/lib/db.server";
import { humanDuration } from "~/lib/time";
import { Pill, SectionHeading } from "~/components/ui";
import { privateNoStore } from "~/lib/cache.server";

/**
 * The library. Deliberately small — seven cards, no categories, no filters,
 * no search. You can hold the whole thing in your head, which is the point.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = envFrom(context);
  const user = await requireOnboardedUser(request, env);

  const [access, completed] = await Promise.all([
    getAccess(env, user),
    all<{ practice_slug: string; n: number }>(
      env.DB,
      `SELECT practice_slug, COUNT(*) AS n FROM practice_sessions
        WHERE user_id = ? AND status = 'completed'
        GROUP BY practice_slug`,
      user.id,
    ),
  ]);

  const counts = new Map(completed.map((row) => [row.practice_slug, row.n]));
  const ageDays = accountAgeDays(user.created_at);

  return {
    practices: orderedPractices().map((practice) => {
      const gate = canPlay(practice, access, { accountAgeDays: ageDays });
      return {
        slug: practice.slug,
        title: practice.title,
        outcome: practice.outcome,
        seconds: practice.seconds,
        intensity: practice.intensity,
        bestFor: practice.bestFor,
        gradient: practice.gradient,
        locked: !gate.allowed,
        lockReason: gate.reason ?? null,
        timesCompleted: counts.get(practice.slug) ?? 0,
      };
    }),
    showBillingNote: access.unlockedBecauseBillingIsDark,
  };
}

export function headers() {
  return privateNoStore();
}

export function meta() {
  return [
    { title: "Practice · BreathFLOW" },
    { name: "robots", content: "noindex" },
  ];
}

export default function PracticeLibrary({ loaderData }: Route.ComponentProps) {
  const { practices, showBillingNote } = loaderData;

  return (
    <div className="mx-auto max-w-lg">
      <header className="pt-2">
        <h1 className="font-serif text-3xl text-[var(--color-bone)]">
          Practice
        </h1>
        <p className="mt-1 text-sm text-[var(--color-bone-faint)]">
          Seven ways in. Choose the one that meets the state you&rsquo;re
          actually in.
        </p>
      </header>

      {showBillingNote ? (
        <p className="mt-5 rounded-xl border border-[color-mix(in_oklab,#7fb3a0_35%,transparent)] bg-[color-mix(in_oklab,#7fb3a0_12%,transparent)] px-4 py-3 text-sm text-[var(--color-bone-muted)]">
          Everything is open while BreathFLOW is in early access. Nothing is
          hidden from you.
        </p>
      ) : null}

      <ul className="mt-6 space-y-4">
        {practices.map((practice) => (
          <li key={practice.slug}>
            <Link
              to={`/practice/${practice.slug}`}
              prefetch="intent"
              className={`${practice.gradient} relative block overflow-hidden rounded-3xl transition active:scale-[0.99]`}
            >
              <div className="absolute inset-0 bg-black/45" />
              <div className="relative p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={practice.intensity}>
                    {INTENSITY_LABEL[practice.intensity]}
                  </Pill>
                  <Pill>{humanDuration(practice.seconds)}</Pill>
                  {practice.locked ? (
                    <Pill tone="locked">
                      {practice.lockReason === "intro-ended"
                        ? "Intro complete"
                        : "Deep Practice"}
                    </Pill>
                  ) : null}
                </div>

                <h2 className="mt-3 font-serif text-2xl text-[var(--color-bone)]">
                  {practice.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-bone-muted)]">
                  {practice.outcome}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-[var(--color-bone-faint)]">
                    {practice.bestFor.join(" · ")}
                  </p>
                  {practice.timesCompleted > 0 ? (
                    <p className="text-xs text-[var(--color-bone-faint)]">
                      {practice.timesCompleted}×
                    </p>
                  ) : null}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-10">
        <SectionHeading>Reading</SectionHeading>
        <Link
          to="/library"
          prefetch="intent"
          className="mt-3 flex items-center justify-between rounded-2xl border border-[color-mix(in_oklab,var(--color-bone)_14%,transparent)] px-5 py-4 transition hover:bg-[color-mix(in_oklab,var(--color-bone)_6%,transparent)]"
        >
          <span className="text-[var(--color-bone)]">The guide library</span>
          <span className="text-sm text-[var(--color-bone-faint)]">
            8 guides
          </span>
        </Link>
      </section>
    </div>
  );
}
