import { useState, useEffect, useMemo } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Share2, CheckCircle, XCircle, Clock3, Flame, Trophy, TrendingUp, AlertTriangle, Info, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, endOfDay, startOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toSPTime } from "@/lib/dateUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import {
  useAdherenceDashboard,
  barColor,
  type AdherencePeriod,
  type DoseEntry,
} from "@/hooks/useAdherenceDashboard";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMemberId: string;
  memberName: string;
  emitterName: string;
}

const PERIODS: { key: AdherencePeriod; label: string }[] = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "all", label: "Tudo" },
];

const CIRC = 2 * Math.PI * 28; // r=28 on a 72×72 viewBox

const insightConfig = {
  success: { bg: "bg-emerald-50", text: "text-emerald-900", border: "border-emerald-200", Icon: Flame, iconClass: "text-emerald-600" },
  warning: { bg: "bg-amber-50", text: "text-amber-900", border: "border-amber-200", Icon: AlertTriangle, iconClass: "text-amber-500" },
  info: { bg: "bg-blue-50", text: "text-blue-900", border: "border-blue-200", Icon: TrendingUp, iconClass: "text-blue-500" },
  danger: { bg: "bg-red-50", text: "text-red-900", border: "border-red-200", Icon: AlertTriangle, iconClass: "text-red-500" },
};

const medBarColor = (taxa: number) => barColor(taxa);
const medTextColor = (taxa: number) => {
  if (taxa >= 70) return "text-emerald-700";
  if (taxa >= 40) return "text-amber-700";
  if (taxa > 0) return "text-red-600";
  return "text-muted-foreground";
};

