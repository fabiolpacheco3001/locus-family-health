import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useFamilyGroup } from "./useFamilyGroup";

export type Exam = {
  id: string;
  family_member_id: string;
  user_id: string;
  name: string;
  exam_date: string | null;
  location: string | null;
  status: string;
  file_url: string | null;
  result_date: string | null;
  consultation_id: string | null;
  cancel_reason: string | null;
  created_at: string;
  consultations?: { professional_name: string | null; specialty: string } | null;
};

export type NewExam = {
  family_member_id: string;
  name: string;
  exam_date?: string | null;
  location?: string | null;
  status?: string;
  file_url?: string | null;
  consultation_id?: string | null;
  cancel_reason?: string | null;
  result_date?: string | null;
};

export type UpdateExam = {
  id: string;
  name?: string;
  exam_date?: string | null;
  location?: string | null;
  status?: string;
  file_url?: string | null;
  result_date?: string | null;
  consultation_id?: string | null;
  cancel_reason?: string | null;
};

export const useExams = (familyMemberId: string) => {
  const { user } = useAuth();
  const { groupId } = useFamilyGroup();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["exams", familyMemberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("*, consultations(professional_name, specialty)")
        .eq("family_member_id", familyMemberId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Exam[];
    },
    enabled: !!user && !!familyMemberId,
    // LGPD art. 11: exames médicos são dados de saúde sensíveis — staleTime: 0
    // impede que laudos ou resultados de exame sejam vistos de cache obsoleto.
    staleTime: 0,
    gcTime: 5 * 60_000,
  });

  const addExam = useMutation({
    mutationFn: async (exam: NewExam) => {
      const { data, error } = await supabase
        .from("exams")
        .insert({ ...exam, user_id: user!.id, group_id: groupId ?? undefined })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams", familyMemberId] });
      queryClient.invalidateQueries({ queryKey: ["pending-counts"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
    },
  });

  const updateExam = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateExam) => {
      const { data, error } = await supabase
        .from("exams")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams", familyMemberId] });
      queryClient.invalidateQueries({ queryKey: ["pending-counts"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
    },
  });

  const deleteExam = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("exams")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams", familyMemberId] });
      queryClient.invalidateQueries({ queryKey: ["pending-counts"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
    },
  });

  // Returns the storage PATH (not a URL) — callers must use getDisplaySignedUrl/getEdgeSignedUrl to generate URLs
  const uploadFile = async (file: File, examId: string): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${examId}.${ext}`;
    const { error } = await supabase.storage
      .from("exam-files")
      .upload(path, file, { upsert: true });
    if (error) throw error;
    return path; // store path, not public URL (private bucket)
  };

  return {
    exams: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    addExam,
    updateExam,
    deleteExam,
    uploadFile,
  };
};
