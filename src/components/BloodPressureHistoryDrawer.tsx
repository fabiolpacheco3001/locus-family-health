import { useState } from "react";
import { HeartPulse, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { getBPClassification } from "@/lib/bloodPressure";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMemberId: string;
}

type BPRecord = {
  id: string;
  systolic: number;
  diastolic: number;
  measurement_date: string;
  source: string;
  notes: string | null;
  consultation_id: string | null;
};

type ConsultationInfo = {
  id: string;
  consultation_date: string | null;
  professional_name: string | null;
  specialty: string;
  symptoms: string | null;
};

const BloodPressureHistoryDrawer = ({ open, onOpenChange, familyMemberId }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ systolic: "", diastolic: "", date: "", notes: "" });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["blood_pressure_history", familyMemberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blood_pressure_history")
        .select("*")
        .eq("familiar_id", familyMemberId)
        .order("measurement_date", { ascending: false });
      if (error) throw error;
      return (data || []) as BPRecord[];
    },
    enabled: !!familyMemberId && !!user && open,
  });

  // Fetch consultation details for records that came from consultations
  const consultationIds = records
    .filter((r) => r.source === "consultation" && r.consultation_id)
    .map((r) => r.consultation_id!);

  const { data: consultations = [] } = useQuery({
    queryKey: ["bp_consultations", consultationIds],
    queryFn: async () => {
      if (consultationIds.length === 0) return [];
      const { data, error } = await supabase
        .from("consultations")
        .select("id, consultation_date, professional_name, specialty, symptoms")
        .in("id", consultationIds);
      if (error) throw error;
      return (data || []) as ConsultationInfo[];
    },
    enabled: consultationIds.length > 0 && open,
  });

  const consultationMap = new Map(consultations.map((c) => [c.id, c]));

  const formatDate = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      return format(d, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const formatConsultationDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    try {
      const d = parseISO(dateStr);
      const dayName = format(d, "EEE", { locale: ptBR }).substring(0, 3);
      return `${format(d, "dd MMM yyyy", { locale: ptBR })} - ${dayName} às ${format(d, "HH:mm")}`;
    } catch {
      return dateStr;
    }
  };

  const handleSaveManual = async () => {
    const sys = parseInt(form.systolic, 10);
    const dia = parseInt(form.diastolic, 10);
    if (!form.systolic || !form.diastolic || isNaN(sys) || isNaN(dia) || sys <= 0 || dia <= 0) {
      toast.error("Preencha os valores de pressão corretamente.");
      return;
    }
    if (!user) return;

    setSaving(true);
    const { error } = await supabase.from("blood_pressure_history").insert({
      user_id: user.id,
      familiar_id: familyMemberId,
      systolic: sys,
      diastolic: dia,
      measurement_date: form.date ? `${form.date}T12:00:00` : new Date().toISOString(),
      source: "manual",
      notes: form.notes.trim() || null,
    } as any);
    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar medição.");
      return;
    }

    toast.success("Medição registrada!");
    queryClient.invalidateQueries({ queryKey: ["blood_pressure_history", familyMemberId] });
    setForm({ systolic: "", diastolic: "", date: "", notes: "" });
    setAddOpen(false);
  };

  const getBPCategory = (sys: number, dia: number) => {
    if (sys < 120 && dia < 80) return { label: "Normal", color: "bg-green-100 text-green-800" };
    if (sys < 130 && dia < 80) return { label: "Elevada", color: "bg-yellow-100 text-yellow-800" };
    if (sys < 140 || dia < 90) return { label: "Hipertensão 1", color: "bg-orange-100 text-orange-800" };
    return { label: "Hipertensão 2", color: "bg-red-100 text-red-800" };
  };

  const latestRecord = records[0];

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[90dvh] flex flex-col rounded-t-2xl bg-background outline-none">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2 text-primary">
              <HeartPulse className="w-5 h-5" />
              Histórico de Pressão Arterial
            </DrawerTitle>
            <DrawerDescription>
              {latestRecord
                ? `Última: ${latestRecord.systolic}/${latestRecord.diastolic} mmHg`
                : "Nenhuma medição registrada."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3 no-scrollbar">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-muted-foreground" size={24} />
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-8">
                <HeartPulse className="mx-auto mb-3 text-muted-foreground" size={32} />
                <p className="text-sm text-muted-foreground">
                  Nenhuma medição registrada ainda.
                </p>
              </div>
            ) : (
              records.map((r) => {
                const cat = getBPCategory(r.systolic, r.diastolic);
                const consultation = r.consultation_id ? consultationMap.get(r.consultation_id) : null;

                return (
                  <div
                    key={r.id}
                    className="bg-card rounded-xl border border-border/50 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xl font-bold text-foreground">
                        {r.systolic} / {r.diastolic}{" "}
                        <span className="text-sm font-normal text-muted-foreground">mmHg</span>
                      </p>
                      <Badge className={`${cat.color} border-0 text-[10px] font-semibold`}>
                        {cat.label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{formatDate(r.measurement_date)}</span>
                      <span>•</span>
                      <span className="capitalize">
                        {r.source === "consultation" && consultation
                          ? `Consulta Dr(a). ${consultation.professional_name || consultation.specialty}`
                          : "Manual"}
                      </span>
                    </div>

                    {r.source === "consultation" && consultation && (
                      <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Consulta:</span>{" "}
                          <span className="capitalize">{formatConsultationDate(consultation.consultation_date)}</span>
                          {consultation.professional_name && ` — Dr(a). ${consultation.professional_name}`}
                        </p>
                        {consultation.symptoms && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            <span className="font-medium text-foreground">Anamnese:</span>{" "}
                            {consultation.symptoms}
                          </p>
                        )}
                      </div>
                    )}

                    {r.notes && (
                      <p className="text-xs text-muted-foreground italic line-clamp-2">
                        "{r.notes}"
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <DrawerFooter className="flex-row gap-3">
            <DrawerClose asChild>
              <Button variant="ghost" className="flex-1">Fechar</Button>
            </DrawerClose>
            <Button className="flex-1 bg-[#F2A97F] hover:bg-[#ff9b66] text-slate-900" onClick={() => setAddOpen(true)}>
              <Plus size={16} className="mr-1" />
              Nova Medição
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Manual input drawer */}
      <Drawer open={addOpen} onOpenChange={setAddOpen}>
        <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-background outline-none">
          <DrawerHeader>
            <DrawerTitle className="text-primary">Nova Medição Manual</DrawerTitle>
            <DrawerDescription>Registre uma medição avulsa de pressão arterial.</DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 no-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Sistólica (mmHg)</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="ex: 120"
                  value={form.systolic}
                  onChange={(e) => setForm({ ...form, systolic: e.target.value.replace(/[^0-9]/g, "") })}
                  min={1}
                  max={300}
                  className="text-[16px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Diastólica (mmHg)</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="ex: 80"
                  value={form.diastolic}
                  onChange={(e) => setForm({ ...form, diastolic: e.target.value.replace(/[^0-9]/g, "") })}
                  min={1}
                  max={300}
                  className="text-[16px]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data da Medição</Label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                min="1900-01-01"
                max={new Date().toISOString().split("T")[0]}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea
                placeholder="Sintomas, contexto..."
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="text-[16px] resize-none"
                maxLength={500}
              />
            </div>
          </div>

          <DrawerFooter className="flex-row gap-3">
            <DrawerClose asChild>
              <Button variant="ghost" className="flex-1">Cancelar</Button>
            </DrawerClose>
            <Button onClick={handleSaveManual} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="animate-spin" size={16} /> : "Salvar"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default BloodPressureHistoryDrawer;
