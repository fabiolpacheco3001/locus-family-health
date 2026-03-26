import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type Consultation = {
  id: string;
  family_member_id: string;
  user_id: string;
  specialty: string;
  professional_name: string | null;
  consultation_date: string | null;
  type: string | null;
  symptoms: string | null;
  questions: string | null;
  status: string;
  created_at: string;
};

export type NewConsultation = {
  family_member_id: string;
  specialty: string;
  professional_name?: string | null;
  consultation_date?: string | null;
  type?: string | null;
  symptoms?: string | null;
  questions?: string | null;
};

export type UpdateConsultation = {
  id: string;
  specialty?: string;
  professional_name?: string | null;
  consultation_date?: string | null;
  type?: string | null;
  symptoms?: string | null;
  questions?: string | null;
  status?: string;
  cancel_reason?: string | null;
};

export const useConsultations = (familyMemberId: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["consultations", familyMemberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultations")
        .select("*")
        .eq("family_member_id", familyMemberId)
        .order("consultation_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Consultation[];
    },
    enabled: !!user && !!familyMemberId,
    staleTime: 5 * 60 * 1000,
  });

  const addConsultation = useMutation({
    mutationFn: async (consultation: NewConsultation) => {
      const { data, error } = await supabase
        .from("consultations")
        .insert({ ...consultation, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultations", familyMemberId] });
    },
  });

  const updateConsultation = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateConsultation) => {
      const { data, error } = await supabase
        .from("consultations")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultations", familyMemberId] });
    },
  });

  const deleteConsultation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("consultations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultations", familyMemberId] });
    },
  });

  return {
    consultations: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    addConsultation,
    updateConsultation,
    deleteConsultation,
  };
};
