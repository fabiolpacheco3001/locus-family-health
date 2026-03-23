import { useState } from "react";
import { Activity } from "lucide-react";
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
  Legend,
} from "recharts";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import useSmartBack from "@/hooks/useSmartBack";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

const Metricas = () => {
  const { members } = useFamilyMembers();
  const { user } = useAuth();
  const goBack = useSmartBack();
  const queryClient = useQueryClient();
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ date: "", peso: "", altura: "" });

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
    .filter((m) => m.weight || m.height)
    .map((m) => ({
      label: format(parseISO(m.recorded_at), "dd/MM", { locale: ptBR }),
      peso: m.weight ? Number(m.weight) : null,
      altura: m.height ? Number(m.height) * 100 : null,
    }));

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

        {/* Chart card */}
        {selectedMemberId ? (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Crescimento</CardTitle>
                {selectedMember && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedMember.name}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pl-0 pr-2">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mockData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    yAxisId="peso"
                    orientation="left"
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    label={{ value: "kg", angle: -90, position: "insideLeft", fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="altura"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    label={{ value: "cm", angle: 90, position: "insideRight", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--background))",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Line
                    yAxisId="peso"
                    type="monotone"
                    dataKey="peso"
                    name="Peso (kg)"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "hsl(var(--primary))" }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    yAxisId="altura"
                    type="monotone"
                    dataKey="altura"
                    name="Altura (cm)"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "hsl(var(--accent))" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
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

export default Metricas;
