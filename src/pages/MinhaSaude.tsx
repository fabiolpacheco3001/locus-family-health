import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, Activity, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

const MinhaSaude = () => {
  const { id } = useParams<{ id: string }>();
  const { members } = useFamilyMembers();
  const { user } = useAuth();
  const goBack = useSmartBack();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ date: "", peso: "", altura: "" });

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    const scrollContainer = document.querySelector('.overflow-y-auto');
    if (scrollContainer) scrollContainer.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  const member = members.find((m) => m.id === id);

  const { data: measurements = [] } = useQuery({
    queryKey: ["health_measurements", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_measurements")
        .select("*")
        .eq("family_member_id", id!)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!user,
  });

  const chartData = measurements
    .filter((m) => m.weight || m.height)
    .map((m) => ({
      label: format(parseISO(m.recorded_at), "dd/MM", { locale: ptBR }),
      peso: m.weight ? Number(m.weight) : null,
      altura: m.height ? Number(m.height) * 100 : null, // m -> cm
    }));

  const handleSubmit = async () => {
    if (!user || !id) return;
    const w = formData.peso ? Number(formData.peso) : null;
    const hCm = formData.altura ? Number(formData.altura) : null;
    const hM = hCm ? hCm / 100 : null;
    const bmi = w && hM && hM > 0 ? w / (hM * hM) : null;

    const { error } = await supabase.from("health_measurements").insert({
      user_id: user.id,
      family_member_id: id,
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
    queryClient.invalidateQueries({ queryKey: ["health_measurements", id] });
    setDialogOpen(false);
    setFormData({ date: "", peso: "", altura: "" });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Chart card - Premium design */}
        <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Crescimento</h2>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1.5 rounded-full bg-foreground inline-block" />
                Peso
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1.5 rounded-full bg-[#F2A97F] inline-block" />
                Altura
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={mockData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
              <CartesianGrid
                vertical={false}
                stroke="#f1f5f9"
                strokeDasharray=""
              />
              <XAxis
                dataKey="mes"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#64748b" }}
              />
              <YAxis
                yAxisId="peso"
                orientation="left"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                label={{ value: "kg", angle: -90, position: "insideLeft", fontSize: 11, fill: "#94a3b8" }}
              />
              <YAxis
                yAxisId="altura"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                label={{ value: "cm", angle: 90, position: "insideRight", fontSize: 11, fill: "#94a3b8" }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#ffffff",
                  fontSize: "12px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
              />
              <Line
                yAxisId="peso"
                type="monotone"
                dataKey="peso"
                name="Peso (kg)"
                stroke="#0f172a"
                strokeWidth={3}
                dot={{ r: 4, fill: "#0f172a", strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#0f172a", strokeWidth: 0 }}
              />
              <Line
                yAxisId="altura"
                type="monotone"
                dataKey="altura"
                name="Altura (cm)"
                stroke="#F2A97F"
                strokeWidth={3}
                dot={{ r: 4, fill: "#F2A97F", strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#F2A97F", strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Empty state when no data */}
        <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-5">
          <p className="text-sm text-muted-foreground text-center">
            Registre medidas para acompanhar a evolução ao longo do tempo.
          </p>
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setDialogOpen(true)}
        className="fixed right-6 bottom-24 z-40 w-14 h-14 rounded-full bg-[#FFB085] hover:bg-[#ff9b66] text-slate-900 shadow-lg flex items-center justify-center transition-none"
      >
        <Plus size={24} />
      </button>

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
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Peso (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 15.2"
                  value={formData.peso}
                  onChange={(e) => setFormData({ ...formData, peso: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Altura (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 104"
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

export default MinhaSaude;
