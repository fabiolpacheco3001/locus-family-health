/**
 * RX-27 — Constantes compartilhadas do app.
 *
 * Centraliza magic strings / numbers que aparecem em múltiplos arquivos.
 * Importar via `import { TRIAL_DAYS, AGENDA_STATUS } from "@/lib/constants";`
 *
 * NOTA sobre Tailwind: classes como `bottom-[72px]` continuam hardcoded
 * porque o Tailwind JIT precisa ler o literal em tempo de build. Para
 * uso em lógica JS (cálculos, comparações), prefira a constante.
 */

// ── Layout ─────────────────────────────────────────────────────────────────
export const BOTTOM_NAV_HEIGHT_PX = 72;

// ── Agenda / Consultas / Exames / Vacinas ──────────────────────────────────
export const AGENDA_STATUS = {
  AGENDADA: "Agendada",
  REALIZADA: "Realizada",
  CANCELADA: "Cancelada",
  PRONTO: "Pronto",
  PENDENTE: "Pendente",
} as const;
export type AgendaStatus = (typeof AGENDA_STATUS)[keyof typeof AGENDA_STATUS];

// ── Medicamentos ───────────────────────────────────────────────────────────
export const DOSE_WINDOW_DAYS = 7;
export const MEDICATION_FREQUENCY_TYPES = {
  INTERVAL: "interval",
  FIXED_INTERVAL: "fixed_interval",
  SPECIFIC_TIMES: "specific_times",
  SPECIFIC_DAYS: "specific_days",
} as const;
export type MedicationFrequencyType =
  (typeof MEDICATION_FREQUENCY_TYPES)[keyof typeof MEDICATION_FREQUENCY_TYPES];

// ── SaaS / Assinatura ──────────────────────────────────────────────────────
export const TRIAL_DAYS = 30;
export const GRACE_PERIOD_DAYS = 7;

// ── Paginação ──────────────────────────────────────────────────────────────
export const PAGE_SIZE = 20;
export const AGENDA_FUTURE_CAP = 50;
export const AGENDA_PAST_CAP = 30;
