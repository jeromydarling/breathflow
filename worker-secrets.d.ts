/**
 * Worker secrets.
 *
 * `wrangler types` only knows about bindings and non-secret vars, so secrets
 * are declared here by declaration merging. They are all optional on purpose:
 * every integration must run dark when its key is absent, and typing them as
 * required would let a missing-key path slip past the compiler.
 *
 * Set them with:
 *   npx wrangler secret put RESEND_API_KEY
 *
 * Never put a value in this file, in wrangler.jsonc, or anywhere in the repo.
 */
interface Env {
  /** Resend. Absent → email logs instead of sending. */
  RESEND_API_KEY?: string;

  /** Stripe. Absent → billing is dark and every gate opens. */
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_MONTHLY?: string;
  STRIPE_PRICE_ANNUAL?: string;

  /** Anthropic. Reserved for post-V1 AI features; unused today. */
  ANTHROPIC_API_KEY?: string;
}
