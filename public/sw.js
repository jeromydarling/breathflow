/*
 * BreathFLOW service worker.
 *
 * This exists for one reason: Chrome will not fire `beforeinstallprompt`
 * without a registered service worker that has a fetch handler. So it is
 * deliberately the smallest thing that satisfies that, and it is paranoid
 * about what it will touch.
 *
 * It caches ONLY content-addressed build assets — files under /assets/ carry a
 * content hash in their name, so a cached copy can never be stale, and they
 * are identical for every visitor.
 *
 * It will never cache:
 *   • HTML documents. Every page in this app is server-rendered and many are
 *     personalised; a cached document could show one person's practice to
 *     someone else, or resurrect a page after sign-out.
 *   • Anything under /api/.
 *   • Any response carrying Set-Cookie.
 *   • Anything that is not a same-origin GET returning a clean 200.
 *
 * Everything it does not cache goes straight to the network, untouched.
 */

const CACHE = "breathflow-assets-v1";

/** Same-origin paths whose contents are immutable for a given URL. */
function isImmutableAsset(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname === "/favicon.svg" ||
    url.pathname === "/icon-192.png" ||
    url.pathname === "/icon-512.png" ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname === "/og-default.png"
  );
}

self.addEventListener("install", (event) => {
  // Take over promptly so an update cannot leave two versions racing.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older versions of this worker.
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("breathflow-") && name !== CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  // `mode: navigate` is a page load. Those are never cached — see above.
  if (request.mode === "navigate") return;
  if (!isImmutableAsset(url)) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      const response = await fetch(request);

      // Only store a clean, complete, cookie-free 200.
      if (
        response &&
        response.status === 200 &&
        response.type === "basic" &&
        !response.headers.has("Set-Cookie")
      ) {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
      }

      return response;
    })(),
  );
});
