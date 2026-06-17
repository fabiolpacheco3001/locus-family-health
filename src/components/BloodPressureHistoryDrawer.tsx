import { fromSPToUTC } from "@/lib/dateUtils";
import { useState } from "react";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { HeartPulse, Plus, Loader2, Stethoscope } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { getBPClassification } from "@/lib/bloodPressure";
import SwipeableCard from "@/components/SwipeableCard";
import { AnimatePresence } from "framer-motion";

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
  const { groupId } = useFamilyGroup();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ systolic: "", diastolic: "", date: "", notes: "" });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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
      measurement_date: form.date ? fromSPToUTC(form.date).toISOString() : new Date().toISOString(),
      source: "manual",
      notes: form.notes.trim() || null,
      group_id: groupId ?? undefined,
    });
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("blood_pressure_history")
      .delete()
      .eq("id", deleteTarget);
    if (error) {
      toast.error("Erro ao excluir medição.");
    } else {
      toast.success("Medição excluída.");
      queryClient.invalidateQueries({ queryKey: ["blood_pressure_history", familyMemberId] });
    }
    setDeleteTarget(null);
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[90dvh] flex flex-col rounded-t-2xl bg-background outline-hidden">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2 text-primary">
              <HeartPulse className="w-5 h-5" />
              Histórico de Pressão Arterial
            </DrawerTitle>
            <DrawerDescription>
              {records.length > 0
                ? `${records.length} registro${records.length > 1 ? "s" : ""}`
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
              <AnimatePresence mode="popLayout">
                {records.map((r) => {
                  const cat = getBPClassification(r.systolic, r.diastolic);
                  const consultation = r.consultation_id ? consultationMap.get(r.consultation_id) : null;
                  const isConsultation = r.source === "consultation" && consultation;

                  return (
                    <SwipeableCard key={r.id} onSwipeDelete={() => setDeleteTarget(r.id)}>
                      <div className="bg-card rounded-xl border border-border/50 p-4 space-y-2">
                        {/* Consultation origin header */}
                        {isConsultation && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                            <Stethoscope className="w-3.5 h-3.5" />
                            <span className="font-medium">Origem: Consulta Médica</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <p className="text-xl font-bold text-foreground">
                            {r.systolic} / {r.diastolic}{" "}
                            <span className="text-sm font-normal text-muted-foreground">mmHg</span>
                          </p>
                          <Badge className={`${cat.colorClass} border-0 text-[10px] font-semibold`}>
                            {cat.label}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{formatDate(r.measurement_date)}</span>
                          {!isConsultation && (
                            <>
                              <span>•</span>
                              <span>Manual</span>
                            </>
                          )}
                        </div>

                        {/* Consultation details */}
                        {isConsultation && (
                          <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Consulta:</span>{" "}
                              <span className="capitalize">{formatConsultationDate(consultation.consultation_date)}</span>
                            </p>
                            {consultation.professional_name && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">Médico:</span>{" "}
                                Dr(a). {consultation.professional_name}
                              </p>
                            )}
                            {consultation.symptoms && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                <span className="font-medium text-foreground">Motivo/Sintomas:</span>{" "}
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
                    </SwipeableCard>
                  );
                })}
              </AnimatePresence>
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
        <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-background outline-hidden">
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
                  placeholder="Ex: 120"
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
                  placeholder="Ex: 80"
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
              <DatePickerField
                value={form.date}
                onChange={(val) => setForm({ ...form, date: val })}
                mode="date"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea
                placeholder="Ex: Após exercício, em repouso..."
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

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-[320px] rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Medição?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente este registro de pressão arterial? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BloodPressureHistoryDrawer;
