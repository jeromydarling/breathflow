# BreathFLOW

> Deep Breath. Deep Life.

A daily breath practice rooted in the yogic tradition of pranayama. Built as a
server-rendered, installable web app on Cloudflare Workers.

---

## Activating this deployment

Everything runs today without a single third-party key — email logs instead of
sending, billing is dark and every gate is open. These are the only steps
needed to put it live.

### 1. Create the Cloudflare resources

```bash
npx wrangler d1 create breathflow                 # paste the id into wrangler.jsonc
npx wrangler kv namespace create BREATHFLOW_KV    # paste the id into wrangler.jsonc
npx wrangler r2 bucket create breathflow-media
```

Both `database_id` and the KV `id` in `wrangler.jsonc` are currently
`PLACEHOLDER_…` and must be replaced before a deploy will succeed.

### 2. Apply the migrations

```bash
npm run db:migrate:local     # local dev database
npm run db:migrate:remote    # production
```

### 3. Set `APP_URL` once you have a domain

`APP_URL` ships **empty on purpose**, and the app works that way — canonical
URLs, `sitemap.xml`, `llms.txt` and links in emails sent from a request all
derive from the origin the request actually arrived on.

Set it in `wrangler.jsonc` when you have the real hostname. Two things depend
on it:

- **Cron reminders.** A scheduled run has no request to infer an origin from,
  so the daily reminder is skipped (with a log line) until `APP_URL` is set.
- **Stable canonical URLs**, if the app is ever reachable on more than one
  hostname.

Do not guess a domain here. `breathflow.app` is an unrelated German breathing
app — pointing at it would put a stranger's URL in your canonical tags,
sitemap and email links. `SUPPORT_EMAIL` and `FROM_EMAIL` are placeholders on
a domain you should confirm you control before enabling email.

### 4. Deploy

```bash
npm run deploy
```

Or connect the repo to Workers Builds and push to `main`.

### 5. Turn integrations on, one at a time

Each of these is optional and independent. Until a key is set, that
integration runs dark and the app stays fully usable.

| To enable | Run |
| --- | --- |
| Email (Resend) | `npx wrangler secret put RESEND_API_KEY` |
| Billing (Stripe) | `npx wrangler secret put STRIPE_SECRET_KEY` |
| ↳ then | `npx wrangler secret put STRIPE_WEBHOOK_SECRET` |
| ↳ then the two price ids | `npx wrangler secret put STRIPE_PRICE_MONTHLY` (and `STRIPE_PRICE_ANNUAL`) |

After setting `RESEND_API_KEY`, verify the sender domain in Resend and use
**Settings → Email → Send myself a test** in the app. It surfaces the
provider's verbatim error if anything is wrong.

Point the Stripe webhook at `https://<your-domain>/api/stripe/webhook`.

Booking and social links are non-secret and live in `wrangler.jsonc` as
`BOOKING_URL` and `INSTAGRAM_URL`. Leave them empty and the Bezz screen routes
those buttons to the Ask form instead of showing a broken link.

---

## Before launch — decisions and reviews still outstanding

These are deliberately left open because they are not an engineer's call.

1. **Pricing is a placeholder.** `app/lib/pricing.ts` carries $12.99/month and
   $89.99/year. Change the two `cents` values and every surface — paywall,
   pricing page, comparison pages, `llms.txt`, structured data — follows.
   `pricing.test.ts` pins the savings claim to the real arithmetic.
2. **Founder credentials are held back.** Every certification, teacher and
   event from the brief sits in `app/content/bezz.ts` behind
   `CREDENTIALS_VERIFIED = false` and does **not** render in production. Set it
   to `true` once the wording is confirmed. A test fails if it is flipped
   without that happening deliberately.
3. **Privacy, terms and safety need legal and clinical review.** All three
   pages carry a visible banner saying so. They describe what the software
   actually does, which is the right brief for a lawyer, not a substitute for
   one.
4. **Audio does not exist yet.** The practice registry references R2 keys under
   `audio/`. Until those objects are uploaded the player runs on the breathing
   orb and its paced phase labels, which is a complete experience — but it is
   not the product until Bezz records the sessions.
5. **The founder video** on the Bezz screen renders a "coming soon" placeholder
   rather than a broken player.

---

## How it is built

- **Cloudflare Workers** runtime, **React Router v8** in SSR mode for every
  page, **Hono** mounted at `/api/*` for JSON, webhooks and beacons.
- **D1** for relational data, **KV** for rate limits, **R2** for media.
- Cron triggers: hourly practice reminders, nightly demo reset and session
  sweep.

### Conventions worth knowing

- **Money is integer cents**, only ever formatted at the edge of the system.
  `app/lib/pricing.ts` is the single source of truth.
- **Streaks are computed against the user's own midnight**, never UTC.
  `practice_sessions.local_day` stores the day a session belongs to, and
  nothing else is consulted.
- **Every integration degrades cleanly without its key.** Email logs, billing
  opens every gate, and the UI says so honestly rather than pretending.
- **Multi-tenant from row one.** Every user-owned row carries `org_id`; each
  user gets a personal org. `ORG_TABLES` in `app/lib/db.server.ts` is the one
  list that knows what "all of someone's data" means, and a test fails if a
  migration adds an org-scoped table without updating it.
- **Server-only modules end in `.server.ts`** and are kept out of the client
  bundle by the build.

### Layout

```
app/
  content/     practices, guides, achievements, comparisons, Bezz — typed registries
  lib/         pure logic (tested) + .server modules
  components/  the breathing orb, share cards, guide blocks
  routes/      marketing/ · auth/ · onboarding/ · app/ · well-known/
workers/       the Worker entry, the Hono API, cron
migrations/    numbered SQL
```

---

## Development

```bash
npm install
npm run db:migrate:local
npm run dev
```

| Command | |
| --- | --- |
| `npm run dev` | local dev server |
| `npm test` | Vitest — pure logic, content integrity, cache policy |
| `npm run typecheck` | typegen + `tsc --noEmit` |
| `npm run build` | production build |
| `node scripts/generate-assets.mjs` | regenerate the OG card and PWA icons |

The seeded demo lives at `/demo` — it auto-logs in, shows a banner, resets
nightly, and self-heals if it is ever found empty.

---

## Deviations from the design brief

The brief (§20.3) suggested React Native or Flutter with Supabase or Firebase.
This is built as a server-rendered, installable web app on Cloudflare Workers
with D1 instead, because that is the stack this project already had running.

The practical differences, stated plainly:

- **In favour:** one codebase, no app-store review between a fix and its users,
  every public page crawlable and citable by AI assistants out of the box, and
  content updatable without a release.
- **Against:** push notifications on iOS require the user to add the app to
  their home screen first, so the reminder suite is email today. Background
  audio with the screen locked is weaker than a native app's. Apple Health and
  wearable integrations — already excluded from V1 — would need a native shell
  later.

If native apps become the right call, the Worker becomes their API and the data
model carries over unchanged.
