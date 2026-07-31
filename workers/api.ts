import { Hono } from "hono";
import { getUser } from "../app/lib/auth.server";
import { one, run } from "../app/lib/db.server";
import { suppress } from "../app/lib/email.server";
import {
  applySubscriptionUpdate,
  billingIsLive,
  planForPriceId,
} from "../app/lib/membership.server";
import { sha256Hex } from "../app/lib/password.server";
import { track, EVENTS } from "../app/lib/analytics.server";
import { lifeForceMinutesFor } from "../app/lib/streaks";
import { localDay } from "../app/lib/time";

/**
 * JSON, webhook and beacon endpoints.
 *
 * Everything a human looks at is server-rendered by React Router. This is only
 * for the things that genuinely need to be an API: mid-session progress saves,
 * webhooks, and one-click unsubscribe.
 */
export const api = new Hono<{ Bindings: Env }>();

api.get("/api/health", (c) =>
  c.json({
    ok: true,
    app: "breathflow",
    // Verifiable markers so a live deploy can be checked without a browser.
    email: Boolean(c.env.RESEND_API_KEY) ? "live" : "dark",
    billing: billingIsLive(c.env) ? "live" : "dark",
  }),
);

/**
 * Mid-session progress save.
 *
 * The player beacons this every 15 seconds and once more on pagehide, so a
 * phone call, a locked screen or a closed tab never costs someone their
 * minutes. Idempotent: it only ever moves elapsed_seconds forward.
 */
api.post("/api/session/heartbeat", async (c) => {
  const user = await getUser(c.req.raw, c.env);
  if (!user) return c.json({ ok: false }, 401);

  let body: { sessionId?: string; elapsed?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "bad json" }, 400);
  }

  const sessionId = String(body.sessionId ?? "");
  const elapsed = Math.max(0, Math.floor(Number(body.elapsed ?? 0)));
  if (!sessionId || !Number.isFinite(elapsed)) {
    return c.json({ ok: false, error: "missing fields" }, 400);
  }

  const row = await one<{ planned_seconds: number }>(
    c.env.DB,
    `SELECT planned_seconds FROM practice_sessions
      WHERE id = ? AND user_id = ? AND status = 'in_progress'`,
    sessionId,
    user.id,
  );
  if (!row) return c.json({ ok: false, error: "no such session" }, 404);

  // Clamp to the practice length — a tampered beacon can't mint minutes.
  const clamped = Math.min(elapsed, row.planned_seconds + 60);

  await run(
    c.env.DB,
    `UPDATE practice_sessions
        SET elapsed_seconds = MAX(elapsed_seconds, ?), updated_at = ?
      WHERE id = ? AND user_id = ? AND status = 'in_progress'`,
    clamped,
    Date.now(),
    sessionId,
    user.id,
  );

  return c.json({ ok: true, elapsed: clamped });
});

/**
 * Abandon a session cleanly (the user chose "exit" and confirmed).
 * Partial minutes are still credited — the time was still spent breathing.
 */
api.post("/api/session/abandon", async (c) => {
  const user = await getUser(c.req.raw, c.env);
  if (!user) return c.json({ ok: false }, 401);

  let body: { sessionId?: string; elapsed?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "bad json" }, 400);
  }

  const sessionId = String(body.sessionId ?? "");
  const elapsed = Math.max(0, Math.floor(Number(body.elapsed ?? 0)));
  const now = Date.now();

  const row = await one<{ planned_seconds: number }>(
    c.env.DB,
    `SELECT planned_seconds FROM practice_sessions
      WHERE id = ? AND user_id = ? AND status = 'in_progress'`,
    sessionId,
    user.id,
  );
  if (!row) return c.json({ ok: true });

  const clamped = Math.min(elapsed, row.planned_seconds + 60);

  await run(
    c.env.DB,
    `UPDATE practice_sessions
        SET status = 'abandoned', elapsed_seconds = MAX(elapsed_seconds, ?),
            credited_minutes = ?, local_day = ?, updated_at = ?
      WHERE id = ? AND user_id = ?`,
    clamped,
    lifeForceMinutesFor(clamped),
    localDay(now, user.timezone),
    now,
    sessionId,
    user.id,
  );

  c.executionCtx.waitUntil(
    track(c.env, {
      name: EVENTS.practiceAbandoned,
      orgId: user.org_id,
      userId: user.id,
      props: { elapsed: clamped },
    }),
  );

  return c.json({ ok: true });
});

