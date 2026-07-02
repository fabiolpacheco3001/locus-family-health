/**
 * medication.test.ts — [ID-016]
 * Cobre os 4 frequency_types (fixed_interval, specific_times, specific_days,
 * cyclic) + o guard equivalente à CHECK constraint chk_cyclic_fields_complete
 * (migration 20260702000000_add_cyclic_posology) — nunca permitir 'cyclic'
 * sem os 3 campos de ciclo completos.
 */
import { describe, it, expect } from "vitest";
import { medicationSchema, firstMedicationError } from "./medication";

const base = {
  name: "Atorvastatina",
  dosage: "20mg",
  frequency: null,
  frequency_hours: null,
  specific_times: [] as string[],
  specific_days: [] as number[],
  cycle_active_days: null,
  cycle_pause_days: null,
  cycle_start_date: null,
  duration_days: null,
  duration: null,
  start_date: "2026-01-01",
  start_time: null,
  end_date: null,
  consultation_id: null,
  uso_continuo: true,
  medico_prescritor: null,
  estoque_total: null,
  estoque_minimo: null,
  reason: null,
};

describe("medicationSchema", () => {
  it("rejeita nome vazio", () => {
    const result = medicationSchema.safeParse({ ...base, name: "  ", frequency_type: "fixed_interval", frequency_hours: 8 });
    expect(result.success).toBe(false);
  });

  describe("frequency_type: fixed_interval", () => {
    it("aceita com frequency_hours preenchido", () => {
      const result = medicationSchema.safeParse({ ...base, frequency_type: "fixed_interval", frequency_hours: 8 });
      expect(result.success).toBe(true);
    });

    it("rejeita sem frequency_hours", () => {
      const result = medicationSchema.safeParse({ ...base, frequency_type: "fixed_interval", frequency_hours: null });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(firstMedicationError(result)).toMatch(/intervalo/i);
      }
    });
  });

  describe("frequency_type: specific_times", () => {
    it("aceita com ao menos um horário válido", () => {
      const result = medicationSchema.safeParse({
        ...base,
        frequency_type: "specific_times",
        specific_times: ["08:00", "20:00"],
      });
      expect(result.success).toBe(true);
    });

    it("rejeita array vazio de horários", () => {
      const result = medicationSchema.safeParse({ ...base, frequency_type: "specific_times", specific_times: [] });
      expect(result.success).toBe(false);
    });

    it("rejeita horário em formato inválido", () => {
      const result = medicationSchema.safeParse({
        ...base,
        frequency_type: "specific_times",
        specific_times: ["25:99"],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("frequency_type: specific_days", () => {
    it("aceita com ao menos um dia selecionado", () => {
      const result = medicationSchema.safeParse({ ...base, frequency_type: "specific_days", specific_days: [3, 6] });
      expect(result.success).toBe(true);
    });

    it("rejeita array vazio de dias", () => {
      const result = medicationSchema.safeParse({ ...base, frequency_type: "specific_days", specific_days: [] });
      expect(result.success).toBe(false);
    });

    it("rejeita dia fora do intervalo 0-6", () => {
      const result = medicationSchema.safeParse({ ...base, frequency_type: "specific_days", specific_days: [7] });
      expect(result.success).toBe(false);
    });
  });

  describe("frequency_type: cyclic (BK-02) — RISCO HIGH", () => {
    it("aceita com os 3 campos de ciclo completos", () => {
      const result = medicationSchema.safeParse({
        ...base,
        frequency_type: "cyclic",
        cycle_active_days: 21,
        cycle_pause_days: 7,
        cycle_start_date: "2026-01-01T00:00:00",
      });
      expect(result.success).toBe(true);
    });

    it("rejeita cyclic sem cycle_active_days", () => {
      const result = medicationSchema.safeParse({
        ...base,
        frequency_type: "cyclic",
        cycle_active_days: null,
        cycle_pause_days: 7,
        cycle_start_date: "2026-01-01T00:00:00",
      });
      expect(result.success).toBe(false);
    });

    it("rejeita cyclic sem cycle_pause_days", () => {
      const result = medicationSchema.safeParse({
        ...base,
        frequency_type: "cyclic",
        cycle_active_days: 21,
        cycle_pause_days: null,
        cycle_start_date: "2026-01-01T00:00:00",
      });
      expect(result.success).toBe(false);
    });

    it("rejeita cyclic sem cycle_start_date", () => {
      const result = medicationSchema.safeParse({
        ...base,
        frequency_type: "cyclic",
        cycle_active_days: 21,
        cycle_pause_days: 7,
        cycle_start_date: null,
      });
      expect(result.success).toBe(false);
    });

    it("rejeita cycle_active_days <= 0", () => {
      const result = medicationSchema.safeParse({
        ...base,
        frequency_type: "cyclic",
        cycle_active_days: 0,
        cycle_pause_days: 7,
        cycle_start_date: "2026-01-01T00:00:00",
      });
      expect(result.success).toBe(false);
    });
  });

  it("rejeita frequency_type desconhecido", () => {
    const result = medicationSchema.safeParse({ ...base, frequency_type: "unknown" });
    expect(result.success).toBe(false);
  });

  it("firstMedicationError retorna null para resultado válido", () => {
    const result = medicationSchema.safeParse({ ...base, frequency_type: "fixed_interval", frequency_hours: 8 });
    expect(firstMedicationError(result)).toBeNull();
  });
});
