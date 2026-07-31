import { Link } from "react-router";
import type { Route } from "./+types/compare";
import { envFrom } from "~/lib/context";
import {
  articleSchema,
  breadcrumbSchema,
  jsonLd,
  marketingMeta,
  originFrom,
} from "~/lib/seo";
import { getComparison, orderedComparisons } from "~/content/comparisons";
import { PLANS, formatCents } from "~/lib/pricing";
import { Button } from "~/components/ui";
import { publicPageHeaders } from "~/lib/cache.server";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const comparison = getComparison(params.slug);
  if (!comparison) throw new Response("Not found", { status: 404 });

  return {
    origin: originFrom(request, envFrom(context)),
    comparison,
    // Read from pricing.ts so a price change can never leave a stale claim
    // sitting on a comparison page.
    monthlyPrice: formatCents(PLANS.monthly.cents),
    others: orderedComparisons()
      .filter((c) => c.slug !== comparison.slug)
      .map((c) => ({ slug: c.slug, title: c.title })),
  };
}

export function headers({ parentHeaders }: Route.HeadersArgs) {
  return publicPageHeaders(parentHeaders, 900);
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Compare · BreathFLOW" }];
  const { origin, comparison } = loaderData;
  const path = `/compare/${comparison.slug}`;

  return [
    ...marketingMeta({
      title: comparison.title,
      description: comparison.description,
      path,
      origin,
      type: "article",
    }),
    jsonLd(
      articleSchema({
        origin,
        path,
        headline: comparison.title,
        description: comparison.description,
      }),
    ),
    jsonLd(
      breadcrumbSchema(origin, [
        { name: "BreathFLOW", path: "/" },
        { name: comparison.title, path },
      ]),
    ),
  ];
}

export default function Compare({ loaderData }: Route.ComponentProps) {
  const { comparison, monthlyPrice, others } = loaderData;

  return (
    <article className="mx-auto max-w-2xl px-5 py-20">
      <h1 className="font-serif text-4xl leading-tight text-[var(--color-bone)]">
        {comparison.title}
      </h1>

      <p className="mt-8 rounded-2xl border border-[color-mix(in_oklab,var(--color-bone)_14%,transparent)] bg-[color-mix(in_oklab,var(--color-bone)_5%,transparent)] p-6 text-lg leading-relaxed text-[var(--color-bone)]">
        {comparison.verdict}
      </p>

      <section className="mt-14">
        <h2 className="font-serif text-2xl text-[var(--color-bone)]">
          Where {comparison.competitor} are better
        </h2>
        <p className="mt-2 text-sm text-[var(--color-bone-faint)]">
          Genuinely. We would rather you knew.
        </p>
        <ul className="mt-6 space-y-6">
          {comparison.theyreBetter.map((item) => (
            <li key={item.point}>
              <h3 className="text-[var(--color-bone)]">{item.point}</h3>
              <p className="mt-2 leading-[1.8] text-[var(--color-bone-muted)]">
                {item.detail}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="font-serif text-2xl text-[var(--color-bone)]">
          Where we think we&rsquo;re better
        </h2>
        <ul className="mt-6 space-y-6">
          {comparison.wereBetter.map((item) => (
            <li key={item.point}>
              <h3 className="text-[var(--color-bone)]">{item.point}</h3>
              <p className="mt-2 leading-[1.8] text-[var(--color-bone-muted)]">
                {item.detail}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[color-mix(in_oklab,var(--color-bone)_12%,transparent)] p-6">
          <h3 className="text-sm uppercase tracking-[0.18em] text-[var(--color-bone-faint)]">
            Choose them if
          </h3>
          <p className="mt-3 leading-relaxed text-[var(--color-bone-muted)]">
            {comparison.chooseThem}
          </p>
        </div>
        <div className="rounded-2xl border border-[color-mix(in_oklab,var(--color-amber)_38%,transparent)] bg-[color-mix(in_oklab,var(--color-amber)_8%,transparent)] p-6">
          <h3 className="text-sm uppercase tracking-[0.18em] text-[var(--color-bone-faint)]">
            Choose BreathFLOW if
          </h3>
          <p className="mt-3 leading-relaxed text-[var(--color-bone-muted)]">
            {comparison.chooseUs}
          </p>
        </div>
      </section>

      <section className="mt-14 text-center">
        <p className="text-[var(--color-bone-muted)]">
          The daily habit is free. Deep Practice is {monthlyPrice} a month.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button to="/welcome" size="lg">
            Try it free
          </Button>
          <Button to="/pricing" variant="ghost" size="lg">
            See the full pricing
          </Button>
        </div>
      </section>

      {others.length > 0 ? (
        <nav aria-label="Other comparisons" className="mt-14 border-t border-[color-mix(in_oklab,var(--color-bone)_12%,transparent)] pt-8">
          <ul className="space-y-2 text-sm">
            {others.map((other) => (
              <li key={other.slug}>
                <Link
                  to={`/compare/${other.slug}`}
                  className="text-[var(--color-bone-muted)] underline underline-offset-4 hover:text-[var(--color-bone)]"
                >
                  {other.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </article>
  );
}
