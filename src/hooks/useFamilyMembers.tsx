import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type FamilyMember = {
  id: string;
  name: string;
  relationship: string;
  birth_date: string | null;
  gender: string | null;
  blood_type: string | null;
  phone: string | null;
  cpf: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type NewFamilyMember = {
  name: string;
  relationship: string;
  birth_date?: string | null;
  gender?: string | null;
  blood_type?: string | null;
  phone?: string | null;
  cpf?: string | null;
  avatar_url?: string | null;
};

export const useFamilyMembers = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["family_members", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as FamilyMember[];
    },
    enabled: !!user,
  });

  const addMember = useMutation({
    mutationFn: async (member: NewFamilyMember) => {
      const { data, error } = await supabase
        .from("family_members")
        .insert({ ...member, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family_members", user?.id] });
    },
  });

  const updateMember = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<NewFamilyMember> & { id: string }) => {
      const { data, error } = await supabase
        .from("family_members")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family_members"] });
    },
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("family_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family_members"] });
    },
  });

  return {
    members: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    addMember,
    updateMember,
    deleteMember,
  };
};
