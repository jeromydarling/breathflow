/**
 * Share cards, rendered as SVG at the edge.
 *
 * SVG rather than a canvas/PNG pipeline: it renders identically everywhere,
 * costs almost nothing in a Worker, stays crisp at any size, and needs no
 * font binaries in the bundle. The share sheet and Instagram both accept it
 * once rasterised client-side, and we offer a PNG download path for the
 * platforms that insist.
 *
 * Rules that are not negotiable:
 *   • journal notes and reflections NEVER appear on a card;
 *   • no health claims, no promises, no "cured" anything;
 *   • the statistic is the hero, the branding is small.
 */

export type CardKind =
  | "session"
  | "streak"
  | "week"
  | "minutes"
  | "retention"
  | "journey"
  | "quote";

export type CardTheme = {
  key: string;
  name: string;
  /** Background gradient stops, top to bottom. */
  stops: readonly [string, string, string];
  /** Colour of the large statistic. */
  ink: string;
  /** Colour of supporting text. */
  muted: string;
  /** A soft radial light, positioned as a fraction of the canvas. */
  glow: { x: number; y: number; color: string; opacity: number };
};

export const CARD_THEMES: readonly CardTheme[] = [
  {
    key: "dawn",
    name: "Dawn",
    stops: ["#2a1d17", "#6b3f24", "#c28a3a"],
    ink: "#F8F4EC",
    muted: "#E8D9C4",
    glow: { x: 0.5, y: 0.78, color: "#E8B4A0", opacity: 0.5 },
  },
  {
    key: "night",
    name: "Night Flow",
    stops: ["#0e241b", "#173a2b", "#1c2340"],
    ink: "#F4EFE5",
    muted: "#B9C7C0",
    glow: { x: 0.5, y: 0.3, color: "#7FB3A0", opacity: 0.34 },
  },
  {
    key: "ember",
    name: "Ember",
    stops: ["#171a18", "#3d2418", "#9b623d"],
    ink: "#F8EFE4",
    muted: "#E0C4A8",
    glow: { x: 0.5, y: 0.72, color: "#C28A3A", opacity: 0.46 },
  },
  {
    key: "still",
    name: "Still Water",
    stops: ["#0e241b", "#171a18", "#1c2340"],
    ink: "#F4EFE5",
    muted: "#9DA8A2",
    glow: { x: 0.5, y: 0.5, color: "#F4EFE5", opacity: 0.12 },
  },
  {
    key: "bone",
    name: "Bone",
    stops: ["#F4EFE5", "#E5DCCB", "#D8C6A3"],
    ink: "#171A18",
    muted: "#5A5346",
    glow: { x: 0.5, y: 0.35, color: "#FFFFFF", opacity: 0.55 },
  },
] as const;

export const CARD_FORMATS = {
  story: { width: 1080, height: 1920, name: "Story (9:16)" },
  feed: { width: 1080, height: 1350, name: "Feed (4:5)" },
} as const;

export type CardFormat = keyof typeof CARD_FORMATS;

export type CardContent = {
  /** The big number or short phrase. */
  statistic: string;
  /** What the statistic means. */
  label: string;
  /** One line of brand voice underneath. */
  line: string;
};

export function themeFor(key: string): CardTheme {
  return CARD_THEMES.find((t) => t.key === key) ?? CARD_THEMES[0]!;
}

/** Escape text before it goes anywhere near SVG markup. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Compose the copy for a card. Pure, so sharecard.test.ts can pin that no
 * card can ever carry a health claim or a user's private note.
 */
export function contentFor(
  kind: CardKind,
  values: {
    streak?: number;
    minutes?: number;
    weekDays?: number;
    retentionSeconds?: number;
    journeyTitle?: string;
    sessionTitle?: string;
    achievementName?: string;
  },
): CardContent {
  switch (kind) {
    case "streak":
      return {
        statistic: String(values.streak ?? 0),
        label: `${values.streak === 1 ? "day" : "days"} in flow`,
        line: "Deep breath. Deep life.",
      };
    case "minutes":
      return {
        statistic: (values.minutes ?? 0).toLocaleString(),
        label: "Life Force Minutes",
        line: "Cultivated one breath at a time.",
      };
    case "week":
      return {
        statistic: `${values.weekDays ?? 0}/7`,
        label: "days this week",
        line: "Consistency over intensity.",
      };
    case "retention":
      return {
        statistic: formatHold(values.retentionSeconds ?? 0),
        label: "breath held, comfortably",
        line: "Calm inside the urge to breathe.",
      };
    case "journey":
      return {
        statistic: values.journeyTitle ?? "Complete",
        label: "journey complete",
        line: "You went the whole way.",
      };
    case "session":
      return {
        statistic: values.sessionTitle ?? "Practised",
        label: "today's practice, complete",
        line: "You returned to your breath.",
      };
    case "quote":
      return {
        statistic: values.achievementName ?? "Return to flow",
        label: "",
        line: "The breath is the pathway back to feeling.",
      };
  }
}

