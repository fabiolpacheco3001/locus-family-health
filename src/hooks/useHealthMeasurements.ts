import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromSPToUTC } from "@/lib/dateUtils";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface MeasurementInput {
  date: string;
  peso: string;
  altura: string;
}

/**
 * RX-14: Centraliza queries e mutations de health_measurements.
 */
export function useHealthMeasurements(familyMemberId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = ["health_measurements", familyMemberId];

  const { data: measurements = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_measurements")
        // [ID-010] Colunas explícitas: evita vazar colunas futuras não mapeadas no tipo.
        .select("id, user_id, family_member_id, weight, height, bmi, recorded_at, created_at")
        .eq("family_member_id", familyMemberId!)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!familyMemberId && !!user,
    // LGPD art. 11: dado de saúde é sensível — staleTime: 0 garante que nunca
    // servimos medidas corporais de uma sessão anterior do mesmo dispositivo.
    staleTime: 0,
    gcTime: 5 * 60_000,
  });

  const addMutation = useMutation({
    mutationFn: async (input: MeasurementInput) => {
      if (!user || !familyMemberId) throw new Error("Sessão inválida");
      const w = input.peso ? Number(input.peso) : null;
      const hCm = input.altura ? Number(input.altura) : null;
      const hM = hCm ? hCm / 100 : null;
      const bmi = w && hM && hM > 0 ? w / (hM * hM) : null;

      const { error } = await supabase.from("health_measurements").insert({
        user_id: user.id,
        family_member_id: familyMemberId,
        weight: w,
        height: hM,
        bmi: bmi ? Number(bmi.toFixed(1)) : null,
        recorded_at: input.date
          ? fromSPToUTC(input.date).toISOString()
          : new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Medida registrada!");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      toast.error("Erro ao salvar medida.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (measurementId: string) => {
      if (!user) throw new Error("Sessão inválida");
      const { error } = await supabase
        .from("health_measurements")
        .delete()
        .eq("id", measurementId)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro excluído!");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      toast.error("Erro ao excluir registro.");
    },
  });

  return { measurements, isLoading, addMutation, deleteMutation };
}
