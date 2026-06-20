export type LogLevel = "info" | "warn" | "error"

/**
 * Emits a structured JSON log line to stdout/stderr.
 * Each line is a valid JSON object with { level, event, ts, ...data }.
 * Use this instead of bare console.log/warn/error in all Edge Functions.
 *
 * Example:
 *   log("error", "auth_failed", { userId, error: e.message })
 *   // → stderr: {"level":"error","event":"auth_failed","ts":"...","userId":"...","error":"..."}
 */
export function log(
  level: LogLevel,
  event: string,
  data?: Record<string, unknown>
): void {
  const entry = JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...data,
  })
  if (level === "error") console.error(entry)
  else if (level === "warn") console.warn(entry)
  else console.log(entry)
}

/**
 * Returns a `log` function with `baseFields` (e.g. requestId) auto-merged
 * into every entry. Use inside `serve(...)` to bind a requestId once.
 *
 * Example:
 *   const log = createLogger({ requestId });
 *   log("info", "started"); // includes requestId automatically
 */
export function createLogger(baseFields: Record<string, unknown>) {
  return (level: LogLevel, event: string, data?: Record<string, unknown>) =>
    log(level, event, { ...baseFields, ...data });
}