function formatHold(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}:${String(s).padStart(2, "0")}` : `${m}:00`;
}

/**
 * Render the card.
 *
 * Everything is inline: system font stacks, no external references, no
 * embedded user content beyond the escaped values above.
 */
export function renderCardSvg(opts: {
  theme: CardTheme;
  format: CardFormat;
  content: CardContent;
  withBezz?: boolean;
}): string {
  const { theme, content, withBezz = false } = opts;
  const { width, height } = CARD_FORMATS[opts.format];

  const statistic = escapeXml(content.statistic);
  const label = escapeXml(content.label);
  const line = escapeXml(content.line);

  // Long words (a journey title) need a smaller size than a three-digit number.
  const statLength = content.statistic.length;
  const statSize =
    statLength <= 3
      ? width * 0.42
      : statLength <= 6
        ? width * 0.3
        : statLength <= 12
          ? width * 0.16
          : width * 0.1;

  const centerY = height * 0.46;
  const glowRadius = width * 0.9;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label ? `${statistic} ${label}` : statistic}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.25" y2="1">
      <stop offset="0%" stop-color="${theme.stops[0]}"/>
      <stop offset="55%" stop-color="${theme.stops[1]}"/>
      <stop offset="100%" stop-color="${theme.stops[2]}"/>
    </linearGradient>
    <radialGradient id="glow" cx="${theme.glow.x}" cy="${theme.glow.y}" r="0.62">
      <stop offset="0%" stop-color="${theme.glow.color}" stop-opacity="${theme.glow.opacity}"/>
      <stop offset="100%" stop-color="${theme.glow.color}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>

  <!-- The breath, as a set of concentric rings -->
  <g fill="none" stroke="${theme.ink}" stroke-opacity="0.14">
    <circle cx="${width / 2}" cy="${centerY}" r="${glowRadius * 0.38}" stroke-width="2"/>
    <circle cx="${width / 2}" cy="${centerY}" r="${glowRadius * 0.5}" stroke-width="1.5"/>
    <circle cx="${width / 2}" cy="${centerY}" r="${glowRadius * 0.62}" stroke-width="1"/>
  </g>

  <text x="${width / 2}" y="${centerY}" text-anchor="middle" dominant-baseline="central"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="${statSize}" fill="${theme.ink}">${statistic}</text>

  ${
    label
      ? `<text x="${width / 2}" y="${centerY + statSize * 0.72}" text-anchor="middle"
        font-family="-apple-system, 'Segoe UI', Roboto, sans-serif"
        font-size="${width * 0.045}" letter-spacing="${width * 0.006}"
        fill="${theme.muted}">${label.toUpperCase()}</text>`
      : ""
  }

  <text x="${width / 2}" y="${height * 0.79}" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif"
        font-style="italic" font-size="${width * 0.048}"
        fill="${theme.muted}">${line}</text>

  <text x="${width / 2}" y="${height * 0.92}" text-anchor="middle"
        font-family="-apple-system, 'Segoe UI', Roboto, sans-serif"
        font-size="${width * 0.032}" letter-spacing="${width * 0.011}"
        fill="${theme.ink}" fill-opacity="0.72">BREATHFLOW${
          withBezz ? "  ·  WITH BEZZ" : ""
        }</text>
</svg>`;
}

/** Suggested caption. Always editable, never auto-posted. */
export function suggestedCaption(kind: CardKind, content: CardContent): string {
  if (kind === "streak") {
    return `Deep breath. Deep life. Day ${content.statistic} in flow.`;
  }
  if (kind === "minutes") {
    return `${content.statistic} Life Force Minutes. One breath at a time.`;
  }
  return "Deep breath. Deep life.";
}
