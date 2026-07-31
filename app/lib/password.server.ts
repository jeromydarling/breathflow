/**
 * Password hashing with PBKDF2 over WebCrypto.
 *
 * Stored format: `pbkdf2$<iterations>$<salt-b64>$<hash-b64>`. The iteration
 * count travels with the hash so it can be raised later without invalidating
 * anyone's login.
 */

/**
 * Workers refuses PBKDF2 above 100,000 iterations:
 *   NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not
 *   supported (requested 210000).
 *
 * OWASP suggests 210,000 for PBKDF2-SHA512, and the local emulator happily
 * accepts it — so this only ever fails in production, where it took signup,
 * the demo and every login down at once. Do not raise it past the cap.
 */
export const MAX_WORKERS_PBKDF2_ITERATIONS = 100_000;
const ITERATIONS = MAX_WORKERS_PBKDF2_ITERATIONS;
const KEY_BITS = 512;
const SALT_BYTES = 16;

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations,
      hash: "SHA-512",
    },
    key,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

/** Constant-time comparison. Never short-circuit on the first wrong byte. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1000) return false;

  /*
   * Parsing failures mean a malformed stored hash — that is data, and "no
   * match" is the honest answer.
   *
   * A failure inside the KDF is a different animal entirely: it means the
   * platform could not hash at all, so *nobody* can log in. Swallowing that
   * as a wrong password is what let a hard production outage look like a user
   * typo for as long as it did. It gets to surface.
   */
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = fromBase64(parts[2]!);
    expected = fromBase64(parts[3]!);
  } catch {
    return false;
  }

  const actual = await derive(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}

/** SHA-256 hex. Used for reset tokens, which are stored hashed at rest. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Password rules, kept deliberately gentle. Length is what actually matters;
 * character-class requirements mostly produce Passw0rd!.
 */
export const MIN_PASSWORD_LENGTH = 10;

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Passwords need at least ${MIN_PASSWORD_LENGTH} characters — a short phrase works beautifully.`;
  }
  if (password.length > 200) {
    return "That password is longer than we can store. Try something under 200 characters.";
  }
  return null;
}
