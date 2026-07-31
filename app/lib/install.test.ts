import { describe, expect, it } from "vitest";
import {
  DISMISS_DAYS,
  DISMISS_STORAGE_KEY,
  type InstallContext,
  detectIosBrowser,
  installMode,
  isDismissalActive,
  readDismissedAt,
} from "./install";

const NOW = Date.parse("2026-07-31T12:00:00Z");

const base: InstallContext = {
  standalone: false,
  hasNativePrompt: false,
  iosBrowser: "not-ios",
  dismissedAt: null,
  now: NOW,
};

describe("installMode", () => {
  it("offers the native prompt when the browser gave us one", () => {
    expect(installMode({ ...base, hasNativePrompt: true })).toBe("native");
  });

  it("falls back to instructions on iOS Safari, which has no prompt API", () => {
    expect(installMode({ ...base, iosBrowser: "safari" })).toBe(
      "ios-instructions",
    );
  });

  it("offers nothing when the browser cannot install at all", () => {
    expect(installMode(base)).toBe("none");
  });

  it("never asks someone who already installed it", () => {
    expect(
      installMode({ ...base, standalone: true, hasNativePrompt: true }),
    ).toBe("none");
    expect(installMode({ ...base, standalone: true, iosBrowser: "safari" })).toBe(
      "none",
    );
  });

  it("stays quiet for thirty days after a dismissal", () => {
    const justDismissed = { ...base, hasNativePrompt: true, dismissedAt: NOW };
    expect(installMode(justDismissed)).toBe("none");

    const dayTwentyNine = {
      ...justDismissed,
      now: NOW + 29 * 86_400_000,
    };
    expect(installMode(dayTwentyNine)).toBe("none");
  });

  it("may ask again once the thirty days are up", () => {
    expect(
      installMode({
        ...base,
        hasNativePrompt: true,
        dismissedAt: NOW,
        now: NOW + (DISMISS_DAYS + 1) * 86_400_000,
      }),
    ).toBe("native");
  });

  it("honours a dismissal on iOS too", () => {
    expect(
      installMode({ ...base, iosBrowser: "safari", dismissedAt: NOW }),
    ).toBe("none");
  });
});

describe("isDismissalActive", () => {
  it("is false when never dismissed", () => {
    expect(isDismissalActive(null, NOW)).toBe(false);
  });

  it("does not mute the prompt forever on a nonsensical timestamp", () => {
    // A clock that moved backwards, or a corrupted localStorage value, must
    // not silently disable the feature for good.
    expect(isDismissalActive(NOW + 86_400_000, NOW)).toBe(false);
    expect(isDismissalActive(Number.NaN, NOW)).toBe(false);
    expect(isDismissalActive(Number.POSITIVE_INFINITY, NOW)).toBe(false);
  });

  it("pins the exact boundary", () => {
    const window = DISMISS_DAYS * 86_400_000;
    expect(isDismissalActive(NOW - window + 1, NOW)).toBe(true);
    expect(isDismissalActive(NOW - window, NOW)).toBe(false);
  });
});

describe("detectIosBrowser", () => {
  const IPHONE_SAFARI =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

  it("recognises real iOS Safari", () => {
    expect(detectIosBrowser(IPHONE_SAFARI)).toBe("safari");
  });

  it("recognises an iPad pretending to be a Mac", () => {
    const IPADOS =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
    expect(detectIosBrowser(IPADOS, 5)).toBe("safari");
    // A real Mac has no touch points.
    expect(detectIosBrowser(IPADOS, 0)).toBe("not-ios");
  });

  /**
   * The case that made the prompt useless in practice: links are shared
   * through messaging apps, and every one of them opens an embedded webview
   * where Add to Home Screen does not exist.
   */
  it("recognises in-app browsers, named and unnamed", () => {
    const inApp = [
      // WhatsApp's webview sends no Version/ token at all.
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
      // Facebook / Instagram announce themselves.
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0]",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]",
    ];
    for (const ua of inApp) {
      expect(detectIosBrowser(ua), ua.slice(-40)).toBe("in-app");
    }
  });

  it("recognises third-party iOS browsers that cannot install", () => {
    for (const marker of ["CriOS/120.0", "FxiOS/121.0", "EdgiOS/120.0", "OPT/4.0"]) {
      expect(
        detectIosBrowser(
          `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ${marker} Mobile/15E148`,
        ),
        marker,
      ).toBe("other-ios-browser");
    }
  });

  it("is not-ios for desktop and Android", () => {
    expect(
      detectIosBrowser(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
      ),
    ).toBe("not-ios");
    expect(
      detectIosBrowser("Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile"),
    ).toBe("not-ios");
    expect(detectIosBrowser("")).toBe("not-ios");
  });
});

describe("installMode on iOS browsers that cannot install", () => {
  it("offers to open in Safari rather than saying nothing", () => {
    // Showing nothing is what made this look broken: the user is on an
    // iPhone, wants the app on their home screen, and the page is silent.
    expect(installMode({ ...base, iosBrowser: "in-app" })).toBe(
      "ios-open-in-safari",
    );
    expect(installMode({ ...base, iosBrowser: "other-ios-browser" })).toBe(
      "ios-open-in-safari",
    );
  });

  it("still respects a dismissal", () => {
    expect(
      installMode({ ...base, iosBrowser: "in-app", dismissedAt: NOW }),
    ).toBe("none");
  });
});

describe("readDismissedAt", () => {
  it("reads a stored timestamp", () => {
    const storage = { getItem: (k: string) => (k === DISMISS_STORAGE_KEY ? "123" : null) };
    expect(readDismissedAt(storage)).toBe(123);
  });

  it("returns null for missing or junk values", () => {
    expect(readDismissedAt({ getItem: () => null })).toBeNull();
    expect(readDismissedAt({ getItem: () => "not-a-number" })).toBeNull();
  });

  it("survives storage being blocked entirely", () => {
    // Safari private mode throws on access rather than returning null.
    const hostile = {
      getItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(readDismissedAt(hostile)).toBeNull();
  });
});
