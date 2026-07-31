/**
 * KV-backed rate limiting.
 *
 * Fails OPEN, always. A broken limiter that locks every user out of their own
 * breath practice is a far worse outcome than a few extra attempts getting
 * through, and KV is eventually consistent by design.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
};

export type RateLimitRule = {
  /** Max attempts inside the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

export const RULES = {
  /** Failed logins, per IP+email pair. Successful logins are never counted. */
  login: { limit: 8, windowSeconds: 900 },
  /** Password reset requests, per IP and per email. */
  passwordReset: { limit: 5, windowSeconds: 3600 },
  /** Signups per IP. */
  signup: { limit: 10, windowSeconds: 3600 },
  /** Ask Bezz submissions per IP. */
  contact: { limit: 5, windowSeconds: 3600 },
  /** Retention logs per user — a sanity cap, not a real constraint. */
  retention: { limit: 60, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

export type RuleName = keyof typeof RULES;

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * Consume one unit against a key. Call this only on *failure* for login, so a
 * user with a working password is never throttled.
 */
export async function consume(
  kv: KVNamespace | undefined,
  rule: RuleName,
  key: string,
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = RULES[rule];
  const allowedResult: RateLimitResult = {
    allowed: true,
    remaining: limit,
    retryAfter: 0,
  };
  if (!kv) return allowedResult;

  // Fixed window. Coarse, but it is the right amount of machinery for this.
  const window = Math.floor(Date.now() / (windowSeconds * 1000));
  const storageKey = `rl:${rule}:${window}:${key}`;

  try {
    const raw = await kv.get(storageKey);
    const used = raw ? Number(raw) : 0;
    const next = (Number.isFinite(used) ? used : 0) + 1;

    await kv.put(storageKey, String(next), {
      expirationTtl: Math.max(60, windowSeconds),
    });

    const resetsAt = (window + 1) * windowSeconds * 1000;
    return {
      allowed: next <= limit,
      remaining: Math.max(0, limit - next),
      retryAfter: Math.max(1, Math.ceil((resetsAt - Date.now()) / 1000)),
    };
  } catch (error) {
    // Fail open, loudly enough to notice in logs.
    console.error("rate limit unavailable, allowing request", { rule, error });
    return allowedResult;
  }
}

/** Read the current count without consuming. Used to gate before doing work. */
export async function peek(
  kv: KVNamespace | undefined,
  rule: RuleName,
  key: string,
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = RULES[rule];
  if (!kv) return { allowed: true, remaining: limit, retryAfter: 0 };

  try {
    const window = Math.floor(Date.now() / (windowSeconds * 1000));
    const raw = await kv.get(`rl:${rule}:${window}:${key}`);
    const used = raw ? Number(raw) : 0;
    const resetsAt = (window + 1) * windowSeconds * 1000;
    return {
      allowed: used < limit,
      remaining: Math.max(0, limit - used),
      retryAfter: Math.max(1, Math.ceil((resetsAt - Date.now()) / 1000)),
    };
  } catch (error) {
    console.error("rate limit unavailable, allowing request", { rule, error });
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }
}

/** Clear a key after a success, so one good login wipes the failure count. */
export async function reset(
  kv: KVNamespace | undefined,
  rule: RuleName,
  key: string,
): Promise<void> {
  if (!kv) return;
  const { windowSeconds } = RULES[rule];
  const window = Math.floor(Date.now() / (windowSeconds * 1000));
  try {
    await kv.delete(`rl:${rule}:${window}:${key}`);
  } catch {
    // Nothing to do — the window will expire on its own.
  }
}
