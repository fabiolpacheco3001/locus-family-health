import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useAiStatus() {
  const { user } = useAuth();

  const { data: isAiActive = true, isLoading } = useQuery({
    queryKey: ["ai-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "ai_status")
        .maybeSingle();

      if (error) {
        console.error("Error fetching AI status:", error);
        return true; // fail-open: don't block users on error
      }

      return (data?.value as { is_active?: boolean } | null)?.is_active ?? true;
    },
    enabled: !!user,
    staleTime: 30_000, // refresh every 30s
    refetchInterval: 60_000,
  });

  return { isAiActive, isLoading };
}
