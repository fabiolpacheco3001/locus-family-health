import { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Share2, CheckCircle, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toSPTime } from "@/lib/dateUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { generateAdherencePdf } from "@/lib/generateAdherencePdf";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMemberId: string;
  memberName: string;
  logoBase64?: string;
  emitterName: string;
}

const AdherenceHistoryDrawer = ({ open, onOpenChange, familyMemberId, memberName, logoBase64, emitterName }: Props) => {
  const [generating, setGenerating] = useState(false);

  const { data: doses = [], isLoading } = useQuery({
    queryKey: ["adherence_history", familyMemberId],
    queryFn: async () => {
      // Get medications for this member
      const { data: meds, error: medsErr } = await supabase
        .from("medications")
        .select("id, name")
        .eq("family_member_id", familyMemberId);
      if (medsErr) throw medsErr;
      if (!meds || meds.length === 0) return [];

      const medIds = meds.map((m) => m.id);
      const medMap: Record<string, string> = {};
      for (const m of meds) medMap[m.id] = m.name;

      const { data: doseData, error: doseErr } = await supabase
        .from("medication_doses")
        .select("*")
        .in("medication_id", medIds)
        .order("scheduled_for", { ascending: false });
      if (doseErr) throw doseErr;

      return (doseData ?? []).map((d: any) => ({
        ...d,
        medication_name: medMap[d.medication_id] || "Desconhecido",
      }));
    },
    enabled: open,
    staleTime: 30 * 1000,
  });

  const takenCount = doses.filter((d) => d.status === "taken").length;
  const totalCount = doses.length;
  const adherenceRate = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  const handleExportPdf = async () => {
    if (doses.length === 0) {
      toast.error("Nenhum registro para exportar.");
      return;
    }
    setGenerating(true);
    try {
      const blob = generateAdherencePdf({
        memberName,
        doses,
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
              className="absolute right-3 top-3"
              title="Exportar PDF"
            >
              <Share2 size={18} />
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
          ) : doses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma dose registrada ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {doses.map((d: any) => {
                const dateStr = format(
                  toSPTime(new Date(d.scheduled_for)),
                  "dd MMM yyyy 'às' HH:mm",
                  { locale: ptBR }
                );
                const isTaken = d.status === "taken";
                return (
                  <div
                    key={d.id}
                    className="bg-card rounded-xl border border-border/50 px-4 py-3 flex items-center gap-3"
                  >
                    {isTaken ? (
                      <CheckCircle size={18} className="text-emerald-500 shrink-0" />
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
                        isTaken ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                      }`}
                    >
                      {isTaken ? "Tomado" : "Pulado"}
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
