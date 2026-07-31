/**
 * Prefixed random IDs. One helper, used everywhere, so an ID is always
 * self-describing in a log line or a support ticket.
 */
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export const ID_PREFIXES = {
  org: "og",
  user: "us",
  session: "se",
  contact: "ct",
  practiceSession: "ps",
  retention: "rt",
  checkin: "ck",
  achievement: "ac",
  guideProgress: "gp",
  ask: "ak",
  subscription: "sb",
  resetToken: "rs",
  shareCard: "sc",
  event: "ev",
  practice: "pr",
} as const;

export type IdKind = keyof typeof ID_PREFIXES;

/** 20 random base-36 chars ≈ 103 bits of entropy. Plenty, and easy to read. */
export function newId(kind: IdKind, length = 20): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return `${ID_PREFIXES[kind]}_${out}`;
}

/** URL-safe opaque token (password reset, calendar feed, unsubscribe). */
export function newToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isId(kind: IdKind, value: unknown): value is string {
  return (
    typeof value === "string" && value.startsWith(`${ID_PREFIXES[kind]}_`)
  );
}
