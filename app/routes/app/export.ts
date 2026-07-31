import type { Route } from "./+types/export";
import { envFrom } from "~/lib/context";
import { requireUser } from "~/lib/auth.server";
import { exportOrg } from "~/lib/db.server";

/**
 * "Take my data", as a resource route.
 *
 * This has to be a route that returns a raw Response from a *loader* rather
 * than an action: React Router's single-fetch protocol serialises an action's
 * return value and re-renders the page, so a Response returned from an action
 * arrives as HTML, not a download. A GET resource route hands the bytes back
 * untouched — and it makes the download a plain link, which works without
 * JavaScript.
 *
 * Passwords and payment identifiers are stripped by `exportOrg` itself, via
 * NEVER_EXPORT_COLUMNS, so there is no way to forget here.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = envFrom(context);
  const user = await requireUser(request, env);

  const payload = await exportOrg(env.DB, user.org_id);
  const filename = `breathflow-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
