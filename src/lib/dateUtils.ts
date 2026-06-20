/**
 * Centralized date/timezone utilities for Locus Vita.
 * All dates are handled in America/Sao_Paulo (UTC-3).
 * Replaces all "T12:00:00" workarounds.
 */
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { differenceInYears, isValid, parseISO } from "date-fns";

export const APP_TIMEZONE = "America/Sao_Paulo";

/**
 * Returns the current date/time in São Paulo timezone.
 */
export function nowInSP(): Date {
  return toZonedTime(new Date(), APP_TIMEZONE);
}

/**
 * Safely parses a date string (YYYY-MM-DD or ISO) into a Date object
 * interpreted in America/Sao_Paulo timezone.
 * Replaces all `new Date(str + "T12:00:00")` workarounds.
 */
export function parseDateInSP(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;

  try {
    // If it's a date-only string (YYYY-MM-DD), treat it as midnight in SP
    if (dateStr.length === 10) {
      const d = fromZonedTime(`${dateStr}T00:00:00`, APP_TIMEZONE);
      return isNaN(d.getTime()) ? null : d;
    }

    // If it already has time info, parse it. If it looks like a plain datetime
    // without timezone (e.g. "2026-04-03T14:00"), treat as SP time.
    if (dateStr.includes("T") && !dateStr.endsWith("Z") && !dateStr.includes("+")) {
      const d = fromZonedTime(dateStr, APP_TIMEZONE);
      return isNaN(d.getTime()) ? null : d;
    }

    // Otherwise (ISO with Z or offset), just parse normally
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * Converts a Date to the zoned representation in São Paulo.
 * Use this before formatting with date-fns `format()`.
 */
export function toSPTime(date: Date): Date {
  return toZonedTime(date, APP_TIMEZONE);
}

/**
 * Creates a UTC Date from a local SP date/time string.
 * Use when saving to Supabase (which stores UTC).
 * E.g. fromSPToUTC("2026-04-03", "14:00") => UTC Date for 17:00 UTC
 */
export function fromSPToUTC(dateStr: string, timeStr?: string | null): Date {
  const combined = timeStr ? `${dateStr}T${timeStr}` : `${dateStr}T00:00:00`;
  return fromZonedTime(combined, APP_TIMEZONE);
}

/**
 * Calcula idade em anos a partir de uma data ISO (string ou Date).
 * Retorna null se a data for inválida.
 */
export function calculateAge(
  birthDate: string | Date | null | undefined
): number | null {
  if (!birthDate) return null;
  const date = typeof birthDate === "string" ? parseISO(birthDate) : birthDate;
  if (!isValid(date)) return null;
  return differenceInYears(new Date(), date);
}
