/**
 * Advances past doses that have already been taken/skipped,
 * returning the next untaken dose for any frequency type.
 */
import { calculateNextDose, FrequencyType } from "./calculateNextDose";
import { parseDateInSP } from "./dateUtils";

interface AdvanceOptions {
  medicationId: string;
  startDateISO: string | null;
  frequencyHours: number | null;
  endDate: string | null;
  referenceTime: Date;
  frequencyType?: FrequencyType | string | null;
  specificTimes?: string[] | null;
  specificDays?: number[] | null;
  doseStatuses: Record<string, "taken" | "skipped">;
}

/**
 * Iteratively calls calculateNextDose, skipping timestamps
 * that already have a dose record, returning the first untaken dose.
 */
export function advancePastTakenDoses(opts: AdvanceOptions): Date | null {
  const {
    medicationId,
    startDateISO,
    frequencyHours,
    endDate,
    referenceTime,
    frequencyType,
    specificTimes,
    specificDays,
    doseStatuses,
  } = opts;

  // "interval" is the legacy DB value for fixed_interval — normalize it.
  const rawType = (frequencyType as string) || "fixed_interval";
  const effType: FrequencyType =
    rawType === "interval" ? "fixed_interval" : (rawType as FrequencyType);

  // First candidate from the calculation engine
  let candidate = calculateNextDose(
    startDateISO,
    frequencyHours,
    endDate,
    referenceTime,
    frequencyType,
    specificTimes,
    specificDays,
  );

  if (!candidate || isNaN(candidate.getTime())) return null;

  // Advance past taken/skipped doses
  let advanceLimit = 100;
  while (advanceLimit > 0) {
    const key = `${medicationId}-${candidate.toISOString()}`;
    if (!doseStatuses[key]) break; // This dose hasn't been taken/skipped

    // Calculate the NEXT dose after this one
    let nextCandidate: Date | null = null;

    if (effType === "fixed_interval") {
      if (frequencyHours && frequencyHours > 0) {
        nextCandidate = new Date(candidate.getTime() + frequencyHours * 60 * 60 * 1000);
      } else {
        // Continuous 1x/day
        nextCandidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
      }
    } else {
      // For specific_times and specific_days, recalculate using the current candidate
      // as the new reference time (so the engine returns the NEXT slot after it)
      nextCandidate = calculateNextDose(
        startDateISO,
        frequencyHours,
        endDate,
        candidate, // use current dose as reference to get the next one
        frequencyType,
        specificTimes,
        specificDays,
      );

      // Guard against the engine returning the same time (shouldn't happen, but safety)
      if (
        nextCandidate &&
        nextCandidate.getTime() === candidate.getTime()
      ) {
        // Force advance by 1 minute so we skip past this slot
        nextCandidate = calculateNextDose(
          startDateISO,
          frequencyHours,
          endDate,
          new Date(candidate.getTime() + 60_000),
          frequencyType,
          specificTimes,
          specificDays,
        );
      }
    }

    if (!nextCandidate || isNaN(nextCandidate.getTime())) return null;

    // Validate against end date
    if (endDate) {
      const endStr = endDate.length === 10 ? endDate + "T23:59:59" : endDate;
      const endDt = parseDateInSP(endStr);
      if (endDt && nextCandidate > endDt) return null;
    }

    candidate = nextCandidate;
    advanceLimit--;
  }

  return candidate;
}
