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
 */
export function useMedicationAlarms() {
  const { medications } = useMedications();
  const queryClient = useQueryClient();
  const firedRef = useRef<Set<string>>(new Set());
  const decrementedRef = useRef<Set<string>>(new Set());
  const catchUpDoneRef = useRef<Set<string>>(new Set());
  const permissionRef = useRef<NotificationPermission | null>(null);

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

  const decrementStock = useCallback(async (medId: string, amount: number = 1) => {
    try {
      await supabase.rpc("decrement_stock", { med_id: medId, amount });
      queryClient.invalidateQueries({ queryKey: ["medications"] });
    } catch {
      // Silent fail – stock will catch up on next cycle
    }
  }, [queryClient]);

  const fireNotification = useCallback((med: { id: string; name: string; dosage: string | null; estoque_total?: number | null; uso_continuo?: boolean }, key: string, body: string, isLate: boolean) => {
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
      }
    }
  }, [decrementStock]);

  // Catch-up: calculate missed doses since last_stock_decrement and decrement
  const catchUpMissedDoses = useCallback(async (activeMeds: typeof medications) => {
    const now = new Date();

    for (const med of activeMeds) {
      if (med.estoque_total == null || med.estoque_total <= 0) continue;
      if (!med.frequency_hours || med.frequency_hours <= 0) continue;
      if (catchUpDoneRef.current.has(med.id)) continue;
      catchUpDoneRef.current.add(med.id);

      // Determine the reference point: last decrement or start_date
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

      // Check end_date
      if (med.end_date) {
        const endDate = new Date(`${med.end_date}T23:59:59`);
        if (now > endDate) continue; // treatment ended
      }

      const elapsedMs = now.getTime() - refTime.getTime();
      const elapsedHours = elapsedMs / (1000 * 60 * 60);
      const missedDoses = Math.floor(elapsedHours / med.frequency_hours);

      if (missedDoses > 0) {
        const safeDoses = Math.min(missedDoses, med.estoque_total);
        if (safeDoses > 0) {
          await decrementStock(med.id, safeDoses);
        }
      }
    }
  }, [decrementStock, medications]);

  const checkAlarms = useCallback(() => {
    const now = new Date();
    const nowH = now.getHours();
    const nowM = now.getMinutes();
    const todayStr = now.toISOString().slice(0, 10);

    const activeMeds = medications.filter((m) => m.status === "Ativo");

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

      // Exact match: same hour and minute → fire now
      if (doseH === nowH && doseM === nowM) {
        const key = `${med.id}-${todayStr}-${doseH}:${doseM}`;
        const memberName = med.family_members?.name ?? "Você";
        const body = `${memberName}, tome agora: ${med.name}${med.dosage ? ` (${med.dosage})` : ""}`;
        fireNotification(med, key, body, false);
        continue;
      }

      // Late dose: nextDose is in the past but within 30 min window
      if (diffMs > 0 && diffMs <= 30 * 60 * 1000) {
        const lateKey = `${med.id}-${todayStr}-late-${doseH}:${doseM}`;
        const hh = String(doseH).padStart(2, "0");
        const mm = String(doseM).padStart(2, "0");
        const memberName = med.family_members?.name ?? "Você";
        const body = `${memberName}, ${med.name}${med.dosage ? ` (${med.dosage})` : ""} era às ${hh}:${mm}`;
        fireNotification(med, lateKey, body, true);
      }
    }

    // Cleanup old keys daily
    if (firedRef.current.size > 500) {
      firedRef.current.clear();
    }
    if (decrementedRef.current.size > 500) {
      decrementedRef.current.clear();
    }
  }, [medications, fireNotification]);

  // Interval + visibilitychange + catch-up
  useEffect(() => {
    const activeMeds = medications.filter((m) => m.status === "Ativo");
    catchUpMissedDoses(activeMeds);
    checkAlarms();
    const interval = setInterval(checkAlarms, 60_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        catchUpDoneRef.current.clear(); // allow re-check on each app resume
        const active = medications.filter((m) => m.status === "Ativo");
        catchUpMissedDoses(active);
        checkAlarms();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [checkAlarms, catchUpMissedDoses, medications]);
}
