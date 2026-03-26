import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useFamilyGroup } from "./useFamilyGroup";

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
  member_type: string | null;
  species: string | null;
  breed: string | null;
  tracks_menstrual_cycle?: boolean;
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
  member_type?: string | null;
  species?: string | null;
  breed?: string | null;
};

export const useFamilyMembers = () => {
  const { user } = useAuth();
  const { groupId } = useFamilyGroup();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["family_members", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as FamilyMember[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const addMember = useMutation({
    mutationFn: async (member: NewFamilyMember) => {
      const { data, error } = await supabase
        .from("family_members")
        .insert({ ...member, user_id: user!.id, ...(groupId ? { group_id: groupId } : {}) } as any)
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
      const { error } = await supabase
        .from("family_members")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
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
