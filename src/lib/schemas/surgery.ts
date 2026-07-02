import { z } from "zod";

/**
 * [ID-016] Schema Zod centralizado para AddSurgeryDrawer (react-hook-form + zodResolver).
 * Cobre apenas a aba "Agendamento" (tipo, profissional, data, local, observações) —
 * as abas Pré-Op/Pós-Op usam SurgeryInstructionImporter, um componente à parte
 * que gerencia sua própria lista de itens (fora do escopo de validação de formulário).
 *
 * custom_type obrigatório quando surgery_type === "outro" espelha a validação
 * client-side já existente e o mesmo motivo de negócio (cirurgia "outro" exige descrição).
 */
export const surgerySchema = z
  .object({
    surgery_type: z.string().trim().min(1, "Selecione o tipo de cirurgia."),
    custom_type: z.string().trim().optional().or(z.literal("")),
    scheduled_date: z.date().nullable().optional(),
    surgeon_name: z.string().trim().max(200, "Nome muito longo.").optional().or(z.literal("")),
    hospital_clinic: z.string().trim().max(300, "Local muito longo.").optional().or(z.literal("")),
    notes: z.string().trim().max(2000, "Texto muito longo.").optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.surgery_type === "outro" && (data.custom_type ?? "").trim().length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Descreva o tipo de cirurgia (mínimo 3 caracteres).",
        path: ["custom_type"],
      });
    }
  });

export type SurgeryFormInput = z.infer<typeof surgerySchema>;

export const surgeryDefaultValues: SurgeryFormInput = {
  surgery_type: "",
  custom_type: "",
  scheduled_date: null,
  surgeon_name: "",
  hospital_clinic: "",
  notes: "",
};
