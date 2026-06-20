import { useState, useEffect } from "react";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useParams } from "react-router-dom";
import { ArrowLeft, Activity, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import useSmartBack from "@/hooks/useSmartBack";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFamilyAccessGuard } from "@/hooks/useFamilyAccessGuard";
import { useHealthMeasurements } from "@/hooks/useHealthMeasurements";
import { MeasurementChart } from "@/components/health/MeasurementChart";

const MinhaSaude = () => {
  const { id } = useParams<{ id: string }>();
  const { members } = useFamilyMembers();
  const goBack = useSmartBack();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ date: "", peso: "", altura: "" });
  const [graficoAtivo, setGraficoAtivo] = useState<"peso" | "altura">("peso");

  useFamilyAccessGuard(id);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    const scrollContainer = document.querySelector(".overflow-y-auto");
    if (scrollContainer) scrollContainer.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [id]);

  const member = members.find((m) => m.id === id);
  const { measurements, addMutation, deleteMutation } = useHealthMeasurements(id);

  const chartData = measurements
    .filter((m) => (graficoAtivo === "peso" ? m.weight : m.height))
    .map((m) => ({
      label: format(parseISO(m.recorded_at), "dd/MM", { locale: ptBR }),
      valor: graficoAtivo === "peso" ? Number(m.weight) : Number(m.height) * 100,
    }));

  const historyData = [...measurements].sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
  );

  const handleSubmit = async () => {
    try {
      await addMutation.mutateAsync(formData);
      setDialogOpen(false);
      setFormData({ date: "", peso: "", altura: "" });
    } catch {
      /* handled */
    }
  };

  const handleDelete = async (measurementId: string) => {
    if (!window.confirm("Deseja excluir este registro?")) return;
    try {
      await deleteMutation.mutateAsync(measurementId);
    } catch {
      /* handled */
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
      <div className="flex-none bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={goBack} className="p-1 -ml-1">
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Evolução Corporal</h1>
        </div>
        {member && (
          <Badge variant="secondary" className="ml-auto text-xs">
            {member.name.split(" ")[0]}
          </Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="p-4 pb-8 space-y-6 min-h-[calc(100%+1px)]">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setGraficoAtivo("peso")}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                graficoAtivo === "peso"
                  ? "bg-foreground text-background"
                  : "bg-card text-muted-foreground"
              }`}
            >
              Peso (kg)
            </button>
            <button
              onClick={() => setGraficoAtivo("altura")}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                graficoAtivo === "altura"
                  ? "bg-[#F2A97F] text-slate-900"
                  : "bg-card text-muted-foreground"
              }`}
            >
              Altura (cm)
            </button>
          </div>

          <MeasurementChart data={chartData} metric={graficoAtivo} />

          {historyData.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-base font-semibold text-foreground">Histórico de Medidas</h2>
              </div>
              <div className="space-y-2">
                {historyData.map((m) => {
                  const dateStr = format(parseISO(m.recorded_at), "dd MMM yyyy", { locale: ptBR });
                  return (
                    <div
                      key={m.id}
                      className="bg-card rounded-xl border border-border/50 px-4 py-3 flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-foreground capitalize">{dateStr}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          {m.weight && <span>Peso: {Number(m.weight)} kg</span>}
                          {m.height && <span>Altura: {(Number(m.height) * 100).toFixed(0)} cm</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(m.id)}
                        disabled={deleteMutation.isPending}
                        className="p-2 -mr-1"
                      >
                        <Trash2 size={18} className="text-red-500" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setDialogOpen(true)}
        className="fixed right-6 bottom-24 z-40 w-14 h-14 rounded-full bg-[#F2A97F] hover:bg-[#ff9b66] text-slate-900 shadow-lg flex items-center justify-center transition-none"
      >
        <Plus size={24} />
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-lg max-w-[90vw]">
          <DialogHeader>
            <DialogTitle>Registrar Medida</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Data</label>
              <DatePickerField
                value={formData.date}
                onChange={(val) => setFormData({ ...formData, date: val })}
                mode="date"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Peso (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 72.5"
                  value={formData.peso}
                  onChange={(e) => setFormData({ ...formData, peso: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Altura (cm)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="Ex: 180"
                  value={formData.altura}
                  onChange={(e) => setFormData({ ...formData, altura: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit} disabled={addMutation.isPending} className="w-full">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MinhaSaude;
