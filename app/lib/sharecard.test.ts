import { describe, expect, it } from "vitest";
import {
  CARD_FORMATS,
  CARD_THEMES,
  contentFor,
  escapeXml,
  renderCardSvg,
  suggestedCaption,
  themeFor,
} from "./sharecard";

describe("card formats", () => {
  it("offers the 9:16 story and 4:5 feed shapes the brief requires", () => {
    expect(CARD_FORMATS.story.width / CARD_FORMATS.story.height).toBeCloseTo(
      9 / 16,
      3,
    );
    expect(CARD_FORMATS.feed.width / CARD_FORMATS.feed.height).toBeCloseTo(
      4 / 5,
      3,
    );
  });

  it("offers between three and five artwork themes", () => {
    expect(CARD_THEMES.length).toBeGreaterThanOrEqual(3);
    expect(CARD_THEMES.length).toBeLessThanOrEqual(5);
    const keys = CARD_THEMES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("falls back to a real theme for an unknown key", () => {
    expect(themeFor("nonsense").key).toBe(CARD_THEMES[0]!.key);
  });
});

describe("contentFor", () => {
  it("has no way to carry a private reflection", () => {
    // This is structural, not a string check: the function signature simply
    // has no parameter for a note, so a journal entry cannot reach a card.
    const content = contentFor("minutes", { minutes: 1284 });
    expect(Object.values(content).join(" ")).not.toMatch(/note|reflection/i);
    expect(content.statistic).toBe("1,284");
  });

  it("pluralises a one-day streak correctly", () => {
    expect(contentFor("streak", { streak: 1 }).label).toBe("day in flow");
    expect(contentFor("streak", { streak: 21 }).label).toBe("days in flow");
  });

  it("formats a breath hold as time, not a bare number", () => {
    expect(contentFor("retention", { retentionSeconds: 45 }).statistic).toBe("45s");
    expect(contentFor("retention", { retentionSeconds: 90 }).statistic).toBe("1:30");
    expect(contentFor("retention", { retentionSeconds: 120 }).statistic).toBe("2:00");
  });

  it("never makes a health claim on any card type", () => {
    const kinds = [
      "session",
      "streak",
      "week",
      "minutes",
      "retention",
      "journey",
      "quote",
    ] as const;

    for (const kind of kinds) {
      const content = contentFor(kind, {
        streak: 21,
        minutes: 500,
        weekDays: 5,
        retentionSeconds: 60,
        journeyTitle: "Breath of Rapture",
        sessionTitle: "Grand Rising",
        achievementName: "River",
      });
      const text = Object.values(content).join(" ").toLowerCase();
      expect(text, kind).not.toMatch(
        /cure|cured|heal(ed|s)?\b|treat|diagnos|anxiety-free|trauma|medicine|prescri/,
      );
    }
  });
});

describe("renderCardSvg", () => {
  const svg = renderCardSvg({
    theme: themeFor("dawn"),
    format: "story",
    content: contentFor("streak", { streak: 21 }),
  });

  it("produces a self-contained SVG at the right size", () => {
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain('width="1080"');
    expect(svg).toContain('height="1920"');
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
  });

  it("references nothing external", () => {
    expect(svg).not.toMatch(/<image|xlink:href|https?:\/\/(?!www\.w3\.org)/);
  });

  it("carries the small BreathFLOW mark", () => {
    expect(svg).toContain("BREATHFLOW");
    expect(svg).not.toContain("WITH BEZZ");
  });

  it("adds the founder mark only when asked", () => {
    const withBezz = renderCardSvg({
      theme: themeFor("dawn"),
      format: "feed",
      content: contentFor("streak", { streak: 21 }),
      withBezz: true,
    });
    expect(withBezz).toContain("WITH BEZZ");
  });

  it("is accessible — it has a label", () => {
    expect(svg).toMatch(/role="img"/);
    expect(svg).toMatch(/aria-label="[^"]+"/);
  });

  it("escapes hostile text rather than rendering it as markup", () => {
    const hostile = renderCardSvg({
      theme: themeFor("night"),
      format: "story",
      content: contentFor("journey", {
        journeyTitle: '</text><script>alert(1)</script>',
      }),
    });
    expect(hostile).not.toContain("<script>");
    expect(hostile).toContain("&lt;script&gt;");
  });
});

describe("escapeXml", () => {
  it("escapes every character that could break out of markup", () => {
    expect(escapeXml(`<&>"'`)).toBe("&lt;&amp;&gt;&quot;&apos;");
  });

  it("escapes ampersands before anything else, so no double-encoding", () => {
    expect(escapeXml("&lt;")).toBe("&amp;lt;");
  });
});

describe("suggestedCaption", () => {
  it("matches the brief's example wording", () => {
    const caption = suggestedCaption(
      "streak",
      contentFor("streak", { streak: 21 }),
    );
    expect(caption).toBe("Deep breath. Deep life. Day 21 in flow.");
  });
});
