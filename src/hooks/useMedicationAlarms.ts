import { useEffect, useRef, useCallback } from "react";
import { useMedications } from "./useMedications";
import { calculateNextDose } from "@/lib/calculateNextDose";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook that checks every 60s if any active medication dose is due,
 * then fires both an OS Notification and an in-app toast.
 * Also detects late doses when the app regains visibility.
 * Decrements stock on alarm fire + catches up missed doses on app resume.
 */
export function useMedicationAlarms() {
  const { medications } = useMedications();
  const queryClient = useQueryClient();
  const firedRef = useRef<Set<string>>(new Set());
  const decrementedRef = useRef<Set<string>>(new Set());
  const catchUpDoneRef = useRef(false);
  const permissionRef = useRef<NotificationPermission | null>(null);
  // Keep a stable ref to medications to avoid dependency cycles
  const medsRef = useRef(medications);
  medsRef.current = medications;

  // Request permission once on mount
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
      permissionRef.current = "granted";
      return;
    }
    if (Notification.permission === "denied") {
      permissionRef.current = "denied";
      toast.warning("Ative as notificações no seu navegador para receber os alertas de medicamentos.", { duration: 6000 });
      return;
    }
    Notification.requestPermission().then((perm) => {
      permissionRef.current = perm;
      if (perm === "denied") {
        toast.warning("Ative as notificações no seu navegador para receber os alertas de medicamentos.", { duration: 6000 });
      }
    });
  }, []);

  // Silent decrement – does NOT invalidate queries to avoid loops
  const decrementStock = useCallback(async (medId: string, amount: number = 1) => {
    try {
      await supabase.rpc("decrement_stock", { med_id: medId, amount });
    } catch {
      // Silent fail
    }
  }, []);

  // Delayed refresh after decrements are done (single debounced call)
  const scheduleRefresh = useCallback(() => {
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["medications"] });
    }, 5000); // 5s delay to batch and avoid loops
  }, [queryClient]);

  const fireNotification = useCallback((med: { id: string; name: string; dosage: string | null; estoque_total?: number | null }, key: string, body: string, isLate: boolean) => {
    if (firedRef.current.has(key)) return;
    firedRef.current.add(key);

    const title = isLate ? "⚠️ Dose Atrasada!" : "Hora do Remédio! 💊";

    // OS Notification
    if (permissionRef.current === "granted") {
      try {
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, { body, icon: "/logo-locus-vita.svg", tag: key });
          });
        } else {
          new Notification(title, { body, icon: "/logo-locus-vita.svg", tag: key });
        }
      } catch {
        // Fallback silently to toast only
      }
    }

    // In-App Toast
    if (isLate) {
      toast.warning(`⚠️ Dose Atrasada!`, { description: body, duration: 20000 });
    } else {
      toast.error(`💊 Hora do Remédio!`, { description: body, duration: 15000 });
    }

    // Decrement stock by 1 on alarm fire (if has stock tracking)
    if (med.estoque_total != null && med.estoque_total > 0) {
      const decKey = `${med.id}-${key}`;
      if (!decrementedRef.current.has(decKey)) {
        decrementedRef.current.add(decKey);
        decrementStock(med.id, 1);
        scheduleRefresh();
      }
    }
  }, [decrementStock, scheduleRefresh]);

  // Catch-up on mount: calculate missed doses since last_stock_decrement
  useEffect(() => {
    if (catchUpDoneRef.current) return;
    if (medications.length === 0) return;
    catchUpDoneRef.current = true;

    const runCatchUp = async () => {
      const now = new Date();
      let didDecrement = false;

      for (const med of medications) {
        if (med.status !== "Ativo") continue;
        if (med.estoque_total == null || med.estoque_total <= 0) continue;
        if (!med.frequency_hours || med.frequency_hours <= 0) continue;

        // Determine reference point
        let refTime: Date | null = null;
        if (med.last_stock_decrement) {
          refTime = new Date(med.last_stock_decrement);
        } else if (med.start_date) {
          const dateOnly = med.start_date.slice(0, 10);
          refTime = med.start_time
            ? new Date(`${dateOnly}T${med.start_time}`)
            : new Date(`${dateOnly}T12:00:00`);
        }

        if (!refTime || isNaN(refTime.getTime())) continue;
        if (refTime >= now) continue;

        if (med.end_date) {
          const endDate = new Date(`${med.end_date}T23:59:59`);
          if (now > endDate) continue;
        }

        const elapsedHours = (now.getTime() - refTime.getTime()) / (1000 * 60 * 60);
        const missedDoses = Math.floor(elapsedHours / med.frequency_hours);

        if (missedDoses > 0) {
          const safeDoses = Math.min(missedDoses, med.estoque_total);
          if (safeDoses > 0) {
            await decrementStock(med.id, safeDoses);
            didDecrement = true;
          }
        }
      }

      if (didDecrement) {
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
          startDateISO = `${dateOnly}T12:00:00`;
        }

        const nextDose = calculateNextDose(startDateISO, med.frequency_hours, med.end_date);
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

      // Cleanup old keys
      if (firedRef.current.size > 500) firedRef.current.clear();
      if (decrementedRef.current.size > 500) decrementedRef.current.clear();
    };

    checkAlarms();
    const interval = setInterval(checkAlarms, 60_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // Reset catch-up flag so it re-runs on next medications load
        catchUpDoneRef.current = false;
        checkAlarms();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fireNotification]);
}
