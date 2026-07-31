import type { Route } from "./+types/robots";
import { envFrom } from "~/lib/context";
import { originFrom } from "~/lib/seo";
import { renderRobots } from "~/lib/sitemap";

export async function loader({ request, context }: Route.LoaderArgs) {
  const origin = originFrom(request, envFrom(context));
  return new Response(renderRobots(origin), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
