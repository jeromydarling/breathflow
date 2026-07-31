import type { Route } from "./+types/share-card";
import { immutableAsset } from "~/lib/cache.server";
import {
  CARD_FORMATS,
  type CardFormat,
  type CardKind,
  contentFor,
  renderCardSvg,
  themeFor,
} from "~/lib/sharecard";

/**
 * Share-card image endpoint.
 *
 * Everything the card shows arrives in the URL, and the URL is generated
 * server-side from the signed-in user's real numbers. That means:
 *   • the image itself needs no session, so it can be fetched by a share
 *     sheet, a preview crawler or a download;
 *   • it is content-addressed, so it caches immutably;
 *   • and there is nothing private to leak, because a note or reflection can
 *     never be encoded into it — `contentFor` has no parameter for one.
 *
 * Values are clamped rather than trusted. Someone crafting a URL can produce a
 * card claiming a big number, which is exactly as consequential as typing a
 * big number into an image editor.
 */
export async function loader({ params, request }: Route.LoaderArgs) {
  const url = new URL(request.url);

  const kind = (url.searchParams.get("kind") ?? "minutes") as CardKind;
  const themeKey = url.searchParams.get("theme") ?? "dawn";
  const formatParam = url.searchParams.get("format");
  const format: CardFormat =
    formatParam === "feed" || formatParam === "story" ? formatParam : "story";

  const clamp = (name: string, max: number) => {
    const raw = Number(url.searchParams.get(name) ?? 0);
    if (!Number.isFinite(raw) || raw < 0) return 0;
    return Math.min(Math.floor(raw), max);
  };

  const content = contentFor(kind, {
    streak: clamp("streak", 100_000),
    minutes: clamp("minutes", 10_000_000),
    weekDays: clamp("week", 7),
    retentionSeconds: clamp("hold", 3600),
    journeyTitle: (url.searchParams.get("title") ?? "").slice(0, 60),
    sessionTitle: (url.searchParams.get("title") ?? "").slice(0, 60),
    achievementName: (url.searchParams.get("title") ?? "").slice(0, 60),
  });

  const svg = renderCardSvg({
    theme: themeFor(themeKey),
    format,
    content,
    withBezz: url.searchParams.get("bezz") === "1",
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `inline; filename="breathflow-${params.token.replace(/[^a-z0-9-]/gi, "") || "card"}.svg"`,
      "X-Card-Size": `${CARD_FORMATS[format].width}x${CARD_FORMATS[format].height}`,
      ...immutableAsset(),
    },
  });
}
