import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type Medication = {
  id: string;
  family_member_id: string;
  user_id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  frequency_hours: number | null;
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
};

export type UpdateMedication = {
  id: string;
  name?: string;
  dosage?: string | null;
  frequency?: string | null;
  frequency_hours?: number | null;
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
};

export const useMedications = (familyMemberId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["medications", familyMemberId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("medications")
        .select("*, consultations(professional_name, specialty), family_members(name)")
        .order("created_at", { ascending: false });

      if (familyMemberId) {
        q = q.eq("family_member_id", familyMemberId);
      } else {
        q = q.eq("user_id", user!.id);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as Medication[];
    },
    enabled: !!user && (!!familyMemberId || true),
  });

  const addMedication = useMutation({
    mutationFn: async (medication: NewMedication) => {
      const { data, error } = await supabase
        .from("medications")
        .insert({ ...medication, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medications"] });
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
    },
  });

  return {
    medications: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    addMedication,
    updateMedication,
    deleteMedication,
  };
};
