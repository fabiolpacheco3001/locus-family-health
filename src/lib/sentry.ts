/**
 * Sentry APM — M1
 *
 * Setup (one-time, after getting a Sentry account):
 *   1. Run:  npm install   (installs @sentry/react added to package.json)
 *   2. Create a project at https://sentry.io and copy the DSN
 *   3. Add to .env:  VITE_SENTRY_DSN=https://xxxx@oxxxx.ingest.sentry.io/xxxx
 *
 * Behaviour:
 *   - VITE_SENTRY_DSN not set → all calls are no-ops (safe for local dev)
 *   - VITE_SENTRY_DSN set     → errors captured and sent to Sentry dashboard
 */

import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

/**
 * Call once before ReactDOM.render (in main.tsx).
 * No-op when VITE_SENTRY_DSN is not set.
 */
export function initSentry(): void {
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE ?? "production",
    // Capture 10% of transactions for performance monitoring (adjust as needed)
    tracesSampleRate: 0.1,
    // Replay: capture all sessions that had an error
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    integrations: [Sentry.browserTracingIntegration()],
    // Do not send errors from development builds (comment out to force-send)
    enabled: import.meta.env.PROD,
  });
}

/**
 * Send an exception to Sentry.
 * No-op when VITE_SENTRY_DSN is not set or in development.
 */
export function captureException(
  error: unknown,
  extra?: Record<string, unknown>
): void {
  if (!dsn || !import.meta.env.PROD) return;
  Sentry.captureException(error, { extra });
}
