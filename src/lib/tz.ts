/**
 * tz.ts — Centralized timezone utilities for Locus Vita
 *
 * SSOT for all date formatting in the app.
 * Always converts from UTC (how Supabase stores timestamptz) to America/Sao_Paulo (UTC-3).
 *
 * Project rule (CLAUDE.md §4.3):
 *   - Parse: parseISO + isValid (never new Date(string))
 *   - Format: format from date-fns-tz with TZ_SAO_PAULO
 *   - Never render "Invalid Date" — always return null and handle upstream
 *
 * Usage:
 *   import { formatDate, formatDateTime, formatTime, parseDate } from "@/lib/tz";
 *
 *   formatDate("2026-06-16T19:08:34.071+00")   // "16/06/2026"
 *   formatDateTime("2026-06-16T19:08:34.071+00") // "16/06/2026 às 16:08"
 *   formatTime("2026-06-16T19:08:34.071+00")    // "16:08"
 */

import { parseISO, isValid } from "date-fns";
import { format, toZonedTime } from "date-fns-tz";

export const TZ_SAO_PAULO = "America/Sao_Paulo";

/**
 * Safely parse a raw DB value (ISO string or Date) into a Date object.
 * Returns null for any invalid input so callers can handle gracefully.
 */
export function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : parseISO(value);
  return isValid(d) ? d : null;
}

/**
 * Convert a UTC date/string to the São Paulo timezone.
 * Returns null for invalid input.
 */
export function toSaoPaulo(value: string | Date | null | undefined): Date | null {
  const d = parseDate(value);
  if (!d) return null;
  return toZonedTime(d, TZ_SAO_PAULO);
}

/**
 * Format as date only: "16/06/2026"
 */
export function formatDate(value: string | Date | null | undefined): string | null {
  const d = toSaoPaulo(value);
  if (!d) return null;
  return format(d, "dd/MM/yyyy", { timeZone: TZ_SAO_PAULO });
}

/**
 * Format as date + time: "16/06/2026 às 16:08"
 */
export function formatDateTime(value: string | Date | null | undefined): string | null {
  const d = toSaoPaulo(value);
  if (!d) return null;
  return format(d, "dd/MM/yyyy 'às' HH:mm", { timeZone: TZ_SAO_PAULO });
}

/**
 * Format as time only: "16:08"
 */
export function formatTime(value: string | Date | null | undefined): string | null {
  const d = toSaoPaulo(value);
  if (!d) return null;
  return format(d, "HH:mm", { timeZone: TZ_SAO_PAULO });
}

/**
 * Format as date + seconds: "16/06/2026 às 16:08:34"
 * Useful for audit logs and export PDFs.
 */
export function formatDateTimeSeconds(value: string | Date | null | undefined): string | null {
  const d = toSaoPaulo(value);
  if (!d) return null;
  return format(d, "dd/MM/yyyy 'às' HH:mm:ss", { timeZone: TZ_SAO_PAULO });
}

/**
 * Format as ISO string in São Paulo timezone offset (for display in forms).
 * Example: "2026-06-16T16:08:34-03:00"
 */
export function formatISOSaoPaulo(value: string | Date | null | undefined): string | null {
  const d = toSaoPaulo(value);
  if (!d) return null;
  return format(d, "yyyy-MM-dd'T'HH:mm:ssxxx", { timeZone: TZ_SAO_PAULO });
}

/**
 * Return today's date string in São Paulo timezone: "2026-06-16"
 */
export function todaySaoPaulo(): string {
  return format(toZonedTime(new Date(), TZ_SAO_PAULO), "yyyy-MM-dd", {
    timeZone: TZ_SAO_PAULO,
  });
}

/**
 * Return current datetime in São Paulo timezone as a Date object.
 */
export function nowSaoPaulo(): Date {
  return toZonedTime(new Date(), TZ_SAO_PAULO);
}
