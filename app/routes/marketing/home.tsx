import { Link } from "react-router";
import type { Route } from "./+types/home";
import { envFrom } from "~/lib/context";
import {
  jsonLd,
  marketingMeta,
  organizationSchema,
  originFrom,
  softwareApplicationSchema,
  websiteSchema,
} from "~/lib/seo";
import { CURRENCY, PLANS, formatCents } from "~/lib/pricing";
import { orderedPractices, INTENSITY_LABEL } from "~/content/practices";
import { humanDuration } from "~/lib/time";
import { Button, CoreQuote, Pill, Wordmark } from "~/components/ui";
import { InstallPrompt } from "~/components/InstallPrompt";
import { publicPageHeaders } from "~/lib/cache.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = envFrom(context);
  return {
    origin: originFrom(request, env),
    practices: orderedPractices().map((p) => ({
      slug: p.slug,
      title: p.title,
      outcome: p.outcome,
      seconds: p.seconds,
      intensity: p.intensity,
      gradient: p.gradient,
      premium: p.premium,
    })),
    monthlyCents: PLANS.monthly.cents,
  };
}

export function headers({ parentHeaders }: Route.HeadersArgs) {
  return publicPageHeaders(parentHeaders, 300);
}

export function meta({ loaderData }: Route.MetaArgs) {
  // React Router gives meta() `loaderData`, not `data`.
  const origin = loaderData?.origin ?? "";
  return [
    ...marketingMeta({
      title: "BreathFLOW — Tap into your life force",
      description:
        "A daily breath practice rooted in pranayama. Build a ritual you actually keep, track your Life Force Minutes, and return to flow. Free to start.",
      path: "/",
      origin,
    }),
    jsonLd(organizationSchema(origin)),
    jsonLd(websiteSchema(origin)),
    jsonLd(
      softwareApplicationSchema(origin, {
        priceCents: loaderData?.monthlyCents ?? 0,
        currency: CURRENCY,
      }),
    ),
  ];
}

