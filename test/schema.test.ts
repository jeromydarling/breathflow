import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NEVER_EXPORT_COLUMNS, ORG_TABLES } from "~/lib/db.server";
import {
  INTENTIONS,
  MAX_INTENTIONS,
  PRACTICE_TIMES,
  STEPS,
  firstInvitationSlug,
  isStep,
  nextStep,
  reminderHourFor,
  sanitizeIntentions,
} from "~/lib/onboarding";
import { PRACTICES } from "~/content/practices";
import { RULES } from "~/lib/ratelimit.server";

const MIGRATIONS_DIR = join(process.cwd(), "migrations");

function allMigrationSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(join(MIGRATIONS_DIR, file), "utf8"))
    .join("\n");
}

/** Table names declared by CREATE TABLE statements across all migrations. */
function declaredTables(sql: string): Set<string> {
  const names = new Set<string>();
  const pattern = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+([a-z_]+)/gi;
  for (const match of sql.matchAll(pattern)) names.add(match[1]!.toLowerCase());
  return names;
}

/** Tables that carry an org_id column. */
function orgScopedTables(sql: string): Set<string> {
  const names = new Set<string>();
  const blocks = sql.split(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+/i).slice(1);
  for (const block of blocks) {
    const name = block.match(/^([a-z_]+)/i)?.[1]?.toLowerCase();
    if (!name) continue;
    const body = block.slice(0, block.indexOf(");"));
    if (/\borg_id\b/i.test(body)) names.add(name);
  }
  return names;
}

describe("migrations", () => {
  const sql = allMigrationSql();

  it("are numbered and ordered", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(file, file).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
    }
  });

  it("are safe to re-run by hand", () => {
    // Wrangler tracks applied migrations, but a hand-run must not explode.
    const creates = sql.match(/CREATE TABLE/gi) ?? [];
    const guarded = sql.match(/CREATE TABLE\s+IF NOT EXISTS/gi) ?? [];
    expect(guarded.length).toBe(creates.length);

    const indexes = sql.match(/CREATE (?:UNIQUE )?INDEX/gi) ?? [];
    const guardedIndexes =
      sql.match(/CREATE (?:UNIQUE )?INDEX\s+IF NOT EXISTS/gi) ?? [];
    expect(guardedIndexes.length).toBe(indexes.length);
  });

  /**
   * The rule the house style calls out explicitly: when a migration adds an
   * org-scoped table, it has to be added everywhere that enumerates org
   * tables. This test is what makes forgetting impossible.
   */
  it("ORG_TABLES lists every org-scoped table in the schema", () => {
    const scoped = orgScopedTables(sql);
    const listed = new Set<string>(ORG_TABLES);

    for (const table of scoped) {
      expect(
        listed.has(table),
        `${table} has an org_id but is missing from ORG_TABLES in db.server.ts — export, deletion and the demo reset would all silently skip it`,
      ).toBe(true);
    }
  });

  it("ORG_TABLES does not list a table that doesn't exist", () => {
    const declared = declaredTables(sql);
    for (const table of ORG_TABLES) {
      expect(declared.has(table), table).toBe(true);
    }
  });

  it("never exports password or provider secrets", () => {
    expect(NEVER_EXPORT_COLUMNS.has("password_hash")).toBe(true);
    expect(NEVER_EXPORT_COLUMNS.has("token_hash")).toBe(true);
    // And the column really does exist, so the guard is not a no-op.
    expect(sql).toMatch(/password_hash/);
  });

  it("indexes the hot query paths", () => {
    // Streaks read (user_id, local_day); the reminder cron reads reminder_hour.
    expect(sql).toMatch(/idx_ps_user_day/);
    expect(sql).toMatch(/idx_users_reminder/);
    // Keyset pagination over contacts needs (org_id, name, id).
    expect(sql).toMatch(/idx_contacts_keyset/);
  });

  it("stores the local day a session belongs to", () => {
    // Streaks must never be computed from a UTC timestamp.
    expect(sql).toMatch(/local_day/);
  });
});

