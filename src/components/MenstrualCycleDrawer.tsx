import { useState } from "react";
import { Droplets, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import SwipeableCard from "@/components/SwipeableCard";
import { AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMemberId: string;
}

type CycleRecord = {
  id: string;
  start_date: string;
  end_date: string | null;
  flow_intensity: string | null;
  symptoms: string | null;
  notes: string | null;
};

const flowColors: Record<string, string> = {
  Leve: "bg-pink-100 text-pink-700",
  Moderado: "bg-rose-100 text-rose-700",
  Intenso: "bg-red-100 text-red-700",
};

export function getCycleDay(records: CycleRecord[]): string | null {
  if (records.length === 0) return null;
  const latest = records[0];
  if (latest.end_date) return null; // cycle ended
  const start = parseISO(latest.start_date + "T12:00:00");
  const today = new Date();
  const day = differenceInDays(today, start) + 1;
  if (day < 1 || day > 60) return null;
  return `Dia ${day} do ciclo`;
}

const MenstrualCycleDrawer = ({ open, onOpenChange, familyMemberId }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState({
    start_date: "",
    end_date: "",
    flow_intensity: "",
    symptoms: "",
    notes: "",
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["menstrual_cycles", familyMemberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menstrual_cycles" as any)
        .select("*")
        .eq("familiar_id", familyMemberId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data || []) as CycleRecord[];
    },
    enabled: !!familyMemberId && !!user && open,
  });

  const cycleStatus = getCycleDay(records);

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

  const handleSave = async () => {
    if (!form.start_date) {
      toast.error("Informe a data de início.");
      return;
    }
    if (!user) return;

    setSaving(true);
    const { error } = await supabase.from("menstrual_cycles" as any).insert({
      user_id: user.id,
      familiar_id: familyMemberId,
      start_date: form.start_date,
      end_date: form.end_date || null,
      flow_intensity: form.flow_intensity || null,
      symptoms: form.symptoms.trim() || null,
      notes: form.notes.trim() || null,
    } as any);
    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar registro.");
      return;
    }

    toast.success("Ciclo registrado!");
    queryClient.invalidateQueries({ queryKey: ["menstrual_cycles", familyMemberId] });
    setForm({ start_date: "", end_date: "", flow_intensity: "", symptoms: "", notes: "" });
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
            <DrawerTitle className="flex items-center gap-2 text-pink-600">
              <Droplets className="w-5 h-5" />
              Ciclo Menstrual
            </DrawerTitle>
            <DrawerDescription>
              {cycleStatus ? (
                <span className="font-semibold text-pink-600">{cycleStatus}</span>
              ) : records.length > 0 ? (
                `${records.length} registro${records.length > 1 ? "s" : ""}`
              ) : (
                "Nenhum ciclo registrado."
              )}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3 no-scrollbar">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-muted-foreground" size={24} />
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-8">
                <Droplets className="mx-auto mb-3 text-pink-300" size={32} />
                <p className="text-sm text-muted-foreground">
                  Nenhum ciclo registrado ainda.
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {records.map((r) => (
                  <SwipeableCard key={r.id} onSwipeDelete={() => setDeleteTarget(r.id)}>
                    <div className="bg-card rounded-xl border border-border/50 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">
                          {formatDateRange(r.start_date, r.end_date)}
                        </p>
                        {r.flow_intensity && (
                          <Badge className={`${flowColors[r.flow_intensity] || "bg-pink-100 text-pink-700"} border-0 text-[10px] font-semibold`}>
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
                    </div>
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
              className="flex-1 bg-pink-500 hover:bg-pink-600 text-white"
              onClick={() => setAddOpen(true)}
            >
              <Plus size={16} className="mr-1" />
              Registrar Menstruação
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Add form drawer */}
      <Drawer open={addOpen} onOpenChange={setAddOpen}>
        <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-background outline-none">
          <DrawerHeader>
            <DrawerTitle className="text-pink-600">Registrar Menstruação</DrawerTitle>
            <DrawerDescription>Informe os dados do ciclo menstrual.</DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 no-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data de Início *</Label>
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
                <Label className="text-xs text-muted-foreground">Data de Fim</Label>
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
                className="text-[16px] resize-none"
                maxLength={500}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea
                placeholder="Anotações adicionais..."
                rows={2}
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
            <Button onClick={handleSave} disabled={saving} className="flex-1 bg-pink-500 hover:bg-pink-600 text-white">
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
