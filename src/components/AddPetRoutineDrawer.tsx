import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

interface AddPetRoutineDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMemberId: string;
}

const AddPetRoutineDrawer = ({ open, onOpenChange, familyMemberId }: AddPetRoutineDrawerProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];

  const [routineType, setRoutineType] = useState("Banho");
  const [customType, setCustomType] = useState("");
  const [datePerformed, setDatePerformed] = useState(today);
  const [timePerformed, setTimePerformed] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setRoutineType("Banho");
    setCustomType("");
    setDatePerformed(today);
    setTimePerformed("");
    setRecurrence("none");
    setNotes("");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const type = routineType === "Outro" ? (customType.trim() || "Outro") : routineType;
      const { error } = await supabase.from("pet_routines").insert({
        family_member_id: familyMemberId,
        user_id: user!.id,
        routine_type: type,
        date_performed: datePerformed,
        next_due_date: null,
        notes: notes.trim() || null,
        recurrence: recurrence,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rotina registrada!");
      queryClient.invalidateQueries({ queryKey: ["pet_routines", familyMemberId] });
      queryClient.invalidateQueries({ queryKey: ["pending-counts"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["today-pet-routines"] });
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
      onOpenChange(false);
      resetForm();
    },
    onError: () => toast.error("Erro ao salvar rotina."),
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex flex-col max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>Registrar Rotina</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4 overscroll-contain">
          {/* Tipo */}
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

          {/* Data + Repetição */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Data Realização</label>
              <input
                type="date"
                value={datePerformed}
                onChange={(e) => setDatePerformed(e.target.value)}
                max={today}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none"
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

          {/* Notas */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Orientações</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Usou shampoo antialérgico"
              className="text-[16px]"
              rows={3}
              onFocus={(e) => {
                setTimeout(() => {
                  e.target.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 300);
              }}
            />
          </div>
        </div>

        <DrawerFooter>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!datePerformed || mutation.isPending}
            className="w-full"
          >
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default AddPetRoutineDrawer;
