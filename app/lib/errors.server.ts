import { newId } from "./ids";

/**
 * Server-error telemetry.
 *
 * Workers logs are not reachable from every environment this app is operated
 * from, and "it 500s in production but not locally" is exactly the situation
 * where you need the actual message rather than a hypothesis. So failures on
 * important paths are recorded into `analytics_events`, which can be read with
 * a plain SQL query against D1.
 *
 * Deliberately never throws: a logger that can take down the request it is
 * describing is worse than no logger.
 */
export async function recordError(
  env: Env,
  where: string,
  error: unknown,
  meta: Record<string, string | number | boolean | null> = {},
): Promise<void> {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);

  // D1 surfaces the useful detail on `cause` for constraint failures.
  const cause =
    error instanceof Error && error.cause
      ? String(
          (error.cause as { message?: string }).message ?? error.cause,
        ).slice(0, 300)
      : "";

  console.error(`[${where}]`, message, cause);

  try {
    await env.DB.prepare(
      `INSERT INTO analytics_events (id, org_id, user_id, name, props, created_at)
       VALUES (?, NULL, NULL, 'server_error', ?, ?)`,
    )
      .bind(
        newId("event"),
        JSON.stringify({
          where,
          message: message.slice(0, 500),
          cause,
          stack:
            error instanceof Error && error.stack
              ? error.stack.split("\n").slice(0, 4).join(" | ").slice(0, 500)
              : "",
          ...meta,
        }),
        Date.now(),
      )
      .run();
  } catch (loggingFailure) {
    console.error("could not record the error", loggingFailure);
  }
}
