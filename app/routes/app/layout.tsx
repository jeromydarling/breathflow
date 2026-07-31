import { Form, Link, NavLink, Outlet } from "react-router";
import type { Route } from "./+types/layout";
import { envFrom } from "~/lib/context";
import { requireOnboardedUser } from "~/lib/auth.server";
import { getAccess } from "~/lib/membership.server";
import { privateNoStore } from "~/lib/cache.server";
import { Wordmark } from "~/components/ui";

/**
 * The four-destination app shell: Home, Practice, Progress, Bezz.
 *
 * There is no fifth tab. Settings, membership and account live behind the
 * avatar in the top-right, exactly as the brief specifies — every extra tab
 * is a decision the user has to make before they can breathe.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = envFrom(context);
  const user = await requireOnboardedUser(request, env);
  const access = await getAccess(env, user);

  return {
    name: user.name,
    isDemo: user.is_demo === 1,
    entitlement: access.entitlement,
    initial: (user.name.trim()[0] ?? user.email[0] ?? "?").toUpperCase(),
  };
}

export function headers() {
  return privateNoStore();
}

const TABS = [
  { to: "/home", label: "Home", icon: HomeIcon },
  { to: "/practice", label: "Practice", icon: PracticeIcon },
  { to: "/progress", label: "Progress", icon: ProgressIcon },
  { to: "/bezz", label: "Bezz", icon: BezzIcon },
] as const;

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const { isDemo, initial } = loaderData;

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-charcoal)]">
      <a
        href="#app-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-[var(--color-bone)] focus:px-4 focus:py-2 focus:text-[var(--color-charcoal)]"
      >
        Skip to content
      </a>

      {isDemo ? <DemoBanner /> : null}

      <header className="flex items-center justify-between px-5 pb-2 pt-5">
        <Link to="/home" className="text-[var(--color-bone)]">
          <Wordmark className="text-xs" />
        </Link>

        <Link
          to="/settings"
          aria-label="Settings and account"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--color-bone)_22%,transparent)] text-sm text-[var(--color-bone)] transition hover:bg-[color-mix(in_oklab,var(--color-bone)_10%,transparent)]"
        >
          {initial}
        </Link>
      </header>

      {/* pb accounts for the fixed tab bar plus the home indicator. */}
      <main id="app-main" className="flex-1 px-5 pb-32 pt-2">
        <Outlet />
      </main>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[color-mix(in_oklab,var(--color-bone)_10%,transparent)] bg-[color-mix(in_oklab,var(--color-charcoal)_88%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
      >
        <ul className="mx-auto flex max-w-lg">
          {TABS.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                prefetch="intent"
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-3 text-[0.68rem] transition ${
                    isActive
                      ? "text-[var(--color-amber-bright)]"
                      : "text-[var(--color-bone-faint)] hover:text-[var(--color-bone-muted)]"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <tab.icon active={isActive} />
                    <span>{tab.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function DemoBanner() {
  return (
    <div className="bg-[color-mix(in_oklab,var(--color-amber)_22%,transparent)] px-5 py-2.5 text-center text-xs text-[var(--color-bone)]">
      You&rsquo;re in the demo practice — everything works, nothing is yours,
      and it resets each night.{" "}
      <Form method="post" action="/logout" className="inline">
        <button
          type="submit"
          className="underline underline-offset-4 hover:text-white"
        >
          Leave the demo
        </button>
      </Form>
    </div>
  );
}

/* Icons — simple strokes, currentColor, filled when active. */

type IconProps = { active?: boolean };

function HomeIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="1.5"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.22 : 0}
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" opacity={active ? 1 : 0.55} />
    </svg>
  );
}

function PracticeIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12c4-6 12-6 16 0-4 6-12 6-16 0Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.22 : 0}
      />
      <circle cx="12" cy="12" r="2" fill="currentColor" opacity={active ? 1 : 0.55} />
    </svg>
  );
}

function ProgressIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 17c3 0 3-6 6-6s3 6 6 6 4-4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="7" r="2" fill="currentColor" opacity={active ? 1 : 0.45} />
    </svg>
  );
}

function BezzIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="8.5"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.22 : 0}
      />
      <path
        d="M5 19.5c1.2-3.4 3.9-5 7-5s5.8 1.6 7 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