/**
 * One-click unsubscribe. Must work on a GET (mailbox providers fetch it) and
 * on a POST (RFC 8058 List-Unsubscribe-Post).
 */
async function handleUnsubscribe(c: {
  req: { query: (k: string) => string | undefined };
  env: Env;
  html: (s: string) => Response;
}) {
  const token = c.req.query("token") ?? "";
  if (!token) return c.html(unsubscribePage("We couldn't read that link."));

  const row = await one<{ email: string }>(
    c.env.DB,
    `SELECT email FROM users WHERE id = ?`,
    token,
  );
  if (!row) return c.html(unsubscribePage("We couldn't find that address."));

  await suppress(c.env, row.email, "unsubscribed");
  await run(
    c.env.DB,
    `UPDATE users SET reminder_hour = NULL WHERE id = ?`,
    token,
  );

  return c.html(
    unsubscribePage(
      "You're unsubscribed. No more emails from us — your practice is still yours, and your account is untouched.",
    ),
  );
}

api.get("/api/unsubscribe", (c) => handleUnsubscribe(c as never));
api.post("/api/unsubscribe", (c) => handleUnsubscribe(c as never));

function unsubscribePage(message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribed · BreathFLOW</title>
<style>body{background:#171a18;color:#f4efe5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:grid;place-items:center;min-height:100dvh;margin:0;padding:2rem;text-align:center;line-height:1.6}a{color:#e0a84e}</style>
</head><body><div><h1 style="font-weight:400">${message}</h1>
<p><a href="/">Back to BreathFLOW</a></p></div></body></html>`;
}

/**
 * Stripe webhook.
 *
 * Verifies the signature before trusting a byte. Returns 200 on an
 * unconfigured deployment so Stripe never retries against a dark environment.
 */
api.post("/api/stripe/webhook", async (c) => {
  if (!c.env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ ok: true, note: "billing is dark" });
  }

  const signature = c.req.header("stripe-signature") ?? "";
  const payload = await c.req.text();

  const verified = await verifyStripeSignature(
    payload,
    signature,
    c.env.STRIPE_WEBHOOK_SECRET,
  );
  if (!verified) return c.json({ ok: false, error: "bad signature" }, 400);

  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return c.json({ ok: false, error: "bad json" }, 400);
  }

  const object = event?.data?.object ?? {};
  const userId: string | undefined =
    object?.metadata?.user_id ?? object?.subscription_details?.metadata?.user_id;

  switch (event.type) {
    case "checkout.session.completed":
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      if (!userId) break;
      const priceId =
        object?.items?.data?.[0]?.price?.id ??
        object?.line_items?.data?.[0]?.price?.id ??
        "";
      await applySubscriptionUpdate(c.env, {
        userId,
        plan: priceId ? planForPriceId(c.env, priceId) : "monthly",
        status: object?.status ?? "active",
        customerId: object?.customer ?? null,
        subscriptionId: object?.subscription ?? object?.id ?? null,
        currentPeriodEnd: object?.current_period_end
          ? object.current_period_end * 1000
          : null,
      });
      c.executionCtx.waitUntil(
        track(c.env, {
          name: EVENTS.subscriptionActivated,
          userId,
          props: { type: event.type },
        }),
      );
      break;
    }
    case "customer.subscription.deleted": {
      if (!userId) break;
      await applySubscriptionUpdate(c.env, {
        userId,
        plan: "free",
        status: "canceled",
      });
      break;
    }
    default:
      break;
  }

  return c.json({ ok: true });
});

/** Stripe's v1 scheme: HMAC-SHA256 over `${timestamp}.${payload}`. */
async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
): Promise<boolean> {
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const [k, ...rest] = kv.split("=");
      return [k?.trim() ?? "", rest.join("=")];
    }),
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  // Reject anything older than five minutes to blunt replay.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  const expected = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

/** Unused today, but keeps the hash helper honest for future webhook work. */
export { sha256Hex };
