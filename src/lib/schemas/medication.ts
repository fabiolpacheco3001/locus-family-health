import { z } from "zod";

/**
 * [ID-016] Schema Zod centralizado para posologia (AddMedicationDrawer).
 *
 * Usado via `medicationSchema.safeParse()` no handleSave — NÃO via
 * zodResolver/react-hook-form. AddMedicationDrawer.tsx tem 33 useState e a
 * lógica de cálculo de próxima dose (calculateNextDose.ts, 4 frequency_types
 * + BK-02 ciclos) foi alterada na sessão anterior; reescrever o gerenciamento
 * de estado para RHF sem cobertura de QA visual é risco desnecessário para um
 * arquivo que decide dose de medicamento. A validação centralizada (o
 * objetivo real do ID-016) é obtida da mesma forma via safeParse.
 *
 * O shape espelha exatamente o retorno de `buildMedPayload()` em
 * AddMedicationDrawer.tsx — não o de `buildMedPayloadFromExtracted()`, que
 * tem um subconjunto de campos (fluxo de revisão em lote da OCR, fora de
 * escopo desta correção; ver ANÁLISE da sessão).
 */
export const FREQUENCY_TYPES = ["fixed_interval", "specific_times", "specific_days", "cyclic"] as const;

export const medicationSchema = z
  .object({
    name: z.string().trim().min(1, "Preencha o nome do medicamento.").max(200, "Nome muito longo."),
    dosage: z.string().trim().max(50, "Dosagem muito longa.").nullable(),
    frequency: z.string().nullable(),
    frequency_type: z.enum(FREQUENCY_TYPES, {
      errorMap: () => ({ message: "Selecione a frequência." }),
    }),
    frequency_hours: z.number().positive("Intervalo inválido.").nullable(),
    specific_times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.")),
    specific_days: z.array(z.number().int().min(0).max(6)),
    // BK-02: Ciclos Posológicos — espelha a CHECK constraint chk_cyclic_fields_complete
    // (migration 20260702000000): os 3 campos são obrigatórios juntos quando frequency_type='cyclic'.
    cycle_active_days: z.number().int().positive("Dias ativos deve ser maior que zero.").nullable(),
    cycle_pause_days: z.number().int().positive("Dias de pausa deve ser maior que zero.").nullable(),
    cycle_start_date: z.string().nullable(),
    duration_days: z.number().int().positive("Duração inválida.").nullable(),
    duration: z.string().nullable(),
    start_date: z.string().nullable(),
    start_time: z.string().nullable(),
    end_date: z.string().nullable(),
    consultation_id: z.string().nullable(),
    uso_continuo: z.boolean(),
    medico_prescritor: z.string().trim().max(200, "Nome muito longo.").nullable(),
    estoque_total: z.number().nonnegative("Estoque não pode ser negativo.").nullable(),
    estoque_minimo: z.number().nonnegative("Estoque mínimo não pode ser negativo.").nullable(),
    reason: z.string().trim().max(500, "Motivo muito longo.").nullable(),
  })
  .superRefine((data, ctx) => {
    // Cada frequency_type exige um subconjunto de campos distinto — validar
    // aqui é o que impede o app de calcular (ou pior, deixar de calcular)
    // a próxima dose por falta de dado obrigatório (ver calculateNextDose.ts).
    switch (data.frequency_type) {
      case "fixed_interval":
        if (!data.frequency_hours || data.frequency_hours <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Selecione o intervalo entre doses.",
            path: ["frequency_hours"],
          });
        }
        break;
      case "specific_times":
        if (data.specific_times.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Adicione ao menos um horário.",
            path: ["specific_times"],
          });
        }
        break;
      case "specific_days":
        if (data.specific_days.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Selecione ao menos um dia da semana.",
            path: ["specific_days"],
          });
        }
        break;
      case "cyclic":
        if (!data.cycle_active_days || data.cycle_active_days <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Informe os dias ativos do ciclo.",
            path: ["cycle_active_days"],
          });
        }
        if (!data.cycle_pause_days || data.cycle_pause_days <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Informe os dias de pausa do ciclo.",
            path: ["cycle_pause_days"],
          });
        }
        if (!data.cycle_start_date) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Data de início do tratamento é obrigatória para posologia cíclica.",
            path: ["cycle_start_date"],
          });
        }
        break;
    }
  });

export type MedicationFormInput = z.infer<typeof medicationSchema>;

/** Retorna a primeira mensagem de erro do safeParse, pronta para exibir em toast.error(). */
export function firstMedicationError(result: z.SafeParseReturnType<unknown, MedicationFormInput>): string | null {
  if (result.success) return null;
  return result.error.issues[0]?.message ?? "Dados do medicamento inválidos.";
}
