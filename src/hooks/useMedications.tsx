import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useFamilyGroup } from "./useFamilyGroup";

export type Medication = {
  id: string;
  family_member_id: string;
  user_id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  frequency_hours: number | null;
  frequency_type: string;
  specific_times: string[];
  specific_days: number[];
  duration: string | null;
  duration_days: number | null;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  status: string;
  consultation_id: string | null;
  uso_continuo: boolean;
  medico_prescritor: string | null;
  estoque_total: number | null;
  estoque_minimo: number | null;
  receita_url: string | null;
  reason: string | null;
  last_stock_decrement: string | null;
  created_at: string;
  consultations?: { professional_name: string | null; specialty: string } | null;
  family_members?: { name: string } | null;
};

export type NewMedication = {
  family_member_id: string;
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  frequency_hours?: number | null;
  frequency_type?: string;
  specific_times?: string[];
  specific_days?: number[];
  duration?: string | null;
  duration_days?: number | null;
  start_date?: string | null;
  start_time?: string | null;
  end_date?: string | null;
  consultation_id?: string | null;
  uso_continuo?: boolean;
  medico_prescritor?: string | null;
  estoque_total?: number | null;
  estoque_minimo?: number | null;
  receita_url?: string | null;
  reason?: string | null;
  status?: string;
};

export type UpdateMedication = {
  id: string;
  name?: string;
  dosage?: string | null;
  frequency?: string | null;
  frequency_hours?: number | null;
  frequency_type?: string;
  specific_times?: string[];
  specific_days?: number[];
  duration?: string | null;
  duration_days?: number | null;
  start_date?: string | null;
  start_time?: string | null;
  end_date?: string | null;
  status?: string;
  consultation_id?: string | null;
  uso_continuo?: boolean;
  medico_prescritor?: string | null;
  estoque_total?: number | null;
  estoque_minimo?: number | null;
  receita_url?: string | null;
  reason?: string | null;
};

export const useMedications = (familyMemberId?: string) => {
  const { user } = useAuth();
  const { groupId, isAdmin, linkedMemberId, managedProfiles, isLoading: groupLoading } = useFamilyGroup();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["medications", familyMemberId ?? "all", groupId, isAdmin, linkedMemberId],
    queryFn: async () => {
      let q = supabase
        .from("medications")
        .select("*, consultations(professional_name, specialty), family_members!inner(name)")
        .is("family_members.deleted_at", null)
        .order("created_at", { ascending: false });

      if (familyMemberId) {
        q = q.eq("family_member_id", familyMemberId);
      } else if (isAdmin && groupId) {
        // Don't filter by group_id (may be null on old rows); RLS handles access via family_members.group_id
      } else if (linkedMemberId) {
        const allowedIds = [linkedMemberId, ...(managedProfiles ?? [])];
        q = q.in("family_member_id", allowedIds);
      } else {
        q = q.eq("user_id", user!.id);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as Medication[];
    },
    enabled: !!user && !groupLoading,
    // LGPD art. 11: medicamentos em uso são dados de saúde sensíveis — staleTime: 0
    // garante que a posologia e o histórico de doses nunca vêm de cache desatualizado.
    staleTime: 0,
    gcTime: 5 * 60_000,
  });

  const addMedication = useMutation({
    mutationFn: async (medication: NewMedication) => {
      const { data, error } = await supabase
        .from("medications")
        .insert({ ...medication, user_id: user!.id, group_id: groupId ?? undefined })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medications"] });
      queryClient.invalidateQueries({ queryKey: ["pending-counts"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-appointments"] });
      // [ID-014] Agenda exibe medicamentos no widget do dia — deve refletir adição imediata.
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
    },
  });

  const updateMedication = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateMedication) => {
      const { data, error } = await supabase
        .from("medications")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medications"] });
      queryClient.invalidateQueries({ queryKey: ["pending-counts"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-appointments"] });
      // [ID-014] Posologia editada deve aparecer imediatamente na Agenda.
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
    },
  });

  const deleteMedication = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("medications")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medications"] });
      queryClient.invalidateQueries({ queryKey: ["pending-counts"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-appointments"] });
    },
  });

  // Returns the storage PATH (not a URL) — callers must use getEdgeSignedUrl to pass to edge functions
  const uploadReceita = async (file: File, medicationId: string): Promise<string> => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user!.id}/${medicationId}/receita.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("exam-files")
      .upload(path, file, { upsert: true });
    if (upErr) throw upErr;
    return path; // store path, not public URL (private bucket)
  };

  return {
    medications: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    addMedication,
    updateMedication,
    deleteMedication,
    uploadReceita,
  };
};