describe("onboarding", () => {
  it("has the nine screens the brief describes", () => {
    expect(STEPS).toHaveLength(9);
    expect(STEPS[0]).toBe("welcome");
    expect(STEPS.at(-1)).toBe("first-breath");
  });

  it("puts the safety acknowledgment before account creation", () => {
    expect(STEPS.indexOf("safety")).toBeLessThan(STEPS.indexOf("account"));
  });

  it("shows the core quote before asking for anything", () => {
    expect(STEPS.indexOf("quote")).toBeLessThan(STEPS.indexOf("intention"));
  });

  it("walks from the first step to the last without a gap", () => {
    let step: (typeof STEPS)[number] = STEPS[0]!;
    let hops = 0;
    while (nextStep(step)) {
      step = nextStep(step)!;
      hops++;
      expect(hops).toBeLessThan(20);
    }
    expect(step).toBe("first-breath");
    expect(hops).toBe(STEPS.length - 1);
  });

  it("rejects a step name that isn't real", () => {
    expect(isStep("welcome")).toBe(true);
    expect(isStep("../../etc/passwd")).toBe(false);
    expect(isStep("")).toBe(false);
  });

  it("caps intentions at two and drops anything invented", () => {
    expect(sanitizeIntentions(["calm", "flow"])).toBe("calm,flow");
    expect(sanitizeIntentions(["calm", "flow", "energy"]).split(",")).toHaveLength(
      MAX_INTENTIONS,
    );
    expect(sanitizeIntentions(["calm", "calm"])).toBe("calm");
    expect(sanitizeIntentions(["<script>", "calm"])).toBe("calm");
    expect(sanitizeIntentions([])).toBe("");
  });

  it("offers the five intentions the brief lists", () => {
    expect(INTENTIONS).toHaveLength(5);
    const values = INTENTIONS.map((i) => i.value);
    expect(new Set(values).size).toBe(5);
  });

  it("maps a preferred time to a sensible reminder hour", () => {
    expect(reminderHourFor("morning")).toBe(7);
    expect(reminderHourFor("midday")).toBe(12);
    expect(reminderHourFor("evening")).toBe(20);
    // Flexible means no scheduled nudge at all.
    expect(reminderHourFor("flexible")).toBeNull();
    expect(reminderHourFor("nonsense")).toBeNull();
  });

  it("keeps every reminder hour inside a real clock", () => {
    for (const time of PRACTICE_TIMES) {
      if (time.hour === null) continue;
      expect(time.hour).toBeGreaterThanOrEqual(0);
      expect(time.hour).toBeLessThanOrEqual(23);
    }
  });

  it("invites a beginner to the short practice, not the long one", () => {
    const slugs = new Set(PRACTICES.map((p) => p.slug));
    const beginner = firstInvitationSlug("new");
    const experienced = firstInvitationSlug("experienced");

    expect(slugs.has(beginner)).toBe(true);
    expect(slugs.has(experienced)).toBe(true);

    const beginnerPractice = PRACTICES.find((p) => p.slug === beginner)!;
    expect(beginnerPractice.premium).toBe(false);
    expect(beginnerPractice.seconds).toBeLessThanOrEqual(5 * 60);
  });

  it("only ever invites someone to a free practice", () => {
    for (const level of ["new", "some", "experienced", null]) {
      const slug = firstInvitationSlug(level);
      const practice = PRACTICES.find((p) => p.slug === slug)!;
      expect(practice.premium, slug).toBe(false);
    }
  });
});

describe("rate limits", () => {
  it("are all positive and bounded", () => {
    for (const [name, rule] of Object.entries(RULES)) {
      expect(rule.limit, name).toBeGreaterThan(0);
      expect(rule.windowSeconds, name).toBeGreaterThanOrEqual(60);
    }
  });

  it("are generous enough not to lock out a real person", () => {
    // Eight failed logins in fifteen minutes is a typo-and-a-half, not a
    // brute-force attempt.
    expect(RULES.login.limit).toBeGreaterThanOrEqual(5);
    expect(RULES.passwordReset.limit).toBeGreaterThanOrEqual(3);
  });
});
