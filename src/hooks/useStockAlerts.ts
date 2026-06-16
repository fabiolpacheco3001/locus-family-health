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

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // M6: Batch dedup — one SELECT for ALL low-stock meds instead of N individual queries
      let dedupQuery = supabase
        .from("notifications")
        .select("medication_id")
        .eq("type", "stock")
        .in("medication_id", lowStockMeds.map((m) => m.id))
        .gte("created_at", todayStart.toISOString());

      if (groupId) {
        dedupQuery = dedupQuery.eq("group_id", groupId);
      } else {
        dedupQuery = dedupQuery.eq("user_id", user.id);
      }

      const { data: existingNotifs } = await dedupQuery;
      if (cancelled) return;

      const alreadyNotifiedIds = new Set(existingNotifs?.map((n) => n.medication_id) ?? []);
      const medsToNotify = lowStockMeds.filter((m) => !alreadyNotifiedIds.has(m.id));
      if (medsToNotify.length === 0) return;

      // M6: Batch INSERT — one insert for ALL new notifications instead of N individual inserts
      const notificationsToInsert = medsToNotify.map((med) => ({
        user_id: user.id,
        family_member_id: med.family_member_id,
        medication_id: med.id,
        title: `Estoque Baixo: ${med.name}`,
        message: `Restam apenas ${med.estoque_total} comprimidos para ${med.family_members?.name ?? "o usuário"}. Lembre-se de comprar uma nova caixa.`,
        type: "stock",
        scheduled_for: new Date().toISOString(),
        ...(groupId ? { group_id: groupId } : {}),
      }));

      const { error } = await supabase
        .from("notifications")
        .insert(notificationsToInsert as never[]);

      if (!cancelled && !error) {
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
