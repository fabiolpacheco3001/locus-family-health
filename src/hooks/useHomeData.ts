/**
 * useHomeData — Agrega todos os dados da Home em um único hook.
 * Extraído de Home.tsx (M3) para reduzir o monolito de 849 LOC.
 *
 * Responsabilidades:
 *  - pendingCounts (consultas + exames + rotinas pet em aberto)
 *  - upcoming (5 próximos compromissos)
 *  - todayPetRoutines
 *  - homeDoseStatuses (medication_doses últimos 7 dias)
 *  - medsWithNextDose (medicamentos ativos com próxima dose calculada)
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, startOfYesterday, isBefore, isToday, isYesterday, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useFamilyGroup } from "./useFamilyGroup";
import { useMedications } from "./useMedications";
import { parseDateInSP, toSPTime } from "@/lib/dateUtils";
import { advancePastTakenDoses } from "@/lib/advancePastTakenDoses";

export type UpcomingItem = {
  id: string;
  title: string;
  subtitle: string;
  date: string | null;
  memberName: string;
  kind: "consultation" | "exam" | "pet_routine";
  familyMemberId: string;
  isOverdue: boolean;
  consultationType?: string | null;
  isPet: boolean;
};

export type MedWithNextDose = {
  med: any;
  effectiveScheduledFor: string | null;
  doseLabel: string;
  isOverdue: boolean;
  doseStatus: "taken" | "skipped" | null;
  isContinuous: boolean;
  effectiveFreqType: string;
  startDateISO: string | null;
};

export function useHomeData() {
  const { user } = useAuth();
  const { groupId, isAdmin, linkedMemberId, managedProfiles } = useFamilyGroup();
  const { medications, isLoading: medsLoading } = useMedications();

  const activeMeds = medications.filter((m) => m.status === "Ativo");
  const activeMedIds = React.useMemo(() => activeMeds.map((m) => m.id), [activeMeds]);

  // ── Pending counts (1 query paralela de 3 sub-queries) ──
  const { data: pendingCounts } = useQuery({
    queryKey: ["pending-counts", groupId, isAdmin, linkedMemberId, managedProfiles],
    queryFn: async () => {
      let cq = supabase.from("consultations").select("id", { count: "exact", head: true }).eq("status", "Agendada");
      let eq = supabase.from("exams").select("id", { count: "exact", head: true }).eq("status", "Agendado");
      let pq = supabase.from("pet_routines").select("id", { count: "exact", head: true }).eq("status", "Agendado");

      if (!isAdmin && linkedMemberId) {
        const allowedIds = [linkedMemberId, ...(managedProfiles ?? [])];
        cq = cq.in("family_member_id", allowedIds);
        eq = eq.in("family_member_id", allowedIds);
        pq = pq.in("family_member_id", allowedIds);
      } else if (!isAdmin) {
        cq = cq.eq("user_id", user!.id);
        eq = eq.eq("user_id", user!.id);
        pq = pq.eq("user_id", user!.id);
      }

      const [consultRes, examRes, petRes] = await Promise.all([cq, eq, pq]);
      if (consultRes.error) throw consultRes.error;
      if (examRes.error) throw examRes.error;
      if (petRes.error) throw petRes.error;
      return {
        consultations: consultRes.count ?? 0,
        exams: examRes.count ?? 0,
        petRoutines: petRes.count ?? 0,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const pendingConsultations = pendingCounts?.consultations ?? 0;
  const pendingExams = pendingCounts?.exams ?? 0;
  const totalOpenAppointments = pendingConsultations + pendingExams + (pendingCounts?.petRoutines ?? 0);

  // ── Upcoming appointments (5 mais próximos) ──
  const { data: upcoming = [], isLoading: upcomingLoading } = useQuery({
    queryKey: ["upcoming-appointments", groupId, isAdmin, linkedMemberId, managedProfiles],
    queryFn: async () => {
      let cq = supabase
        .from("consultations")
        .select("id, family_member_id, specialty, professional_name, consultation_date, type, status, family_members!inner(name, member_type, deleted_at)")
        .is("family_members.deleted_at", null)
        .in("status", ["Agendada"])
        .order("consultation_date", { ascending: true })
        .limit(5);

      let eq = supabase
        .from("exams")
        .select("id, family_member_id, name, exam_date, location, status, result_date, family_members!inner(name, member_type, deleted_at)")
        .is("family_members.deleted_at", null)
        .or("status.eq.Agendado,and(status.eq.Realizado,result_date.not.is.null),and(status.eq.Coletado,result_date.not.is.null)")
        .order("exam_date", { ascending: true })
        .limit(5);

      let pq = supabase
        .from("pet_routines")
        .select("id, family_member_id, routine_type, date_performed, status, recurrence, notes, family_members!inner(name, member_type, deleted_at)")
        .is("family_members.deleted_at", null)
        .eq("status", "Agendado")
        .order("date_performed", { ascending: true })
        .limit(5);

      if (!isAdmin && linkedMemberId) {
        const allowedIds = [linkedMemberId, ...(managedProfiles ?? [])];
        cq = cq.in("family_member_id", allowedIds);
        eq = eq.in("family_member_id", allowedIds);
        pq = pq.in("family_member_id", allowedIds);
      } else if (!isAdmin) {
        cq = cq.eq("user_id", user!.id);
        eq = eq.eq("user_id", user!.id);
        pq = pq.eq("user_id", user!.id);
      }

      const [consultRes, examRes, petRes] = await Promise.all([cq, eq, pq]);

      const items: UpcomingItem[] = [];
      const now = new Date();

      (consultRes.data ?? []).forEach((c: any) => {
        const dateStr = c.consultation_date;
        if (dateStr && new Date(dateStr) <= now) return;
        items.push({
          id: c.id,
          title: c.specialty,
          subtitle: c.professional_name ? `com ${c.professional_name}` : "Consulta",
          date: dateStr,
          memberName: c.family_members?.name ?? "Usuário",
          kind: "consultation",
          familyMemberId: c.family_member_id,
          isOverdue: false,
          consultationType: c.type,
          isPet: (c.family_members?.member_type || "human") === "pet",
        });
      });

      (examRes.data ?? []).forEach((e: any) => {
        const isRealizado = e.status === "Realizado" || e.status === "Coletado";
        const displayDate = isRealizado ? e.result_date : e.exam_date;
        if (e.status === "Agendado" && e.exam_date && isBefore(new Date(e.exam_date), startOfDay(now))) return;
        items.push({
          id: e.id,
          title: isRealizado ? "Buscar Resultado" : e.name,
          subtitle: isRealizado ? e.name : (e.location ?? "Exame"),
          date: displayDate,
          memberName: e.family_members?.name ?? "Usuário",
          kind: "exam",
          familyMemberId: e.family_member_id,
          isOverdue: false,
          isPet: (e.family_members?.member_type || "human") === "pet",
        });
      });

      (petRes.data ?? []).forEach((p: any) => {
        const dateStr = p.date_performed;
        if (dateStr && isBefore(parseDateInSP(dateStr) ?? new Date(), startOfDay(now))) return;
        items.push({
          id: p.id,
          title: p.routine_type,
          subtitle: p.notes || "Rotina Pet",
          date: dateStr,
          memberName: p.family_members?.name ?? "Pet",
          kind: "pet_routine",
          familyMemberId: p.family_member_id,
          isOverdue: false,
          isPet: true,
        });
      });

      items.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      return items.slice(0, 5);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // ── Rotinas pet para hoje (Ações de Hoje) ──
  const { data: todayPetRoutines = [] } = useQuery({
    queryKey: ["today-pet-routines", groupId, isAdmin, linkedMemberId, managedProfiles],
    queryFn: async () => {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      let pq = supabase
        .from("pet_routines")
        .select("id, family_member_id, routine_type, date_performed, status, notes, family_members(name, member_type)")
        .eq("date_performed", todayStr)
        .eq("status", "Agendado");

      if (!isAdmin && linkedMemberId) {
        const allowedIds = [linkedMemberId, ...(managedProfiles ?? [])];
        pq = pq.in("family_member_id", allowedIds);
      } else if (!isAdmin) {
        pq = pq.eq("user_id", user!.id);
      }

      const { data, error } = await pq;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // ── Status de doses (últimos 7 dias) ──
  const { data: homeDoseStatuses = {} } = useQuery({
    queryKey: ["medication_doses_home", activeMedIds],
    queryFn: async () => {
      if (activeMedIds.length === 0) return {};
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data, error } = await supabase
        .from("medication_doses")
        .select("medication_id, scheduled_for, status")
        .in("medication_id", activeMedIds)
        .gte("scheduled_for", sevenDaysAgo.toISOString());
      if (error) throw error;
      const map: Record<string, "taken" | "skipped"> = {};
      for (const d of (data ?? [])) {
        const key = `${d.medication_id}-${new Date(d.scheduled_for).toISOString()}`;
        map[key] = d.status as "taken" | "skipped";
      }
      return map;
    },
    enabled: activeMedIds.length > 0,
    staleTime: 30 * 1000,
  });

  // ── Medicamentos com próxima dose calculada ──
  const medsWithNextDose = React.useMemo((): MedWithNextDose[] => {
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");

    return activeMeds
      .map((med) => {
        const freqType = (med.frequency_type as string) || "fixed_interval";
        const hasSpecificTimes =
          freqType === "specific_times" ||
          (Array.isArray(med.specific_times) && med.specific_times.length > 0);
        const hasSpecificDays =
          freqType === "specific_days" ||
          (Array.isArray(med.specific_days) && med.specific_days.length > 0);
        const hasSpecificSchedule = hasSpecificTimes || hasSpecificDays;
        const effectiveFreqType: string = hasSpecificDays
          ? "specific_days"
          : hasSpecificTimes
          ? "specific_times"
          : freqType;
        const isContinuous = !hasSpecificSchedule && (!med.frequency_hours || med.frequency_hours <= 0);

        const dateOnly = med.start_date?.slice(0, 10);
        let startDateISO: string | null = null;
        if (dateOnly && med.start_time) {
          startDateISO = `${dateOnly}T${med.start_time}`;
        } else if (dateOnly) {
          startDateISO = dateOnly;
        }

        let effectiveScheduledFor: string | null = null;
        let doseLabel = "";

        if (isContinuous) {
          if (med.start_date && med.start_time) {
            let targetDose = new Date(`${todayStr}T${med.start_time}`);
            let advanceLimit = 50;
            while (advanceLimit > 0) {
              const key = `${med.id}-${targetDose.toISOString()}`;
              if (!homeDoseStatuses[key]) break;
              targetDose = new Date(targetDose.getTime() + 24 * 60 * 60 * 1000);
              advanceLimit--;
            }
            if (!isNaN(targetDose.getTime())) {
              effectiveScheduledFor = targetDose.toISOString();
              doseLabel = `Próxima dose: ${format(toSPTime(targetDose), "dd MMM 'às' HH:mm", { locale: ptBR })}`;
            }
          }
        } else {
          const candidate = advancePastTakenDoses({
            medicationId: med.id,
            startDateISO,
            frequencyHours: med.frequency_hours,
            endDate: med.end_date,
            referenceTime: startOfYesterday(),
            frequencyType: effectiveFreqType,
            specificTimes: med.specific_times as string[] | null,
            specificDays: med.specific_days as number[] | null,
            doseStatuses: homeDoseStatuses,
          });

          if (candidate && !isNaN(candidate.getTime())) {
            effectiveScheduledFor = candidate.toISOString();
            doseLabel = `Próxima dose: ${format(toSPTime(candidate), "dd MMM 'às' HH:mm", { locale: ptBR })}`;
          }
        }

        const effectiveDate = effectiveScheduledFor ? new Date(effectiveScheduledFor) : null;
        const isOverdue = effectiveDate ? isPast(effectiveDate) : false;
        const doseKey = effectiveScheduledFor ? `${med.id}-${effectiveScheduledFor}` : null;
        const doseStatus: "taken" | "skipped" | null = doseKey ? (homeDoseStatuses[doseKey] ?? null) : null;

        return { med, effectiveScheduledFor, doseLabel, isOverdue, doseStatus, isContinuous, effectiveFreqType, startDateISO };
      })
      .filter(({ effectiveScheduledFor, isContinuous }) => {
        if (isContinuous) return true;
        if (!effectiveScheduledFor) return false;
        const d = new Date(effectiveScheduledFor);
        return isToday(d) || isYesterday(d) || d > now;
      })
      .sort((a, b) => {
        if (!a.effectiveScheduledFor && !b.effectiveScheduledFor) return 0;
        if (!a.effectiveScheduledFor) return 1;
        if (!b.effectiveScheduledFor) return -1;
        return new Date(a.effectiveScheduledFor).getTime() - new Date(b.effectiveScheduledFor).getTime();
      });
  }, [activeMeds, homeDoseStatuses]);

  return {
    activeMeds,
    medsLoading,
    pendingCounts,
    pendingConsultations,
    pendingExams,
    totalOpenAppointments,
    upcoming,
    upcomingLoading,
    todayPetRoutines,
    homeDoseStatuses,
    medsWithNextDose,
  };
}
