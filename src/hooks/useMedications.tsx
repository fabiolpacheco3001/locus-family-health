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
  duration: string | null;
  start_date: string | null;
  status: string;
  consultation_id: string | null;
  created_at: string;
  consultations?: { professional_name: string | null; specialty: string } | null;
};

export type NewMedication = {
  family_member_id: string;
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  start_date?: string | null;
  consultation_id?: string | null;
};

export type UpdateMedication = {
  id: string;
  name?: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  start_date?: string | null;
  status?: string;
  consultation_id?: string | null;
};

export const useMedications = (familyMemberId: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["medications", familyMemberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medications")
        .select("*")
        .eq("family_member_id", familyMemberId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Medication[];
    },
    enabled: !!user && !!familyMemberId,
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
      queryClient.invalidateQueries({ queryKey: ["medications", familyMemberId] });
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
      queryClient.invalidateQueries({ queryKey: ["medications", familyMemberId] });
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
      queryClient.invalidateQueries({ queryKey: ["medications", familyMemberId] });
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
