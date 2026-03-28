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
  const [nextDueDate, setNextDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setRoutineType("Banho");
    setCustomType("");
    setDatePerformed(today);
    setNextDueDate("");
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
        next_due_date: nextDueDate || null,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rotina registrada!");
      queryClient.invalidateQueries({ queryKey: ["pet_routines", familyMemberId] });
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

        <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain">
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

          {/* Datas */}
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
              <label className="text-sm font-medium text-foreground mb-1 block">Próximo (opc.)</label>
              <input
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none"
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Observações (opc.)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Usou shampoo antialérgico"
              className="text-[16px]"
              rows={3}
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
