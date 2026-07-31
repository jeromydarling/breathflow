import { Link } from "react-router";
import type { Route } from "./+types/guides";
import { envFrom } from "~/lib/context";
import { requireOnboardedUser } from "~/lib/auth.server";
import { all } from "~/lib/db.server";
import { orderedGuides, readingMinutes } from "~/content/guides";
import { SectionHeading } from "~/components/ui";
import { privateNoStore } from "~/lib/cache.server";

const CATEGORY_LABEL: Record<string, string> = {
  foundations: "Foundations",
  practice: "Practice",
  safety: "Safety",
  integration: "Integration",
};

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = envFrom(context);
  const user = await requireOnboardedUser(request, env);

  const progress = await all<{ guide_slug: string; chapter_index: number }>(
    env.DB,
    `SELECT guide_slug, chapter_index FROM guide_progress WHERE user_id = ?`,
    user.id,
  );
  const bookmarks = new Map(
    progress.map((row) => [row.guide_slug, row.chapter_index]),
  );

  return {
    guides: orderedGuides().map((guide) => ({
      slug: guide.slug,
      title: guide.title,
      description: guide.description,
      category: guide.category,
      minutes: readingMinutes(guide),
      chapters: guide.chapters.length,
      bookmark: bookmarks.get(guide.slug) ?? null,
    })),
  };
}

export function headers() {
  return privateNoStore();
}

export function meta() {
  return [
    { title: "Guides · BreathFLOW" },
    { name: "robots", content: "noindex" },
  ];
}

export default function Guides({ loaderData }: Route.ComponentProps) {
  const { guides } = loaderData;

  return (
    <div className="mx-auto max-w-lg">
      <header className="pt-2">
        <h1 className="font-serif text-3xl text-[var(--color-bone)]">
          The library
        </h1>
        <p className="mt-1 text-sm text-[var(--color-bone-faint)]">
          Written to be read on a phone, not downloaded and lost in a folder.
        </p>
      </header>

      <ul className="mt-6 space-y-3">
        {guides.map((guide) => (
          <li key={guide.slug}>
            <Link
              to={`/library/${guide.slug}`}
              prefetch="intent"
              className="block rounded-2xl border border-[color-mix(in_oklab,var(--color-bone)_14%,transparent)] p-5 transition hover:bg-[color-mix(in_oklab,var(--color-bone)_6%,transparent)]"
            >
              <SectionHeading>{CATEGORY_LABEL[guide.category]}</SectionHeading>
              <h2 className="mt-2 font-serif text-xl text-[var(--color-bone)]">
                {guide.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-bone-muted)]">
                {guide.description}
              </p>
              <p className="mt-3 text-xs text-[var(--color-bone-faint)]">
                {guide.minutes} min read
                {guide.bookmark !== null && guide.bookmark > 0
                  ? ` · you're on chapter ${guide.bookmark + 1} of ${guide.chapters}`
                  : ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
