/**
 * Edge caching for anonymous public GETs.
 *
 * Marketing pages, guides and the machine-readable surfaces are identical for
 * every signed-out visitor, so they belong in the edge cache. Two rules keep
 * that safe:
 *
 *   1. Any request carrying a session cookie bypasses the shared cache
 *      entirely (`private`), so a signed-in header is never served to someone
 *      else.
 *   2. Only 200s without Set-Cookie are cacheable.
 *
 * Worth remembering: a cached page's server-stamped timestamps are stale by
 * definition. Anything per-visitor and time-sensitive gets stamped on the
 * client instead — see the year in the marketing footer, which is fine to be
 * a few hours old, versus a greeting, which is not and lives behind auth.
 */

import { hasSessionCookie } from "./auth.server";

/**
 * `stale-while-revalidate` is deliberately short.
 *
 * It was 86400, which meant a repeat visitor could be handed HTML up to a day
 * old — served instantly from the edge while revalidation happened behind
 * them. That makes a deploy effectively invisible to exactly the people most
 * likely to be checking it, and cost real time chasing a shipped fix that
 * looked like it had not shipped.
 *
 * Sixty seconds keeps the thundering-herd protection that SWR is actually for
 * and caps total staleness at roughly s-maxage + 1 minute.
 */
export function cacheAnonymousGet(seconds = 300): Record<string, string> {
  return {
    "Cache-Control": `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=60`,
    Vary: "Cookie, Accept-Encoding",
  };
}

/** Never store this in a shared cache. */
export function privateNoStore(): Record<string, string> {
  return {
    "Cache-Control": "private, no-store",
    Vary: "Cookie",
  };
}

/**
 * Pick the right policy for a request. Signed-in visitors always get
 * `private`, so a personalised header can never leak into a shared cache.
 */
export function cacheHeadersFor(
  request: Request,
  seconds = 300,
): Record<string, string> {
  if (request.method !== "GET" || hasSessionCookie(request)) {
    return privateNoStore();
  }
  const url = new URL(request.url);
  // Preview params make a page one-off by definition.
  if (url.searchParams.has("preview") || url.searchParams.has("token")) {
    return privateNoStore();
  }
  return cacheAnonymousGet(seconds);
}

/** Long, immutable caching for content-addressed assets (share cards, images). */
export function immutableAsset(): Record<string, string> {
  return { "Cache-Control": "public, max-age=31536000, immutable" };
}

/**
 * React Router's `headers()` export receives `loaderHeaders` and
 * `parentHeaders`, never the request — so a page cannot decide "is this
 * visitor signed in?" on its own.
 *
 * The marketing layout's loader makes that one decision for the whole subtree
 * and stamps it here; each page then only chooses its own TTL. One place knows
 * the rule, and no page can forget it.
 */
const CACHEABLE_HEADER = "X-BF-Cacheable";

export function stampCacheability(request: Request): Record<string, string> {
  const shared = cacheHeadersFor(request, 1)["Cache-Control"]!.startsWith(
    "public",
  );
  return { [CACHEABLE_HEADER]: shared ? "1" : "0" };
}

export function publicPageHeaders(
  headers: Headers,
  seconds: number,
): Record<string, string> {
  // Absent stamp means we could not tell — assume personalised and keep it out
  // of a shared cache. Failing closed is the right default here.
  const cacheable = headers.get(CACHEABLE_HEADER) === "1";

  return {
    ...(cacheable ? cacheAnonymousGet(seconds) : privateNoStore()),
    // Re-emit the stamp. `headers()` receives the *parent route's headers()
    // output* as `parentHeaders` — not the parent's loader headers — so
    // without this the decision would stop at the layout and every child page
    // would fail closed.
    [CACHEABLE_HEADER]: cacheable ? "1" : "0",
  };
}
