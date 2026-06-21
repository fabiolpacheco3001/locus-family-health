import { parseDateInSP } from "@/lib/dateUtils";
import { useEffect, useRef, useCallback } from "react";
import { calculateNextDose } from "@/lib/calculateNextDose";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { Medication } from "./useMedications";
import { captureException } from "@/lib/sentry";

/**
 * Hook that checks every 60s if any active medication dose is due,
 * then fires an in-app toast as foreground feedback.
 *
 * Background push (app closed) is now handled server-side:
 *   pg_cron → send-medication-reminders Edge Function → send-push-notification → Service Worker
 *
 * This hook is responsible for:
 *  1. In-app toast when the app IS open (foreground feedback)
 *  2. Stock decrement when a dose time is reached
 *  3. Catch-up on missed stock decrements at app open
 */

export function useMedicationAlarms(medications: Medication[]) {
  const queryClient = useQueryClient();
  const firedRef = useRef<Set<string>>(new Set());
  const decrementedRef = useRef<Set<string>>(new Set());
  const catchUpDoneRef = useRef(false);
  const medsRef = useRef(medications);
  medsRef.current = medications;

  // Permission request is now handled by usePushSubscription (via Notificações/Ajustes).
  // useMedicationAlarms only handles in-app toasts for when the app is in the foreground.

  const decrementStock = useCallback(async (medId: string, amount: number = 1) => {
    try {
      await supabase.rpc("decrement_stock", { med_id: medId, amount });
    } catch (err) {
      // Observabilidade: não retry, apenas log estruturado + Sentry
      console.error("[useMedicationAlarms] decrement_stock failed", {
        medId,
        amount,
        error: err instanceof Error ? err.message : String(err),
      });
      captureException(err, { context: "decrement_stock", medId, amount });
    }
  }, []);

  const scheduleRefresh = useCallback(() => {
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["medications"] });
    }, 5000);
  }, [queryClient]);

  const fireNotification = useCallback((med: { id: string; name: string; dosage: string | null; estoque_total?: number | null }, key: string, body: string, isLate: boolean) => {
    if (firedRef.current.has(key)) return;
    firedRef.current.add(key);

    // In-app toast (foreground only). Background push is handled server-side
    // by send-medication-reminders → send-push-notification → Service Worker.
    if (isLate) {
      toast.warning(`⚠️ Dose Atrasada!`, { description: body, duration: 20000 });
    } else {
      toast.error(`💊 Hora do Remédio!`, { description: body, duration: 15000 });
    }

    if (med.estoque_total != null && med.estoque_total > 0) {
      const decKey = `${med.id}-${key}`;
      if (!decrementedRef.current.has(decKey)) {
        decrementedRef.current.add(decKey);
        decrementStock(med.id, 1);
        scheduleRefresh();
      }
    }
  }, [decrementStock, scheduleRefresh]);

  // Catch-up missed doses on mount
  useEffect(() => {
    if (catchUpDoneRef.current) return;
    if (medications.length === 0) return;
    catchUpDoneRef.current = true;

    const runCatchUp = async () => {
      const now = new Date();
      const decrements: { id: string; amount: number }[] = [];

      for (const med of medications) {
        if (med.status !== "Ativo") continue;
        if (med.estoque_total == null || med.estoque_total <= 0) continue;

        const effFreqType = (med.frequency_type as string) || "fixed_interval";
        const isSpecificTimes = effFreqType === "specific_times" ||
          (Array.isArray(med.specific_times) && med.specific_times.length > 0);
        const isSpecificDays = effFreqType === "specific_days" ||
          (Array.isArray(med.specific_days) && med.specific_days.length > 0);
        const isSpecific = isSpecificTimes || isSpecificDays;

        // ── FIXED INTERVAL: legacy hourly loop ──────────────────────────────
        if (!isSpecific) {
          if (!med.frequency_hours || med.frequency_hours <= 0) continue;

          let refTime: Date | null = null;
          if (med.last_stock_decrement) {
            refTime = new Date(med.last_stock_decrement);
          } else if (med.start_date) {
            const dateOnly = med.start_date.slice(0, 10);
            refTime = med.start_time
              ? new Date(`${dateOnly}T${med.start_time}`)
              : parseDateInSP(dateOnly) ?? new Date();
          }

          if (!refTime || isNaN(refTime.getTime())) continue;
          if (refTime >= now) continue;

          if (med.end_date) {
            const endDate = new Date(`${med.end_date}T23:59:59`);
            if (now > endDate) continue;
          }

          const elapsedHours = (now.getTime() - refTime.getTime()) / (1000 * 60 * 60);
          const isFirstRun = !med.last_stock_decrement;
          const missedDoses = Math.floor(elapsedHours / med.frequency_hours) + (isFirstRun ? 1 : 0);

          if (missedDoses > 0) {
            const safeDoses = Math.min(missedDoses, med.estoque_total);
            if (safeDoses > 0) {
              decrements.push({ id: med.id, amount: safeDoses });
            }
          }
          continue;
        }

        // ── SPECIFIC TIMES / SPECIFIC DAYS: count missed slots ───────────────
        // Reference: last_stock_decrement if set, otherwise start_date
        const dateOnly = med.start_date?.slice(0, 10);
        const startDateISO = dateOnly && med.start_time
          ? `${dateOnly}T${med.start_time}`
          : (dateOnly ?? null);

        const refTime = med.last_stock_decrement
          ? new Date(med.last_stock_decrement)
          : (startDateISO ? parseDateInSP(startDateISO) : null);

        if (!refTime || isNaN(refTime.getTime())) continue;
        if (refTime >= now) continue;

        if (med.end_date) {
          const endDate = new Date(`${med.end_date}T23:59:59`);
          if (now > endDate) continue;
        }

        // Walk forward from refTime, counting slots that have already passed
        // without being recorded. Cap at 60 to avoid runaway loops.
        let cursor = refTime;
        let missedCount = 0;
        const MAX_ITER = 60;
        let iter = 0;
        while (iter < MAX_ITER) {
          const next = calculateNextDose(
            startDateISO,
            null,
            med.end_date,
            cursor,
            effFreqType,
            med.specific_times as string[] | null,
            med.specific_days as number[] | null,
          );
          if (!next || next >= now) break;
          missedCount++;
          cursor = next;
          iter++;
        }

        if (missedCount > 0) {
          const safeDoses = Math.min(missedCount, med.estoque_total);
          if (safeDoses > 0) {
            decrements.push({ id: med.id, amount: safeDoses });
          }
        }
      }

      // Batch all decrements in parallel
      if (decrements.length > 0) {
        await Promise.all(decrements.map((d) => decrementStock(d.id, d.amount)));
        scheduleRefresh();
      }
    };

    runCatchUp();
  }, [medications, decrementStock, scheduleRefresh]);

  // Check alarms every 60s
  useEffect(() => {
    const checkAlarms = () => {
      const now = new Date();
      const nowH = now.getHours();
      const nowM = now.getMinutes();
      const todayStr = now.toISOString().slice(0, 10);
      const currentMeds = medsRef.current;
      const activeMeds = currentMeds.filter((m) => m.status === "Ativo");

      for (const med of activeMeds) {
        const dateOnly = med.start_date?.slice(0, 10);
        let startDateISO: string | null = null;
        if (dateOnly && med.start_time) {
          startDateISO = `${dateOnly}T${med.start_time}`;
        } else if (dateOnly) {
          startDateISO = dateOnly;
        }

        const nextDose = calculateNextDose(startDateISO, med.frequency_hours, med.end_date, undefined, med.frequency_type, med.specific_times as string[] | null, med.specific_days as number[] | null);
        if (!nextDose) continue;

        const doseH = nextDose.getHours();
        const doseM = nextDose.getMinutes();
        const diffMs = now.getTime() - nextDose.getTime();

        if (doseH === nowH && doseM === nowM) {
          const key = `${med.id}-${todayStr}-${doseH}:${doseM}`;
          const memberName = med.family_members?.name ?? "Você";
          const body = `${memberName}, tome agora: ${med.name}${med.dosage ? ` (${med.dosage})` : ""}`;
          fireNotification(med, key, body, false);
          continue;
        }

        if (diffMs > 0 && diffMs <= 30 * 60 * 1000) {
          const lateKey = `${med.id}-${todayStr}-late-${doseH}:${doseM}`;
          const hh = String(doseH).padStart(2, "0");
          const mm = String(doseM).padStart(2, "0");
          const memberName = med.family_members?.name ?? "Você";
          const body = `${memberName}, ${med.name}${med.dosage ? ` (${med.dosage})` : ""} era às ${hh}:${mm}`;
          fireNotification(med, lateKey, body, true);
        }
      }

      if (firedRef.current.size > 500) firedRef.current.clear();
      if (decrementedRef.current.size > 500) decrementedRef.current.clear();
    };

    // Defer first check to unblock main thread for First Paint
    const initialTimeout = setTimeout(checkAlarms, 150);
    const interval = setInterval(checkAlarms, 60_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // Note: catchUpDoneRef is intentionally NOT reset here.
        // Resetting it caused a cascade: visibility change → catch-up → stock decrement
        // → scheduleRefresh → invalidateQueries → re-render → repeat.
        // checkAlarms() alone is sufficient to fire any due doses on return.
        checkAlarms();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fireNotification]);
}
