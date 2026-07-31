import type { Route } from "./+types/llms";
import { envFrom } from "~/lib/context";
import { PLANS, formatCents } from "~/lib/pricing";
import { originFrom } from "~/lib/seo";
import { renderLlmsTxt } from "~/lib/sitemap";

/**
 * llms.txt — the AI-findability surface.
 *
 * The price comes from pricing.ts, so an assistant can never quote a number
 * we stopped charging.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const origin = originFrom(request, envFrom(context));
  return new Response(
    renderLlmsTxt(origin, formatCents(PLANS.monthly.cents)),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=3600",
      },
    },
  );
}
