import { parseDateInSP, toSPTime } from "@/lib/dateUtils";
import { useEffect } from "react";
import { useAuth } from "./useAuth";
import { useFamilyGroup } from "./useFamilyGroup";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, differenceInDays } from "date-fns";
import type { CycleRecord } from "@/components/MenstrualCycleDrawer";

const menstrualAlertSessionRuns = new Set<string>();

/**
 * Checks menstrual cycles and creates advance notifications
 * for upcoming periods. Group-wide dedup by family_member_id + type per day.
 */
export function useMenstrualAlerts() {
  const { user } = useAuth();
  const { groupId } = useFamilyGroup();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const todayKey = new Date().toDateString();
    const sessionKey = `${user.id}-menstrual-${todayKey}`;

    if (menstrualAlertSessionRuns.has(sessionKey)) return;
    menstrualAlertSessionRuns.add(sessionKey);

    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;

      const { data: allCycles, error } = await supabase
        .from("menstrual_cycles")
        .select("*")
        .eq("user_id", user.id)
        .order("start_date", { ascending: false });

      if (error || !allCycles || cancelled) return;

      const cycles = allCycles as unknown as (CycleRecord & { familiar_id: string; user_id: string })[];

      const latestByFamiliar = new Map<string, typeof cycles[0]>();
      for (const c of cycles) {
        if (!latestByFamiliar.has(c.familiar_id)) {
          latestByFamiliar.set(c.familiar_id, c);
        }
      }

      const today = new Date();
      today.setHours(12, 0, 0, 0);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // M6: First pass — compute eligible alerts synchronously (no await needed)
      interface PendingAlert { familiarId: string; daysLeft: number }
      const pendingAlerts: PendingAlert[] = [];

      for (const [familiarId, cycle] of latestByFamiliar) {
        if (cycle.alert_advance_days === 0) continue;

        const startDate = toSPTime(parseDateInSP(cycle.start_date) ?? new Date());
        const nextPeriod = addDays(startDate, cycle.cycle_length);
        const alertDate = addDays(nextPeriod, -cycle.alert_advance_days);
        const daysUntilAlert = differenceInDays(alertDate, today);

        if (daysUntilAlert !== 0) continue;
        pendingAlerts.push({ familiarId, daysLeft: cycle.alert_advance_days });
      }

      if (pendingAlerts.length === 0 || cancelled) return;

      // M6: Batch dedup — one SELECT for ALL eligible familiar IDs instead of N individual queries
      const eligibleFamiliarIds = pendingAlerts.map((a) => a.familiarId);
      let dedupQuery = supabase
        .from("notifications")
        .select("family_member_id")
        .eq("type", "menstrual")
        .in("family_member_id", eligibleFamiliarIds)
        .gte("created_at", todayStart.toISOString());

      if (groupId) {
        dedupQuery = dedupQuery.eq("group_id", groupId);
      } else {
        dedupQuery = dedupQuery.eq("user_id", user.id);
      }

      const { data: existingNotifs } = await dedupQuery;
      if (cancelled) return;

      const alreadyNotifiedIds = new Set(existingNotifs?.map((n) => n.family_member_id) ?? []);
      const alertsToInsert = pendingAlerts.filter((a) => !alreadyNotifiedIds.has(a.familiarId));
      if (alertsToInsert.length === 0) return;

      // M6: Batch INSERT — one insert for ALL new notifications instead of N individual inserts
      const notificationsToInsert = alertsToInsert.map(({ familiarId, daysLeft }) => ({
        user_id: user.id,
        family_member_id: familiarId,
        title: "Ciclo Menstrual se Aproxima",
        message: `Faltam ${daysLeft} dia${daysLeft > 1 ? "s" : ""} para o seu próximo ciclo menstrual. Prepare-se e cuide-se!`,
        type: "menstrual",
        scheduled_for: new Date().toISOString(),
        ...(groupId ? { group_id: groupId } : {}),
      }));

      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notificationsToInsert as never[]);

      if (!cancelled && !insertError) {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user, queryClient, groupId]);
}
