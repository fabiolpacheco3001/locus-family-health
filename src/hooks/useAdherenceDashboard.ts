import { useMemo } from "react";
import {
  subDays,
  startOfDay,
  endOfDay,
  isSameDay,
  format,
  eachDayOfInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toSPTime } from "@/lib/dateUtils";

export interface DoseEntry {
  id?: string;
  medication_id?: string;
  medication_name: string;
  scheduled_for: string;
  status: string;
  isVirtual?: boolean;
}

export type AdherencePeriod = "7d" | "30d" | "90d" | "all";

export interface MedStat {
  name: string;
  taken: number;
  total: number;
  taxa: number;
}

export interface HeatmapDay {
  date: Date;
  label: string;
  color: string;
  taken: number;
  total: number;
}

export interface WeeklyEntry {
  label: string;
  taxa: number;
}

export interface InsightData {
  text: string;
  type: "success" | "warning" | "info" | "danger";
}

export interface AdherenceDashboardData {
  taxa: number;
  tomadas: number;
  total: number;
  streak: number;
  bestStreak: number;
  weeklyData: WeeklyEntry[];
  heatmapData: HeatmapDay[];
  medBreakdown: MedStat[];
  insight: InsightData;
}

function getPeriodStart(period: AdherencePeriod): Date | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return startOfDay(subDays(new Date(), days - 1));
}

function barColor(taxa: number): string {
  if (taxa >= 70) return "#78C2AD";
  if (taxa >= 40) return "#f5c04e";
  if (taxa > 0) return "#f09595";
  return "#e0ddd8";
}

export function useAdherenceDashboard(
  allDoses: DoseEntry[],
  period: AdherencePeriod
): AdherenceDashboardData {
  return useMemo(() => {
    const now = toSPTime(new Date());
    const periodStart = getPeriodStart(period);

    // Filter by period
    const filtered = periodStart
      ? allDoses.filter((d) => toSPTime(new Date(d.scheduled_for)) >= periodStart)
      : allDoses;

    const tomadas = filtered.filter((d) => d.status === "taken").length;
    const total = filtered.length;
    const taxa = total > 0 ? Math.round((tomadas / total) * 100) : 0;

    // ── Streak ──────────────────────────────────────────────────────────────
    // Consecutive days going back from today where at least 1 dose was taken.
    // Days with no scheduled doses are skipped (don't break the streak).
    let streak = 0;
    let checkDay = startOfDay(now);
    for (let i = 0; i < 180; i++) {
      const dayDoses = allDoses.filter((d) =>
        isSameDay(toSPTime(new Date(d.scheduled_for)), checkDay)
      );
      if (dayDoses.length === 0) {
        // No doses scheduled — skip without breaking
        checkDay = subDays(checkDay, 1);
        continue;
      }
      const takenToday = dayDoses.filter((d) => d.status === "taken").length;
      if (takenToday === 0) break;
      streak++;
      checkDay = subDays(checkDay, 1);
    }

    // ── Heatmap — last 14 days ──────────────────────────────────────────────
    const heatDays = eachDayOfInterval({
      start: subDays(startOfDay(now), 13),
      end: startOfDay(now),
    });
    const heatmapData: HeatmapDay[] = heatDays.map((day) => {
      const dayDoses = allDoses.filter((d) =>
        isSameDay(toSPTime(new Date(d.scheduled_for)), day)
      );
      const takenDay = dayDoses.filter((d) => d.status === "taken").length;
      const totalDay = dayDoses.length;
      let color = "#e8e5e0"; // gray — no doses
      if (totalDay > 0) {
        if (takenDay === totalDay) color = "#78C2AD"; // green — all taken
        else if (takenDay > 0) color = "#f5c04e";     // yellow — partial
        else color = "#f09595";                        // red — none taken
      }
      return {
        date: day,
        label: format(day, "d", { locale: ptBR }),
        color,
        taken: takenDay,
        total: totalDay,
      };
    });

    // ── Weekly trend ────────────────────────────────────────────────────────
    const numWeeks = period === "7d" ? 4 : period === "30d" ? 8 : 12;
    const weeklyData: WeeklyEntry[] = [];
    for (let w = numWeeks - 1; w >= 0; w--) {
      const weekEnd = endOfDay(subDays(now, w * 7));
      const weekStart = startOfDay(subDays(weekEnd, 6));
      const weekDoses = allDoses.filter((d) => {
        const dt = toSPTime(new Date(d.scheduled_for));
        return dt >= weekStart && dt <= weekEnd;
      });
      const wTaken = weekDoses.filter((d) => d.status === "taken").length;
      const wTotal = weekDoses.length;
      const wTaxa = wTotal > 0 ? Math.round((wTaken / wTotal) * 100) : 0;
      const label =
        period === "90d" || period === "all"
          ? format(weekStart, "d/MM", { locale: ptBR })
          : format(weekStart, "d MMM", { locale: ptBR });
      weeklyData.push({ label, taxa: wTaxa });
    }

    // ── Per-medication breakdown ────────────────────────────────────────────
    const medMap: Record<string, { taken: number; total: number }> = {};
    for (const d of filtered) {
      if (!medMap[d.medication_name]) medMap[d.medication_name] = { taken: 0, total: 0 };
      medMap[d.medication_name].total++;
      if (d.status === "taken") medMap[d.medication_name].taken++;
    }
    const medBreakdown: MedStat[] = Object.entries(medMap)
      .map(([name, s]) => ({
        name,
        taken: s.taken,
        total: s.total,
        taxa: s.total > 0 ? Math.round((s.taken / s.total) * 100) : 0,
      }))
      .sort((a, b) => b.taxa - a.taxa);

    // ── Contextual insight ──────────────────────────────────────────────────
    let insight: InsightData;
    if (streak >= 7) {
      insight = {
        text: `${streak} dias seguidos de adesão! Sequência incrível — continue assim.`,
        type: "success",
      };
    } else if (streak >= 3) {
      insight = {
        text: `${streak} dias seguidos de adesão. Você está ganhando ritmo!`,
        type: "success",
      };
    } else {
      const zeroMeds = medBreakdown.filter((m) => m.taxa === 0 && m.total > 2);
      const worstMed = medBreakdown
        .filter((m) => m.total > 5 && m.taxa > 0)
        .sort((a, b) => a.taxa - b.taxa)[0];

      if (zeroMeds.length >= 3) {
        insight = {
          text: `${zeroMeds.length} medicamentos com 0% de adesão no período. Revise com seu médico.`,
          type: "danger",
        };
      } else if (zeroMeds.length > 0) {
        insight = {
          text: `${zeroMeds[0].name} está com 0% no período. Ainda está em uso?`,
          type: "warning",
        };
      } else if (worstMed && worstMed.taxa < 30) {
        insight = {
          text: `${worstMed.name} tem apenas ${worstMed.taxa}% de adesão. É seu maior desafio.`,
          type: "warning",
        };
      } else if (taxa >= 80) {
        insight = {
          text: `Ótima adesão! ${tomadas} de ${total} doses tomadas no período.`,
          type: "success",
        };
      } else {
        insight = {
          text: `Cada dose conta para seu tratamento. Vamos melhorar juntos!`,
          type: "info",
        };
      }
    }

    return { taxa, tomadas, total, streak, weeklyData, heatmapData, medBreakdown, insight };
  }, [allDoses, period]);
}

export { barColor };
