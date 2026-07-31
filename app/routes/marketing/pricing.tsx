import type { Route } from "./+types/pricing";
import { envFrom } from "~/lib/context";
import { faqSchema, jsonLd, marketingMeta, originFrom } from "~/lib/seo";
import {
  PLANS,
  annualIsGenuinelyCheaper,
  annualMonthlyEquivalentCents,
  annualSavingsPercent,
  formatCents,
} from "~/lib/pricing";
import { Button, Card, HealthDisclaimer } from "~/components/ui";
import { publicPageHeaders } from "~/lib/cache.server";

const FAQS = [
  {
    q: "Is the free plan really free?",
    a: "Yes. The Three-Minute Return, your streak, your Life Force Minutes and the breath-retention tracker cost nothing and are not time-limited. There is no card required to start and no trial that quietly converts.",
  },
  {
    q: "What happens to my streak if I stop paying?",
    a: "Nothing. Your streak, your Life Force Minutes and your retention history are your record, not ours. You keep them, and the free practices keep your streak alive.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes, from the membership screen, and you keep access until the end of the period you already paid for. We do not ask you to email us or sit through a retention flow.",
  },
  {
    q: "Are 1:1 sessions or retreats included?",
    a: "No. Those are booked and paid for separately, and no membership includes them. We would rather say that plainly than let it be a surprise.",
  },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = envFrom(context);
  return {
    origin: originFrom(request, env),
    monthlyCents: PLANS.monthly.cents,
    annualCents: PLANS.annual.cents,
    perMonth: annualMonthlyEquivalentCents(),
    savingsPercent: annualSavingsPercent(),
    annualWorthPromoting: annualIsGenuinelyCheaper(),
    free: PLANS.free,
    monthly: PLANS.monthly,
    annual: PLANS.annual,
  };
}

export function headers({ parentHeaders }: Route.HeadersArgs) {
  return publicPageHeaders(parentHeaders, 600);
}

export function meta({ loaderData }: Route.MetaArgs) {
  const origin = loaderData?.origin ?? "";
  return [
    ...marketingMeta({
      title: "Pricing",
      description:
        "BreathFLOW is free to start and stays free for the daily habit. Deep Practice adds the full library and the longer journeys.",
      path: "/pricing",
      origin,
    }),
    jsonLd(faqSchema(FAQS)),
  ];
}

export default function Pricing({ loaderData }: Route.ComponentProps) {
  const {
    free,
    monthly,
    annual,
    perMonth,
    savingsPercent,
    annualWorthPromoting,
  } = loaderData;

  return (
    <div className="mx-auto max-w-4xl px-5 py-20">
      <header className="text-center">
        <h1 className="font-serif text-4xl text-[var(--color-bone)] sm:text-5xl">
          Free is genuinely free.
        </h1>
        <p className="mx-auto mt-5 max-w-xl leading-relaxed text-[var(--color-bone-muted)]">
          The habit costs nothing. The depth costs{" "}
          {formatCents(monthly.cents)} a month. That is the whole pricing
          model, and there is nothing else underneath it.
        </p>
      </header>

      <div className="mt-14 grid gap-5 sm:grid-cols-2">
        <Card className="flex flex-col">
          <h2 className="font-serif text-2xl text-[var(--color-bone)]">
            {free.name}
          </h2>
          <p className="mt-2 text-4xl text-[var(--color-bone)]">Free</p>
          <p className="mt-3 text-sm text-[var(--color-bone-muted)]">
            {free.tagline}
          </p>
          <ul className="mt-6 flex-1 space-y-2.5">
            {free.includes.map((item) => (
              <li key={item} className="flex gap-3 text-sm text-[var(--color-bone-muted)]">
                <span aria-hidden="true" className="text-[var(--color-amber-bright)]">
                  ·
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Button to="/welcome" variant="ghost" className="mt-8 w-full">
            Begin
          </Button>
        </Card>

        <Card className="flex flex-col border-[color-mix(in_oklab,var(--color-amber)_45%,transparent)]">
          <h2 className="font-serif text-2xl text-[var(--color-bone)]">
            {monthly.name}
          </h2>
          <p className="mt-2 text-4xl text-[var(--color-bone)]">
            {formatCents(monthly.cents)}
            <span className="text-base text-[var(--color-bone-faint)]">
              /month
            </span>
          </p>
          {annualWorthPromoting ? (
            <p className="mt-1 text-sm text-[var(--color-bone-muted)]">
              or {formatCents(annual.cents)} a year — {formatCents(perMonth)} a
              month, {savingsPercent}% less
            </p>
          ) : null}
          <p className="mt-3 text-sm text-[var(--color-bone-muted)]">
            {monthly.tagline}
          </p>
          <ul className="mt-6 flex-1 space-y-2.5">
            {monthly.includes.map((item) => (
              <li key={item} className="flex gap-3 text-sm text-[var(--color-bone-muted)]">
                <span aria-hidden="true" className="text-[var(--color-amber-bright)]">
                  ·
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Button to="/welcome" className="mt-8 w-full">
            Start free, upgrade later
          </Button>
        </Card>
      </div>

      <section className="mt-16">
        <h2 className="font-serif text-2xl text-[var(--color-bone)]">
          What we won&rsquo;t do
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            "Interrupt your first practice with a paywall.",
            "Run a countdown timer that isn't real.",
            "Take away your streak or your history if you stop paying.",
            "Charge you without telling you first.",
            "Call something free when it needs a card.",
            "Make you email someone to cancel.",
          ].map((item) => (
            <li
              key={item}
              className="rounded-2xl border border-[color-mix(in_oklab,var(--color-bone)_12%,transparent)] px-5 py-4 text-sm text-[var(--color-bone-muted)]"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="font-serif text-2xl text-[var(--color-bone)]">
          Questions
        </h2>
        <dl className="mt-6 space-y-6">
          {FAQS.map((faq) => (
            <div key={faq.q}>
              <dt className="text-[var(--color-bone)]">{faq.q}</dt>
              <dd className="mt-2 leading-relaxed text-[var(--color-bone-muted)]">
                {faq.a}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-16 text-center">
        <Button to="/welcome" size="lg">
          Begin your practice
        </Button>
      </div>

      <HealthDisclaimer className="mt-16" />
    </div>
  );
}
