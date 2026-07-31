/**
 * Thin D1 helpers.
 *
 * No ORM. The queries in this app are small enough to read, and being able to
 * read them is worth more than the abstraction.
 */

export type Row = Record<string, unknown>;

export async function one<T = Row>(
  db: D1Database,
  sql: string,
  ...binds: unknown[]
): Promise<T | null> {
  const stmt = binds.length ? db.prepare(sql).bind(...binds) : db.prepare(sql);
  return (await stmt.first<T>()) ?? null;
}

export async function all<T = Row>(
  db: D1Database,
  sql: string,
  ...binds: unknown[]
): Promise<T[]> {
  const stmt = binds.length ? db.prepare(sql).bind(...binds) : db.prepare(sql);
  const result = await stmt.all<T>();
  return result.results ?? [];
}

export async function run(
  db: D1Database,
  sql: string,
  ...binds: unknown[]
): Promise<D1Result> {
  const stmt = binds.length ? db.prepare(sql).bind(...binds) : db.prepare(sql);
  return stmt.run();
}

/**
 * Batch writes into a single round trip. Per-request subrequest budgets on
 * Workers are tight, and a completed session writes four rows at once.
 *
 * Every batch is prefixed with `PRAGMA defer_foreign_keys = true`, and that
 * prefix is load-bearing.
 *
 * D1 enforces foreign key constraints in production. The local emulator does
 * not — which is precisely how this hid through a full local test pass. Inside
 * a batch's transaction, a parent row inserted by an earlier statement is not
 * reliably visible to a later statement's immediate FK check, so creating an
 * org and its first user in one batch fails in production with
 * SQLITE_CONSTRAINT_FOREIGNKEY while working perfectly on a laptop.
 *
 * Deferring the checks to commit time is Cloudflare's own recommendation, and
 * it loses nothing: the constraints are still enforced, just at the end of the
 * transaction, by which point every row exists.
 *
 * ALWAYS go through this helper rather than calling `db.batch` directly.
 */
export async function batch(
  db: D1Database,
  statements: D1PreparedStatement[],
): Promise<D1Result[]> {
  if (statements.length === 0) return [];
  const results = await db.batch([
    db.prepare("PRAGMA defer_foreign_keys = true"),
    ...statements,
  ]);
  // Drop the pragma's result so callers keep their original indexing.
  return results.slice(1);
}

export function nowMs(): number {
  return Date.now();
}

/**
 * Every table that holds tenant-scoped rows.
 *
 * This list is the single place that knows what "all of an org's data" means.
 * Data export, account deletion and the demo reset all enumerate it — so when
 * a migration adds an org-scoped table, adding it here is not optional, and
 * db.test.ts fails if the migration file and this list disagree.
 */
export const ORG_TABLES = [
  "users",
  "sessions",
  "contacts",
  "practice_sessions",
  "retention_attempts",
  "achievements",
  "guide_progress",
  "ask_messages",
  "subscriptions",
  "analytics_events",
] as const;

export type OrgTable = (typeof ORG_TABLES)[number];

/** Columns that must never leave the system in an export. */
export const NEVER_EXPORT_COLUMNS = new Set([
  "password_hash",
  "token_hash",
  "provider_customer_id",
  "provider_subscription_id",
]);

/**
 * Delete every trace of an org. Used by account deletion and the demo reset.
 * `users` and `sessions` go last so a partial failure never orphans a login.
 */
export async function purgeOrg(db: D1Database, orgId: string): Promise<void> {
  const ordered: OrgTable[] = [
    "practice_sessions",
    "retention_attempts",
    "achievements",
    "guide_progress",
    "ask_messages",
    "subscriptions",
    "analytics_events",
    "contacts",
    "sessions",
    "users",
  ];
  await batch(
    db,
    ordered.map((table) =>
      db.prepare(`DELETE FROM ${table} WHERE org_id = ?`).bind(orgId),
    ),
  );
  await run(db, `DELETE FROM orgs WHERE id = ?`, orgId);
}

/**
 * Everything an org owns, as plain JSON, minus anything secret.
 * The brief requires privacy controls; this is the "take my data" half.
 */
export async function exportOrg(
  db: D1Database,
  orgId: string,
): Promise<Record<string, Row[]>> {
  const out: Record<string, Row[]> = {};
  for (const table of ORG_TABLES) {
    const rows = await all<Row>(
      db,
      `SELECT * FROM ${table} WHERE org_id = ?`,
      orgId,
    );
    out[table] = rows.map((row) => {
      const clean: Row = {};
      for (const [key, value] of Object.entries(row)) {
        if (!NEVER_EXPORT_COLUMNS.has(key)) clean[key] = value;
      }
      return clean;
    });
  }
  return out;
}
