import { useEffect } from "react";
import { useAuth } from "./useAuth";
import { useFamilyGroup } from "./useFamilyGroup";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { Medication } from "./useMedications";

const stockAlertSessionRuns = new Set<string>();

/**
 * Checks continuous-use medications for low stock and creates
 * at most one stock notification per medication per day (group-wide dedup).
 */
export function useStockAlerts(medications: Medication[]) {
  const { user } = useAuth();
  const { groupId } = useFamilyGroup();
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

    const timer = setTimeout(async () => {
      if (cancelled) return;
      let hasInserted = false;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Group-wide dedup: check by medication_id + type, not user_id
      let dedupQuery = supabase
        .from("notifications")
        .select("medication_id")
        .eq("type", "stock")
        .gte("created_at", todayStart.toISOString());

      if (groupId) {
        dedupQuery = dedupQuery.eq("group_id", groupId);
      } else {
        dedupQuery = dedupQuery.eq("user_id", user.id);
      }

      const { data: todayStockNotifs } = await dedupQuery;

      if (cancelled) return;

      const notifiedMedIds = new Set(
        (todayStockNotifs ?? []).map((n: any) => n.medication_id),
      );

      for (const med of lowStockMeds) {
        if (cancelled) return;
        if (notifiedMedIds.has(med.id)) continue;

        const memberName = med.family_members?.name ?? "o familiar";
        const notificationInsert = {
          user_id: user.id,
          family_member_id: med.family_member_id,
          medication_id: med.id,
          title: `Estoque Baixo: ${med.name}`,
          message: `Restam apenas ${med.estoque_total} comprimidos para ${memberName}. Lembre-se de comprar uma nova caixa.`,
          type: "stock",
          scheduled_for: new Date().toISOString(),
          ...(groupId ? { group_id: groupId } : {}),
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
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user, medications, queryClient, groupId]);
}
