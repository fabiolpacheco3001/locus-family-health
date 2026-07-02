/**
 * surgery.test.ts — [ID-016]
 * Cobre surgerySchema (aba Agendamento de AddSurgeryDrawer) — obrigatoriedade
 * de surgery_type e de custom_type quando surgery_type === "outro".
 */
import { describe, it, expect } from "vitest";
import { surgerySchema, surgeryDefaultValues } from "./surgery";

describe("surgerySchema", () => {
  it("aceita tipo canônico sem custom_type", () => {
    const result = surgerySchema.safeParse({ ...surgeryDefaultValues, surgery_type: "apendicectomia" });
    expect(result.success).toBe(true);
  });

  it("rejeita surgery_type vazio", () => {
    const result = surgerySchema.safeParse({ ...surgeryDefaultValues, surgery_type: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita 'outro' sem custom_type", () => {
    const result = surgerySchema.safeParse({ ...surgeryDefaultValues, surgery_type: "outro", custom_type: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita 'outro' com custom_type menor que 3 caracteres", () => {
    const result = surgerySchema.safeParse({ ...surgeryDefaultValues, surgery_type: "outro", custom_type: "ab" });
    expect(result.success).toBe(false);
  });

  it("aceita 'outro' com custom_type válido", () => {
    const result = surgerySchema.safeParse({
      ...surgeryDefaultValues,
      surgery_type: "outro",
      custom_type: "Septoplastia endoscópica",
    });
    expect(result.success).toBe(true);
  });

  it("aceita scheduled_date nula", () => {
    const result = surgerySchema.safeParse({ ...surgeryDefaultValues, surgery_type: "apendicectomia", scheduled_date: null });
    expect(result.success).toBe(true);
  });
});
