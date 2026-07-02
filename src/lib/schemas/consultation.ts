import { z } from "zod";

/**
 * [ID-016] Schema Zod centralizado para AddConsultationDrawer (react-hook-form + zodResolver).
 * PHI: sintomas e dúvidas são dados de saúde sensíveis (LGPD art. 11).
 * Sistólica/diastólica seguem a mesma faixa (1-300 mmHg) já validada nos
 * inputs nativos do drawer — aqui apenas centralizamos e tornamos testável.
 */
export const CONSULTATION_TYPES = ["Rotina", "Emergência", "Retorno"] as const;

const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).optional().or(z.literal(""));

const optionalVital = (label: string) =>
  z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || (!isNaN(Number(v)) && Number(v) >= 1 && Number(v) <= 300),
      `${label} deve estar entre 1 e 300 mmHg.`
    );

export const consultationSchema = z.object({
  specialty: z.string().trim().min(1, "Preencha a especialidade."),
  professional_name: optionalText(200, "Nome muito longo."),
  consultation_date: z.string().optional().or(z.literal("")),
  type: z.enum(CONSULTATION_TYPES),
  symptoms: optionalText(2000, "Texto muito longo."),
  questions: optionalText(2000, "Texto muito longo."),
  location: optionalText(300, "Local muito longo."),
  systolic: optionalVital("Sistólica"),
  diastolic: optionalVital("Diastólica"),
});

export type ConsultationFormInput = z.infer<typeof consultationSchema>;

export const consultationDefaultValues: ConsultationFormInput = {
  specialty: "",
  professional_name: "",
  consultation_date: "",
  type: "Rotina",
  symptoms: "",
  questions: "",
  location: "",
  systolic: "",
  diastolic: "",
};
