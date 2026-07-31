import { redirect } from "react-router";
import { newId, newToken } from "./ids";
import { all, batch, one, run } from "./db.server";
import {
  MAX_WORKERS_PBKDF2_ITERATIONS,
  hashPassword,
  sha256Hex,
  verifyPassword,
} from "./password.server";
import { isValidTimeZone } from "./time";

export const SESSION_COOKIE = "bf_session";

/**
 * A well-formed hash that no password matches, used to keep the timing of a
 * miss close to the timing of a hit. Built from the live iteration count so it
 * can never drift out of step with real hashes.
 */
const DECOY_HASH = `pbkdf2$${MAX_WORKERS_PBKDF2_ITERATIONS}$${btoa(
  "decoy-salt-0000",
)}$${btoa("decoy-not-a-real-derived-key-value-here")}`;
const SESSION_DAYS = 60;
const RESET_TTL_MS = 60 * 60 * 1000; // one hour, as the brief requires

export type User = {
  id: string;
  org_id: string;
  email: string;
  name: string;
  password_hash: string | null;
  role: string;
  timezone: string;
  intentions: string;
  experience_level: string | null;
  preferred_time: string | null;
  reminder_hour: number | null;
  reduced_motion: number;
  safety_ack_at: number | null;
  onboarded_at: number | null;
  is_demo: number;
  created_at: number;
  last_seen_at: number | null;
};

// ── Cookies ────────────────────────────────────────────────────────────────

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
    `Max-Age=${maxAgeSeconds}`,
  ];
  return parts.join("; ");
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
}

export function readSessionToken(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=") || null;
  }
  return null;
}

/** True when *any* session cookie is present — used to bypass the edge cache. */
export function hasSessionCookie(request: Request): boolean {
  return readSessionToken(request) !== null;
}

// ── Lookup ─────────────────────────────────────────────────────────────────

/**
 * Per-request memoization. A single page can call requireUser from a layout
 * loader and three child loaders; that must be one database read, not four.
 */
const userCache = new WeakMap<Request, Promise<User | null>>();

export function getUser(
  request: Request,
  env: Env,
): Promise<User | null> {
  const cached = userCache.get(request);
  if (cached) return cached;

  const promise = (async (): Promise<User | null> => {
    const token = readSessionToken(request);
    if (!token) return null;

    const row = await one<User & { expires_at: number }>(
      env.DB,
      `SELECT u.*, s.expires_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ? AND s.expires_at > ?`,
      token,
      Date.now(),
    );
    if (!row) return null;

    const { expires_at: _expires, ...user } = row;
    return user as User;
  })();

  userCache.set(request, promise);
  return promise;
}

export async function requireUser(request: Request, env: Env): Promise<User> {
  const user = await getUser(request, env);
  if (!user) {
    const url = new URL(request.url);
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(`/login?next=${next}`);
  }
  return user;
}

/** For the app shell: send un-onboarded users back to finish the invitation. */
export async function requireOnboardedUser(
  request: Request,
  env: Env,
): Promise<User> {
  const user = await requireUser(request, env);
  if (!user.onboarded_at) throw redirect("/welcome");
  return user;
}

// ── Sessions ───────────────────────────────────────────────────────────────

