import { describe, expect, it } from "vitest";
import { SPAM_THRESHOLD, contactProblem, scoreSpam } from "./spam";

/**
 * Real-world samples on both sides. The genuine messages matter more than the
 * spam ones — a scorer that eats a nervous beginner's first question is worse
 * than one that lets a link-builder through.
 */

const GENUINE = [
  {
    name: "Marta",
    email: "marta@example.com",
    message:
      "Hi — I've been doing the Grand Rising for about two weeks and I keep getting tingling in my hands around minute six. Is that normal or should I slow down?",
  },
  {
    name: "Dev",
    email: "dev.patel@example.co.uk",
    message: "how do i start?",
  },
  {
    name: "Ana",
    email: "ana@example.org",
    message:
      "My name is Ana and I run a small yoga studio in Lisbon. I'd love to talk about bringing Bezz over for a weekend workshop — is that something you do?",
  },
  {
    name: "Sam",
    email: "sam@example.net",
    message:
      "I tried Breath of Rapture last night and cried for twenty minutes afterwards. I'm okay, but I wanted to tell someone. Is that a normal response?",
  },
  {
    name: "Jo",
    email: "jo@example.com",
    message:
      "The app won't save my streak. I practise every morning at 6am and it shows zero. I'm in New Zealand if that matters. https://breathflow.app/progress is the page.",
  },
];

const SPAM = [
  {
    name: "SEO Expert",
    email: "seo@marketing-agency.example",
    message:
      "Dear Sir, I hope this email finds you well. I came across your website and noticed it is not ranking on the first page of Google. We are a leading provider of SEO services and link building. Visit https://example.com and https://example.net and https://example.org for our packages.",
  },
  {
    name: "https://cheap-pills.example",
    email: "bot@gmial.com",
    message: "CHEAP OFFERS CLICK HERE NOW [url=https://spam.example]BUY[/url]",
  },
  {
    name: "Alex",
    email: "alex@outsourcing-dev.example",
    message:
      "Hello, we are a leading mobile app development and web design services company. We can build your app for 70% less. Reply for our portfolio.",
  },
];

describe("scoreSpam lets real people through", () => {
  it.each(GENUINE)("keeps $name's message", (sample) => {
    const verdict = scoreSpam({ ...sample, fillMs: 45_000 });
    expect(verdict.isSpam).toBe(false);
  });

  it("does not punish a short question", () => {
    const verdict = scoreSpam({
      name: "Dev",
      email: "dev@example.com",
      message: "how do i start?",
      fillMs: 8000,
    });
    expect(verdict.score).toBeLessThan(SPAM_THRESHOLD);
  });

  it("tolerates a single link in a genuine support message", () => {
    const verdict = scoreSpam({
      name: "Jo",
      email: "jo@example.com",
      message:
        "The page at https://breathflow.app/progress shows zero even though I practised.",
      fillMs: 30_000,
    });
    expect(verdict.isSpam).toBe(false);
  });
});

describe("scoreSpam catches the obvious", () => {
  it.each(SPAM)("drops the message from $name", (sample) => {
    const verdict = scoreSpam({ ...sample, fillMs: 40_000 });
    expect(verdict.isSpam).toBe(true);
  });

  it("treats a filled honeypot as decisive on its own", () => {
    const verdict = scoreSpam({
      name: "Marta",
      email: "marta@example.com",
      message: "A perfectly ordinary question about my morning practice.",
      honeypot: "http://spam.example",
      fillMs: 60_000,
    });
    expect(verdict.isSpam).toBe(true);
    expect(verdict.reasons).toContain("honeypot");
  });

  it("catches a form submitted faster than a human could type it", () => {
    const verdict = scoreSpam({
      name: "Marta",
      email: "marta@example.com",
      message: "A perfectly ordinary question about my morning practice.",
      fillMs: 300,
    });
    expect(verdict.reasons).toContain("submitted-too-fast");
    expect(verdict.isSpam).toBe(true);
  });

  it("does not fire the timing trap when no timestamp was recorded", () => {
    const verdict = scoreSpam({
      name: "Marta",
      email: "marta@example.com",
      message: "A perfectly ordinary question about my morning practice.",
    });
    expect(verdict.reasons).not.toContain("submitted-too-fast");
    expect(verdict.isSpam).toBe(false);
  });

  it("notices a look-alike sender domain", () => {
    const verdict = scoreSpam({
      name: "Bot",
      email: "someone@gmial.com",
      message: "Hello there, just checking in about your website.",
      fillMs: 30_000,
    });
    expect(verdict.reasons).toContain("lookalike-domain");
  });

  it("caps pitch signals rather than stacking them into an absurd score", () => {
    const verdict = scoreSpam({
      name: "X",
      email: "x@example.com",
      message: "seo services link building backlink guest post crypto forex casino",
      fillMs: 30_000,
    });
    // Six distinct pitch phrases are present; only two are ever counted.
    expect(
      verdict.reasons.filter((r) => r.startsWith("pitch:")).length,
    ).toBeLessThanOrEqual(2);
    expect(verdict.isSpam).toBe(true);
  });

  it("treats a single ambiguous pitch word as not-yet-spam on its own", () => {
    // Someone genuinely asking about breathwork for crypto traders is a real
    // person. One signal must not be enough to drop their message.
    const verdict = scoreSpam({
      name: "Priya",
      email: "priya@example.com",
      message:
        "I work in crypto and the stress is constant. Which practice would you start with?",
      fillMs: 40_000,
    });
    expect(verdict.isSpam).toBe(false);
  });
});

describe("contactProblem", () => {
  it("accepts a valid submission", () => {
    expect(
      contactProblem({
        name: "Marta",
        email: "marta@example.com",
        message: "How do I begin?",
      }),
    ).toBeNull();
  });

  it("is kind and specific, never blaming", () => {
    const noName = contactProblem({ name: "", email: "a@b.co", message: "hi there" });
    expect(noName).toMatch(/first name is plenty/i);

    const badEmail = contactProblem({
      name: "Marta",
      email: "not-an-email",
      message: "hi there",
    });
    expect(badEmail).toMatch(/mind checking it/i);

    // No error message may blame the person.
    for (const message of [noName, badEmail]) {
      expect(message).not.toMatch(/invalid|error|failed|you must/i);
    }
  });

  it("rejects an empty and an enormous message", () => {
    expect(
      contactProblem({ name: "A", email: "a@b.co", message: "" }),
    ).not.toBeNull();
    expect(
      contactProblem({ name: "A", email: "a@b.co", message: "x".repeat(6000) }),
    ).not.toBeNull();
  });
});
