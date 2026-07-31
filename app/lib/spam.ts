/**
 * Content spam scoring for the Ask Bezz form.
 *
 * Layered defence, not a single honeypot: this scorer plus a honeypot field,
 * a client-stamped timing trap, and a per-IP cap.
 *
 * The response to spam is always the same warm "thanks" a real message gets —
 * the message is simply dropped and the reason logged. Bots never learn the
 * rule, so they never work around it.
 *
 * Pure and tested against real submissions in spam.test.ts.
 */

export type SpamVerdict = {
  score: number;
  reasons: string[];
  /** At or above this, the message is stored as spam and never relayed. */
  isSpam: boolean;
};

export const SPAM_THRESHOLD = 5;

const PITCH_PHRASES = [
  "seo services",
  "guest post",
  "link building",
  "backlink",
  "increase your traffic",
  "first page of google",
  "web design services",
  "mobile app development",
  "we are a leading",
  "outsourcing",
  "dear sir",
  "dear sir/madam",
  "business proposal",
  "crypto",
  "forex",
  "casino",
  "loan offer",
  "investment opportunity",
];

const FORM_LETTER_OPENERS = [
  "i hope this email finds you well",
  "i hope this message finds you well",
  "i came across your website",
  "i was browsing your website",
  "i visited your website and",
  "my name is",
];

/** Domains that imitate a real provider closely enough to be a tell. */
const LOOKALIKE_DOMAINS =
  /@(gmial|gmai1|gnail|hotmial|outlok|yaho|proton-mail|mail-ru)\./i;

function countLinks(text: string): number {
  return (text.match(/https?:\/\/|www\.|\[url|<a\s/gi) ?? []).length;
}

export type SpamInput = {
  name: string;
  email: string;
  message: string;
  /** Hidden field. Only a bot fills it in. */
  honeypot?: string;
  /** Milliseconds between the form rendering and being submitted. */
  fillMs?: number;
};

export function scoreSpam(input: SpamInput): SpamVerdict {
  const reasons: string[] = [];
  let score = 0;

  const message = (input.message ?? "").trim();
  const lower = message.toLowerCase();
  const email = (input.email ?? "").toLowerCase();
  const name = (input.name ?? "").trim();

  // Honeypot — decisive on its own.
  if (input.honeypot && input.honeypot.trim().length > 0) {
    score += 10;
    reasons.push("honeypot");
  }

  // Timing trap. A human cannot read the form, think of a question about their
  // breath practice, and type it in under two seconds.
  if (typeof input.fillMs === "number" && input.fillMs >= 0 && input.fillMs < 2000) {
    score += 6;
    reasons.push("submitted-too-fast");
  }

  const links = countLinks(message);
  if (links >= 3) {
    score += 5;
    reasons.push(`links:${links}`);
  } else if (links === 2) {
    score += 2;
    reasons.push("links:2");
  } else if (links === 1) {
    score += 1;
    reasons.push("links:1");
  }

  // Count up to two distinct pitch signals. One is ambiguous — a real person
  // might mention crypto. Two is an outsourcing pitch. More than two adds
  // nothing, so the contribution is capped rather than stacked into absurdity.
  let pitchHits = 0;
  for (const phrase of PITCH_PHRASES) {
    if (!lower.includes(phrase)) continue;
    reasons.push(`pitch:${phrase}`);
    score += 3;
    if (++pitchHits === 2) break;
  }

  for (const opener of FORM_LETTER_OPENERS) {
    if (lower.startsWith(opener) || lower.includes(`\n${opener}`)) {
      score += 2;
      reasons.push("form-letter-opener");
      break;
    }
  }

  if (LOOKALIKE_DOMAINS.test(email)) {
    score += 4;
    reasons.push("lookalike-domain");
  }

  // BBCode/HTML tags in a plain-text form.
  if (/\[url=|\[\/url\]|<a\s+href/i.test(message)) {
    score += 4;
    reasons.push("markup-in-plaintext");
  }

  // Wall of capitals.
  const letters = message.replace(/[^a-z]/gi, "");
  if (letters.length > 20) {
    const caps = (message.match(/[A-Z]/g) ?? []).length;
    if (caps / letters.length > 0.6) {
      score += 2;
      reasons.push("shouting");
    }
  }

  // A name that is just a URL, or an empty name with a long message.
  if (/https?:\/\//i.test(name)) {
    score += 4;
    reasons.push("url-in-name");
  }

  // Very short messages are not spam — "how do I start?" is a real question.
  // Very long ones with links usually are.
  if (message.length > 1500 && links >= 1) {
    score += 2;
    reasons.push("long-with-links");
  }

  return { score, reasons, isSpam: score >= SPAM_THRESHOLD };
}

/**
 * Non-spam validation. Kind and specific — never blaming.
 * Returns null when the submission is fine.
 */
export function contactProblem(input: SpamInput): string | null {
  if (!input.name?.trim()) {
    return "We need a name to reply to — first name is plenty.";
  }
  if (!input.email?.trim()) {
    return "We need an email address, or Bezz has nowhere to write back to.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.email.trim())) {
    return "That email address doesn't look quite right — mind checking it?";
  }
  const message = input.message?.trim() ?? "";
  if (message.length < 4) {
    return "Tell us a little more, even one line — we'd rather answer the real question.";
  }
  if (message.length > 5000) {
    return "That's longer than this form can hold. Trim it a little and we'll read every word.";
  }
  return null;
}
