import type { MetaDescriptor } from "react-router";

/**
 * SEO and AI-findability helpers.
 *
 * Every public page runs its metadata through `marketingMeta` so canonical
 * URLs, Open Graph and Twitter cards can never drift apart.
 *
 * React Router gotcha worth remembering: `meta()` receives `loaderData`, not
 * `data`. Destructuring `{ data }` silently gives you undefined and every page
 * ends up with the fallback title.
 */

export const SITE_NAME = "BreathFLOW";
export const DEFAULT_DESCRIPTION =
  "A daily breath practice rooted in pranayama. Build a consistent ritual, track your Life Force Minutes, and return to flow.";

export type MarketingMetaInput = {
  title: string;
  description?: string;
  /** Path with a leading slash. */
  path: string;
  /** Absolute origin, from the request. */
  origin: string;
  image?: string;
  type?: "website" | "article";
  /** Set for pages that should stay out of search results. */
  noIndex?: boolean;
  publishedTime?: string;
};

export function marketingMeta(input: MarketingMetaInput): MetaDescriptor[] {
  const {
    title,
    description = DEFAULT_DESCRIPTION,
    path,
    origin,
    image = `${origin}/og-default.png`,
    type = "website",
    noIndex = false,
    publishedTime,
  } = input;

  const canonical = `${origin}${path === "/" ? "" : path}`;
  const fullTitle =
    title === SITE_NAME ? title : `${title} · ${SITE_NAME}`;

  const tags: MetaDescriptor[] = [
    { title: fullTitle },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: canonical },

    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: description },
    { property: "og:url", content: canonical },
    { property: "og:type", content: type },
    { property: "og:image", content: image },

    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: fullTitle },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ];

  if (publishedTime) {
    tags.push({ property: "article:published_time", content: publishedTime });
  }
  if (noIndex) {
    tags.push({ name: "robots", content: "noindex, nofollow" });
  }

  return tags;
}

/** Emit JSON-LD as a meta descriptor React Router will render into <head>. */
export function jsonLd(data: Record<string, unknown>): MetaDescriptor {
  return {
    "script:ld+json": data,
  } as unknown as MetaDescriptor;
}

export function organizationSchema(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "BreathFLOW Practice",
    alternateName: SITE_NAME,
    url: origin,
    logo: `${origin}/icon-512.png`,
    description: DEFAULT_DESCRIPTION,
    slogan: "Deep Breath. Deep Life.",
  };
}

export function websiteSchema(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: origin,
    description: DEFAULT_DESCRIPTION,
  };
}

export function softwareApplicationSchema(
  origin: string,
  opts: { priceCents: number; currency: string },
) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "HealthApplication",
    applicationSubCategory: "Breathwork and meditation",
    operatingSystem: "Web, iOS, Android",
    url: origin,
    description: DEFAULT_DESCRIPTION,
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: opts.currency.toUpperCase(),
        name: "Practice",
        description: "Free forever. The Three-Minute Return, streaks, and Life Force Minutes.",
      },
      {
        "@type": "Offer",
        price: (opts.priceCents / 100).toFixed(2),
        priceCurrency: opts.currency.toUpperCase(),
        name: "Deep Practice",
        description: "The full library and the deeper journeys.",
      },
    ],
  };
}

export function articleSchema(opts: {
  origin: string;
  path: string;
  headline: string;
  description: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.headline,
    description: opts.description,
    url: `${opts.origin}${opts.path}`,
    publisher: {
      "@type": "Organization",
      name: "BreathFLOW Practice",
      url: opts.origin,
    },
    isAccessibleForFree: true,
  };
}

export function breadcrumbSchema(
  origin: string,
  trail: Array<{ name: string; path: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${origin}${crumb.path}`,
    })),
  };
}

export function faqSchema(items: readonly { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

/**
 * The vertical-specific schema type. Breathwork sessions are best described as
 * an ExerciseAction/HowTo hybrid; HowTo is the one search engines actually
 * render, so that is what we emit.
 */
export function practiceSchema(opts: {
  origin: string;
  path: string;
  name: string;
  description: string;
  minutes: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: opts.name,
    description: opts.description,
    url: `${opts.origin}${opts.path}`,
    totalTime: `PT${Math.round(opts.minutes)}M`,
    tool: [{ "@type": "HowToTool", name: "A quiet place to sit or lie down" }],
  };
}

/** Absolute origin for the current request, honouring the configured APP_URL. */
export function originFrom(request: Request, env?: Env): string {
  const configured = env?.APP_URL;
  if (configured && /^https?:\/\//.test(configured)) {
    return configured.replace(/\/$/, "");
  }
  return new URL(request.url).origin;
}
