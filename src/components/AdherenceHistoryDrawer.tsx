import { useState, useEffect, useMemo } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Share2, CheckCircle, XCircle, Clock3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toSPTime } from "@/lib/dateUtils";
import { Skeleton } from "@/components/ui/skeleton";
// generateAdherencePdf loaded on-demand (A13: ~250KB jspdf bundle excluded from initial load)
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMemberId: string;
  memberName: string;
  emitterName: string;
}

interface DoseEntry {
  id?: string;
  medication_id?: string;
  medication_name: string;
  scheduled_for: string;
  status: string;
  taken_at?: string | null;
  isVirtual?: boolean;
}

const AdherenceHistoryDrawer = ({ open, onOpenChange, familyMemberId, memberName, emitterName }: Props) => {
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

  // Fetch medications and their doses
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["adherence_history", familyMemberId],
    queryFn: async () => {
      const { data: meds, error: medsErr } = await supabase
        .from("medications")
        .select("id, name, start_date, start_time, frequency_hours, end_date, uso_continuo")
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

  // Compute virtual "forgotten" doses + real doses merged
  const allDoses: DoseEntry[] = useMemo(() => {
    if (!rawData) return [];
    const { meds, doses } = rawData;

    const medMap: Record<string, string> = {};
    for (const m of meds) medMap[m.id] = m.name;

    // Real doses with medication name
    const realDoses: DoseEntry[] = doses.map((d: any) => ({
      ...d,
      medication_name: medMap[d.medication_id] || "Desconhecido",
      isVirtual: false,
    }));

    // Build a set of existing dose keys for fast lookup
    const existingKeys = new Set<string>();
    for (const d of doses) {
      existingKeys.add(`${d.medication_id}-${new Date(d.scheduled_for).toISOString()}`);
    }

    // Cutoff: end of 2 days ago (anything before yesterday is "forgotten" territory)
    const cutoff = endOfDay(subDays(new Date(), 2));

    // Generate virtual "forgotten" doses
    const virtualDoses: DoseEntry[] = [];
    for (const med of meds) {
      if (!med.start_date || !med.frequency_hours || med.frequency_hours <= 0) continue;

      const dateOnly = med.start_date.slice(0, 10);
      const startStr = med.start_time ? `${dateOnly}T${med.start_time}` : `${dateOnly}T00:00:00`;
      const start = new Date(startStr);
      if (isNaN(start.getTime())) continue;

      const endLimit = med.end_date
        ? new Date(med.end_date.length === 10 ? med.end_date + "T23:59:59" : med.end_date)
        : cutoff;
      const effectiveEnd = endLimit < cutoff ? endLimit : cutoff;

      let cursor = new Date(start.getTime());
      let safety = 50000;
      while (cursor <= effectiveEnd && safety > 0) {
        safety--;
        const key = `${med.id}-${cursor.toISOString()}`;
        if (!existingKeys.has(key)) {
          virtualDoses.push({
            medication_name: medMap[med.id] || "Desconhecido",
            scheduled_for: cursor.toISOString(),
            status: "forgotten",
            isVirtual: true,
          });
        }
        cursor = new Date(cursor.getTime() + med.frequency_hours * 60 * 60 * 1000);
      }
    }

    // Merge and sort descending by scheduled_for
    return [...realDoses, ...virtualDoses].sort(
      (a, b) => new Date(b.scheduled_for).getTime() - new Date(a.scheduled_for).getTime()
    );
  }, [rawData]);

  const takenCount = allDoses.filter((d) => d.status === "taken").length;
  const totalCount = allDoses.length;
  const adherenceRate = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  const handleExportPdf = async () => {
    if (allDoses.length === 0) {
      toast.error("Nenhum registro para exportar.");
      return;
    }
    setGenerating(true);
    try {
      const { generateAdherencePdf } = await import("@/lib/generateAdherencePdf");
      const blob = generateAdherencePdf({
        memberName,
        doses: allDoses,
        adherenceRate,
        takenCount,
        totalCount,
        logoBase64,
        emitterName,
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

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="relative text-center">
          <DrawerTitle>Histórico de Adesão</DrawerTitle>
          {totalCount > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExportPdf}
              disabled={generating}
              className="absolute right-3 top-3 text-secondary hover:text-secondary"
              title="Exportar PDF"
            >
              <Share2 size={18} className="text-secondary" />
            </Button>
          )}
        </DrawerHeader>

        <div className="px-4 pb-6 overflow-y-auto space-y-4">
          {/* Stats */}
          {!isLoading && totalCount > 0 && (
            <div className="bg-card rounded-xl border border-border/50 p-4">
              <p className="text-sm text-muted-foreground">Taxa de Adesão</p>
              <p className="text-2xl font-bold text-foreground">{adherenceRate}%</p>
              <p className="text-xs text-muted-foreground">{takenCount} de {totalCount} doses tomadas</p>
            </div>
          )}

          {/* Timeline */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : allDoses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma dose registrada ainda.
            </p>
          ) : (
            <div className="space-y-2">
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
                    className="bg-card rounded-xl border border-border/50 px-4 py-3 flex items-center gap-3"
                  >
                    {isTaken ? (
                      <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                    ) : isForgotten ? (
                      <Clock3 size={18} className="text-slate-400 shrink-0" />
                    ) : (
                      <XCircle size={18} className="text-red-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {d.medication_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{dateStr}</p>
                    </div>
                    <Badge
                      className={`text-[10px] border-none ${
                        isTaken
                          ? "bg-emerald-100 text-emerald-700"
                          : isForgotten
                          ? "bg-slate-100 text-slate-600 border border-slate-300"
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
      </DrawerContent>
    </Drawer>
  );
};

export default AdherenceHistoryDrawer;
