import { useEffect, useRef, useCallback } from "react";
import { useMedications } from "./useMedications";
import { calculateNextDose } from "@/lib/calculateNextDose";
import { toast } from "sonner";

/**
 * Hook that checks every 60s if any active medication dose is due,
 * then fires both an OS Notification and an in-app toast.
 * Also detects late doses when the app regains visibility.
 */
export function useMedicationAlarms() {
  const { medications } = useMedications();
  const firedRef = useRef<Set<string>>(new Set());
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

  const fireNotification = useCallback((med: { id: string; name: string; dosage: string | null }, key: string, body: string, isLate: boolean) => {
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
  }, []);

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
  }, [medications, fireNotification]);

  // Interval + visibilitychange
  useEffect(() => {
    checkAlarms();
    const interval = setInterval(checkAlarms, 60_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        checkAlarms();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [checkAlarms]);
}