export default function MarketingHome({ loaderData }: Route.ComponentProps) {
  const { practices } = loaderData;

  return (
    <>
      {/* Appears only once the browser confirms it can install, and only
          after the page has had a few seconds to itself. */}
      <InstallPrompt />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="bf-dawn relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,transparent_20%,rgba(23,26,24,0.85)_75%)]" />
        <div className="relative mx-auto max-w-3xl px-5 py-24 text-center sm:py-32">
          <div
            aria-hidden="true"
            className="bf-orb-motion mx-auto mb-10 h-32 w-32 rounded-full bg-[radial-gradient(circle_at_38%_32%,rgba(244,239,229,0.95)_0%,var(--color-amber)_45%,transparent_72%)] blur-sm"
            style={{ animation: "bf-breathe 11s var(--ease-breath) infinite" }}
          />

          <h1 className="font-serif text-4xl leading-tight text-[var(--color-bone)] sm:text-6xl">
            Tap into your life force.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-bone)]">
            BreathFLOW is a daily practice rooted in the ancient tradition of
            pranayama — the conscious cultivation and direction of prana
            through the breath. Not another meditation library. A ritual you
            can keep.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button to="/welcome" size="lg">
              Begin today&rsquo;s breath
            </Button>
            <Button to="/demo" variant="ghost" size="lg">
              Look around first
            </Button>
          </div>

          <p className="mt-6 text-sm text-[var(--color-bone-muted)]">
            Free to start. No card, no trial countdown.
          </p>
        </div>
      </section>

      {/* ── The core quote ───────────────────────────────────────────── */}
      <section className="border-y border-[color-mix(in_oklab,var(--color-bone)_10%,transparent)] px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <CoreQuote />
        </div>
      </section>

      {/* ── What it actually is ──────────────────────────────────────── */}
      <section className="px-5 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-serif text-3xl text-[var(--color-bone)]">
            The breath is the pathway back to feeling.
          </h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {[
              {
                title: "Meet yourself where you are",
                body: "Anxious, flat, numb, blocked, wired at midnight — there is a practice for the state you are actually in, not the one you wish you were in.",
              },
              {
                title: "Consistency over intensity",
                body: "Three minutes today beats forty minutes next month. We count days practised and Life Force Minutes, because that is what actually changes things.",
              },
              {
                title: "Honest about what it is",
                body: "Breathwork can support relaxation, attention and emotional awareness. It is not medicine, and we will never tell you it is.",
              },
            ].map((item) => (
              <div key={item.title}>
                <h3 className="text-lg text-[var(--color-bone)]">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-bone-muted)]">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The library ──────────────────────────────────────────────── */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-serif text-3xl text-[var(--color-bone)]">
            Seven practices. Not seven hundred.
          </h2>
          <p className="mt-3 max-w-xl text-[var(--color-bone-muted)]">
            A small library you can hold in your head, so opening the app never
            becomes another decision to make.
          </p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {practices.map((practice) => (
              <li
                key={practice.slug}
                className={`${practice.gradient} relative overflow-hidden rounded-2xl p-6`}
              >
                <div className="absolute inset-0 bg-black/35" />
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <Pill tone={practice.intensity}>
                      {INTENSITY_LABEL[practice.intensity]}
                    </Pill>
                    <Pill>{humanDuration(practice.seconds)}</Pill>
                    {practice.premium ? <Pill tone="locked">Deep Practice</Pill> : null}
                  </div>
                  <h3 className="mt-4 font-serif text-2xl text-[var(--color-bone)]">
                    {practice.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-bone-muted)]">
                    {practice.outcome}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Progress ─────────────────────────────────────────────────── */}
      <section className="border-t border-[color-mix(in_oklab,var(--color-bone)_10%,transparent)] px-5 py-20">
        <div className="mx-auto grid max-w-4xl gap-10 sm:grid-cols-2 sm:items-center">
          <div>
            <h2 className="font-serif text-3xl text-[var(--color-bone)]">
              Progress that feels like a relationship, not a chore.
            </h2>
            <p className="mt-4 leading-relaxed text-[var(--color-bone-muted)]">
              Life Force Minutes, a streak that a three-minute session can
              keep alive, a breath-retention trend that is yours alone, and
              share cards you will actually want to post.
            </p>
            <p className="mt-4 leading-relaxed text-[var(--color-bone-muted)]">
              There is no leaderboard. There never will be. Comparing your
              breath to a stranger&rsquo;s is the fastest way to make a safe
              practice unsafe.
            </p>
            <Button to="/welcome" className="mt-8">
              Start your first day
            </Button>
          </div>

          <div className="bf-night rounded-3xl border border-[color-mix(in_oklab,var(--color-bone)_12%,transparent)] p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-bone-faint)]">
              Life Force Minutes
            </p>
            <p className="mt-2 font-serif text-6xl text-[var(--color-bone)] tabular-nums">
              1,284
            </p>
            <div className="mt-8 flex justify-between gap-2" aria-hidden="true">
              {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                <div key={index} className="flex flex-col items-center gap-2">
                  <div
                    className={`h-9 w-9 rounded-full border-2 ${
                      index < 5
                        ? "border-[var(--color-amber-bright)] bg-[color-mix(in_oklab,var(--color-amber)_35%,transparent)]"
                        : "border-[color-mix(in_oklab,var(--color-bone)_20%,transparent)]"
                    }`}
                  />
                  <span className="text-xs text-[var(--color-bone-faint)]">
                    {day}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-[var(--color-bone-muted)]">
              An illustration of the progress screen, not a real person&rsquo;s
              data.
            </p>
          </div>
        </div>
      </section>

      {/* ── Pricing teaser ───────────────────────────────────────────── */}
      <section className="px-5 pb-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-3xl text-[var(--color-bone)]">
            Free is genuinely free.
          </h2>
          <p className="mt-4 leading-relaxed text-[var(--color-bone-muted)]">
            The Three-Minute Return, your streak, your Life Force Minutes and
            the retention tracker cost nothing and always will. Deep Practice
            adds the full library and the longer journeys for{" "}
            {formatCents(PLANS.monthly.cents)} a month.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button to="/pricing" variant="ghost">
              See what&rsquo;s in each
            </Button>
            <Button to="/welcome">Begin</Button>
          </div>
        </div>
      </section>

      {/* ── Closing ──────────────────────────────────────────────────── */}
      <section className="bf-night border-t border-[color-mix(in_oklab,var(--color-bone)_10%,transparent)] px-5 py-24 text-center">
        <Wordmark className="text-sm text-[var(--color-bone-faint)]" />
        <p className="mx-auto mt-8 max-w-lg font-serif text-3xl leading-snug text-[var(--color-bone)]">
          Welcome home. Your breath has been waiting for you.
        </p>
        <Button to="/welcome" size="lg" className="mt-10">
          Begin
        </Button>
        <p className="mt-8 text-sm text-[var(--color-bone-faint)]">
          Or{" "}
          <Link to="/guides" className="underline underline-offset-4">
            read the guides first
          </Link>
          . No account needed.
        </p>
      </section>
    </>
  );
}
