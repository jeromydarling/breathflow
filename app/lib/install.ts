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
  /** Nothing to offer. */
  | "none";

export type InstallContext = {
  /** Already running as an installed app. */
  standalone: boolean;
  /** The browser fired `beforeinstallprompt` and we captured it. */
  hasNativePrompt: boolean;
  /** iOS Safari, where "Add to Home Screen" is a manual Share-sheet action. */
  isIosSafari: boolean;
  /** Epoch ms of the last dismissal, or null. */
  dismissedAt: number | null;
  now: number;
};

export function installMode(context: InstallContext): InstallMode {
  // Already installed — there is nothing to offer, on any platform.
  if (context.standalone) return "none";

  if (isDismissalActive(context.dismissedAt, context.now)) return "none";

  if (context.hasNativePrompt) return "native";
  if (context.isIosSafari) return "ios-instructions";

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
 * iOS Safari only. Chrome and Firefox on iOS cannot add to the home screen at
 * all, so telling their users to look for a Share button that will not help
 * them would just be wrong.
 */
export function detectIosSafari(userAgent: string): boolean {
  const ua = userAgent || "";
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports itself as a Mac; the touch-point check happens in the
    // component, which is the only place that can see `navigator`.
    false;
  if (!isIos) return false;

  // CriOS = Chrome, FxiOS = Firefox, EdgiOS = Edge, OPiOS/OPT = Opera.
  return !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\//.test(ua);
}

export function readDismissedAt(storage: Pick<Storage, "getItem">): number | null {
  try {
    const raw = storage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    // Private mode, blocked storage — behave as though never dismissed.
    return null;
  }
}
