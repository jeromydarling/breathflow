import type { Route } from "./+types/sitemap";
import { envFrom } from "~/lib/context";
import { originFrom } from "~/lib/seo";
import { renderSitemap } from "~/lib/sitemap";

/**
 * Generated from the real content registry, so it is never stale — adding a
 * guide adds a sitemap entry with no second step to forget.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const origin = originFrom(request, envFrom(context));
  return new Response(renderSitemap(origin), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
