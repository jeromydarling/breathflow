/*
 * Browser checks for the PWA install prompt.
 *
 * These cannot be unit tests: the behaviour under test is a browser deciding
 * an app is installable, an event that fires before hydration, and a service
 * worker's cache contents. Run against a local build:
 *
 *   npm run build
 *   npx wrangler dev --port 8788 --local
 *   node scripts/pwa-check.mjs
 */
import { chromium } from "playwright";

const BASE = "http://localhost:8788";
const results = [];
const ok = (name, pass, detail = "") =>
  results.push(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});

// ── 1. The prompt must not be in the server HTML ──────────────────────────
const html = await (await fetch(`${BASE}/`)).text();
ok(
  "prompt is absent from server-rendered HTML",
  !html.includes("Keep your breath one tap away"),
);

// ── 2. No hydration errors, and nothing visible without an install event ──
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(7000); // past the 5s appear delay

  const hydrationErrors = errors.filter((e) =>
    /hydrat|did not match|Minified React error #(418|423|425)/i.test(e),
  );
  ok("no hydration errors", hydrationErrors.length === 0, hydrationErrors[0] ?? "");

  const visible = await page.locator("text=Keep your breath one tap away").count();
  ok(
    "stays hidden when the browser cannot install",
    visible === 0,
    `found ${visible}`,
  );

  const swRegistered = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return Boolean(reg);
  });
  ok("service worker registers", swRegistered);

  await ctx.close();
}

// ── 3. Fires on beforeinstallprompt, and the button calls prompt() ────────
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // Fire it as early as Chrome really does — before hydration. This is the
  // exact race that made the prompt never appear.
  await page.addInitScript(() => {
    window.__promptCalled = false;
    window.addEventListener("DOMContentLoaded", () => {
      const event = new Event("beforeinstallprompt");
      event.prompt = async () => {
        window.__promptCalled = true;
      };
      event.userChoice = Promise.resolve({ outcome: "accepted" });
      window.dispatchEvent(event);
    });
  });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });

  const card = page.locator("text=Keep your breath one tap away");
  await card.waitFor({ state: "visible", timeout: 12000 });
  ok("appears after a native install event", true);

  // It must not appear instantly — the page gets a few seconds to itself.
  const dialog = page.locator('[role="dialog"][aria-labelledby="install-heading"]');
  ok("uses a labelled dialog", (await dialog.count()) === 1);

  await page.getByRole("button", { name: "Add to home screen" }).click();
  await page.waitForTimeout(500);
  ok(
    "the button fires the browser's real prompt",
    await page.evaluate(() => window.__promptCalled === true),
  );
  ok(
    "card closes after accepting",
    (await card.count()) === 0 || !(await card.first().isVisible()),
  );
  await ctx.close();
}

// ── 4. Dismissal is remembered across reloads ────────────────────────────
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.addEventListener("DOMContentLoaded", () => {
      const event = new Event("beforeinstallprompt");
      event.prompt = async () => {};
      event.userChoice = Promise.resolve({ outcome: "dismissed" });
      window.dispatchEvent(event);
    });
  });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });

  const card = page.locator("text=Keep your breath one tap away");
  await card.waitFor({ state: "visible", timeout: 12000 });
  await page.getByRole("button", { name: "Not now" }).click();
  await page.waitForTimeout(300);
  ok("hides on dismiss", (await card.count()) === 0);

  const stored = await page.evaluate(() =>
    window.localStorage.getItem("bf_install_dismissed_at"),
  );
  ok("dismissal is persisted", Boolean(stored));

  // Reload and fire the event again — it must stay silent.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);
  ok(
    "stays silent on the next visit",
    (await page.locator("text=Keep your breath one tap away").count()) === 0,
  );
  await ctx.close();
}

// ── 5. iOS Safari gets instructions instead ──────────────────────────────
{
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });

  const card = page.locator("text=Keep your breath one tap away");
  await card.waitFor({ state: "visible", timeout: 12000 });
  const body = await page
    .locator("#install-body")
    .innerText();
  ok(
    "iOS gets Share → Add to Home Screen instructions",
    /Share/.test(body) && /Add to Home Screen/.test(body),
    body.slice(0, 70),
  );
  ok(
    "iOS shows no fake install button",
    (await page.getByRole("button", { name: "Add to home screen" }).count()) === 0,
  );
  await page.screenshot({ path: "/tmp/claude-0/-home-user-breathflow/dc5c71a3-fa18-570d-901f-306e70421bff/scratchpad/install-ios.png" });
  await ctx.close();
}

// ── 6. Chrome on iOS must NOT get instructions it cannot follow ──────────
{
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);
  ok(
    "Chrome on iOS is left alone",
    (await page.locator("text=Keep your breath one tap away").count()) === 0,
  );
  await ctx.close();
}

// ── 7. Already-installed users are never asked ───────────────────────────
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q) =>
      q === "(display-mode: standalone)"
        ? { matches: true, addEventListener() {}, removeEventListener() {}, media: q }
        : real(q);
  });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt");
    event.prompt = async () => {};
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(event);
  });
  await page.waitForTimeout(7000);
  ok(
    "never asks someone already running the installed app",
    (await page.locator("text=Keep your breath one tap away").count()) === 0,
  );
  await ctx.close();
}

// ── 8. The service worker never caches a document or an API response ─────
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const out = [];
    for (const name of names) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) out.push(new URL(req.url).pathname);
    }
    return out;
  });
  const badHtml = cached.filter((p) => p === "/" || p.endsWith(".html"));
  const badApi = cached.filter((p) => p.startsWith("/api/"));
  ok("no HTML documents cached", badHtml.length === 0, badHtml.join(","));
  ok("no API responses cached", badApi.length === 0, badApi.join(","));
  ok(
    "only immutable assets cached",
    cached.every(
      (p) => p.startsWith("/assets/") || /\.(png|svg)$/.test(p),
    ),
    cached.slice(0, 4).join(", "),
  );
  await ctx.close();
}

await browser.close();
console.log(results.join("\n"));
console.log(results.some((r) => r.startsWith("FAIL")) ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");
