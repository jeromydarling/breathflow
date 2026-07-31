import { Link } from "react-router";
import type { Route } from "./+types/guide";
import { envFrom } from "~/lib/context";
import {
  articleSchema,
  breadcrumbSchema,
  faqSchema,
  jsonLd,
  marketingMeta,
  originFrom,
} from "~/lib/seo";
import { getGuide, orderedGuides, readingMinutes } from "~/content/guides";
import { getPractice } from "~/content/practices";
import { GuideBlocks } from "~/components/GuideBlocks";
import { Button } from "~/components/ui";
import { publicPageHeaders } from "~/lib/cache.server";

/**
 * The public version of a guide.
 *
 * Whole thing on one page — this is the SEO and AI-findability surface, so it
 * needs to be complete and crawlable in a single fetch. The chaptered reader
 * inside the app is the same content, paced differently.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const guide = getGuide(params.slug);
  if (!guide || !guide.public) throw new Response("Not found", { status: 404 });

  const all = orderedGuides().filter((g) => g.public);
  const index = all.findIndex((g) => g.slug === guide.slug);

  return {
    origin: originFrom(request, envFrom(context)),
    guide: {
      slug: guide.slug,
      title: guide.title,
      h1: guide.h1,
      description: guide.description,
      minutes: readingMinutes(guide),
      chapters: guide.chapters,
      faq: guide.faq ?? [],
    },
    practiceTitles: Object.fromEntries(
      guide.chapters.flatMap((chapter) =>
        chapter.blocks.flatMap((block) =>
          block.type === "practice"
            ? [[block.slug, getPractice(block.slug)?.title ?? block.slug]]
            : [],
        ),
      ),
    ) as Record<string, string>,
    siblings: {
      previous: index > 0 ? { slug: all[index - 1]!.slug, title: all[index - 1]!.title } : null,
      next:
        index < all.length - 1
          ? { slug: all[index + 1]!.slug, title: all[index + 1]!.title }
          : null,
    },
  };
}

export function headers({ parentHeaders }: Route.HeadersArgs) {
  return publicPageHeaders(parentHeaders, 900);
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Guide · BreathFLOW" }];
  const { origin, guide } = loaderData;
  const path = `/guides/${guide.slug}`;

  return [
    ...marketingMeta({
      title: guide.title,
      description: guide.description,
      path,
      origin,
      type: "article",
    }),
    jsonLd(
      articleSchema({
        origin,
        path,
        headline: guide.h1,
        description: guide.description,
      }),
    ),
    jsonLd(
      breadcrumbSchema(origin, [
        { name: "BreathFLOW", path: "/" },
        { name: "Guides", path: "/guides" },
        { name: guide.title, path },
      ]),
    ),
    ...(guide.faq.length > 0 ? [jsonLd(faqSchema(guide.faq))] : []),
  ];
}

export default function PublicGuide({ loaderData }: Route.ComponentProps) {
  const { guide, practiceTitles, siblings } = loaderData;

  return (
    <article className="mx-auto max-w-2xl px-5 py-20">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link
          to="/guides"
          className="text-[var(--color-bone-muted)] underline underline-offset-4 hover:text-[var(--color-bone)]"
        >
          Guides
        </Link>
      </nav>

      <header className="mt-6">
        <h1 className="font-serif text-4xl leading-tight text-[var(--color-bone)]">
          {guide.h1}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-[var(--color-bone-muted)]">
          {guide.description}
        </p>
        <p className="mt-4 text-sm text-[var(--color-bone-faint)]">
          {guide.minutes} min read · free, no account needed
        </p>
      </header>

      <div className="mt-12 space-y-14">
        {guide.chapters.map((chapter) => (
          <section key={chapter.title}>
            <h2 className="font-serif text-3xl text-[var(--color-bone)]">
              {chapter.title}
            </h2>
            <div className="mt-6">
              <GuideBlocks
                blocks={chapter.blocks}
                practiceHref={() => "/welcome"}
                practiceTitle={(slug) => practiceTitles[slug] ?? slug}
              />
            </div>
          </section>
        ))}
      </div>

      {guide.faq.length > 0 ? (
        <section className="mt-16 border-t border-[color-mix(in_oklab,var(--color-bone)_12%,transparent)] pt-12">
          <h2 className="font-serif text-3xl text-[var(--color-bone)]">
            Questions
          </h2>
          <dl className="mt-6 space-y-6">
            {guide.faq.map((item) => (
              <div key={item.q}>
                <dt className="text-[var(--color-bone)]">{item.q}</dt>
                <dd className="mt-2 leading-[1.8] text-[var(--color-bone-muted)]">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="mt-16 rounded-3xl border border-[color-mix(in_oklab,var(--color-amber)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-amber)_8%,transparent)] p-8 text-center">
        <p className="font-serif text-2xl text-[var(--color-bone)]">
          Reading about the breath is not the same as breathing.
        </p>
        <p className="mt-3 text-[var(--color-bone-muted)]">
          Three minutes is enough to begin, and it&rsquo;s free.
        </p>
        <Button to="/welcome" size="lg" className="mt-6">
          Begin your practice
        </Button>
      </section>

      <nav
        aria-label="More guides"
        className="mt-12 flex items-center justify-between gap-4 border-t border-[color-mix(in_oklab,var(--color-bone)_12%,transparent)] pt-8 text-sm"
      >
        {siblings.previous ? (
          <Link
            to={`/guides/${siblings.previous.slug}`}
            className="text-[var(--color-bone-muted)] underline underline-offset-4 hover:text-[var(--color-bone)]"
          >
            ← {siblings.previous.title}
          </Link>
        ) : (
          <span />
        )}
        {siblings.next ? (
          <Link
            to={`/guides/${siblings.next.slug}`}
            className="text-right text-[var(--color-bone-muted)] underline underline-offset-4 hover:text-[var(--color-bone)]"
          >
            {siblings.next.title} →
          </Link>
        ) : null}
      </nav>
    </article>
  );
}
