import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FamilyMember } from "@/hooks/useFamilyMembers";

/**
 * Fetches a single family_member by ID. Filters out soft-deleted rows.
 * Cached for 5 minutes.
 */
export function useFamilyMember(id: string | null | undefined) {
  return useQuery({
    queryKey: ["family_member", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select(
          "id, name, birth_date, blood_type, weight, height, avatar_url, member_type, relationship, physical_activity, deleted_at"
        )
        .eq("id", id!)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data as
        | (FamilyMember & {
            weight: number | null;
            height: number | null;
            physical_activity: string | null;
          })
        | null;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}
