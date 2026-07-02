/**
 * consultation.test.ts — [ID-016]
 * Cobre consultationSchema (AddConsultationDrawer) — campo obrigatório
 * (specialty) e faixa fisiológica de sistólica/diastólica (1-300 mmHg).
 */
import { describe, it, expect } from "vitest";
import { consultationSchema, consultationDefaultValues } from "./consultation";

describe("consultationSchema", () => {
  it("aceita apenas com especialidade preenchida (demais opcionais)", () => {
    const result = consultationSchema.safeParse({ ...consultationDefaultValues, specialty: "Cardiologia" });
    expect(result.success).toBe(true);
  });

  it("rejeita especialidade vazia", () => {
    const result = consultationSchema.safeParse({ ...consultationDefaultValues, specialty: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita type fora do enum", () => {
    const result = consultationSchema.safeParse({
      ...consultationDefaultValues,
      specialty: "Cardiologia",
      type: "Invalido",
    });
    expect(result.success).toBe(false);
  });

  it("aceita sistólica/diastólica dentro da faixa 1-300", () => {
    const result = consultationSchema.safeParse({
      ...consultationDefaultValues,
      specialty: "Cardiologia",
      systolic: "120",
      diastolic: "80",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita sistólica fora da faixa (0 ou > 300)", () => {
    const result = consultationSchema.safeParse({
      ...consultationDefaultValues,
      specialty: "Cardiologia",
      systolic: "0",
    });
    expect(result.success).toBe(false);
  });

  it("aceita sistólica/diastólica vazias (medição opcional)", () => {
    const result = consultationSchema.safeParse({
      ...consultationDefaultValues,
      specialty: "Cardiologia",
      systolic: "",
      diastolic: "",
    });
    expect(result.success).toBe(true);
  });
});
