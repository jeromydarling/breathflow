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
 */
export async function batch(
  db: D1Database,
  statements: D1PreparedStatement[],
): Promise<D1Result[]> {
  if (statements.length === 0) return [];
  return db.batch(statements);
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
