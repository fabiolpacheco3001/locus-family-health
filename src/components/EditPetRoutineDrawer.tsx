import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parse } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";

const ROUTINE_TYPES = ["Banho", "Tosa", "Antipulgas", "Vermífugo", "Outro"];

const RECURRENCE_OPTIONS = [
  { value: "none", label: "Não se repete" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "monthly", label: "Mensal" },
  { value: "quarterly", label: "A cada 3 meses" },
  { value: "semiannually", label: "A cada 6 meses" },
  { value: "annually", label: "Anual" },
];

interface EditPetRoutineDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routine: {
    id: string;
    family_member_id: string;
    routine_type: string;
    date_performed: string;
    next_due_date: string | null;
    notes: string | null;
    status: string;
    recurrence?: string;
  } | null;
}

const EditPetRoutineDrawer = ({ open, onOpenChange, routine }: EditPetRoutineDrawerProps) => {
  const queryClient = useQueryClient();

  const [routineType, setRoutineType] = useState("Banho");
  const [customType, setCustomType] = useState("");
  const [dateTimePerformed, setDateTimePerformed] = useState<Date | undefined>(undefined);
  const [recurrence, setRecurrence] = useState("none");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (routine && open) {
      const isKnown = ROUTINE_TYPES.includes(routine.routine_type);
      setRoutineType(isKnown ? routine.routine_type : "Outro");
      setCustomType(isKnown ? "" : routine.routine_type);
      const time = "12:00";
      const parsed = parse(`${routine.date_performed} ${time}`, "yyyy-MM-dd HH:mm", new Date());
      setDateTimePerformed(isNaN(parsed.getTime()) ? undefined : parsed);
      setRecurrence(routine.recurrence || "none");
      setNotes(routine.notes || "");
    }
  }, [routine, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!routine || !dateTimePerformed) return;
      const type = routineType === "Outro" ? (customType.trim() || "Outro") : routineType;
      const datePart = format(dateTimePerformed, "yyyy-MM-dd");
      const timePart = format(dateTimePerformed, "HH:mm");
      const { error } = await supabase
        .from("pet_routines")
        .update({
          routine_type: type,
          date_performed: datePart,
          time_performed: timePart,
          notes: notes.trim() || null,
          recurrence: recurrence,
        })
        .eq("id", routine.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rotina atualizada!");
      queryClient.invalidateQueries({ queryKey: ["pet_routines", routine?.family_member_id] });
      queryClient.invalidateQueries({ queryKey: ["pending-counts"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["today-pet-routines"] });
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao atualizar rotina."),
  });

  if (!routine) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex flex-col max-h-[80vh]">
        <DrawerHeader>
          <DrawerTitle>Editar Rotina</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4 overscroll-contain">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Tipo de Cuidado</label>
            <select
              value={routineType}
              onChange={(e) => setRoutineType(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none"
            >
              {ROUTINE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {routineType === "Outro" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Especifique</label>
              <input
                type="text"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="Ex: Limpeza de ouvido"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Data/Hora</label>
              <DateTimePicker
                value={dateTimePerformed}
                onChange={setDateTimePerformed}
                placeholder="Selecione"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Repetição</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none"
              >
                {RECURRENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Orientações</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Usou shampoo antialérgico"
              className="text-base"
              rows={3}
              onFocus={(e) => {
                setTimeout(() => {
                  e.target.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 300);
              }}
            />
          </div>
        </div>

        <DrawerFooter className="flex-row gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!dateTimePerformed || mutation.isPending}
            className="flex-1"
          >
            {mutation.isPending ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default EditPetRoutineDrawer;
