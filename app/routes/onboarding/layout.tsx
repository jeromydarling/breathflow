import { Outlet } from "react-router";
import type { Route } from "./+types/layout";
import { privateNoStore } from "~/lib/cache.server";

/**
 * The onboarding shell.
 *
 * No tab bar, no navigation, no way to wander off. One thing on screen at a
 * time, slow motion, minimal copy per screen.
 */
export function headers() {
  return privateNoStore();
}

export default function OnboardingLayout(_: Route.ComponentProps) {
  return (
    <div className="bf-night min-h-dvh">
      <a
        href="#onboarding-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-[var(--color-bone)] focus:px-4 focus:py-2 focus:text-[var(--color-charcoal)]"
      >
        Skip to content
      </a>
      <main id="onboarding-main" className="min-h-dvh">
        <Outlet />
      </main>
    </div>
  );
}
