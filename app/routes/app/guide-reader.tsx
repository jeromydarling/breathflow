import { useEffect } from "react";
import { Link, useFetcher, useSearchParams } from "react-router";
import type { Route } from "./+types/guide-reader";
import { runtimeFrom } from "~/lib/context";
import { safeFormData } from "~/lib/form.server";
import { requireOnboardedUser } from "~/lib/auth.server";
import { one, run } from "~/lib/db.server";
import { newId } from "~/lib/ids";
import { getGuide, readingMinutes } from "~/content/guides";
import { getPractice } from "~/content/practices";
import { EVENTS, track } from "~/lib/analytics.server";
import { GuideBlocks } from "~/components/GuideBlocks";
import { Button, SectionHeading } from "~/components/ui";
import { privateNoStore } from "~/lib/cache.server";

/**
 * The chapter reader.
 *
 * One chapter per screen, position saved automatically so picking it up
 * tomorrow lands exactly where you stopped.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env, ctx } = runtimeFrom(context);
  const user = await requireOnboardedUser(request, env);

  const guide = getGuide(params.slug);
  if (!guide) throw new Response("Not found", { status: 404 });

  const saved = await one<{ chapter_index: number }>(
    env.DB,
    `SELECT chapter_index FROM guide_progress WHERE user_id = ? AND guide_slug = ?`,
    user.id,
    guide.slug,
  );

  const requested = Number(new URL(request.url).searchParams.get("chapter"));
  const chapterIndex = Number.isInteger(requested)
    ? Math.min(Math.max(0, requested), guide.chapters.length - 1)
    : (saved?.chapter_index ?? 0);

  ctx.waitUntil(
    track(env, {
      name: EVENTS.guideOpened,
      orgId: user.org_id,
      userId: user.id,
      props: { slug: guide.slug, chapter: chapterIndex },
    }),
  );

  return {
    guide: {
      slug: guide.slug,
      title: guide.title,
      minutes: readingMinutes(guide),
      chapterTitles: guide.chapters.map((c) => c.title),
    },
    chapterIndex,
    chapter: guide.chapters[chapterIndex]!,
    // Titles for any practice this chapter links to, resolved server-side.
    practiceTitles: Object.fromEntries(
      guide.chapters[chapterIndex]!.blocks.flatMap((block) =>
        block.type === "practice"
          ? [[block.slug, getPractice(block.slug)?.title ?? block.slug]]
          : [],
      ),
    ) as Record<string, string>,
    resumedFromBookmark: saved ? saved.chapter_index === chapterIndex : false,
  };
}

export function headers() {
  return privateNoStore();
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `${loaderData?.guide.title ?? "Guide"} · BreathFLOW` },
    { name: "robots", content: "noindex" },
  ];
}

/** Bookmarks are written by a fetcher, so reading never blocks on a write. */
export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = runtimeFrom(context);
  const user = await requireOnboardedUser(request, env);
  const form = await safeFormData(request);

  const guide = getGuide(params.slug);
  if (!guide) return { saved: false };

  const chapterIndex = Math.min(
    Math.max(0, Number(form.get("chapter") ?? 0)),
    guide.chapters.length - 1,
  );
  const now = Date.now();

  await run(
    env.DB,
    `INSERT INTO guide_progress (id, org_id, user_id, guide_slug, chapter_index, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, guide_slug)
     DO UPDATE SET chapter_index = excluded.chapter_index, updated_at = excluded.updated_at`,
    newId("guideProgress"),
    user.org_id,
    user.id,
    guide.slug,
    chapterIndex,
    now,
  );

  return { saved: true };
}

export default function GuideReader({ loaderData }: Route.ComponentProps) {
  const { guide, chapter, chapterIndex, practiceTitles } = loaderData;
  const [searchParams] = useSearchParams();
  const bookmark = useFetcher();

  // Save the position on arrival, quietly.
  useEffect(() => {
    bookmark.submit(
      { chapter: String(chapterIndex) },
      { method: "post" },
    );
    // Only when the chapter actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterIndex]);

  const isFirst = chapterIndex === 0;
  const isLast = chapterIndex === guide.chapterTitles.length - 1;

  return (
    <article className="mx-auto max-w-lg pt-2">
      <header>
        <Link
          to="/library"
          className="text-sm text-[var(--color-bone-muted)] underline underline-offset-4"
        >
          ← The library
        </Link>

        <p className="mt-5 text-xs uppercase tracking-[0.2em] text-[var(--color-bone-faint)]">
          {guide.title} · {guide.minutes} min read
        </p>

        <h1 className="mt-3 font-serif text-3xl leading-tight text-[var(--color-bone)]">
          {chapter.title}
        </h1>

        <p className="mt-2 text-sm text-[var(--color-bone-faint)]">
          Chapter {chapterIndex + 1} of {guide.chapterTitles.length}
          {searchParams.get("chapter") === null && chapterIndex > 0
            ? " · picked up where you left off"
            : ""}
        </p>
      </header>

      <div className="mt-8">
        <GuideBlocks
          blocks={chapter.blocks}
          practiceHref={(slug) => `/practice/${slug}`}
          practiceTitle={(slug) => practiceTitles[slug] ?? slug}
        />
      </div>

      <nav
        aria-label="Chapters"
        className="mt-12 flex items-center justify-between gap-3 border-t border-[color-mix(in_oklab,var(--color-bone)_12%,transparent)] pt-6"
      >
        {isFirst ? (
          <span />
        ) : (
          <Button
            to={`/library/${guide.slug}?chapter=${chapterIndex - 1}`}
            variant="ghost"
            size="sm"
          >
            ← Previous
          </Button>
        )}

        {isLast ? (
          <Button to="/library" size="sm">
            Finish
          </Button>
        ) : (
          <Button to={`/library/${guide.slug}?chapter=${chapterIndex + 1}`} size="sm">
            Next →
          </Button>
        )}
      </nav>

      <section className="mt-10">
        <SectionHeading>In this guide</SectionHeading>
        <ol className="mt-3 space-y-1">
          {guide.chapterTitles.map((title, index) => (
            <li key={title}>
              <Link
                to={`/library/${guide.slug}?chapter=${index}`}
                className={`block rounded-lg px-3 py-2 text-sm transition ${
                  index === chapterIndex
                    ? "bg-[color-mix(in_oklab,var(--color-bone)_8%,transparent)] text-[var(--color-bone)]"
                    : "text-[var(--color-bone-muted)] hover:text-[var(--color-bone)]"
                }`}
                aria-current={index === chapterIndex ? "true" : undefined}
              >
                {index + 1}. {title}
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
