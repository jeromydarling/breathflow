import { useEffect } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  Link,
} from "react-router";
import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "apple-touch-icon", href: "/icon-192.png" },
  { rel: "manifest", href: "/manifest.webmanifest" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        {/*
          viewport-fit=cover so the player can go edge to edge on a notched
          phone. No maximum-scale — pinch-zoom stays available, because
          disabling it breaks the app for anyone who needs to zoom.
        */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#171a18" />
        <Meta />
        <Links />
        {/*
          Capture `beforeinstallprompt` before React hydrates.

          Chrome fires it as soon as it decides the app is installable, which
          is routinely earlier than a React bundle finishes hydrating. An
          effect-based listener therefore misses it outright and the install
          prompt simply never appears — silently, and only in production-like
          conditions. Stashing it here means the component can pick it up
          whenever it mounts.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){window.__bfInstallEvent=null;" +
              "window.addEventListener('beforeinstallprompt',function(e){" +
              "e.preventDefault();window.__bfInstallEvent=e;" +
              "window.dispatchEvent(new Event('bf:installready'));});" +
              "window.addEventListener('appinstalled',function(){" +
              "window.__bfInstallEvent=null;});})();",
          }}
        />
      </head>
      <body className="min-h-full antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  useServiceWorker();
  return <Outlet />;
}

/**
 * Registers the service worker.
 *
 * It caches only content-hashed build assets — never a page, never an API
 * response (see public/sw.js). Its real job is that Chrome will not offer to
 * install a web app without one.
 */
function useServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Registration is not urgent and competes with the first render for
    // bandwidth, so let the page settle first.
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        // A failed registration costs us the install prompt, nothing else.
        console.warn("service worker registration failed", error);
      });
    }, 2000);
    return () => window.clearTimeout(id);
  }, []);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let heading = "Something went quiet";
  let message =
    "Not your fault, and nothing you did. Take a breath — we'll get you back.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      heading = "This page isn't here";
      message =
        "The link may have moved, or it may never have existed. Either way, your practice is still where you left it.";
    } else {
      heading = "Something went quiet";
      message =
        error.statusText ||
        "Not your fault, and nothing you did. Take a breath — we'll get you back.";
    }
  } else if (import.meta.env.DEV && error instanceof Error) {
    message = error.message;
    stack = error.stack;
  }

  return (
    <main className="bf-still flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <div
        aria-hidden="true"
        className="bf-orb-motion h-24 w-24 rounded-full bg-[var(--color-amber)] opacity-40 blur-xl"
      />
      <h1 className="font-serif text-3xl text-[var(--color-bone)]">{heading}</h1>
      <p className="max-w-sm text-[var(--color-bone-muted)]">{message}</p>
      <Link
        to="/"
        className="rounded-full bg-[var(--color-bone)] px-6 py-3 font-medium text-[var(--color-charcoal)] transition hover:bg-white"
      >
        Come back home
      </Link>
      {stack ? (
        <pre className="mt-6 max-w-full overflow-x-auto rounded-xl bg-black/40 p-4 text-left text-xs text-[var(--color-bone-faint)]">
          <code>{stack}</code>
        </pre>
      ) : null}
    </main>
  );
}
