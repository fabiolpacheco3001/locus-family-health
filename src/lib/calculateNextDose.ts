import { parseISO, addHours, isBefore, isAfter } from "date-fns";

/**
 * Calculates the next future dose for a recurring medication.
 *
 * @param startDate  - ISO string of the first dose (e.g. "2026-03-20T08:00:00")
 * @param frequencyHours - interval between doses in hours
 * @param endDate - ISO date string of the treatment end (nullable)
 * @returns Date of the next dose, or null if treatment is over / invalid input
 */
export function calculateNextDose(
  startDate: string | null,
  frequencyHours: number | null,
  endDate: string | null,
): Date | null {
  if (!startDate || !frequencyHours || frequencyHours <= 0) return null;

  const start = parseISO(startDate);
  const now = new Date();

  // If start is still in the future, next dose IS the start
  if (isAfter(start, now)) {
    return start;
  }

  // Calculate how many intervals have elapsed since start
  const elapsedMs = now.getTime() - start.getTime();
  const intervalMs = frequencyHours * 60 * 60 * 1000;
  const elapsed = Math.floor(elapsedMs / intervalMs);

  // Next dose = start + (elapsed + 1) intervals
  let nextDose = addHours(start, (elapsed + 1) * frequencyHours);

  // Edge case: if rounding lands exactly on now, it's still valid
  if (isBefore(nextDose, now)) {
    nextDose = addHours(nextDose, frequencyHours);
  }

  // Check if treatment has ended
  if (endDate) {
    const end = parseISO(endDate.length === 10 ? endDate + "T23:59:59" : endDate);
    if (isAfter(nextDose, end)) {
      return null; // Treatment is over
    }
  }

  return nextDose;
}
