import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSurgeryLabel } from "@/lib/surgeryTypes";

export type ClinicalEvent = {
  id: string;
  type: "consulta" | "medicamento" | "exame" | "cirurgia" | "vacina";
  date: string;
  title: string;
  subtitle: string | null;
  details: string | null;
  fileUrl: string | null;
  status: string | null;
  reason: string | null;
};

export const useClinicalTimeline = (familyMemberId: string | undefined) => {
  return useQuery({
    queryKey: ["clinical_timeline", familyMemberId],
    queryFn: async (): Promise<ClinicalEvent[]> => {
      const fid = familyMemberId!;

      const [cRes, mRes, eRes, sRes, vRes] = await Promise.all([
        // Consultas: só as Realizadas (não filtrar por data — status é o sinal correto)
        supabase
          .from("consultations")
          .select("id, specialty, professional_name, consultation_date, symptoms, status, created_at")
          .eq("family_member_id", fid)
          .eq("status", "Realizada")
          .is("deleted_at", null),

        // Medicamentos: todos (ativos e histórico)
        supabase
          .from("medications")
          .select("id, name, dosage, frequency, start_date, status, reason, medico_prescritor, receita_url, created_at")
          .eq("family_member_id", fid)
          .is("deleted_at", null),

        // Exames: não-cancelados, passados ou realizados
        supabase
          .from("exams")
          .select("id, name, location, exam_date, status, file_url, created_at")
          .eq("family_member_id", fid)
          .neq("status", "Cancelado")
          .is("deleted_at", null),

        // Cirurgias: realizadas (status = "completed")
        supabase
          .from("surgeries")
          .select("id, surgery_type, custom_type, surgeon_name, hospital_clinic, scheduled_date, status, notes, created_at")
          .eq("family_member_id", fid)
          .eq("status", "completed")
          .is("deleted_at", null),

        // Vacinas: todas aplicadas (applied_date presente)
        supabase
          .from("vaccines")
          .select("id, name, applied_date, dose_type, facility, created_at")
          .eq("family_member_id", fid)
          .not("applied_date", "is", null)
          .is("deleted_at", null),
      ]);

      if (cRes.error) throw cRes.error;
      if (mRes.error) throw mRes.error;
      if (eRes.error) throw eRes.error;
      if (sRes.error) throw sRes.error;
      if (vRes.error) throw vRes.error;

      const events: ClinicalEvent[] = [];

      (cRes.data || []).forEach((c) => {
        events.push({
          id: c.id,
          type: "consulta",
          date: c.consultation_date || c.created_at,
          title: `Consulta — ${c.specialty}`,
          subtitle: c.professional_name ? `Dr(a). ${c.professional_name}` : null,
          details: c.symptoms || null,
          fileUrl: null,
          status: c.status,
          reason: null,
        });
      });

      (mRes.data || []).forEach((m) => {
        const doseLine = [m.dosage, m.frequency].filter(Boolean).join(" · ");
        events.push({
          id: m.id,
          type: "medicamento",
          date: m.start_date || m.created_at,
          title: m.name,
          subtitle: doseLine || null,
          details: m.medico_prescritor ? `Prescrito por Dr(a). ${m.medico_prescritor}` : null,
          fileUrl: m.receita_url || null,
          status: m.status,
          reason: m.reason || null,
        });
      });

      (eRes.data || []).forEach((e) => {
        events.push({
          id: e.id,
          type: "exame",
          date: e.exam_date || e.created_at,
          title: e.name,
          subtitle: e.location || null,
          details: null,
          fileUrl: e.file_url || null,
          status: e.status,
          reason: null,
        });
      });

      (sRes.data || []).forEach((s) => {
        const displayName =
          s.surgery_type === "outro" && s.custom_type
            ? s.custom_type
            : getSurgeryLabel(s.surgery_type);
        events.push({
          id: s.id,
          type: "cirurgia",
          date: s.scheduled_date || s.created_at,
          title: `Cirurgia — ${displayName}`,
          subtitle: s.surgeon_name ? `Dr(a). ${s.surgeon_name}` : null,
          details: s.hospital_clinic || s.notes || null,
          fileUrl: null,
          status: "Realizada",
          reason: null,
        });
      });

      (vRes.data || []).forEach((v) => {
        events.push({
          id: v.id,
          type: "vacina",
          date: v.applied_date || v.created_at,
          title: `Vacina — ${v.name}`,
          subtitle: v.dose_type || null,
          details: v.facility || null,
          fileUrl: null,
          status: "Aplicada",
          reason: null,
        });
      });

      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return events;
    },
    enabled: !!familyMemberId,
    staleTime: 5 * 60 * 1000,
  });
};
