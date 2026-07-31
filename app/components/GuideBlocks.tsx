import { Link } from "react-router";
import type { Block } from "~/content/guides";

/**
 * Renders a guide chapter.
 *
 * Large type, generous spacing, no pinch-and-zoom PDF anywhere in sight. The
 * `practice` block is the whole point of doing this natively — a link from the
 * middle of a paragraph straight into the practice being described.
 */
export function GuideBlocks({
  blocks,
  practiceHref = (slug: string) => `/practice/${slug}`,
  practiceTitle,
}: {
  blocks: readonly Block[];
  practiceHref?: (slug: string) => string;
  practiceTitle?: (slug: string) => string;
}) {
  return (
    <div className="space-y-6">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "h":
            return (
              <h3
                key={index}
                className="pt-2 font-serif text-2xl text-[var(--color-bone)]"
              >
                {block.text}
              </h3>
            );

          case "p":
            return (
              <p
                key={index}
                className="text-[1.05rem] leading-[1.8] text-[var(--color-bone-muted)]"
              >
                {block.text}
              </p>
            );

          case "quote":
            return (
              <figure key={index} className="py-2">
                <blockquote className="border-l-2 border-[var(--color-amber-bright)] pl-5 font-serif text-xl leading-relaxed text-[var(--color-bone)]">
                  {block.text}
                </blockquote>
                {block.attribution ? (
                  <figcaption className="mt-2 pl-5 text-sm text-[var(--color-bone-faint)]">
                    {block.attribution}
                  </figcaption>
                ) : null}
              </figure>
            );

          case "list":
            return (
              <ul key={index} className="space-y-3">
                {block.items.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 leading-[1.75] text-[var(--color-bone-muted)]"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-amber-bright)]"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );

          case "callout":
            return (
              <aside
                key={index}
                className={`rounded-2xl border p-5 ${
                  block.tone === "caution"
                    ? "border-[color-mix(in_oklab,var(--color-copper)_50%,transparent)] bg-[color-mix(in_oklab,var(--color-copper)_12%,transparent)]"
                    : "border-[color-mix(in_oklab,#7fb3a0_38%,transparent)] bg-[color-mix(in_oklab,#7fb3a0_10%,transparent)]"
                }`}
              >
                <h4 className="text-sm font-medium text-[var(--color-bone)]">
                  {block.title}
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-bone-muted)]">
                  {block.text}
                </p>
              </aside>
            );

          case "practice":
            return (
              <Link
                key={index}
                to={practiceHref(block.slug)}
                prefetch="intent"
                className="flex items-center justify-between gap-4 rounded-2xl border border-[color-mix(in_oklab,var(--color-amber)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-amber)_10%,transparent)] p-5 transition hover:bg-[color-mix(in_oklab,var(--color-amber)_16%,transparent)]"
              >
                <span>
                  <span className="block text-xs uppercase tracking-[0.18em] text-[var(--color-bone-faint)]">
                    Try it
                  </span>
                  <span className="mt-1.5 block font-serif text-xl text-[var(--color-bone)]">
                    {practiceTitle?.(block.slug) ?? block.slug}
                  </span>
                  <span className="mt-1 block text-sm text-[var(--color-bone-muted)]">
                    {block.note}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-[var(--color-amber-bright)]"
                >
                  →
                </span>
              </Link>
            );
        }
      })}
    </div>
  );
}
