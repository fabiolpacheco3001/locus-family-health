import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ClinicalEvent = {
  id: string;
  type: "consulta" | "medicamento" | "exame";
  date: string;
  title: string;
  subtitle: string | null;
  details: string | null;
  fileUrl: string | null;
  status: string | null;
};

export const useClinicalTimeline = (familyMemberId: string | undefined) => {
  return useQuery({
    queryKey: ["clinical_timeline", familyMemberId],
    queryFn: async (): Promise<ClinicalEvent[]> => {
      const fid = familyMemberId!;

      const now = new Date().toISOString();

      const [cRes, mRes, eRes] = await Promise.all([
        supabase.from("consultations").select("*").eq("family_member_id", fid).neq("status", "Cancelada").lte("consultation_date", now),
        supabase.from("medications").select("*").eq("family_member_id", fid),
        supabase.from("exams").select("*").eq("family_member_id", fid).neq("status", "Cancelado").lte("exam_date", now),
      ]);

      if (cRes.error) throw cRes.error;
      if (mRes.error) throw mRes.error;
      if (eRes.error) throw eRes.error;

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
        });
      });

      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return events;
    },
    enabled: !!familyMemberId,
  });
};
