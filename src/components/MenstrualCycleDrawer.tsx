import { useState } from "react";
import { Droplets, Plus, Loader2, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, differenceInDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import SwipeableCard from "@/components/SwipeableCard";
import { AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMemberId: string;
}

export type CycleRecord = {
  id: string;
  start_date: string;
  end_date: string | null;
  flow_intensity: string | null;
  symptoms: string | null;
  notes: string | null;
  cycle_length: number;
  alert_advance_days: number;
};

const flowColors: Record<string, string> = {
  Leve: "bg-primary/10 text-primary",
  Moderado: "bg-primary/20 text-primary",
  Intenso: "bg-primary/30 text-primary",
};

export function getCycleDay(records: CycleRecord[]): string | null {
  if (records.length === 0) return null;
  const latest = records[0];
  if (latest.end_date) return null;
  const start = parseISO(latest.start_date + "T12:00:00");
  const today = new Date();
  const day = differenceInDays(today, start) + 1;
  if (day < 1 || day > 60) return null;
  return `Dia ${day} do ciclo`;
}

export function getNextPeriodInfo(records: CycleRecord[]): { date: Date; daysLeft: number; formatted: string } | null {
  if (records.length === 0) return null;
  const latest = records[0];
  const start = parseISO(latest.start_date + "T12:00:00");
  const nextDate = addDays(start, latest.cycle_length);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const daysLeft = differenceInDays(nextDate, today);
  const dayName = format(nextDate, "EEE", { locale: ptBR }).substring(0, 3);
  const capitalDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  const formatted = `${format(nextDate, "dd MMM yyyy", { locale: ptBR })} - ${capitalDay}`;
  return { date: nextDate, daysLeft, formatted };
}

type FormState = {
  start_date: string;
  end_date: string;
  flow_intensity: string;
  symptoms: string;
  notes: string;
  cycle_length: string;
  alert_advance_days: string;
};

const emptyForm: FormState = {
  start_date: "",
  end_date: "",
  flow_intensity: "",
  symptoms: "",
  notes: "",
  cycle_length: "28",
  alert_advance_days: "2",
};

const MenstrualCycleDrawer = ({ open, onOpenChange, familyMemberId }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["menstrual_cycles", familyMemberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menstrual_cycles" as any)
        .select("*")
        .eq("familiar_id", familyMemberId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CycleRecord[];
    },
    enabled: !!familyMemberId && !!user && open,
  });

  const cycleStatus = getCycleDay(records);
  const prediction = getNextPeriodInfo(records);

  const formatDateRange = (start: string, end: string | null) => {
    try {
      const s = parseISO(start + "T12:00:00");
      const startStr = format(s, "dd/MM", { locale: ptBR });
      if (!end) return `${startStr} - Em andamento`;
      const e = parseISO(end + "T12:00:00");
      const endStr = format(e, "dd/MM", { locale: ptBR });
      const days = differenceInDays(e, s) + 1;
      return `${startStr} a ${endStr} — ${days} dia${days > 1 ? "s" : ""}`;
    } catch {
      return start;
    }
  };

  const openNewForm = () => {
    const lastRecord = records.length > 0 ? records[0] : null;
    if (lastRecord) {
      const predInfo = getNextPeriodInfo(records);
      let prefillDate = "";
      if (predInfo) {
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        prefillDate = predInfo.daysLeft > 0
          ? predInfo.date.toISOString().split("T")[0]
          : today.toISOString().split("T")[0];
      }
      setForm({
        start_date: prefillDate,
        end_date: "",
        flow_intensity: "",
        symptoms: "",
        notes: "",
        cycle_length: String(lastRecord.cycle_length),
        alert_advance_days: String(lastRecord.alert_advance_days),
      });
    } else {
      setForm({ ...emptyForm });
    }
    setEditingId(null);
    setAddOpen(true);
  };

  const openEditForm = (record: CycleRecord) => {
    setForm({
      start_date: record.start_date,
      end_date: record.end_date || "",
      flow_intensity: record.flow_intensity || "",
      symptoms: record.symptoms || "",
      notes: record.notes || "",
      cycle_length: String(record.cycle_length),
      alert_advance_days: String(record.alert_advance_days),
    });
    setEditingId(record.id);
    setAddOpen(true);
  };

  const handleSave = async () => {
    if (!form.start_date) {
      toast.error("Informe a data de início.");
      return;
    }
    if (!user) return;

    setSaving(true);
    const cycleLen = parseInt(form.cycle_length) || 28;
    const alertDays = parseInt(form.alert_advance_days) || 2;

    const payload = {
      start_date: form.start_date,
      end_date: form.end_date || null,
      flow_intensity: form.flow_intensity || null,
      symptoms: form.symptoms.trim() || null,
      notes: form.notes.trim() || null,
      cycle_length: cycleLen,
      alert_advance_days: alertDays,
    };

    let error;
    if (editingId) {
      const res = await supabase
        .from("menstrual_cycles" as any)
        .update(payload as any)
        .eq("id", editingId);
      error = res.error;
    } else {
      const res = await supabase.from("menstrual_cycles" as any).insert({
        ...payload,
        user_id: user.id,
        familiar_id: familyMemberId,
      } as any);
      error = res.error;
    }
    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar registro.");
      return;
    }

    toast.success(editingId ? "Registro atualizado!" : "Ciclo registrado!");
    queryClient.invalidateQueries({ queryKey: ["menstrual_cycles", familyMemberId] });
    setForm({ ...emptyForm });
    setEditingId(null);
    setAddOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("menstrual_cycles" as any)
      .delete()
      .eq("id", deleteTarget);
    if (error) {
      toast.error("Erro ao excluir registro.");
    } else {
      toast.success("Registro excluído.");
      queryClient.invalidateQueries({ queryKey: ["menstrual_cycles", familyMemberId] });
    }
    setDeleteTarget(null);
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[90dvh] flex flex-col rounded-t-2xl bg-background outline-none">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2 text-primary">
              <Droplets className="w-5 h-5" />
              Ciclo Menstrual
            </DrawerTitle>
            <DrawerDescription asChild>
              <div className="space-y-1">
                {cycleStatus && (
                  <p className="font-semibold text-primary">{cycleStatus}</p>
                )}
                {prediction && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <CalendarClock className="w-3.5 h-3.5 text-primary/60" />
                    <span className="text-foreground font-medium">
                      Próxima menstruação: {prediction.formatted}
                    </span>
                  </div>
                )}
                {prediction && (
                  <p className={`text-xs font-semibold ${prediction.daysLeft > 0 ? "text-primary" : "text-destructive"}`}>
                    {prediction.daysLeft > 0
                      ? `Faltam ${prediction.daysLeft} dia${prediction.daysLeft > 1 ? "s" : ""}`
                      : prediction.daysLeft === 0
                        ? "Prevista para hoje!"
                        : `Atrasada há ${Math.abs(prediction.daysLeft)} dia${Math.abs(prediction.daysLeft) > 1 ? "s" : ""}`}
                  </p>
                )}
                {!cycleStatus && !prediction && records.length > 0 && (
                  <p>{records.length} registro{records.length > 1 ? "s" : ""}</p>
                )}
                {records.length === 0 && !isLoading && (
                  <p>Nenhum ciclo registrado.</p>
                )}
              </div>
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3 no-scrollbar">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-muted-foreground" size={24} />
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-8">
                <Droplets className="mx-auto mb-3 text-primary/30" size={32} />
                <p className="text-sm text-muted-foreground">
                  Nenhum ciclo registrado ainda.
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {records.map((r) => (
                  <SwipeableCard key={r.id} onSwipeDelete={() => setDeleteTarget(r.id)}>
                    <button
                      type="button"
                      onClick={() => openEditForm(r)}
                      className="w-full text-left bg-card rounded-xl border border-border/50 p-4 space-y-2 cursor-pointer active:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">
                          {formatDateRange(r.start_date, r.end_date)}
                        </p>
                        {r.flow_intensity && (
                          <Badge className={`${flowColors[r.flow_intensity] || "bg-primary/10 text-primary"} border-0 text-[10px] font-semibold`}>
                            {r.flow_intensity}
                          </Badge>
                        )}
                      </div>

                      {r.symptoms && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          <span className="font-medium text-foreground">Sintomas:</span> {r.symptoms}
                        </p>
                      )}

                      {r.notes && (
                        <p className="text-xs text-muted-foreground italic line-clamp-2">
                          "{r.notes}"
                        </p>
                      )}

                      <p className="text-[10px] text-muted-foreground">
                        Ciclo: {r.cycle_length} dias
                      </p>
                    </button>
                  </SwipeableCard>
                ))}
              </AnimatePresence>
            )}
          </div>

          <DrawerFooter className="flex-row gap-3">
            <DrawerClose asChild>
              <Button variant="ghost" className="flex-1">Fechar</Button>
            </DrawerClose>
            <Button
              className="flex-1"
              onClick={openNewForm}
            >
              <Plus size={16} className="mr-1" />
              Registrar Menstruação
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Add/Edit form drawer */}
      <Drawer open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setEditingId(null); }}>
        <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[90dvh] flex flex-col rounded-t-2xl bg-background outline-none">
          <DrawerHeader>
            <DrawerTitle className="text-primary">
              {editingId ? "Editar Registro" : "Registrar Menstruação"}
            </DrawerTitle>
            <DrawerDescription>Informe os dados do ciclo menstrual.</DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Início do Sangramento *</Label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  min="1900-01-01"
                  max={today}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Fim do Sangramento</Label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  min={form.start_date || "1900-01-01"}
                  max={today}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Duração do Ciclo (Dias)</Label>
                <input
                  type="number"
                  value={form.cycle_length}
                  onChange={(e) => setForm({ ...form, cycle_length: e.target.value })}
                  min={15}
                  max={60}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none"
                />
                <p className="text-[10px] text-muted-foreground">O padrão médio é 28 dias</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Aviso Antecipado</Label>
                <Select value={form.alert_advance_days} onValueChange={(v) => setForm({ ...form, alert_advance_days: v })}>
                  <SelectTrigger className="text-[16px]">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Não avisar</SelectItem>
                    <SelectItem value="1">1 dia antes</SelectItem>
                    <SelectItem value="2">2 dias antes</SelectItem>
                    <SelectItem value="3">3 dias antes</SelectItem>
                    <SelectItem value="4">4 dias antes</SelectItem>
                    <SelectItem value="5">5 dias antes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Intensidade do Fluxo</Label>
              <Select value={form.flow_intensity} onValueChange={(v) => setForm({ ...form, flow_intensity: v })}>
                <SelectTrigger className="text-[16px]">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Leve">Leve</SelectItem>
                  <SelectItem value="Moderado">Moderado</SelectItem>
                  <SelectItem value="Intenso">Intenso</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Sintomas</Label>
              <Textarea
                placeholder="Cólica, dor de cabeça..."
                rows={2}
                value={form.symptoms}
                onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
                className="text-[16px] resize-none min-h-[60px]"
                maxLength={500}
                onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea
                placeholder="Anotações adicionais..."
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="text-[16px] resize-none min-h-[60px]"
                maxLength={500}
                onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
              />
            </div>

            <div className="pb-32" />
          </div>

          <DrawerFooter className="flex-row gap-3">
            <DrawerClose asChild>
              <Button variant="ghost" className="flex-1">Cancelar</Button>
            </DrawerClose>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="animate-spin" size={16} /> : "Salvar"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-[320px] rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente este registro de ciclo menstrual? Esta ação não pode ser desfeita.
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

export default MenstrualCycleDrawer;
