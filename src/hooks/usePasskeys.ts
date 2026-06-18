/**
 * usePasskeys.ts
 *
 * React hook for managing WebAuthn passkeys (FaceID / TouchID / fingerprint).
 *
 * Provides:
 *   passkeys   — list of enrolled credentials for the current user
 *   register   — mutation to enroll a new passkey (triggers OS biometric prompt)
 *   remove     — mutation to delete a passkey by DB id
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { registerPasskey } from "@/lib/webauthn";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Passkey {
  id: string;
  credential_id: string;
  device_name: string;
  created_at: string;
  last_used_at: string | null;
  transports: string[] | null;
}

export function usePasskeys() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // ── List passkeys for current user ──────────────────────────────────────────
  // IMPORTANT: queryKey includes user.id to prevent stale cache from a previous
  // user (on shared devices) from triggering the lock screen for a different user.
  const { data: passkeys = [], isLoading } = useQuery({
    queryKey: ["passkeys", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("passkeys")
        .select("id, credential_id, device_name, created_at, last_used_at, transports")
        .eq("user_id", user.id)        // explicit filter — defence-in-depth beyond RLS
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Passkey[];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // ── Register new passkey ─────────────────────────────────────────────────────
  const register = useMutation({
    mutationFn: (deviceName?: string) => registerPasskey(deviceName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["passkeys"] });
      toast.success("Biometria cadastrada com sucesso!");
    },
    onError: (err: Error) => {
      // registerPasskey already shows specific error messages
      toast.error(err.message);
    },
  });

  // ── Remove passkey ───────────────────────────────────────────────────────────
  const remove = useMutation({
    mutationFn: async (passkeyId: string) => {
      const { error } = await supabase
        .from("passkeys")
        .delete()
        .eq("id", passkeyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["passkeys"] });
      toast.success("Biometria removida.");
    },
    onError: () => {
      toast.error("Erro ao remover biometria. Tente novamente.");
    },
  });

  return { passkeys, isLoading, register, remove };
}