export async function createSession(
  env: Env,
  user: Pick<User, "id" | "org_id">,
  request: Request,
): Promise<{ token: string; cookie: string }> {
  const token = newId("session", 32);
  const now = Date.now();
  const expiresAt = now + SESSION_DAYS * 86_400_000;

  await run(
    env.DB,
    `INSERT INTO sessions (id, user_id, org_id, expires_at, created_at, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    token,
    user.id,
    user.org_id,
    expiresAt,
    now,
    (request.headers.get("user-agent") ?? "").slice(0, 255),
  );

  return {
    token,
    cookie: sessionCookie(token, SESSION_DAYS * 86_400),
  };
}

export async function destroySession(env: Env, token: string): Promise<void> {
  await run(env.DB, `DELETE FROM sessions WHERE id = ?`, token);
}

/** Removing a member — or changing a password — kills every session at once. */
export async function destroyAllSessions(
  env: Env,
  userId: string,
): Promise<void> {
  await run(env.DB, `DELETE FROM sessions WHERE user_id = ?`, userId);
}

export async function sweepExpiredSessions(env: Env): Promise<number> {
  const result = await run(
    env.DB,
    `DELETE FROM sessions WHERE expires_at < ?`,
    Date.now(),
  );
  return result.meta?.changes ?? 0;
}

// ── Accounts ───────────────────────────────────────────────────────────────

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Deliberately permissive. We are not the arbiter of valid email addresses. */
export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

export async function findUserByEmail(
  env: Env,
  email: string,
): Promise<User | null> {
  return one<User>(
    env.DB,
    `SELECT * FROM users WHERE email = ?`,
    normalizeEmail(email),
  );
}

export type SignupInput = {
  email: string;
  password: string;
  name?: string;
  timezone?: string;
  isDemo?: boolean;
};

export async function createUser(
  env: Env,
  input: SignupInput,
): Promise<User> {
  const now = Date.now();
  const email = normalizeEmail(input.email);
  const name = (input.name ?? "").trim().slice(0, 120);
  const timezone =
    input.timezone && isValidTimeZone(input.timezone) ? input.timezone : "UTC";

  const orgId = newId("org");
  const userId = newId("user");
  const passwordHash = await hashPassword(input.password);

  await batch(env.DB, [
    env.DB.prepare(
      `INSERT INTO orgs (id, name, kind, created_at) VALUES (?, ?, ?, ?)`,
    ).bind(
      orgId,
      name || email,
      input.isDemo ? "demo" : "personal",
      now,
    ),
    env.DB.prepare(
      `INSERT INTO users (id, org_id, email, name, password_hash, role, timezone, is_demo, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, 'owner', ?, ?, ?, ?)`,
    ).bind(
      userId,
      orgId,
      email,
      name,
      passwordHash,
      timezone,
      input.isDemo ? 1 : 0,
      now,
      now,
    ),
    // Everyone starts on the free plan. No card, no trial countdown, no gate.
    env.DB.prepare(
      `INSERT INTO subscriptions (id, org_id, user_id, plan, status, provider, created_at, updated_at)
       VALUES (?, ?, ?, 'free', 'active', 'none', ?, ?)`,
    ).bind(newId("subscription"), orgId, userId, now, now),
  ]);

  const user = await one<User>(env.DB, `SELECT * FROM users WHERE id = ?`, userId);
  if (!user) throw new Error("user vanished immediately after creation");
  return user;
}

export async function verifyCredentials(
  env: Env,
  email: string,
  password: string,
): Promise<User | null> {
  const user = await findUserByEmail(env, email);
  if (!user) {
    // Burn roughly the same time as a real verification so the response time
    // does not reveal whether the address exists. The decoy has to use the
    // real iteration count, or it neither costs the same nor stays valid.
    await verifyPassword(password, DECOY_HASH);
    return null;
  }
  const ok = await verifyPassword(password, user.password_hash);
  return ok ? user : null;
}

export async function setPassword(
  env: Env,
  userId: string,
  password: string,
): Promise<void> {
  const hash = await hashPassword(password);
  await run(
    env.DB,
    `UPDATE users SET password_hash = ? WHERE id = ?`,
    hash,
    userId,
  );
}

export async function touchLastSeen(env: Env, userId: string): Promise<void> {
  await run(
    env.DB,
    `UPDATE users SET last_seen_at = ? WHERE id = ?`,
    Date.now(),
    userId,
  );
}

// ── Password reset ─────────────────────────────────────────────────────────

/**
 * Issues a reset token. The raw token goes in the email; only its SHA-256
 * lives in the database. Single-use, one-hour expiry.
 */
export async function issueResetToken(
  env: Env,
  userId: string,
): Promise<string> {
  const token = newToken(32);
  const now = Date.now();
  await run(
    env.DB,
    `INSERT INTO password_resets (token_hash, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
    await sha256Hex(token),
    userId,
    now + RESET_TTL_MS,
    now,
  );
  return token;
}

export async function consumeResetToken(
  env: Env,
  token: string,
): Promise<User | null> {
  const hash = await sha256Hex(token);
  const row = await one<{ user_id: string }>(
    env.DB,
    `SELECT user_id FROM password_resets
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`,
    hash,
    Date.now(),
  );
  if (!row) return null;

  await run(
    env.DB,
    `UPDATE password_resets SET used_at = ? WHERE token_hash = ?`,
    Date.now(),
    hash,
  );
  return one<User>(env.DB, `SELECT * FROM users WHERE id = ?`, row.user_id);
}

/** Peek at a token's validity without spending it (for the reset form's GET). */
export async function resetTokenIsValid(
  env: Env,
  token: string,
): Promise<boolean> {
  const row = await one(
    env.DB,
    `SELECT 1 AS ok FROM password_resets
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`,
    await sha256Hex(token),
    Date.now(),
  );
  return row !== null;
}

export async function activeSessionCount(
  env: Env,
  userId: string,
): Promise<number> {
  const rows = await all<{ n: number }>(
    env.DB,
    `SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND expires_at > ?`,
    userId,
    Date.now(),
  );
  return rows[0]?.n ?? 0;
}
