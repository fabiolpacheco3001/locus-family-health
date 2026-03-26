import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface AtualizarMedidasDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberType?: string | null;
  currentData: {
    blood_type: string | null;
    weight: number | null;
    height: number | null;
    physical_activity: string | null;
  };
}

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const ACTIVITY_LEVELS = ["Intensa", "Moderada", "Sedentária"];

const classifyBMI = (bmi: number): string => {
  if (bmi < 18.5) return "Abaixo do peso";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Sobrepeso";
  return "Obesidade";
};

const AtualizarMedidasDrawer = ({
  open,
  onOpenChange,
  memberId,
  memberType,
  currentData,
}: AtualizarMedidasDrawerProps) => {
  const isPet = (memberType || "human") === "pet";
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [bloodType, setBloodType] = useState(currentData.blood_type || "");
  const [weight, setWeight] = useState(currentData.weight?.toString() || "");
  const [height, setHeight] = useState(currentData.height?.toString() || "");
  const [activity, setActivity] = useState(currentData.physical_activity || "");

  useEffect(() => {
    if (open) {
      setBloodType(currentData.blood_type || "");
      setWeight(currentData.weight?.toString() || "");
      setHeight(currentData.height?.toString() || "");
      setActivity(currentData.physical_activity || "");
    }
  }, [open, currentData]);

  const bmi = useMemo(() => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    if (!w || !h || h <= 0) return null;
    return w / (h * h);
  }, [weight, height]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const w = parseFloat(weight) || null;
      const h = parseFloat(height) || null;

      const { error } = await supabase
        .from("family_members")
        .update({
          blood_type: bloodType || null,
          weight: w,
          height: h,
          physical_activity: activity || null,
        })
        .eq("id", memberId);

      if (error) throw error;

      // Insert history record if weight or height provided
      if (w || h) {
        const bmiVal = w && h && h > 0 ? w / (h * h) : null;
        await supabase.from("health_measurements").insert({
          user_id: user!.id,
          family_member_id: memberId,
          weight: w,
          height: h,
          bmi: bmiVal ? parseFloat(bmiVal.toFixed(1)) : null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family_member", memberId] });
      queryClient.invalidateQueries({ queryKey: ["health_measurements", memberId] });
      toast.success("Medidas atualizadas!");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Erro ao salvar medidas.");
    },
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-background outline-none">
        <DrawerHeader>
          <DrawerTitle>Atualizar Medidas</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain no-scrollbar">
          {/* Blood Type - hidden for pets */}
          {!isPet && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Tipo Sanguíneo
              </label>
              <Select value={bloodType} onValueChange={setBloodType}>
                <SelectTrigger className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {BLOOD_TYPES.map((bt) => (
                    <SelectItem key={bt} value={bt}>
                      {bt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Weight + Height grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Peso (kg)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="Ex: 75.0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Altura (m)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Ex: 1.78"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none"
              />
            </div>
          </div>

          {/* IMC auto-calculated */}
          <div className="rounded-xl bg-muted/50 border border-border/50 p-4">
            <p className="text-xs text-muted-foreground mb-1">IMC Calculado</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">
                {bmi ? bmi.toFixed(1) : "—"}
              </span>
              {bmi && (
                <span className="text-sm text-muted-foreground">
                  {classifyBMI(bmi)}
                </span>
              )}
            </div>
          </div>

          {/* Physical Activity */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Atividade Física
            </label>
            <Select value={activity} onValueChange={setActivity}>
              <SelectTrigger className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_LEVELS.map((al) => (
                  <SelectItem key={al} value={al}>
                    {al}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Fixed footer */}
        <div className="p-4 border-t mt-auto bg-background">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full"
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar Medidas"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default AtualizarMedidasDrawer;
