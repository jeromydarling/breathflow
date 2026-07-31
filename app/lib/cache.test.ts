import { describe, expect, it } from "vitest";
import {
  cacheHeadersFor,
  immutableAsset,
  privateNoStore,
  publicPageHeaders,
  stampCacheability,
} from "./cache.server";

function request(url: string, init?: RequestInit) {
  return new Request(`https://breathflow.app${url}`, init);
}

const withSession = () =>
  request("/pricing", { headers: { cookie: "bf_session=se_abc123" } });

describe("cacheHeadersFor", () => {
  it("lets a shared cache hold an anonymous public GET", () => {
    const headers = cacheHeadersFor(request("/pricing"), 600);
    expect(headers["Cache-Control"]).toContain("public");
    expect(headers["Cache-Control"]).toContain("s-maxage=600");
    expect(headers.Vary).toContain("Cookie");
  });

  it("bypasses the shared cache the moment a session cookie appears", () => {
    expect(cacheHeadersFor(withSession(), 600)["Cache-Control"]).toBe(
      "private, no-store",
    );
  });

  it("never shared-caches a non-GET", () => {
    expect(
      cacheHeadersFor(request("/pricing", { method: "POST" }), 600)[
        "Cache-Control"
      ],
    ).toBe("private, no-store");
  });

  it("treats a preview or tokened URL as one-off", () => {
    expect(cacheHeadersFor(request("/pricing?preview=1"))["Cache-Control"]).toBe(
      "private, no-store",
    );
    expect(cacheHeadersFor(request("/pricing?token=abc"))["Cache-Control"]).toBe(
      "private, no-store",
    );
  });
});

/**
 * The subtle part: React Router hands a child route the parent's `headers()`
 * *output* as `parentHeaders`, not the parent's loader headers. If the stamp
 * is not re-emitted it stops at the layout and every page below it silently
 * becomes uncacheable — which is exactly the bug this pins.
 */
describe("the cacheability stamp", () => {
  it("propagates down a route chain", () => {
    const layoutLoaderHeaders = new Headers(
      stampCacheability(request("/pricing")),
    );
    const layoutOutput = publicPageHeaders(layoutLoaderHeaders, 300);

    // What the child sees.
    const childOutput = publicPageHeaders(new Headers(layoutOutput), 600);

    expect(layoutOutput["Cache-Control"]).toContain("s-maxage=300");
    expect(childOutput["Cache-Control"]).toContain("s-maxage=600");
    expect(childOutput["Cache-Control"]).toContain("public");
  });

  it("propagates a signed-in bypass down the same chain", () => {
    const layoutLoaderHeaders = new Headers(stampCacheability(withSession()));
    const layoutOutput = publicPageHeaders(layoutLoaderHeaders, 300);
    const childOutput = publicPageHeaders(new Headers(layoutOutput), 600);

    expect(layoutOutput["Cache-Control"]).toBe("private, no-store");
    expect(childOutput["Cache-Control"]).toBe("private, no-store");
  });

  it("fails closed when there is no stamp at all", () => {
    // A page rendered outside the marketing layout must not be shared-cached
    // just because nobody told it otherwise.
    expect(publicPageHeaders(new Headers(), 600)["Cache-Control"]).toBe(
      "private, no-store",
    );
  });
});

describe("asset caching", () => {
  it("caches content-addressed assets immutably", () => {
    expect(immutableAsset()["Cache-Control"]).toContain("immutable");
    expect(immutableAsset()["Cache-Control"]).toContain("max-age=31536000");
  });

  it("has a no-store policy available for private surfaces", () => {
    expect(privateNoStore()["Cache-Control"]).toBe("private, no-store");
  });
});
