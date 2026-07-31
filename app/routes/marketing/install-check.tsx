import { useEffect, useState } from "react";
import type { Route } from "./+types/install-check";
import { envFrom } from "~/lib/context";
import { marketingMeta, originFrom } from "~/lib/seo";
import { privateNoStore } from "~/lib/cache.server";
import {
  DISMISS_STORAGE_KEY,
  detectIosBrowser,
  installMode,
  isDismissalActive,
  readDismissedAt,
} from "~/lib/install";

/**
 * A diagnostic page for the install prompt.
 *
 * "It doesn't show up on my iPhone" is unfalsifiable from here — there is no
 * console to read and no way to reproduce a specific device. This page makes
 * the browser report what it actually sees, so a screenshot settles in one
 * step what guessing could not.
 *
 * Deliberately never cached and never indexed.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  return { origin: originFrom(request, envFrom(context)) };
}

export function headers() {
  return privateNoStore();
}

export function meta({ loaderData }: Route.MetaArgs) {
  return marketingMeta({
    title: "Install check",
    description: "Diagnostics for the add-to-home-screen prompt.",
    path: "/install-check",
    origin: loaderData?.origin ?? "",
    noIndex: true,
  });
}

type Row = { label: string; value: string; good: boolean | null };

export default function InstallCheck(_: Route.ComponentProps) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [ua, setUa] = useState("");

  useEffect(() => {
    const out: Row[] = [];
    const userAgent = navigator.userAgent;
    setUa(userAgent);

    // Storage — the thing that silently killed the prompt on Safari.
    let storageOk = true;
    let storageError = "";
    try {
      window.localStorage.getItem("bf_probe");
      window.localStorage.setItem("bf_probe", "1");
      window.localStorage.removeItem("bf_probe");
    } catch (error) {
      storageOk = false;
      storageError = error instanceof Error ? error.name : "blocked";
    }

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (navigator as { standalone?: boolean }).standalone === true;

    const iosBrowser = detectIosBrowser(userAgent, navigator.maxTouchPoints);

    const dismissedAt = readDismissedAt();
    const dismissed = isDismissalActive(dismissedAt, Date.now());
    const hasNativePrompt = Boolean(
      (window as { __bfInstallEvent?: unknown }).__bfInstallEvent,
    );

    const mode = installMode({
      standalone,
      hasNativePrompt,
      iosBrowser,
      dismissedAt,
      now: Date.now(),
    });

    out.push({
      label: "JavaScript ran",
      value: "yes — you are reading a value this page computed",
      good: true,
    });
    out.push({
      label: "Browser",
      value:
        iosBrowser === "safari"
          ? "iOS Safari — can install"
          : iosBrowser === "in-app"
            ? "an in-app browser (opened from another app) — cannot install; open in Safari first"
            : iosBrowser === "other-ios-browser"
              ? "Chrome/Firefox/Edge on iOS — cannot install; open in Safari first"
              : "not iOS",
      good: iosBrowser === "safari" || iosBrowser === "not-ios",
    });
    out.push({
      label: "Already installed (standalone)",
      value: standalone ? "yes — that is why no prompt shows" : "no",
      good: !standalone,
    });
    out.push({
      label: "Native install event captured",
      value: hasNativePrompt ? "yes" : "no (expected on iOS — it has no such API)",
      good: null,
    });
    out.push({
      label: "Local storage",
      value: storageOk ? "readable and writable" : `blocked (${storageError})`,
      good: storageOk,
    });
    out.push({
      label: "Previously dismissed",
      value: dismissed
        ? `yes, on ${new Date(dismissedAt!).toLocaleString()} — muted for 30 days`
        : "no",
      good: !dismissed,
    });
    out.push({
      label: "Service worker",
      value: "serviceWorker" in navigator ? "supported" : "not supported",
      good: "serviceWorker" in navigator,
    });
    out.push({
      label: "CSS color-mix (needs Safari 16.4+)",
      value:
        typeof CSS !== "undefined" && CSS.supports?.("color", "color-mix(in oklab, red, blue)")
          ? "supported"
          : "NOT supported — your browser is too old for this site's styling",
      good:
        typeof CSS !== "undefined" &&
        CSS.supports?.("color", "color-mix(in oklab, red, blue)"),
    });
    out.push({
      label: "What the prompt decides",
      value:
        mode === "native"
          ? "show the install button"
          : mode === "ios-instructions"
            ? "show the Share → Add to Home Screen steps"
            : mode === "ios-open-in-safari"
              ? "tell you to open the page in Safari first"
              : "show nothing",
      good: mode !== "none",
    });

    setRows(out);
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-5 py-20">
      <h1 className="font-serif text-3xl text-[var(--color-bone)]">
        Install check
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--color-bone-muted)]">
        This page asks your browser what it sees, so a screenshot can settle
        what guessing cannot.
      </p>

      {rows === null ? (
        <div className="mt-10 rounded-2xl border border-[color-mix(in_oklab,var(--color-copper)_50%,transparent)] bg-[color-mix(in_oklab,var(--color-copper)_12%,transparent)] p-6">
          <p className="text-[var(--color-bone)]">JavaScript has not run.</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-bone-muted)]">
            If this message is still here after a moment, the app is not
            starting up in this browser at all — which would explain the
            missing prompt, and means something larger is wrong than the
            prompt itself.
          </p>
        </div>
      ) : (
        <>
          <dl className="mt-10 space-y-3">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex flex-col gap-1 rounded-2xl border border-[color-mix(in_oklab,var(--color-bone)_14%,transparent)] p-4 sm:flex-row sm:items-baseline sm:gap-4"
              >
                <dt className="shrink-0 text-sm text-[var(--color-bone-faint)] sm:w-64">
                  {row.label}
                </dt>
                <dd
                  className={
                    row.good === false
                      ? "text-[var(--color-copper-bright)]"
                      : "text-[var(--color-bone)]"
                  }
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 rounded-2xl border border-[color-mix(in_oklab,var(--color-bone)_14%,transparent)] p-4">
            <p className="text-sm text-[var(--color-bone-faint)]">
              Browser identification
            </p>
            <p className="mt-2 break-all font-mono text-xs text-[var(--color-bone-muted)]">
              {ua}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/?install"
              className="rounded-full bg-[var(--color-bone)] px-5 py-2.5 text-sm font-medium text-[var(--color-charcoal)]"
            >
              Force the prompt now
            </a>
            <button
              type="button"
              onClick={() => {
                try {
                  window.localStorage.removeItem(DISMISS_STORAGE_KEY);
                } catch {
                  /* storage blocked; nothing to clear */
                }
                window.location.reload();
              }}
              className="rounded-full border border-[color-mix(in_oklab,var(--color-bone)_28%,transparent)] px-5 py-2.5 text-sm text-[var(--color-bone)]"
            >
              Clear the dismissal
            </button>
          </div>
        </>
      )}
    </div>
  );
}
