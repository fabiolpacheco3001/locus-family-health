import { useEffect } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { Medication } from "./useMedications";

const stockAlertSessionRuns = new Set<string>();

/**
 * Checks continuous-use medications for low stock and creates
 * at most one stock notification per medication per day.
 * Receives medications externally to avoid duplicate useQuery calls.
 */
export function useStockAlerts(medications: Medication[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user || medications.length === 0) return;

    const lowStockMeds = medications.filter(
      (m) =>
        m.status === "Ativo" &&
        m.uso_continuo &&
        m.estoque_minimo != null &&
        m.estoque_total != null &&
        m.estoque_total <= m.estoque_minimo,
    );

    if (lowStockMeds.length === 0) return;

    const todayKey = new Date().toDateString();
    const sessionKey = `${user.id}-${todayKey}`;

    if (stockAlertSessionRuns.has(sessionKey)) return;
    stockAlertSessionRuns.add(sessionKey);

    let cancelled = false;

    const checkAndNotify = async () => {
      let hasInserted = false;

      for (const med of lowStockMeds) {
        if (cancelled) return;

        const { data: latest } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .eq("type", "stock")
          .eq("medication_id", med.id)
          .order("created_at", { ascending: false })
          .limit(1);

        const latestNotification = latest?.[0];
        const wasAlreadyNotifiedToday =
          !!latestNotification?.created_at && new Date(latestNotification.created_at).toDateString() === todayKey;

        if (wasAlreadyNotifiedToday) continue;

        const memberName = med.family_members?.name ?? "o familiar";
        const notificationInsert = {
          user_id: user.id,
          family_member_id: med.family_member_id,
          medication_id: med.id,
          title: `Estoque Baixo: ${med.name}`,
          message: `Restam apenas ${med.estoque_total} comprimidos para ${memberName}. Lembre-se de comprar uma nova caixa.`,
          type: "stock",
          scheduled_for: new Date().toISOString(),
        };

        const { error } = await supabase.from("notifications").insert(notificationInsert as never);

        if (!error) {
          hasInserted = true;
        }
      }

      if (!cancelled && hasInserted) {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
      }
    };

    void checkAndNotify();

    return () => {
      cancelled = true;
    };
  }, [user, medications, queryClient]);
}
