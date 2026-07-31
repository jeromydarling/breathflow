import { describe, expect, it } from "vitest";
import {
  DISMISS_DAYS,
  DISMISS_STORAGE_KEY,
  type InstallContext,
  detectIosSafari,
  installMode,
  isDismissalActive,
  readDismissedAt,
} from "./install";

const NOW = Date.parse("2026-07-31T12:00:00Z");

const base: InstallContext = {
  standalone: false,
  hasNativePrompt: false,
  isIosSafari: false,
  dismissedAt: null,
  now: NOW,
};

describe("installMode", () => {
  it("offers the native prompt when the browser gave us one", () => {
    expect(installMode({ ...base, hasNativePrompt: true })).toBe("native");
  });

  it("falls back to instructions on iOS Safari, which has no prompt API", () => {
    expect(installMode({ ...base, isIosSafari: true })).toBe(
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
    expect(installMode({ ...base, standalone: true, isIosSafari: true })).toBe(
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
      installMode({ ...base, isIosSafari: true, dismissedAt: NOW }),
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

describe("detectIosSafari", () => {
  it("recognises iPhone and iPad Safari", () => {
    expect(
      detectIosSafari(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(true);
  });

  it("excludes browsers on iOS that cannot add to the home screen", () => {
    // Telling a Chrome-on-iOS user to find a Share button that will not help
    // them is worse than saying nothing.
    for (const marker of ["CriOS/120.0", "FxiOS/121.0", "EdgiOS/120.0", "OPT/4.0"]) {
      expect(
        detectIosSafari(
          `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ${marker} Mobile/15E148`,
        ),
        marker,
      ).toBe(false);
    }
  });

  it("is false for desktop and Android", () => {
    expect(
      detectIosSafari(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
      ),
    ).toBe(false);
    expect(
      detectIosSafari("Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile"),
    ).toBe(false);
    expect(detectIosSafari("")).toBe(false);
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
