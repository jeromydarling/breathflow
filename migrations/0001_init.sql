-- BreathFLOW initial schema.
--
-- Wrangler records applied migrations in its own `d1_migrations` table, so
-- re-running `d1 migrations apply` is already idempotent. Every statement here
-- is also written IF NOT EXISTS so a hand-applied re-run is harmless.
--
-- Multi-tenant from row one: every user-owned row carries org_id. BreathFLOW
-- launches consumer-direct, so each user gets a personal org — but retreat
-- cohorts and private groups are on the roadmap and will slot in without a
-- migration of every table.

-- ── Tenancy ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orgs (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'personal', -- personal | cohort | demo
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY,
  org_id           TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email            TEXT NOT NULL,          -- always stored lowercased
  name             TEXT NOT NULL DEFAULT '',
  -- pbkdf2$<iterations>$<salt-b64>$<hash-b64>. Never reversible, never exported.
  password_hash    TEXT,
  role             TEXT NOT NULL DEFAULT 'owner',
  timezone         TEXT NOT NULL DEFAULT 'UTC',
  -- Onboarding answers. All optional — the brief says skipping is allowed.
  intentions       TEXT NOT NULL DEFAULT '',  -- comma list, see lib/onboarding.ts
  experience_level TEXT,                      -- new | some | experienced
  preferred_time   TEXT,                      -- morning | midday | evening | flexible
  reminder_hour    INTEGER,                   -- local hour 0-23; NULL = reminders off
  reduced_motion   INTEGER NOT NULL DEFAULT 0,
  safety_ack_at    INTEGER,
  onboarded_at     INTEGER,
  is_demo          INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL,
  last_seen_at     INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
-- Hot path: the hourly reminder cron asks "who wants a nudge this hour?"
CREATE INDEX IF NOT EXISTS idx_users_reminder ON users(reminder_hour)
  WHERE reminder_hour IS NOT NULL;

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id      TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

-- Tokened, hashed at rest, single-use, short-lived.
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_resets_user ON password_resets(user_id);

-- ── CRM spine ──────────────────────────────────────────────────────────────
-- One gentle contacts table. Roles stack: someone can be a practitioner AND a
-- 1:1 client AND a retreat enquiry. Rows are created automatically from
-- events, never hand-entered.
CREATE TABLE IF NOT EXISTS contacts (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  roles       TEXT NOT NULL DEFAULT '',  -- comma list: practitioner,enquiry,client,subscriber
  source      TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_org_email ON contacts(org_id, email);
-- Keyset pagination reads (name, id) in order — index it that way.
CREATE INDEX IF NOT EXISTS idx_contacts_keyset ON contacts(org_id, name, id);

-- ── Practice ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS practice_sessions (
  id                TEXT PRIMARY KEY,
  org_id            TEXT NOT NULL,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  practice_slug     TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'in_progress', -- in_progress | completed | abandoned
  planned_seconds   INTEGER NOT NULL DEFAULT 0,
  elapsed_seconds   INTEGER NOT NULL DEFAULT 0,
  -- Life Force Minutes actually credited. Stored, not recomputed, so a change
  -- to the accrual rule never silently rewrites someone's history.
  credited_minutes  INTEGER NOT NULL DEFAULT 0,
  -- 'YYYY-MM-DD' in the user's own timezone. Streaks read this column and
  -- nothing else, so a flight across timezones cannot break a streak.
  local_day         TEXT,
  state_check       TEXT,   -- lighter | grounded | energized | emotional | processing
  note              TEXT,   -- private. Never leaves the app, never on a share card.
  started_at        INTEGER NOT NULL,
  completed_at      INTEGER,
  updated_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ps_user_day ON practice_sessions(user_id, local_day);
CREATE INDEX IF NOT EXISTS idx_ps_user_started ON practice_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ps_resume ON practice_sessions(user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS retention_attempts (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seconds     INTEGER NOT NULL,
  method      TEXT NOT NULL DEFAULT 'after_exhale', -- after_inhale | after_exhale
  comfort     TEXT,   -- comfortable | edge | strained
  note        TEXT,
  local_day   TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ret_user_created ON retention_attempts(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS achievements (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  earned_at   INTEGER NOT NULL,
  meta        TEXT NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ach_user_key ON achievements(user_id, key);

CREATE TABLE IF NOT EXISTS guide_progress (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guide_slug    TEXT NOT NULL,
  chapter_index INTEGER NOT NULL DEFAULT 0,
  completed_at  INTEGER,
  updated_at    INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gp_user_guide ON guide_progress(user_id, guide_slug);

-- ── Relationship & conversion ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ask_messages (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL,
  user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  category     TEXT NOT NULL,
  message      TEXT NOT NULL,
  -- Spam is accepted silently and dropped here, so bots never learn the rule.
  spam_score   INTEGER NOT NULL DEFAULT 0,
  spam_reasons TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'new', -- new | read | replied | spam
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ask_status ON ask_messages(status, created_at DESC);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                       TEXT PRIMARY KEY,
  org_id                   TEXT NOT NULL,
  user_id                  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan                     TEXT NOT NULL DEFAULT 'free',   -- free | monthly | annual
  status                   TEXT NOT NULL DEFAULT 'active', -- active | trialing | past_due | canceled
  provider                 TEXT NOT NULL DEFAULT 'none',   -- none | stripe
  provider_customer_id     TEXT,
  provider_subscription_id TEXT,
  current_period_end       INTEGER,
  created_at               INTEGER NOT NULL,
  updated_at               INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_provider ON subscriptions(provider_subscription_id);

-- ── Email hygiene ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_suppressions (
  email       TEXT PRIMARY KEY,
  reason      TEXT NOT NULL,   -- unsubscribed | bounced | complained
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS email_log (
  id          TEXT PRIMARY KEY,
  to_email    TEXT NOT NULL,
  template    TEXT NOT NULL,
  status      TEXT NOT NULL,   -- sent | skipped_no_key | suppressed | failed
  detail      TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_log_created ON email_log(created_at DESC);

-- ── Analytics ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_events (
  id          TEXT PRIMARY KEY,
  org_id      TEXT,
  user_id     TEXT,
  name        TEXT NOT NULL,
  props       TEXT NOT NULL DEFAULT '{}',
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_name_created ON analytics_events(name, created_at DESC);

-- ── Content overrides (the "simple CMS") ───────────────────────────────────
-- The typed registry in app/content/ is the source of truth and the fallback.
-- A row here overrides individual fields so a new journey or a copy fix ships
-- without a deploy, exactly as the acceptance criteria require.
CREATE TABLE IF NOT EXISTS practice_overrides (
  slug        TEXT PRIMARY KEY,
  patch       TEXT NOT NULL DEFAULT '{}',  -- JSON partial of the Practice type
  published   INTEGER NOT NULL DEFAULT 1,
  updated_at  INTEGER NOT NULL
);
