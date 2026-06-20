import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyMember } from "@/hooks/useFamilyMember";

/**
 * RX-14: Consolida queries de dados do Prontuário (member + allergies + diseases).
 * Mantém os queryKeys originais para não invalidar cache.
 */
export function useProntuarioData(id: string | undefined) {
  const { data: member, isLoading: memberLoading } = useFamilyMember(id);

  const { data: allergies } = useQuery({
    queryKey: ["allergies", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("allergies")
        .select("id, substance, severity")
        .eq("family_member_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: diseases } = useQuery({
    queryKey: ["diseases", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diseases")
        .select("id, name, category")
        .eq("family_member_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    member,
    allergies: allergies ?? [],
    diseases: diseases ?? [],
    isLoading: memberLoading,
  };
}
