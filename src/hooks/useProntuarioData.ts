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
    // LGPD art. 11: alergias são dados de saúde sensíveis — staleTime: 0 impede
    // que uma sessão anterior contamine a visualização do prontuário atual.
    staleTime: 0,
    gcTime: 5 * 60_000,
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
    // LGPD art. 11: doenças são dados de saúde sensíveis — staleTime: 0 garante
    // que o prontuário sempre reflete o estado atual no banco.
    staleTime: 0,
    gcTime: 5 * 60_000,
  });

  return {
    member,
    allergies: allergies ?? [],
    diseases: diseases ?? [],
    isLoading: memberLoading,
  };
}
