import { Link, NavLink, Outlet, data } from "react-router";
import type { Route } from "./+types/layout";
import { getUser } from "~/lib/auth.server";
import { envFrom } from "~/lib/context";
import { Wordmark } from "~/components/ui";
import { publicPageHeaders, stampCacheability } from "~/lib/cache.server";

/**
 * The public marketing shell.
 *
 * Anonymous GETs here are edge-cached (see `headers`), which is why the only
 * personalisation is a single "signed in?" flag — and why we bypass the cache
 * entirely the moment a session cookie is present.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = envFrom(context);
  const user = await getUser(request, env);

  // One decision for the whole public subtree: may a shared cache hold this
  // visitor's response at all? Child pages read it and pick only a TTL.
  return data(
    { signedIn: Boolean(user) },
    { headers: stampCacheability(request) },
  );
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return publicPageHeaders(loaderHeaders, 300);
}

const NAV = [
  { to: "/guides", label: "Guides" },
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "Bezz" },
  { to: "/safety", label: "Safety" },
];

export default function MarketingLayout({ loaderData }: Route.ComponentProps) {
  const { signedIn } = loaderData;

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-charcoal)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-[var(--color-bone)] focus:px-4 focus:py-2 focus:text-[var(--color-charcoal)]"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-[color-mix(in_oklab,var(--color-bone)_10%,transparent)] bg-[color-mix(in_oklab,var(--color-charcoal)_82%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link to="/" className="text-[var(--color-bone)]" aria-label="BreathFLOW home">
            <Wordmark className="text-sm" />
          </Link>

          <nav aria-label="Main" className="hidden gap-7 sm:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                prefetch="intent"
                className={({ isActive }) =>
                  `text-sm transition ${
                    isActive
                      ? "text-[var(--color-bone)]"
                      : "text-[var(--color-bone-muted)] hover:text-[var(--color-bone)]"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {signedIn ? (
              <Link
                to="/home"
                prefetch="intent"
                className="rounded-full bg-[var(--color-bone)] px-4 py-2 text-sm font-medium text-[var(--color-charcoal)]"
              >
                Your practice
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm text-[var(--color-bone-muted)] transition hover:text-[var(--color-bone)]"
                >
                  Sign in
                </Link>
                <Link
                  to="/welcome"
                  prefetch="intent"
                  className="rounded-full bg-[var(--color-bone)] px-4 py-2 text-sm font-medium text-[var(--color-charcoal)]"
                >
                  Begin
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-[color-mix(in_oklab,var(--color-bone)_10%,transparent)] px-5 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
            <div className="max-w-xs">
              <Wordmark className="text-sm text-[var(--color-bone)]" />
              <p className="mt-3 font-serif text-lg text-[var(--color-bone-muted)]">
                Deep Breath. Deep Life.
              </p>
              <p className="mt-2 text-sm text-[var(--color-bone-faint)]">
                Tap into your life force. Return to flow.
              </p>
            </div>

            <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
              {[
                { to: "/guides", label: "Guides" },
                { to: "/pricing", label: "Pricing" },
                { to: "/about", label: "About Bezz" },
                { to: "/safety", label: "Safety" },
                { to: "/privacy", label: "Privacy" },
                { to: "/terms", label: "Terms" },
                { to: "/demo", label: "Try the demo" },
                { to: "/login", label: "Sign in" },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="text-[var(--color-bone-muted)] transition hover:text-[var(--color-bone)]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <p className="mt-10 text-xs leading-relaxed text-[var(--color-bone-faint)]">
            BreathFLOW is a wellbeing practice, not healthcare. It does not
            diagnose, treat, cure or prevent any condition. Inspired by the
            ancient practice of pranayama and translated into modern rituals for
            everyday life.
          </p>
          <p className="mt-4 text-xs text-[var(--color-bone-faint)]">
            © {new Date().getFullYear()} BreathFLOW Practice.
          </p>
        </div>
      </footer>
    </div>
  );
}
