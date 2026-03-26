import { useEffect, useRef, useCallback } from "react";
import { calculateNextDose } from "@/lib/calculateNextDose";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { Medication } from "./useMedications";

/**
 * Hook that checks every 60s if any active medication dose is due,
 * then fires both an OS Notification and an in-app toast.
 * Receives medications externally to avoid duplicate useQuery calls.
 */
let permissionToastShown = false;

export function useMedicationAlarms(medications: Medication[]) {
  const queryClient = useQueryClient();
  const firedRef = useRef<Set<string>>(new Set());
  const decrementedRef = useRef<Set<string>>(new Set());
  const catchUpDoneRef = useRef(false);
  const permissionRef = useRef<NotificationPermission | null>(null);
  const medsRef = useRef(medications);
  medsRef.current = medications;

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
      permissionRef.current = "granted";
      return;
    }
    if (Notification.permission === "denied") {
      permissionRef.current = "denied";
      if (!permissionToastShown) {
        permissionToastShown = true;
        toast.warning("Ative as notificações no seu navegador para receber os alertas de medicamentos.", { duration: 6000 });
      }
      return;
    }
    Notification.requestPermission().then((perm) => {
      permissionRef.current = perm;
      if (perm === "denied" && !permissionToastShown) {
        permissionToastShown = true;
        toast.warning("Ative as notificações no seu navegador para receber os alertas de medicamentos.", { duration: 6000 });
      }
    });
  }, []);

  const decrementStock = useCallback(async (medId: string, amount: number = 1) => {
    try {
      await supabase.rpc("decrement_stock", { med_id: medId, amount });
    } catch {
      // Silent fail
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

    const title = isLate ? "⚠️ Dose Atrasada!" : "Hora do Remédio! 💊";

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
        // Fallback silently
      }
    }

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
        if (!med.frequency_hours || med.frequency_hours <= 0) continue;

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
        const isFirstRun = !med.last_stock_decrement;
        const missedDoses = Math.floor(elapsedHours / med.frequency_hours) + (isFirstRun ? 1 : 0);

        if (missedDoses > 0) {
          const safeDoses = Math.min(missedDoses, med.estoque_total);
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

      if (firedRef.current.size > 500) firedRef.current.clear();
      if (decrementedRef.current.size > 500) decrementedRef.current.clear();
    };

    // Defer first check to unblock main thread for First Paint
    const initialTimeout = setTimeout(checkAlarms, 150);
    const interval = setInterval(checkAlarms, 60_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        catchUpDoneRef.current = false;
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
