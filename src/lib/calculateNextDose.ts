/**
 * Calculates the next future dose for a recurring medication.
 * Blindada contra datas futuras, passadas e erros de timezone.
 */
export function calculateNextDose(
  startDateStr: string | null | undefined,
  frequencyHours: number | null | undefined,
  endDateStr: string | null | undefined,
): Date | null {
  if (!startDateStr || !frequencyHours || frequencyHours <= 0) return null;

  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return null;

  const now = new Date();

  // 1. Se o tratamento ainda nem começou, a próxima dose É a data de início.
  if (start > now) return start;

  // 2. Calcula a próxima dose usando matemática de intervalos (sem loop).
  const elapsedMs = now.getTime() - start.getTime();
  const intervalMs = frequencyHours * 60 * 60 * 1000;
  const intervals = Math.ceil(elapsedMs / intervalMs);
  const next = new Date(start.getTime() + intervals * intervalMs);

  if (isNaN(next.getTime())) return null;

  // 3. Validação da Data de Término (força 23:59:59 para não cortar doses noturnas)
  if (endDateStr) {
    const endStr = endDateStr.length === 10 ? endDateStr + "T23:59:59" : endDateStr;
    const end = new Date(endStr);
    if (!isNaN(end.getTime()) && next > end) return null;
  }

  return next;
}
