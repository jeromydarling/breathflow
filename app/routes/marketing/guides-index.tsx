import { Link } from "react-router";
import type { Route } from "./+types/guides-index";
import { envFrom } from "~/lib/context";
import {
  breadcrumbSchema,
  jsonLd,
  marketingMeta,
  originFrom,
} from "~/lib/seo";
import { publicGuides, readingMinutes } from "~/content/guides";
import { Button } from "~/components/ui";
import { publicPageHeaders } from "~/lib/cache.server";

const CATEGORY_LABEL: Record<string, string> = {
  foundations: "Foundations",
  practice: "Practice",
  safety: "Safety",
  integration: "Integration",
};

export async function loader({ request, context }: Route.LoaderArgs) {
  return {
    origin: originFrom(request, envFrom(context)),
    guides: publicGuides().map((guide) => ({
      slug: guide.slug,
      title: guide.title,
      description: guide.description,
      category: guide.category,
      minutes: readingMinutes(guide),
    })),
  };
}

export function headers({ parentHeaders }: Route.HeadersArgs) {
  return publicPageHeaders(parentHeaders, 600);
}

export function meta({ loaderData }: Route.MetaArgs) {
  const origin = loaderData?.origin ?? "";
  return [
    ...marketingMeta({
      title: "Guides",
      description:
        "Free, honest writing on pranayama, nervous-system regulation, breath retention safety, and building a daily practice that survives a real life.",
      path: "/guides",
      origin,
    }),
    jsonLd(
      breadcrumbSchema(origin, [
        { name: "BreathFLOW", path: "/" },
        { name: "Guides", path: "/guides" },
      ]),
    ),
  ];
}

export default function GuidesIndex({ loaderData }: Route.ComponentProps) {
  const { guides } = loaderData;

  return (
    <div className="mx-auto max-w-3xl px-5 py-20">
      <header>
        <h1 className="font-serif text-4xl text-[var(--color-bone)]">Guides</h1>
        <p className="mt-5 max-w-xl leading-relaxed text-[var(--color-bone-muted)]">
          Everything here is free and needs no account. It is also what we
          actually believe — including the parts where the research is thinner
          than the marketing usually admits.
        </p>
      </header>

      <ul className="mt-12 space-y-4">
        {guides.map((guide) => (
          <li key={guide.slug}>
            <Link
              to={`/guides/${guide.slug}`}
              prefetch="intent"
              className="block rounded-2xl border border-[color-mix(in_oklab,var(--color-bone)_12%,transparent)] p-6 transition hover:bg-[color-mix(in_oklab,var(--color-bone)_5%,transparent)]"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-bone-faint)]">
                {CATEGORY_LABEL[guide.category]} · {guide.minutes} min read
              </p>
              <h2 className="mt-3 font-serif text-2xl text-[var(--color-bone)]">
                {guide.title}
              </h2>
              <p className="mt-2 leading-relaxed text-[var(--color-bone-muted)]">
                {guide.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-16 text-center">
        <p className="text-[var(--color-bone-muted)]">
          Reading is good. Practising is better.
        </p>
        <Button to="/welcome" size="lg" className="mt-6">
          Begin your practice
        </Button>
      </div>
    </div>
  );
}
