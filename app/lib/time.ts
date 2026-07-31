/**
 * Day boundaries, in the user's own timezone.
 *
 * Streaks are a promise we make to someone about their life, so they have to
 * be computed against *their* midnight — not UTC's, and not the edge PoP's.
 * Every function here is pure and tested in time.test.ts.
 */

/** Milliseconds → 'YYYY-MM-DD' in the given IANA timezone. */
export function localDay(at: number | Date, timeZone: string): string {
  const date = typeof at === "number" ? new Date(at) : at;
  try {
    // 'en-CA' formats as YYYY-MM-DD, which is exactly what we want to store.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    // An unknown timezone must never cost someone their streak.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }
}

/** The local hour (0–23) in the given timezone. Used by the reminder cron. */
export function localHour(at: number | Date, timeZone: string): number {
  const date = typeof at === "number" ? new Date(at) : at;
  try {
    const hour = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      hour12: false,
    }).format(date);
    // 'en-GB' renders midnight as "24" in some ICU versions.
    return Number(hour) % 24;
  } catch {
    return date.getUTCHours();
  }
}

/** Days between two 'YYYY-MM-DD' strings. Calendar days, not 24-hour spans. */
export function daysBetween(fromDay: string, toDay: string): number {
  const from = Date.parse(`${fromDay}T00:00:00Z`);
  const to = Date.parse(`${toDay}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return Number.NaN;
  return Math.round((to - from) / 86_400_000);
}

/** Shift a 'YYYY-MM-DD' by a whole number of days. */
export function addDays(day: string, delta: number): string {
  const base = Date.parse(`${day}T00:00:00Z`);
  return new Date(base + delta * 86_400_000).toISOString().slice(0, 10);
}

/** The seven local days ending today, oldest first. Powers the weekly ring. */
export function lastSevenDays(today: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
}

/** Inclusive list of days spanning a range. Powers the monthly heatmap. */
export function dayRange(fromDay: string, toDay: string): string[] {
  const span = daysBetween(fromDay, toDay);
  if (!Number.isFinite(span) || span < 0) return [];
  return Array.from({ length: span + 1 }, (_, i) => addDays(fromDay, i));
}

/**
 * Time-aware greeting. Deliberately warm and never presumptuous about how
 * someone's day is going.
 */
export function greetingFor(hour: number): string {
  if (hour < 5) return "Still awake";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Late night";
}

/** "16 min" / "1 hr 5 min" — never "16:00", which reads like a deadline. */
export function humanDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.round(total / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

/** Clock format for the player's elapsed/remaining readout. */
export function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** A small, safe allowlist check so we never hand Intl a hostile string. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
