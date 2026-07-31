/**
 * Install-prompt rules.
 *
 * Kept pure and separate from the component so the parts that decide *whether
 * to ask someone something* are testable. An install prompt is the easiest
 * thing in an app to turn into a nag, and the brand does not do nags.
 *
 * Rules:
 *   • never ask someone who has already installed it;
 *   • never ask when the browser cannot actually install it;
 *   • one dismissal buys thirty days of silence;
 *   • installing is offered, never required, and nothing is withheld from
 *     someone who says no.
 */

export const DISMISS_STORAGE_KEY = "bf_install_dismissed_at";
export const DISMISS_DAYS = 30;

export type InstallMode =
  /** Chrome/Edge/Android: the browser gave us a real prompt to fire. */
  | "native"
  /** iOS Safari: no programmatic prompt exists, so we explain the two taps. */
  | "ios-instructions"
  /**
   * On iOS but in a browser that cannot install — an in-app webview opened
   * from WhatsApp or Instagram, or Chrome/Firefox. Adding to the home screen
   * is impossible here, but opening the page in Safari is not, so say that
   * rather than showing nothing.
   */
  | "ios-open-in-safari"
  /** Nothing to offer. */
  | "none";

/**
 * Which iOS browser this is, as far as installing is concerned.
 *
 * "in-app" is the case that matters most in practice: links get shared through
 * WhatsApp, Instagram and Slack, and every one of them opens in an embedded
 * webview where Add to Home Screen simply does not exist.
 */
export type IosBrowser = "safari" | "in-app" | "other-ios-browser" | "not-ios";

export type InstallContext = {
  /** Already running as an installed app. */
  standalone: boolean;
  /** The browser fired `beforeinstallprompt` and we captured it. */
  hasNativePrompt: boolean;
  /** What kind of iOS browser this is, if any. */
  iosBrowser: IosBrowser;
  /** Epoch ms of the last dismissal, or null. */
  dismissedAt: number | null;
  now: number;
};

export function installMode(context: InstallContext): InstallMode {
  // Already installed — there is nothing to offer, on any platform.
  if (context.standalone) return "none";

  if (isDismissalActive(context.dismissedAt, context.now)) return "none";

  if (context.hasNativePrompt) return "native";
  if (context.iosBrowser === "safari") return "ios-instructions";
  if (
    context.iosBrowser === "in-app" ||
    context.iosBrowser === "other-ios-browser"
  ) {
    return "ios-open-in-safari";
  }

  return "none";
}

export function isDismissalActive(
  dismissedAt: number | null,
  now: number,
): boolean {
  if (dismissedAt === null) return false;
  // A clock that has gone backwards (or a corrupted value) must not mute the
  // prompt forever — treat anything nonsensical as "never dismissed".
  if (!Number.isFinite(dismissedAt) || dismissedAt > now) return false;
  return now - dismissedAt < DISMISS_DAYS * 86_400_000;
}

/**
 * Classify an iOS browser by whether it can install at all.
 *
 * The previous version answered a narrower question — "is this iOS Safari?" —
 * and returned a bare false for everything else, which meant a link opened
 * from WhatsApp got silence. Since shared links are how most people arrive,
 * that was the common case, not the edge case.
 */
export function detectIosBrowser(
  userAgent: string,
  maxTouchPoints = 0,
): IosBrowser {
  const ua = userAgent || "";

  // iPadOS 13+ reports itself as a Mac. A Mac with a touchscreen does not
  // exist, which makes the touch-point count a reliable tell.
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && maxTouchPoints > 1);
  if (!isIos) return "not-ios";

  // CriOS = Chrome, FxiOS = Firefox, EdgiOS = Edge, OPiOS/OPT = Opera.
  // None of them can add to the home screen.
  if (/CriOS|FxiOS|EdgiOS|OPiOS|OPT\//.test(ua)) return "other-ios-browser";

  // Embedded webviews that announce themselves.
  if (
    /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Twitter|TikTok|Snapchat|LinkedInApp|Pinterest|MicroMessenger|Slack/i.test(
      ua,
    )
  ) {
    return "in-app";
  }

  // Real Safari always sends a `Version/<n>` token. A WKWebView embedded in
  // another app generally does not, which catches the in-app browsers that
  // do not name themselves.
  if (!/Version\/\d/.test(ua)) return "in-app";

  return "safari";
}

export function readDismissedAt(
  storage?: Pick<Storage, "getItem"> | null,
): number | null {
  try {
    const store = storage ?? globalThis.localStorage;
    const raw = store?.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    // Private mode, blocked storage — behave as though never dismissed.
    return null;
  }
}
