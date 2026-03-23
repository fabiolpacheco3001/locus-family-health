import { useState } from "react";
import { Activity, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import useSmartBack from "@/hooks/useSmartBack";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const Metricas = () => {
  const { members } = useFamilyMembers();
  const { user } = useAuth();
  const goBack = useSmartBack();
  const queryClient = useQueryClient();
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ date: "", peso: "", altura: "" });
  const [graficoAtivo, setGraficoAtivo] = useState<"peso" | "altura">("peso");

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  const { data: measurements = [] } = useQuery({
    queryKey: ["health_measurements", selectedMemberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_measurements")
        .select("*")
        .eq("family_member_id", selectedMemberId)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedMemberId && !!user,
  });

  const chartData = measurements
    .filter((m) => (graficoAtivo === "peso" ? m.weight : m.height))
    .map((m) => ({
      label: format(parseISO(m.recorded_at), "dd/MM", { locale: ptBR }),
      valor: graficoAtivo === "peso"
        ? Number(m.weight)
        : Number(m.height) * 100,
    }));

  const historyData = [...measurements].sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  );

  const handleSubmit = async () => {
    if (!user || !selectedMemberId) return;
    const w = formData.peso ? Number(formData.peso) : null;
    const hCm = formData.altura ? Number(formData.altura) : null;
    const hM = hCm ? hCm / 100 : null;
    const bmi = w && hM && hM > 0 ? w / (hM * hM) : null;

    const { error } = await supabase.from("health_measurements").insert({
      user_id: user.id,
      family_member_id: selectedMemberId,
      weight: w,
      height: hM,
      bmi: bmi ? Number(bmi.toFixed(1)) : null,
      recorded_at: formData.date ? `${formData.date}T12:00:00` : new Date().toISOString(),
    });

    if (error) {
      toast.error("Erro ao salvar medida.");
      return;
    }

    toast.success("Medida registrada!");
    queryClient.invalidateQueries({ queryKey: ["health_measurements", selectedMemberId] });
    setDialogOpen(false);
    setFormData({ date: "", peso: "", altura: "" });
  };

  const handleDelete = async (measurementId: string) => {
    if (!window.confirm("Deseja excluir este registro?")) return;
    const { error } = await supabase
      .from("health_measurements")
      .delete()
      .eq("id", measurementId);
    if (error) {
      toast.error("Erro ao excluir registro.");
      return;
    }
    toast.success("Registro excluído!");
    queryClient.invalidateQueries({ queryKey: ["health_measurements", selectedMemberId] });
  };

  const lineColor = graficoAtivo === "peso" ? "#0f172a" : "#F2A97F";
  const unitLabel = graficoAtivo === "peso" ? "kg" : "cm";

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={goBack} className="p-1 -ml-1">
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Evolução de Saúde</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Family member selector */}
        <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
          <SelectTrigger className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none">
            <SelectValue placeholder="Selecione um familiar" />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name} — {m.relationship}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Register button */}
        <Button
          onClick={() => setDialogOpen(true)}
          className="w-full"
          disabled={!selectedMemberId}
        >
          Registrar Medida
        </Button>

        {selectedMemberId && (
          <>
            {/* Toggle Peso / Altura */}
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

            {/* Chart */}
            {chartData.length > 0 ? (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {graficoAtivo === "peso" ? "Evolução do Peso" : "Evolução da Altura"}
                    </CardTitle>
                    {selectedMember && (
                      <Badge variant="secondary" className="text-xs">
                        {selectedMember.name.split(" ")[0]}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pl-0 pr-2">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#64748b" }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        label={{ value: unitLabel, angle: -90, position: "insideLeft", fontSize: 11, fill: "#94a3b8" }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                          backgroundColor: "#ffffff",
                          fontSize: "12px",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                        formatter={(value: number) => [`${value} ${unitLabel}`, graficoAtivo === "peso" ? "Peso" : "Altura"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="valor"
                        name={graficoAtivo === "peso" ? "Peso" : "Altura"}
                        stroke={lineColor}
                        strokeWidth={3}
                        dot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: lineColor, strokeWidth: 0 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  Registre medidas para acompanhar a evolução ao longo do tempo.
                </CardContent>
              </Card>
            )}

            {/* History */}
            {historyData.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-foreground mb-3">Histórico de Medidas</h2>
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
                        <button onClick={() => handleDelete(m.id)} className="p-2 -mr-1">
                          <Trash2 size={18} className="text-red-500" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {!selectedMemberId && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              Selecione um familiar para visualizar os gráficos de evolução.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Register measurement dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-lg max-w-[90vw]">
          <DialogHeader>
            <DialogTitle>Registrar Medida</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Data</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                min="1900-01-01"
                max={new Date().toISOString().split('T')[0]}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none"
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
            <Button onClick={handleSubmit} className="w-full">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Metricas;
