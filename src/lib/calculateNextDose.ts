/**
 * Calculates the next future dose for a recurring medication.
 * Supports three frequency types:
 *   - fixed_interval: legacy hourly loop (start_time + frequency_hours)
 *   - specific_times: array of clock times (e.g. ["08:00","14:00","22:00"])
 *   - specific_days: array of weekday numbers (0=Sun..6=Sat) + specific_times
 */
import { parseDateInSP, APP_TIMEZONE } from "./dateUtils";
import { toZonedTime } from "date-fns-tz";

export type FrequencyType = "fixed_interval" | "specific_times" | "specific_days";

export function calculateNextDose(
  startDateStr: string | null | undefined,
  frequencyHours: number | null | undefined,
  endDateStr: string | null | undefined,
  referenceTime?: Date,
  frequencyType?: FrequencyType | string | null,
  specificTimes?: string[] | null,
  specificDays?: number[] | null,
): Date | null {
  const ref = referenceTime ?? new Date();
  const refSP = toZonedTime(ref, APP_TIMEZONE);

  // Determine effective frequency type (retrocompatibility).
  // "interval" is the legacy DB value for fixed_interval — normalize it.
  const rawType = (frequencyType as string) || "fixed_interval";
  const effType: FrequencyType =
    rawType === "interval" ? "fixed_interval" : (rawType as FrequencyType);

  // Helper: parse end date with 23:59:59 ceiling
  const parseEnd = (): Date | null => {
    if (!endDateStr) return null;
    const endStr = endDateStr.length === 10 ? endDateStr + "T23:59:59" : endDateStr;
    return parseDateInSP(endStr);
  };

  // Helper: validate against end date
  const withinEnd = (d: Date): Date | null => {
    const end = parseEnd();
    if (end && d > end) return null;
    return d;
  };

  // ──── FIXED INTERVAL (legacy) ────
  if (effType === "fixed_interval") {
    if (!startDateStr || !frequencyHours || frequencyHours <= 0) return null;

    const start = parseDateInSP(startDateStr);
    if (!start) return null;

    if (start > ref) return withinEnd(start);

    const next = new Date(start.getTime());
    let maxIterations = 10000;
    while (next <= ref && maxIterations > 0) {
      next.setTime(next.getTime() + frequencyHours * 60 * 60 * 1000);
      maxIterations--;
    }

    if (isNaN(next.getTime())) return null;
    return withinEnd(next);
  }

  // ──── SPECIFIC TIMES (e.g. ["08:00", "14:00", "22:00"]) ────
  if (effType === "specific_times") {
    const times = specificTimes && specificTimes.length > 0 ? specificTimes : null;
    if (!times) return null;

    // Sort times chronologically
    const sorted = [...times].sort();

    // Check start date: if treatment hasn't started yet, return first time on start day
    if (startDateStr) {
      const start = parseDateInSP(startDateStr);
      if (start && start > ref) {
        const startSP = toZonedTime(start, APP_TIMEZONE);
        const startDayStr = `${startSP.getFullYear()}-${String(startSP.getMonth() + 1).padStart(2, "0")}-${String(startSP.getDate()).padStart(2, "0")}`;

        // If start_date is TODAY (relative to referenceTime), skip times that have already passed.
        // Avoids showing "Atrasado" for a medication just being registered mid-day.
        // Uses refSP (not new Date()) so the function stays fully deterministic in tests.
        const refDayStr = `${refSP.getFullYear()}-${String(refSP.getMonth() + 1).padStart(2, "0")}-${String(refSP.getDate()).padStart(2, "0")}`;
        if (startDayStr === refDayStr) {
          const refTimeStr = `${String(refSP.getHours()).padStart(2, "0")}:${String(refSP.getMinutes()).padStart(2, "0")}`;
          for (const t of sorted) {
            if (t >= refTimeStr) {
              const candidate = parseDateInSP(`${startDayStr}T${t}`);
              if (candidate) return withinEnd(candidate);
            }
          }
          // All today's times have passed → first time tomorrow
          const tomorrow = new Date(startSP);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
          const candidate = parseDateInSP(`${tomorrowStr}T${sorted[0]}`);
          return candidate ? withinEnd(candidate) : null;
        }

        // Start date is in the future (tomorrow or later) → first time on that day
        const candidate = parseDateInSP(`${startDayStr}T${sorted[0]}`);
        return candidate ? withinEnd(candidate) : null;
      }
    }

    // Current SP date parts
    const todayStr = `${refSP.getFullYear()}-${String(refSP.getMonth() + 1).padStart(2, "0")}-${String(refSP.getDate()).padStart(2, "0")}`;
    const nowTimeStr = `${String(refSP.getHours()).padStart(2, "0")}:${String(refSP.getMinutes()).padStart(2, "0")}`;

    // Find the next time TODAY that hasn't passed yet
    for (const t of sorted) {
      if (t > nowTimeStr) {
        const candidate = parseDateInSP(`${todayStr}T${t}`);
        if (candidate) {
          const result = withinEnd(candidate);
          if (result) return result;
        }
      }
    }

    // All times passed today → first time TOMORROW
    const tomorrow = new Date(refSP);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    const candidate = parseDateInSP(`${tomorrowStr}T${sorted[0]}`);
    return candidate ? withinEnd(candidate) : null;
  }

  // ──── SPECIFIC DAYS (e.g. [1, 3, 5] for Mon/Wed/Fri) + specific_times ────
  if (effType === "specific_days") {
    const days = specificDays && specificDays.length > 0 ? specificDays : null;
    const times = specificTimes && specificTimes.length > 0 ? [...specificTimes].sort() : ["08:00"];
    if (!days) return null;

    const sortedDays = [...days].sort((a, b) => a - b);

    // Check start date
    if (startDateStr) {
      const start = parseDateInSP(startDateStr);
      if (start && start > ref) {
        const startSP = toZonedTime(start, APP_TIMEZONE);
        const startDayStr = `${startSP.getFullYear()}-${String(startSP.getMonth() + 1).padStart(2, "0")}-${String(startSP.getDate()).padStart(2, "0")}`;

        // If start_date is TODAY (relative to referenceTime) and today is an allowed weekday, skip past times.
        // Uses refSP (not new Date()) so the function stays fully deterministic in tests.
        const refDayStr2 = `${refSP.getFullYear()}-${String(refSP.getMonth() + 1).padStart(2, "0")}-${String(refSP.getDate()).padStart(2, "0")}`;
        if (startDayStr === refDayStr2 && sortedDays.includes(refSP.getDay())) {
          const refTimeStr2 = `${String(refSP.getHours()).padStart(2, "0")}:${String(refSP.getMinutes()).padStart(2, "0")}`;
          for (const t of times) {
            if (t >= refTimeStr2) {
              const candidate = parseDateInSP(`${startDayStr}T${t}`);
              if (candidate) return withinEnd(candidate);
            }
          }
          // All today's times passed → fall through to find next allowed day
        } else if (startDayStr !== refDayStr2) {
          // Start date is in the future → first time on that day
          const candidate = parseDateInSP(`${startDayStr}T${times[0]}`);
          return candidate ? withinEnd(candidate) : null;
        }
        // If start is today but NOT an allowed weekday, fall through to find next allowed day below
      }
    }

    const currentDayOfWeek = refSP.getDay(); // 0=Sun
    const nowTimeStr = `${String(refSP.getHours()).padStart(2, "0")}:${String(refSP.getMinutes()).padStart(2, "0")}`;

    // Check if TODAY is one of the allowed days and there's a future time
    if (sortedDays.includes(currentDayOfWeek)) {
      for (const t of times) {
        if (t > nowTimeStr) {
          const todayStr = `${refSP.getFullYear()}-${String(refSP.getMonth() + 1).padStart(2, "0")}-${String(refSP.getDate()).padStart(2, "0")}`;
          const candidate = parseDateInSP(`${todayStr}T${t}`);
          if (candidate) {
            const result = withinEnd(candidate);
            if (result) return result;
          }
        }
      }
    }

    // Find the next allowed day
    for (let offset = 1; offset <= 7; offset++) {
      const futureDate = new Date(refSP);
      futureDate.setDate(futureDate.getDate() + offset);
      const futureDow = futureDate.getDay();
      if (sortedDays.includes(futureDow)) {
        const dateStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}-${String(futureDate.getDate()).padStart(2, "0")}`;
        const candidate = parseDateInSP(`${dateStr}T${times[0]}`);
        return candidate ? withinEnd(candidate) : null;
      }
    }

    return null;
  }

  return null;
}
