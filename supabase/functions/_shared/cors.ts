/**
 * _shared/cors.ts — Locus Vita
 *
 * CORS robusto: normaliza APP_ORIGIN (trim de espaços/slash) antes de comparar.
 * Se APP_ORIGIN não estiver setado, usa wildcard "*".
 */

const rawOrigin = Deno.env.get("APP_ORIGIN");
const APP_ORIGIN = rawOrigin?.trim().replace(/\/+$/, ""); // remove trailing slash e espaços

if (!APP_ORIGIN) {
  console.warn("[cors] APP_ORIGIN not set — using wildcard '*'. Set APP_ORIGIN in production.");
}

const ALLOWED_ORIGIN = APP_ORIGIN ?? "*";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
  ...(ALLOWED_ORIGIN !== "*" ? { "Vary": "Origin" } : {}),
};
