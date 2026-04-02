/**
 * Calculates the next future dose for a recurring medication.
 * Uses America/Sao_Paulo timezone explicitly.
 */
import { nowInSP, parseDateInSP, APP_TIMEZONE } from "./dateUtils";
import { toZonedTime } from "date-fns-tz";

export function calculateNextDose(
  startDateStr: string | null | undefined,
  frequencyHours: number | null | undefined,
  endDateStr: string | null | undefined,
): Date | null {
  if (!startDateStr || !frequencyHours || frequencyHours <= 0) return null;

  const start = parseDateInSP(startDateStr);
  if (!start) return null;

  const now = new Date();

  // 1. Se o tratamento ainda nem começou, a próxima dose É a data de início.
  if (start > now) return start;

  // 2. Calcula a próxima dose iterando com a frequência (while loop blindado).
  const next = new Date(start.getTime());
  let maxIterations = 10000;
  while (next <= now && maxIterations > 0) {
    next.setTime(next.getTime() + frequencyHours * 60 * 60 * 1000);
    maxIterations--;
  }

  if (isNaN(next.getTime())) return null;

  // 3. Validação da Data de Término (força 23:59:59 SP para não cortar doses noturnas)
  if (endDateStr) {
    const endStr = endDateStr.length === 10 ? endDateStr + "T23:59:59" : endDateStr;
    const end = parseDateInSP(endStr);
    if (end && next > end) return null;
  }

  return next;
}
