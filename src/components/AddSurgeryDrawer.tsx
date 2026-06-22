import { useState } from "react";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, X } from "lucide-react";
import { SURGERY_TYPES } from "@/lib/surgeryTypes";
import { useSurgeries } from "@/hooks/useSurgeries";
import { SurgeryInstructionImporter } from "./SurgeryInstructionImporter";
import { CustomDateTimePicker } from "@/components/ui/custom-date-time-picker";
import type { InstructionItem } from "@/hooks/useSurgeries";
import { toast } from "sonner";

interface AddSurgeryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMemberId: string;
}

export function AddSurgeryDrawer({
  open,
  onOpenChange,
  familyMemberId,
}: AddSurgeryDrawerProps) {
  const { createMutation } = useSurgeries(familyMemberId);
  const [activeTab, setActiveTab] = useState("agendamento");

  const [surgeryType, setSurgeryType] = useState("");
  const [customType, setCustomType] = useState("");
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [hospitalClinic, setHospitalClinic] = useState("");
  const [surgeonName, setSurgeonName] = useState("");
  const [notes, setNotes] = useState("");
  const [preItems, setPreItems] = useState<InstructionItem[]>([]);
  const [postItems, setPostItems] = useState<InstructionItem[]>([]);

  const reset = () => {
    setSurgeryType("");
    setCustomType("");
    setScheduledDate(null);
    setHospitalClinic("");
    setSurgeonName("");
    setNotes("");
    setPreItems([]);
    setPostItems([]);
    setActiveTab("agendamento");
  };

  const handleSave = async () => {
    if (!surgeryType) {
      toast.error("Selecione o tipo de cirurgia.");
      setActiveTab("agendamento");
      return;
    }
    if (surgeryType === "outro" && customType.trim().length < 3) {
      toast.error("Descreva o tipo de cirurgia (mínimo 3 caracteres).");
      setActiveTab("agendamento");
      return;
    }

    try {
      await createMutation.mutateAsync({
        family_member_id: familyMemberId,
        surgery_type: surgeryType,
        custom_type: surgeryType === "outro" ? customType.trim() : undefined,
        scheduled_date: scheduledDate ? scheduledDate.toISOString() : undefined,
        hospital_clinic: hospitalClinic.trim() || undefined,
        surgeon_name: surgeonName.trim() || undefined,
        notes: notes.trim() || undefined,
        pre_instructions: preItems.length > 0 ? preItems : undefined,
        post_instructions: postItems.length > 0 ? postItems : undefined,
      });
      reset();
      onOpenChange(false);
    } catch {
      // toast exibido no onError do hook
    }
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-[20px] max-h-[92dvh] flex flex-col">
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          <div className="flex items-center justify-between px-4 pb-3 shrink-0 border-b border-border/40">
            <Drawer.Title className="text-base font-semibold text-foreground">
              Nova Cirurgia
            </Drawer.Title>
            <button
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
              className="p-1 rounded-lg active:bg-muted/40"
              aria-label="Fechar"
            >
              <X size={20} className="text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Pill tabs (Padrão drawer) */}
            <div className="flex p-1 bg-slate-100 rounded-xl mx-4 my-3 shrink-0">
              {[
                { value: "agendamento", label: "Agendamento" },
                { value: "pre", label: "Pré-Op" },
                { value: "pos", label: "Pós-Op" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActiveTab(value)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    activeTab === value
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto no-scrollbar">
                {activeTab === "agendamento" && (
                <div className="p-4 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      Tipo de Cirurgia *
                    </label>
                    <Select value={surgeryType} onValueChange={setSurgeryType}>
                      <SelectTrigger className="text-base">
                        <SelectValue placeholder="Selecione o tipo..." />
                      </SelectTrigger>
                      <SelectContent className="text-base max-h-64">
                        {SURGERY_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value} className="text-base">
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {surgeryType === "outro" && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">
                        Descreva a Cirurgia *
                      </label>
                      <Input
                        value={customType}
                        onChange={(e) => setCustomType(e.target.value)}
                        placeholder="Ex: Septoplastia endoscópica"
                        className="text-base"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Data e Hora</label>
                    <CustomDateTimePicker
                      value={scheduledDate}
                      onChange={setScheduledDate}
                      placeholder="Selecionar data e hora"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Hospital / Clínica</label>
                    <Input
                      value={hospitalClinic}
                      onChange={(e) => setHospitalClinic(e.target.value)}
                      placeholder="Nome do hospital ou clínica"
                      className="text-base"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Cirurgião(ã)</label>
                    <Input
                      value={surgeonName}
                      onChange={(e) => setSurgeonName(e.target.value)}
                      placeholder="Nome do cirurgião"
                      className="text-base"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Observações</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Anotações livres sobre a cirurgia..."
                      className="w-full text-base bg-background border border-input rounded-md px-3 py-2 resize-none min-h-[72px] outline-none focus:ring-1 focus:ring-ring"
                      rows={3}
                    />
                  </div>
                </div>
                )}

                {activeTab === "pre" && (
                <div className="p-4">
                  <p className="text-xs text-muted-foreground mb-3">
                    Instruções a seguir ANTES da cirurgia: jejum, medicamentos, preparo.
                  </p>
                  <SurgeryInstructionImporter
                    phase="pre"
                    items={preItems}
                    onChange={setPreItems}
                  />
                </div>
                )}

                {activeTab === "pos" && (
                <div className="p-4">
                  <p className="text-xs text-muted-foreground mb-3">
                    Cuidados APÓS a cirurgia: repouso, curativo, retorno médico.
                  </p>
                  <SurgeryInstructionImporter
                    phase="post"
                    items={postItems}
                    onChange={setPostItems}
                  />
                </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-border/40 shrink-0">
            <Button
              className="w-full text-base font-semibold h-12"
              onClick={handleSave}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 size={18} className="animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                "Salvar Cirurgia"
              )}
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
