import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { isPast, startOfYesterday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useMedications, type Medication } from "@/hooks/useMedications";
import { advancePastTakenDoses } from "@/lib/advancePastTakenDoses";

export interface ActiveMedComputed {
  med: Medication;
  nextDoseDate: Date | null;
  scheduledFor: string | null;
  isOverdue: boolean;
  doseStatus: "taken" | "skipped" | null;
  effectiveScheduledFor: string | null;
}

/**
 * RX-14: Centraliza dados/cálculos da página Medicamentos.
 * Mantém os mesmos queryKeys para não invalidar cache.
 */
export function useMedicationPageData(familyMemberId: string) {
  const {
    medications,
    isLoading,
    addMedication,
    updateMedication,
    deleteMedication,
  } = useMedications(familyMemberId);

  const activeMedications = useMemo(
    () => medications.filter((m) => m.status === "Ativo"),
    [medications],
  );

  const inactiveMedications = useMemo(
    () => medications.filter((m) => m.status === "Concluído"),
    [medications],
  );

  const activeMedIds = useMemo(
    () => activeMedications.map((m) => m.id),
    [activeMedications],
  );

  const { data: medDoseStatuses = {} } = useQuery({
    queryKey: ["medication_doses_list", activeMedIds],
    queryFn: async () => {
      if (activeMedIds.length === 0) return {} as Record<string, "taken" | "skipped">;
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data, error } = await supabase
        .from("medication_doses")
        .select("medication_id, scheduled_for, status")
        .in("medication_id", activeMedIds)
        .gte("scheduled_for", sevenDaysAgo.toISOString());
      if (error) throw error;
      const map: Record<string, "taken" | "skipped"> = {};
      for (const d of data ?? []) {
        const key = `${d.medication_id}-${new Date(d.scheduled_for).toISOString()}`;
        map[key] = d.status as "taken" | "skipped";
      }
      return map;
    },
    enabled: activeMedIds.length > 0,
    staleTime: 30 * 1000,
  });

  const activeMedsWithEffective = useMemo<ActiveMedComputed[]>(() => {
    return activeMedications.map((m) => {
      const dateOnly = m.start_date?.slice(0, 10);
      let startDateISO: string | null = null;
      if (dateOnly && m.start_time) {
        startDateISO = `${dateOnly}T${m.start_time}`;
      } else if (dateOnly) {
        startDateISO = dateOnly;
      }
      const safeTimes = Array.isArray(m.specific_times) ? (m.specific_times as string[]) : [];
      const safeDays = Array.isArray(m.specific_days) ? (m.specific_days as number[]) : [];
      const nextDoseDate = advancePastTakenDoses({
        medicationId: m.id,
        startDateISO,
        frequencyHours: m.frequency_hours,
        endDate: m.end_date,
        referenceTime: startOfYesterday(),
        frequencyType: m.frequency_type,
        specificTimes: safeTimes,
        specificDays: safeDays,
        doseStatuses: medDoseStatuses,
      });
      const scheduledFor = nextDoseDate ? nextDoseDate.toISOString() : null;
      const isOverdue = nextDoseDate ? isPast(nextDoseDate) : false;
      const doseKey = scheduledFor ? `${m.id}-${scheduledFor}` : null;
      const doseStatus: "taken" | "skipped" | null = doseKey
        ? (medDoseStatuses[doseKey] ?? null)
        : null;
      return {
        med: m,
        nextDoseDate,
        scheduledFor,
        isOverdue,
        doseStatus,
        effectiveScheduledFor: scheduledFor,
      };
    });
  }, [activeMedications, medDoseStatuses]);

  return {
    medications,
    activeMedications,
    inactiveMedications,
    medDoseStatuses,
    activeMedsWithEffective,
    isLoading,
    addMedication,
    updateMedication,
    deleteMedication,
  };
}
