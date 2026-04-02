import { useState } from "react";
import { CheckCircle, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface MedicationDoseActionsProps {
  medicationId: string;
  scheduledFor: string;
  doseStatus: "taken" | "skipped" | null;
  /** Frequency in hours - used for auto-completion check */
  frequencyHours?: number | null;
  /** End date of treatment - used for auto-completion check */
  endDate?: string | null;
  /** Whether this is a continuous-use medication */
  usoContinuo?: boolean;
}

export function MedicationDoseActions({
  medicationId,
  scheduledFor,
  doseStatus,
  frequencyHours,
  endDate,
  usoContinuo,
}: MedicationDoseActionsProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  if (doseStatus === "taken") {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-[#AEE2D4] text-slate-800 border-none">
        ✔️ Tomado
      </Badge>
    );
  }

  if (doseStatus === "skipped") {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground border-none">
        ❌ Pulado
      </Badge>
    );
  }

  const handleAction = async (status: "taken" | "skipped", e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from("medication_doses")
        .insert({
          medication_id: medicationId,
          scheduled_for: scheduledFor,
          status,
          taken_at: status === "taken" ? new Date().toISOString() : null,
        });

      if (error) throw error;

      // Only decrement stock on 'taken'
      if (status === "taken") {
        await supabase.rpc("decrement_stock", { med_id: medicationId });
      }

      // Auto-completion: check if treatment should end
      if (!usoContinuo && frequencyHours && frequencyHours > 0 && endDate) {
        const scheduledDate = new Date(scheduledFor);
        const nextDoseAfterThis = new Date(scheduledDate.getTime() + frequencyHours * 60 * 60 * 1000);
        const endStr = endDate.length === 10 ? endDate + "T23:59:59" : endDate;
        const endDateTime = new Date(endStr);

        if (!isNaN(nextDoseAfterThis.getTime()) && !isNaN(endDateTime.getTime()) && nextDoseAfterThis > endDateTime) {
          // Next dose would be after end_date → auto-complete treatment
          await supabase
            .from("medications")
            .update({ status: "Concluído" })
            .eq("id", medicationId);

          toast.success("🎉 Tratamento concluído! Medicamento marcado como Concluído.");
          queryClient.invalidateQueries({ queryKey: ["agenda"] });
          queryClient.invalidateQueries({ queryKey: ["medication_doses"] });
          queryClient.invalidateQueries({ queryKey: ["medications"] });
          queryClient.invalidateQueries({ queryKey: ["medication_doses_list"] });
          queryClient.invalidateQueries({ queryKey: ["medication_doses_home"] });
          return;
        }
      }

      toast.success(status === "taken" ? "Dose registrada com sucesso!" : "Dose pulada.");
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
      queryClient.invalidateQueries({ queryKey: ["medication_doses"] });
      queryClient.invalidateQueries({ queryKey: ["medications"] });
      queryClient.invalidateQueries({ queryKey: ["medication_doses_list"] });
      queryClient.invalidateQueries({ queryKey: ["medication_doses_home"] });
    } catch (err: any) {
      toast.error("Erro ao registrar dose.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <Button
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={(e) => handleAction("taken", e)}
        className="h-7 px-2.5 text-xs bg-[#AEE2D4] text-slate-800 border-none hover:bg-[#8ed4c0] active:bg-[#8ed4c0]"
      >
        <CheckCircle className="h-3.5 w-3.5 mr-1" />
        {loading ? "..." : "Tomar"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={loading}
        onClick={(e) => handleAction("skipped", e)}
        className="h-7 px-2.5 text-xs text-muted-foreground"
      >
        <SkipForward className="h-3.5 w-3.5 mr-1" />
        {loading ? "..." : "Pular"}
      </Button>
    </div>
  );
}
