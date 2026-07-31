import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes";

export default [
  // ── Public marketing site (server-rendered, edge-cached, crawlable) ──────
  layout("routes/marketing/layout.tsx", [
    index("routes/marketing/home.tsx"),
    route("pricing", "routes/marketing/pricing.tsx"),
    route("about", "routes/marketing/about.tsx"),
    route("safety", "routes/marketing/safety.tsx"),
    route("privacy", "routes/marketing/privacy.tsx"),
    route("terms", "routes/marketing/terms.tsx"),
    route("guides", "routes/marketing/guides-index.tsx"),
    route("guides/:slug", "routes/marketing/guide.tsx"),
    route("compare/:slug", "routes/marketing/compare.tsx"),
  ]),

  // ── Machine-readable surfaces ───────────────────────────────────────────
  route("robots.txt", "routes/well-known/robots.ts"),
  route("sitemap.xml", "routes/well-known/sitemap.ts"),
  route("llms.txt", "routes/well-known/llms.ts"),

  // ── Auth ────────────────────────────────────────────────────────────────
  route("signup", "routes/auth/signup.tsx"),
  route("login", "routes/auth/login.tsx"),
  route("logout", "routes/auth/logout.ts"),
  route("forgot", "routes/auth/forgot.tsx"),
  route("reset/:token", "routes/auth/reset.tsx"),
  route("demo", "routes/auth/demo.ts"),

  // ── Onboarding (its own shell — no tab bar, no distractions) ────────────
  ...prefix("welcome", [
    layout("routes/onboarding/layout.tsx", [
      index("routes/onboarding/step.tsx"),
      route(":step", "routes/onboarding/step.tsx", { id: "onboarding-step" }),
    ]),
  ]),

  // ── The player is full-bleed and outside the tab shell on purpose ───────
  route("play/:slug", "routes/app/player.tsx"),
  route("play/:slug/complete", "routes/app/complete.tsx"),

  // ── The app itself: Home, Practice, Progress, Bezz ──────────────────────
  layout("routes/app/layout.tsx", [
    route("home", "routes/app/home.tsx"),

    route("practice", "routes/app/practice.tsx"),
    route("practice/:slug", "routes/app/practice-detail.tsx"),

    route("progress", "routes/app/progress.tsx"),
    route("progress/retention", "routes/app/retention.tsx"),
    route("progress/share/:kind", "routes/app/share.tsx"),

    route("bezz", "routes/app/bezz.tsx"),
    route("bezz/ask", "routes/app/ask.tsx"),

    route("library", "routes/app/guides.tsx"),
    route("library/:slug", "routes/app/guide-reader.tsx"),

    route("membership", "routes/app/membership.tsx"),

    ...prefix("settings", [
      index("routes/app/settings.tsx"),
      route("notifications", "routes/app/settings-notifications.tsx"),
      route("account", "routes/app/settings-account.tsx"),
    ]),
  ]),

  // ── Share card images (SVG/PNG, generated at the edge) ──────────────────
  route("card/:token", "routes/well-known/share-card.ts"),

  // Resource routes return raw bytes, so they live outside the app layout —
  // a layout that renders an Outlet cannot host one.
  route("my-data.json", "routes/app/export.ts"),

  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
