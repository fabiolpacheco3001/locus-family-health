import { useEffect, useRef } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { Medication } from "./useMedications";

/**
 * Checks continuous-use medications for low stock and creates
 * a notification if one doesn't already exist (unread) for that med.
 * Receives medications externally to avoid duplicate useQuery calls.
 */
export function useStockAlerts(medications: Medication[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const checkedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || medications.length === 0) return;

    const lowStockMeds = medications.filter(
      (m) =>
        m.status === "Ativo" &&
        m.uso_continuo &&
        m.estoque_minimo != null &&
        m.estoque_total != null &&
        m.estoque_total <= m.estoque_minimo
    );

    if (lowStockMeds.length === 0) return;

    const checkAndNotify = async () => {
      for (const med of lowStockMeds) {
        if (checkedRef.current.has(med.id)) continue;
        checkedRef.current.add(med.id);

        // Check for unread notification (existing rule)
        const { data: unread } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", user.id)
          .eq("type", "stock")
          .eq("is_read", false)
          .ilike("title", `%${med.name}%`)
          .limit(1);

        if (unread && unread.length > 0) continue;

        // Temporal lock: max 1 notification per medication per day
        const { data: latest } = await supabase
          .from("notifications")
          .select("created_at")
          .eq("user_id", user.id)
          .eq("type", "stock")
          .ilike("title", `%${med.name}%`)
          .order("created_at", { ascending: false })
          .limit(1);

        if (
          latest &&
          latest.length > 0 &&
          new Date(latest[0].created_at!).toDateString() === new Date().toDateString()
        ) continue;

        const memberName = med.family_members?.name ?? "o familiar";

        await supabase.from("notifications").insert({
          user_id: user.id,
          family_member_id: med.family_member_id,
          title: `Estoque Baixo: ${med.name}`,
          message: `Restam apenas ${med.estoque_total} comprimidos para ${memberName}. Lembre-se de comprar uma nova caixa.`,
          type: "stock",
          scheduled_for: new Date().toISOString(),
        });
      }

      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
    };

    checkAndNotify();
  }, [user, medications, queryClient]);
}
