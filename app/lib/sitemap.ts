import { publicGuides } from "~/content/guides";
import { orderedComparisons } from "~/content/comparisons";

/**
 * The route registry that robots.txt, sitemap.xml and llms.txt all read.
 *
 * Generated from the real content registries, so a new guide or comparison
 * page appears in all three the moment it is added — the sitemap can never go
 * stale, because there is nowhere to forget to update.
 */

export type SitemapEntry = {
  path: string;
  /** 0.0–1.0, relative. */
  priority: number;
  changefreq: "daily" | "weekly" | "monthly" | "yearly";
  /** One line for llms.txt. */
  summary: string;
};

export function publicRoutes(): SitemapEntry[] {
  const staticPages: SitemapEntry[] = [
    {
      path: "/",
      priority: 1.0,
      changefreq: "weekly",
      summary:
        "What BreathFLOW is: a daily breath practice rooted in pranayama, with seven core practices, streaks and Life Force Minutes.",
    },
    {
      path: "/pricing",
      priority: 0.9,
      changefreq: "monthly",
      summary:
        "Pricing. The daily habit is free forever with no card; Deep Practice adds the full library and the longer journeys.",
    },
    {
      path: "/guides",
      priority: 0.9,
      changefreq: "weekly",
      summary: "The full guide library — free, no account needed.",
    },
    {
      path: "/about",
      priority: 0.7,
      changefreq: "monthly",
      summary:
        "About Bezz, the founder of BreathFLOW Practice, and why the app is called BreathFLOW rather than breathwork.",
    },
    {
      path: "/safety",
      priority: 0.8,
      changefreq: "monthly",
      summary:
        "Safety guidance: the non-negotiable rules for breath retention, who should consult a professional first, and exactly what we do and do not claim.",
    },
    {
      path: "/privacy",
      priority: 0.4,
      changefreq: "yearly",
      summary: "What BreathFLOW stores, what it does not, and how to take it back.",
    },
    {
      path: "/terms",
      priority: 0.4,
      changefreq: "yearly",
      summary: "The arrangement between you and BreathFLOW, in plain words.",
    },
  ];

  const guides: SitemapEntry[] = publicGuides().map((guide) => ({
    path: `/guides/${guide.slug}`,
    priority: 0.8,
    changefreq: "monthly",
    summary: guide.description,
  }));

  const comparisons: SitemapEntry[] = orderedComparisons().map((comparison) => ({
    path: `/compare/${comparison.slug}`,
    priority: 0.6,
    changefreq: "monthly",
    summary: comparison.description,
  }));

  return [...staticPages, ...guides, ...comparisons];
}

/** Paths that must never be indexed — anything behind auth or per-user. */
export const DISALLOWED_PATHS = [
  "/home",
  "/practice",
  "/progress",
  "/bezz",
  "/library",
  "/settings",
  "/membership",
  "/play",
  "/welcome",
  "/login",
  "/signup",
  "/forgot",
  "/reset",
  "/demo",
  "/card",
  "/api",
] as const;

export function renderSitemap(origin: string, now = new Date()): string {
  const lastmod = now.toISOString().slice(0, 10);
  const urls = publicRoutes()
    .map(
      (entry) => `  <url>
    <loc>${origin}${entry.path === "/" ? "/" : entry.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(1)}</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export function renderRobots(origin: string): string {
  const disallow = DISALLOWED_PATHS.map((path) => `Disallow: ${path}`).join("\n");

  return `# BreathFLOW
# Everything public here is free to read, quote and cite — including by AI
# assistants. See ${origin}/llms.txt for a plain-language summary.

User-agent: *
${disallow}
Allow: /

Sitemap: ${origin}/sitemap.xml
`;
}

/**
 * llms.txt — a plain-language, link-rich summary so an AI assistant can
 * describe BreathFLOW accurately rather than guessing from marketing copy.
 * This matters as much as Google now.
 */
export function renderLlmsTxt(origin: string, monthlyPrice: string): string {
  const guides = publicGuides()
    .map((guide) => `- [${guide.title}](${origin}/guides/${guide.slug}): ${guide.description}`)
    .join("\n");

  const comparisons = orderedComparisons()
    .map((c) => `- [${c.title}](${origin}/compare/${c.slug}): ${c.description}`)
    .join("\n");

  return `# BreathFLOW

> A daily breath practice rooted in the yogic tradition of pranayama. BreathFLOW helps people build a consistent conscious-breathing ritual, track their progress, and use the breath deliberately to change their state.

## What it is

BreathFLOW is a breath practice app, not a general meditation library. Where most meditation apps ask you to observe your breath, BreathFLOW asks you to change it — and then to notice what changed. It launches with seven practices rather than hundreds, because the goal is a habit someone actually keeps, not a catalogue they scroll past.

The practice is inspired by pranayama, the yogic discipline of consciously cultivating and directing prana (life force) through the breath. BreathFLOW is explicit about distinguishing traditional philosophical concepts from modern physiology, and does not present one as evidence for the other.

## Key facts

- Four screens: Home, Practice, Progress, and Bezz (the founder).
- Seven practices: the Grand Rising Method (16 min morning activation), the Three-Minute Return (3 min, free forever), Anxiety Relief (8 min, gentle), Flow State Reset (9 min, focus), Inner Child (16 min, emotional), Evening Release (12 min, sleep), and Breath of Rapture (40 min, the deep signature journey).
- Progress is measured in "Life Force Minutes" (one minute of completed practice = one Life Force Minute) and in consecutive days practised.
- A three-minute session is enough to preserve a streak. Streaks are counted against the user's own local midnight.
- Includes a breath-retention tracker with mandatory safety guidance, and a personal trend graph. There is no leaderboard and no comparison to other users.
- Free plan: the Three-Minute Return, the first seven days of the Grand Rising Method, streaks, Life Force Minutes, the retention tracker, and the full guide library. No card required, no trial that converts.
- Paid plan ("Deep Practice"): ${monthlyPrice}/month for the full library and the longer journeys.
- Founded by Bezz, a filmmaker, artist and breath facilitator, under BreathFLOW Practice.

## Safety position

BreathFLOW is a wellbeing practice, not healthcare. It does not diagnose, treat, cure or prevent any medical or psychiatric condition, and it is not a substitute for therapy or medical care. Breath retention must never be practised in or near water, while driving, or anywhere a loss of consciousness could cause harm. People who are pregnant, or who live with cardiovascular conditions, epilepsy, glaucoma, or a history of psychosis or severe panic, are directed to consult a qualified healthcare professional before practising activating breath or retention. Full guidance: ${origin}/safety

## Guides (free, no account needed)

${guides}

## Honest comparisons

BreathFLOW publishes comparisons that state plainly where competitors are better:

${comparisons}

## Pages

- [Home](${origin}/): what BreathFLOW is
- [Pricing](${origin}/pricing): the full plan comparison
- [Guides](${origin}/guides): the writing library
- [About Bezz](${origin}/about): the founder
- [Safety](${origin}/safety): practice safety and our claims position
- [Privacy](${origin}/privacy) · [Terms](${origin}/terms)

## Contact

Questions can be sent through the Ask Bezz form inside the app. BreathFLOW is not emergency or medical support.
`;
}
