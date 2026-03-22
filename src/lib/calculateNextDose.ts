import { parseISO, addHours, isBefore, isAfter } from "date-fns";

/**
 * Calculates the next future dose for a recurring medication.
 */
export function calculateNextDose(
  startDate: string | null | undefined,
  frequencyHours: number | null | undefined,
  endDate: string | null | undefined,
): Date | null {
  if (!startDate || !frequencyHours || frequencyHours <= 0) return null;

  const start = parseISO(startDate);
  if (isNaN(start.getTime())) return null;

  const now = new Date();

  if (isAfter(start, now)) return start;

  const elapsedMs = now.getTime() - start.getTime();
  const intervalMs = frequencyHours * 60 * 60 * 1000;
  const elapsed = Math.floor(elapsedMs / intervalMs);

  let nextDose = addHours(start, (elapsed + 1) * frequencyHours);

  if (isBefore(nextDose, now)) {
    nextDose = addHours(nextDose, frequencyHours);
  }

  if (isNaN(nextDose.getTime())) return null;

  if (endDate) {
    const end = parseISO(endDate.length === 10 ? endDate + "T23:59:59" : endDate);
    if (!isNaN(end.getTime()) && isAfter(nextDose, end)) return null;
  }

  return nextDose;
}
