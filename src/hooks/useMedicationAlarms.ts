import { useEffect, useRef, useCallback } from "react";
import { useMedications } from "./useMedications";
import { calculateNextDose } from "@/lib/calculateNextDose";
import { toast } from "sonner";

/**
 * Hook that checks every 60s if any active medication dose is due,
 * then fires both an OS Notification and an in-app toast.
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
    // default → ask
    Notification.requestPermission().then((perm) => {
      permissionRef.current = perm;
      if (perm === "denied") {
        toast.warning("Ative as notificações no seu navegador para receber os alertas de medicamentos.", { duration: 6000 });
      }
    });
  }, []);

  const checkAlarms = useCallback(() => {
    const now = new Date();
    const nowH = now.getHours();
    const nowM = now.getMinutes();

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

      // Same hour and minute → fire
      if (doseH === nowH && doseM === nowM) {
        // Dedup key: medId + hour:minute of this specific dose
        const key = `${med.id}-${doseH}:${doseM}`;
        if (firedRef.current.has(key)) continue;
        firedRef.current.add(key);

        const body = `Tome agora: ${med.name}${med.dosage ? ` (${med.dosage})` : ""}`;

        // 1. OS Notification
        if (permissionRef.current === "granted") {
          try {
            if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
              navigator.serviceWorker.ready.then((reg) => {
                reg.showNotification("Hora do Remédio! 💊", {
                  body,
                  icon: "/logo-locus-vita.svg",
                  tag: key,
                });
              });
            } else {
              new Notification("Hora do Remédio! 💊", {
                body,
                icon: "/logo-locus-vita.svg",
                tag: key,
              });
            }
          } catch {
            // Fallback silently to toast only
          }
        }

        // 2. In-App Toast (always fires)
        toast.error(`💊 Hora do Remédio!`, {
          description: body,
          duration: 15000,
        });
      }
    }

    // Cleanup old keys every hour to avoid memory leak
    if (firedRef.current.size > 500) {
      firedRef.current.clear();
    }
  }, [medications]);

  useEffect(() => {
    // Initial check
    checkAlarms();

    // Check every 60 seconds
    const interval = setInterval(checkAlarms, 60_000);
    return () => clearInterval(interval);
  }, [checkAlarms]);
}
