import { useState, useEffect } from "react";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, X, Check, ChevronsUpDown } from "lucide-react";
import { SURGERY_TYPES_BY_CATEGORY, getSurgeryLabel } from "@/lib/surgeryTypes";
import { useSurgeries } from "@/hooks/useSurgeries";
import { SurgeryInstructionImporter } from "./SurgeryInstructionImporter";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import type { InstructionItem, Surgery } from "@/hooks/useSurgeries";
import { toast } from "sonner";
import { parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Drawer as ShadcnDrawer,
  DrawerContent as ShadcnDrawerContent,
} from "@/components/ui/drawer";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface AddSurgeryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMemberId: string;
  editingSurgery?: Surgery | null;
}

export function AddSurgeryDrawer({
  open,
  onOpenChange,
  familyMemberId,
  editingSurgery,
}: AddSurgeryDrawerProps) {
  const { createMutation, updateMutation, updateInstructionsMutation } = useSurgeries(familyMemberId);
  const isEditing = !!editingSurgery;
  const [activeTab, setActiveTab] = useState("agendamento");
  const [surgeryTypeOpen, setSurgeryTypeOpen] = useState(false);
  const [surgerySearch, setSurgerySearch] = useState("");

  const [surgeryType, setSurgeryType] = useState("");
  const [customType, setCustomType] = useState("");
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [hospitalClinic, setHospitalClinic] = useState("");
  const [surgeonName, setSurgeonName] = useState("");
  const [notes, setNotes] = useState("");
  const [preItems, setPreItems] = useState<InstructionItem[]>([]);
  const [postItems, setPostItems] = useState<InstructionItem[]>([]);

  // Populando campos ao abrir em modo edição
  useEffect(() => {
    if (editingSurgery) {
      setSurgeryType(editingSurgery.surgery_type ?? "");
      setCustomType(editingSurgery.custom_type ?? "");
      const d = editingSurgery.scheduled_date ? parseISO(editingSurgery.scheduled_date) : null;
      setScheduledDate(d && isValid(d) ? d : null);
      setHospitalClinic(editingSurgery.hospital_clinic ?? "");
      setSurgeonName(editingSurgery.surgeon_name ?? "");
      setNotes(editingSurgery.notes ?? "");
      setPreItems(
        editingSurgery.surgery_instructions?.find((i) => i.phase === "pre")?.items ?? []
      );
      setPostItems(
        editingSurgery.surgery_instructions?.find((i) => i.phase === "post")?.items ?? []
      );
      setActiveTab("agendamento");
    } else {
      reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingSurgery, open]);

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

  const isPending = createMutation.isPending || updateMutation.isPending || updateInstructionsMutation.isPending;

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
      if (isEditing && editingSurgery) {
        await updateMutation.mutateAsync({
          id: editingSurgery.id,
          surgery_type: surgeryType,
          custom_type: surgeryType === "outro" ? customType.trim() : null,
          scheduled_date: scheduledDate ? scheduledDate.toISOString() : null,
          hospital_clinic: hospitalClinic.trim() || null,
          surgeon_name: surgeonName.trim() || null,
          notes: notes.trim() || null,
        });
        await updateInstructionsMutation.mutateAsync({
          surgeryId: editingSurgery.id,
          phase: "pre",
          items: preItems,
        });
        await updateInstructionsMutation.mutateAsync({
          surgeryId: editingSurgery.id,
          phase: "post",
          items: postItems,
        });
      } else {
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
      }
      reset();
      onOpenChange(false);
    } catch {
      // toast exibido no onError do hook
    }
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-[20px] h-[90dvh] flex flex-col">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header — título centralizado e verde */}
          <div className="relative flex items-center justify-center px-4 pb-3 shrink-0 border-b border-border/40">
            <Drawer.Title className="text-base font-semibold text-[#78C2AD]">
              {isEditing ? "Editar Cirurgia" : "Nova Cirurgia"}
            </Drawer.Title>
            <button
              onClick={handleClose}
              className="absolute right-4 p-1 rounded-lg active:bg-muted/40"
              aria-label="Fechar"
            >
              <X size={20} className="text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Pill tabs */}
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

            <div className="flex-1 overflow-y-auto no-scrollbar">
              {activeTab === "agendamento" && (
                <div className="px-4 pb-4 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      Tipo de Cirurgia *
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={surgeryTypeOpen}
                      onClick={() => setSurgeryTypeOpen(true)}
                      className="flex h-10 w-full justify-between rounded-md border border-input bg-background px-3 py-2 text-[16px] font-normal hover:bg-background"
                    >
                      <span className={cn("truncate", !surgeryType && "text-muted-foreground")}>
                        {surgeryType
                          ? getSurgeryLabel(surgeryType)
                          : "Ex: Bypass Gástrico, Apendicectomia..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>

                    <ShadcnDrawer
                      open={surgeryTypeOpen}
                      onOpenChange={(o) => {
                        setSurgeryTypeOpen(o);
                        if (!o) setSurgerySearch("");
                      }}
                    >
                      <ShadcnDrawerContent className="flex flex-col max-h-[90vh]">
                        <div className="px-4 pt-4 pb-2">
                          <h3 className="text-base font-semibold text-foreground mb-3">
                            Tipo de Cirurgia
                          </h3>
                        </div>
                        <Command shouldFilter={false} className="border-none">
                          <div className="px-4">
                            <CommandInput
                              placeholder="Buscar tipo de cirurgia..."
                              value={surgerySearch}
                              onValueChange={setSurgerySearch}
                              className="text-[16px]"
                            />
                          </div>
                          <CommandList className="max-h-[55vh] overflow-y-auto px-2 pb-safe-or-4">
                            <CommandEmpty>Tipo não encontrado.</CommandEmpty>
                            {Object.entries(SURGERY_TYPES_BY_CATEGORY)
                              .map(([category, types]) => ({
                                category,
                                types: types.filter((t) =>
                                  t.label.toLowerCase().includes(surgerySearch.toLowerCase()) ||
                                  t.category.toLowerCase().includes(surgerySearch.toLowerCase())
                                ),
                              }))
                              .filter(({ types }) => types.length > 0)
                              .map(({ category, types }) => (
                                <CommandGroup key={category} heading={category}>
                                  {types.map((type) => (
                                    <CommandItem
                                      key={type.value}
                                      value={type.value}
                                      onSelect={() => {
                                        setSurgeryType(type.value);
                                        setSurgerySearch("");
                                        setSurgeryTypeOpen(false);
                                      }}
                                      className="rounded-lg"
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          surgeryType === type.value ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {type.label}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              ))}
                          </CommandList>
                        </Command>
                      </ShadcnDrawerContent>
                    </ShadcnDrawer>
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
                    <label className="text-sm font-medium text-foreground">Nome do Profissional</label>
                    <Input
                      value={surgeonName}
                      onChange={(e) => setSurgeonName(e.target.value)}
                      placeholder="Ex: Dr. João Silva, Dra. Maria Oliveira"
                      className="text-base"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Data e Hora</label>
                    <DateTimePicker
                      value={scheduledDate ?? undefined}
                      onChange={(d) => setScheduledDate(d ?? null)}
                      placeholder="Ex: 15/07/2025 às 08:00"
                      mode="datetime"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Local (Hospital / Clínica / Laboratório)</label>
                    <Input
                      value={hospitalClinic}
                      onChange={(e) => setHospitalClinic(e.target.value)}
                      placeholder="Ex: Hospital das Clínicas, Clínica Saúde Total"
                      className="text-base"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Observações</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex: Trazer exames pré-operatórios, alergia a iodo..."
                      className="w-full text-base bg-background border border-input rounded-md px-3 py-2 resize-none min-h-[72px] outline-none focus:ring-1 focus:ring-ring"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {activeTab === "pre" && (
                <div className="px-4 pb-4">
                  <p className="text-xs text-muted-foreground mb-3 mt-1">
                    Instruções a seguir <strong>antes</strong> da cirurgia: jejum, medicamentos, preparo.
                  </p>
                  <SurgeryInstructionImporter
                    phase="pre"
                    items={preItems}
                    onChange={setPreItems}
                  />
                </div>
              )}

              {activeTab === "pos" && (
                <div className="px-4 pb-4">
                  <p className="text-xs text-muted-foreground mb-3 mt-1">
                    Cuidados <strong>após</strong> a cirurgia: repouso, curativo, retorno médico.
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

          {/* Footer — Cancelar + Agendar (padrão Consultas) */}
          <div className="p-4 border-t border-border/40 shrink-0 flex gap-3">
            <Button
              variant="ghost"
              className="flex-1 text-base"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 text-base font-semibold"
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 size={18} className="animate-spin mr-2" />
                  Salvando...
                </>
              ) : isEditing ? (
                "Salvar Alterações"
              ) : (
                "Agendar Cirurgia"
              )}
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
