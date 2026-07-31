import { useCallback, useEffect, useRef, useState } from "react";
import {
  DISMISS_STORAGE_KEY,
  type InstallMode,
  detectIosSafari,
  installMode,
  readDismissedAt,
} from "~/lib/install";

/**
 * The "add BreathFLOW to your home screen" prompt.
 *
 * Renders nothing on the server and nothing on the first client render, so
 * there is no hydration mismatch — it can only appear once the browser has
 * told us installation is actually possible.
 *
 * It waits a few seconds before appearing. A banner that slides over the hero
 * the instant someone lands is the exact thing the brand promises not to do,
 * and the first thing anyone should see here is the practice, not a request.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const APPEAR_AFTER_MS = 2500;

export function InstallPrompt() {
  const [mode, setMode] = useState<InstallMode>("none");
  const [visible, setVisible] = useState(false);
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);

  const hide = useCallback((remember: boolean) => {
    setVisible(false);
    setMode("none");
    if (!remember) return;
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    } catch {
      // Storage blocked. The prompt reappears next visit; not worth failing over.
    }
  }, []);

  useEffect(() => {
    // `?install` re-opens the prompt regardless of a past dismissal. There is
    // no way to un-dismiss otherwise, which makes the feature impossible to
    // demo or support once you have tapped "Got it" even once.
    const forced = new URLSearchParams(window.location.search).has("install");

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      // iOS reports installed apps through a non-standard flag.
      (navigator as { standalone?: boolean }).standalone === true;

    // No argument: the storage access happens inside the guard, because
    // touching `localStorage` at all throws in Safari with storage blocked.
    const dismissedAt = forced ? null : readDismissedAt();

    // iPadOS 13+ claims to be a Mac, so a UA check alone misses iPads. A Mac
    // with a touchscreen does not exist, which makes this a reliable tell.
    const ua = navigator.userAgent;
    const looksLikeIpad =
      /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    const isIosSafari =
      detectIosSafari(ua) ||
      (looksLikeIpad && !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\//.test(ua));

    const evaluate = (hasNativePrompt: boolean) =>
      installMode({
        standalone: forced ? false : standalone,
        hasNativePrompt,
        isIosSafari,
        dismissedAt,
        now: Date.now(),
      });

    const stashed = () =>
      (window as { __bfInstallEvent?: BeforeInstallPromptEvent | null })
        .__bfInstallEvent ?? null;

    const adopt = () => {
      const event = stashed();
      if (!event) return false;
      deferred.current = event;
      setMode(evaluate(true));
      return true;
    };

    // The inline script in root.tsx catches `beforeinstallprompt` before
    // hydration — Chrome often fires it first — so the event is usually
    // already waiting by the time this mounts.
    const onReady = () => adopt();
    // Belt and braces for the case where it fires after hydration instead.
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferred.current = event as BeforeInstallPromptEvent;
      setMode(evaluate(true));
    };

    // If they install by any route, stop asking immediately and permanently.
    const onInstalled = () => hide(true);

    window.addEventListener("bf:installready", onReady);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (!adopt()) {
      // iOS never fires beforeinstallprompt, so decide for it up front.
      const initial = evaluate(false);
      if (initial === "ios-instructions") setMode(initial);
    }

    return () => {
      window.removeEventListener("bf:installready", onReady);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [hide]);

  // Let the page breathe before asking for anything.
  useEffect(() => {
    if (mode === "none") return;
    const id = window.setTimeout(
      () => setVisible(true),
      // No waiting around when it was asked for explicitly.
      new URLSearchParams(window.location.search).has("install")
        ? 0
        : APPEAR_AFTER_MS,
    );
    return () => window.clearTimeout(id);
  }, [mode]);

  const install = useCallback(async () => {
    const event = deferred.current;
    if (!event) return;
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      // Either way we stop asking: accepted means installed, and dismissed at
      // the native sheet is still a no.
      hide(outcome === "dismissed");
    } catch {
      hide(false);
    } finally {
      deferred.current = null;
    }
  }, [hide]);

  if (mode === "none" || !visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-labelledby="install-heading"
      aria-describedby="install-body"
    >
      <div
        className="bf-night mx-auto max-w-md rounded-3xl border border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)] p-5 shadow-2xl shadow-black/50"
        style={{
          animation: "bf-bloom 700ms var(--ease-breath) both",
        }}
      >
        <div className="flex items-start gap-4">
          {/* The SVG mark, not icon-192.png — the raster icon is a soft
              radial glow that reads as a blur at 48px, while this has a
              defined ring and stays crisp. */}
          <img
            src="/favicon.svg"
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-xl"
          />

          <div className="min-w-0 flex-1">
            <h2
              id="install-heading"
              className="font-serif text-lg leading-snug text-[var(--color-bone)]"
            >
              Keep your breath one tap away
            </h2>

            {mode === "native" ? (
              <p
                id="install-body"
                className="mt-1.5 text-sm leading-relaxed text-[var(--color-bone-muted)]"
              >
                Add BreathFLOW to your home screen. It opens straight into
                today&rsquo;s practice, with no browser in the way.
              </p>
            ) : (
              <p
                id="install-body"
                className="mt-1.5 text-sm leading-relaxed text-[var(--color-bone-muted)]"
              >
                Tap{" "}
                <ShareIcon /> <span className="text-[var(--color-bone)]">Share</span>,
                then{" "}
                <span className="text-[var(--color-bone)]">
                  Add to Home Screen
                </span>
                . It opens straight into today&rsquo;s practice — and it&rsquo;s
                the only way iPhones will let us send you a gentle reminder.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {mode === "native" ? (
                <button
                  type="button"
                  onClick={install}
                  className="whitespace-nowrap rounded-full bg-[var(--color-bone)] px-5 py-2.5 text-sm font-medium text-[var(--color-charcoal)] transition hover:bg-white"
                >
                  Add to home screen
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => hide(true)}
                className={`whitespace-nowrap rounded-full py-2.5 text-sm text-[var(--color-bone-faint)] transition hover:text-[var(--color-bone-muted)] ${
                  // With no primary button beside it, the padding just reads
                  // as a stray indent.
                  mode === "native" ? "px-4" : "pr-4"
                }`}
              >
                {mode === "native" ? "Not now" : "Got it"}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => hide(true)}
            aria-label="Dismiss"
            className="-mr-1 -mt-1 shrink-0 rounded-full p-2 text-[var(--color-bone-faint)] transition hover:text-[var(--color-bone)]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/** The iOS Share glyph, so the instruction points at something recognisable. */
function ShareIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="inline-block -mt-0.5 align-middle text-[var(--color-bone)]"
    >
      <path
        d="M10 2.5v10M10 2.5L6.75 5.75M10 2.5l3.25 3.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 9H4a1 1 0 0 0-1 1v6.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1h-1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