const AdherenceHistoryDrawer = ({ open, onOpenChange, familyMemberId, memberName, emitterName }: Props) => {
  const [period, setPeriod] = useState<AdherencePeriod>("7d");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch("/logo-locus-vita-pdf.png")
      .then((r) => r.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => setLogoBase64(reader.result as string);
        reader.readAsDataURL(blob);
      })
      .catch(() => {});
  }, []);

  const { data: rawData, isLoading } = useQuery({
    queryKey: ["adherence_history", familyMemberId],
    queryFn: async () => {
      const { data: meds, error: medsErr } = await supabase
        .from("medications")
        .select("id, name, start_date, start_time, frequency_hours, end_date, uso_continuo, frequency_type, specific_times, specific_days")
        .eq("family_member_id", familyMemberId);
      if (medsErr) throw medsErr;
      if (!meds || meds.length === 0) return { meds: [], doses: [] };

      const medIds = meds.map((m) => m.id);
      const { data: doseData, error: doseErr } = await supabase
        .from("medication_doses")
        .select("*")
        .in("medication_id", medIds)
        .order("scheduled_for", { ascending: false });
      if (doseErr) throw doseErr;

      return { meds, doses: doseData ?? [] };
    },
    enabled: open,
    staleTime: 30 * 1000,
  });

  // Build allDoses — real + virtual "forgotten"
  const allDoses: DoseEntry[] = useMemo(() => {
    if (!rawData) return [];
    const { meds, doses } = rawData;

    const medMap: Record<string, string> = {};
    for (const m of meds) medMap[m.id] = m.name;

    const realDoses: DoseEntry[] = doses.map((d: any) => ({
      ...d,
      medication_name: medMap[d.medication_id] || "Desconhecido",
      isVirtual: false,
    }));

    const existingKeys = new Set<string>();
    for (const d of doses) {
      existingKeys.add(`${d.medication_id}-${new Date(d.scheduled_for).toISOString()}`);
    }

    const cutoff = new Date();
    const virtualDoses: DoseEntry[] = [];
    for (const med of meds) {
      if (!med.start_date) continue;

      const freqType: string = (med as any).frequency_type || "interval";
      const dateOnly = med.start_date.slice(0, 10);
      const startStr = med.start_time ? `${dateOnly}T${med.start_time}` : `${dateOnly}T00:00:00`;
      const start = new Date(startStr);
      if (isNaN(start.getTime())) continue;

      const endLimit = med.end_date
        ? new Date(med.end_date.length === 10 ? med.end_date + "T23:59:59" : med.end_date)
        : cutoff;
      const effectiveEnd = endLimit < cutoff ? endLimit : cutoff;
      const medName = medMap[med.id] || "Desconhecido";

      // interval (legado / fixed_interval)
      if (freqType === "interval" || freqType === "fixed_interval" || !med.frequency_type) {
        if (!med.frequency_hours || med.frequency_hours <= 0) continue;
        let cursor = new Date(start.getTime());
        let safety = 50000;
        while (cursor <= effectiveEnd && safety > 0) {
          safety--;
          const key = `${med.id}-${cursor.toISOString()}`;
          if (!existingKeys.has(key)) {
            virtualDoses.push({
              medication_name: medName,
              scheduled_for: cursor.toISOString(),
              status: "forgotten",
              isVirtual: true,
            });
          }
          cursor = new Date(cursor.getTime() + med.frequency_hours * 60 * 60 * 1000);
        }
        continue;
      }

      // specific_times: doses nos mesmos horários todos os dias
      if (freqType === "specific_times") {
        const times: string[] = Array.isArray((med as any).specific_times) ? (med as any).specific_times : [];
        if (times.length === 0) continue;
        let dayCursor = startOfDay(start);
        while (dayCursor <= effectiveEnd) {
          const dateStr = format(dayCursor, "yyyy-MM-dd");
          for (const timeStr of times) {
            const dt = new Date(`${dateStr}T${timeStr}`);
            if (isNaN(dt.getTime()) || dt < start || dt > effectiveEnd) continue;
            const key = `${med.id}-${dt.toISOString()}`;
            if (!existingKeys.has(key)) {
              virtualDoses.push({
                medication_name: medName,
                scheduled_for: dt.toISOString(),
                status: "forgotten",
                isVirtual: true,
              });
            }
          }
          dayCursor = addDays(dayCursor, 1);
        }
        continue;
      }

      // specific_days: doses em dias da semana específicos + horários
      if (freqType === "specific_days") {
        const times: string[] = Array.isArray((med as any).specific_times) ? (med as any).specific_times : [];
        const days: number[] = Array.isArray((med as any).specific_days) ? (med as any).specific_days : [];
        if (times.length === 0 || days.length === 0) continue;
        let dayCursor = startOfDay(start);
        while (dayCursor <= effectiveEnd) {
          const dow = dayCursor.getDay();
          if (days.includes(dow)) {
            const dateStr = format(dayCursor, "yyyy-MM-dd");
            for (const timeStr of times) {
              const dt = new Date(`${dateStr}T${timeStr}`);
              if (isNaN(dt.getTime()) || dt < start || dt > effectiveEnd) continue;
              const key = `${med.id}-${dt.toISOString()}`;
              if (!existingKeys.has(key)) {
                virtualDoses.push({
                  medication_name: medName,
                  scheduled_for: dt.toISOString(),
                  status: "forgotten",
                  isVirtual: true,
                });
              }
            }
          }
          dayCursor = addDays(dayCursor, 1);
        }
        continue;
      }
    }

    return [...realDoses, ...virtualDoses].sort(
      (a, b) => new Date(b.scheduled_for).getTime() - new Date(a.scheduled_for).getTime()
    );
  }, [rawData]);

  const dashboard = useAdherenceDashboard(allDoses, period);
  const {
    taxa = 0,
    tomadas = 0,
    total = 0,
    streak = 0,
    bestStreak = 0,
    weeklyData = [],
    chartLabel = "Evolução",
    heatmapData = [],
    medBreakdown = [],
    insight = { text: "", type: "info" as const },
  } = dashboard ?? {};

  // Period-filtered doses for PDF export
  const periodFilteredDoses = useMemo(() => {
    if (period === "all") return allDoses;
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const cutoff = startOfDay(subDays(new Date(), days - 1));
    return allDoses.filter((d) => toSPTime(new Date(d.scheduled_for)) >= cutoff);
  }, [allDoses, period]);

  const handleExportPdf = async () => {
    if (allDoses.length === 0) { toast.error("Nenhum registro para exportar."); return; }
    setGenerating(true);
    try {
      const { generateAdherencePdf } = await import("@/lib/generateAdherencePdf");
      const blob = generateAdherencePdf({
        memberName,
        emitterName,
        period,
        taxa,
        tomadas,
        total,
        streak,
        insight,
        weeklyData,
        heatmapData,
        medBreakdown,
        doses: periodFilteredDoses,
        logoBase64,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `adesao-${memberName.split(" ")[0].toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF gerado com sucesso!");
    } catch {
      toast.error("Erro ao gerar PDF.");
    } finally {
      setGenerating(false);
    }
  };

  const filled = (taxa / 100) * CIRC;
  const ic = insightConfig[insight.type];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        {/* Header — alinhado à esquerda + Share2 na mesma linha */}
        <DrawerHeader className="text-left pb-2 px-4">
          <div className="flex items-center justify-between">
            <DrawerTitle>Adesão medicamentosa</DrawerTitle>
            {allDoses.length > 0 && (
              <button
                onClick={handleExportPdf}
                disabled={generating}
                title={`Exportar PDF — ${PERIODS.find(p => p.key === period)?.label ?? period}`}
                className="p-2 rounded-full text-[#78C2AD] hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                <Share2 size={18} />
              </button>
            )}
          </div>
        </DrawerHeader>

        <div className="px-4 pb-8 overflow-y-auto space-y-3">

          {/* Period tabs */}
          <div className="flex gap-1.5">
            {PERIODS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`flex-1 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  period === key
                    ? "bg-foreground text-background"
                    : "border border-border text-muted-foreground bg-card"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : allDoses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Nenhuma dose registrada ainda.
            </p>
          ) : (
            <>
              {/* Main stats card */}
              <div className="bg-card rounded-xl border border-border/50 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Taxa de adesão</p>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-5xl font-medium text-foreground leading-none">{taxa}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{tomadas} de {total} doses tomadas</p>
                  </div>
                  {/* Donut ring */}
                  <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
                    <circle cx="36" cy="36" r="28" fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
                    <circle
                      cx="36" cy="36" r="28"
                      fill="none"
                      stroke="#78C2AD"
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={`${filled.toFixed(1)} ${(CIRC - filled).toFixed(1)}`}
                      strokeDashoffset={CIRC / 4}
                      transform="rotate(-90 36 36)"
                    />
                    <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="500" fill="#78C2AD">
                      {taxa}%
                    </text>
                  </svg>
                </div>

                {/* Streak */}
                {(streak > 0 || bestStreak > 0) && (
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                    {streak > 0 && (
                      <div className="flex items-center gap-2">
                        <Flame size={16} className="text-orange-400 shrink-0" />
                        <span className="text-sm font-medium text-foreground">
                          {streak} {streak === 1 ? "dia" : "dias"} seguidos
                        </span>
                        <span className="text-xs text-muted-foreground">— sequência atual</span>
                      </div>
                    )}
                    {bestStreak > streak && (
                      <div className="flex items-center gap-2">
                        <Trophy size={14} className="text-amber-500 shrink-0" />
                        <span className="text-xs text-muted-foreground">
                          Recorde:{" "}
                          <span className="font-medium text-foreground">
                            {bestStreak} {bestStreak === 1 ? "dia" : "dias"}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Insight */}
              <div className={`rounded-xl border p-3 flex items-start gap-2.5 ${ic.bg} ${ic.border}`}>
                <ic.Icon size={16} className={`${ic.iconClass} shrink-0 mt-0.5`} />
                <p className={`text-sm leading-snug ${ic.text}`}>{insight.text}</p>
              </div>

              {/* Weekly trend */}
              <div className="bg-card rounded-xl border border-border/50 p-4">
                <p className="text-xs font-medium text-foreground mb-3">{chartLabel}</p>
                <div style={{ height: 110 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData} barSize={weeklyData.length > 8 ? 8 : 14} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                        interval={weeklyData.length > 8 ? 1 : 0}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v}%`}
                        ticks={[0, 25, 50, 75, 100]}
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value}%`, "Adesão"]}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                        cursor={{ fill: "hsl(var(--muted))", radius: 4 }}
                      />
                      <Bar dataKey="taxa" radius={[4, 4, 0, 0]}>
                        {weeklyData.map((entry, index) => (
                          <Cell key={index} fill={barColor(entry.taxa)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Heatmap — last 14 days */}
              <div className="bg-card rounded-xl border border-border/50 p-4">
                <div className="flex justify-between items-baseline mb-3">
                  <p className="text-xs font-medium text-foreground">Últimos 14 dias</p>
                  <p className="text-xs text-muted-foreground">
                    {format(heatmapData[0]?.date ?? new Date(), "MMM yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div className="grid grid-cols-7 gap-1.5 mb-2">
                  {heatmapData.map((day, i) => (
                    <div
                      key={i}
                      className="aspect-square rounded flex items-center justify-center"
                      style={{ backgroundColor: day.color }}
                      title={`${format(day.date, "d MMM", { locale: ptBR })}: ${day.taken}/${day.total} tomadas`}
                    >
                      <span className="text-[9px] font-medium" style={{ color: "rgba(0,0,0,0.4)" }}>
                        {day.label}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 mt-1">
                  {[
                    { color: "#78C2AD", label: "Completo" },
                    { color: "#f5c04e", label: "Parcial" },
                    { color: "#f09595", label: "Esquecido" },
                    { color: "#e8e5e0", label: "Sem doses" },
                  ].map(({ color, label }) => (
                    <span key={label} className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: color }} />
                      <span className="text-[10px] text-muted-foreground">{label}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Per-medication breakdown */}
              {medBreakdown.length > 0 && (
                <div className="bg-card rounded-xl border border-border/50 p-4">
                  <p className="text-xs font-medium text-foreground mb-3">Por medicamento</p>
                  <div className="space-y-3">
                    {medBreakdown.map((med) => (
                      <div key={med.name}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-foreground truncate max-w-[70%]">{med.name}</span>
                          <span className="text-xs text-muted-foreground">{med.taken}/{med.total}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${med.taxa}%`, backgroundColor: medBarColor(med.taxa) }}
                            />
                          </div>
                          <span className={`text-xs font-medium min-w-[28px] text-right ${medTextColor(med.taxa)}`}>
                            {med.taxa}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Histórico detalhado — colapsável */}
              <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
                <button
                  onClick={() => setHistoryOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground"
                >
                  <span>Histórico detalhado</span>
                  {historyOpen
                    ? <ChevronUp size={16} className="text-muted-foreground" />
                    : <ChevronDown size={16} className="text-muted-foreground" />
                  }
                </button>

                {historyOpen && (
                  <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2">
                    {allDoses.map((d, idx) => {
                      const dateStr = format(
                        toSPTime(new Date(d.scheduled_for)),
                        "dd MMM yyyy 'às' HH:mm",
                        { locale: ptBR }
                      );
                      const isTaken = d.status === "taken";
                      const isForgotten = d.status === "forgotten";
                      return (
                        <div
                          key={d.id || `virtual-${idx}`}
                          className="bg-background rounded-xl border border-border/40 px-3 py-2.5 flex items-center gap-3"
                        >
                          {isTaken ? (
                            <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                          ) : isForgotten ? (
                            <Clock3 size={16} className="text-slate-400 shrink-0" />
                          ) : (
                            <XCircle size={16} className="text-red-400 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{d.medication_name}</p>
                            <p className="text-xs text-muted-foreground">{dateStr}</p>
                          </div>
                          <Badge
                            className={`text-[10px] border-none shrink-0 ${
                              isTaken
                                ? "bg-emerald-100 text-emerald-700"
                                : isForgotten
                                ? "bg-slate-100 text-slate-600"
                                : "bg-red-100 text-red-600"
                            }`}
                          >
                            {isTaken ? "Tomado" : isForgotten ? "Esquecido" : "Pulado"}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default AdherenceHistoryDrawer;
