import { useState, useEffect, useMemo, useRef } from "react";
import { Loader2, Trash2, Paperclip, X, Eye, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MedicationAutocomplete from "@/components/MedicationAutocomplete";
import ConsultationCombobox from "@/components/ConsultationCombobox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useMedications, Medication, NewMedication } from "@/hooks/useMedications";
import { useConsultations } from "@/hooks/useConsultations";
import { addDays, format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMemberId: string;
  editingMedication?: Medication | null;
}

const FREQUENCY_OPTIONS = [
  { label: "1x ao dia (24h)", value: "24" },
  { label: "De 12 em 12 horas", value: "12" },
  { label: "De 8 em 8 horas", value: "8" },
  { label: "De 6 em 6 horas", value: "6" },
];

const INPUT_CLASSES = "flex h-10 w-full max-w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[16px] ring-offset-background box-border";

const AddMedicationDrawer = ({ open, onOpenChange, familyMemberId, editingMedication }: Props) => {
  const { user } = useAuth();
  const { addMedication, updateMedication, deleteMedication, uploadReceita } = useMedications(familyMemberId);
  const { consultations } = useConsultations(familyMemberId);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [frequencyHours, setFrequencyHours] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [status, setStatus] = useState("Ativo");
  const [consultationId, setConsultationId] = useState("none");
  const [usoContinuo, setUsoContinuo] = useState(false);
  const [medicoPrescritor, setMedicoPrescritor] = useState("");
  const [estoqueTotal, setEstoqueTotal] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState("");
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [receitaFile, setReceitaFile] = useState<File | null>(null);
  const [existingReceitaUrl, setExistingReceitaUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const receitaInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const isEditing = !!editingMedication;

  useEffect(() => {
    if (editingMedication) {
      setName(editingMedication.name);
      setDosage(editingMedication.dosage ?? "");
      const date = editingMedication.start_date?.slice(0, 10) ?? "";
      const time = editingMedication.start_time ?? "";
      if (date && time) {
        setStartDateTime(`${date}T${time}`);
      } else if (date) {
        setStartDateTime(`${date}T08:00`);
      } else {
        setStartDateTime("");
      }
      setFrequencyHours(editingMedication.frequency_hours?.toString() ?? "");
      setDurationDays(editingMedication.duration_days?.toString() ?? "");
      setStatus(editingMedication.status);
      setConsultationId(editingMedication.consultation_id ?? "none");
      setUsoContinuo(editingMedication.uso_continuo ?? false);
      setMedicoPrescritor(editingMedication.medico_prescritor ?? "");
      setEstoqueTotal(editingMedication.estoque_total?.toString() ?? "");
      setEstoqueMinimo(editingMedication.estoque_minimo?.toString() ?? "");
      setExistingReceitaUrl(editingMedication.receita_url ?? null);
      setReceitaFile(null);
    } else {
      resetForm();
    }
  }, [editingMedication, open]);

  const resetForm = () => {
    setName("");
    setDosage("");
    setStartDateTime("");
    setFrequencyHours("");
    setDurationDays("");
    setStatus("Ativo");
    setConsultationId("none");
    setUsoContinuo(false);
    setMedicoPrescritor("");
    setEstoqueTotal("");
    setEstoqueMinimo("");
    setReceitaFile(null);
    setExistingReceitaUrl(null);
  };

  const parsedDate = useMemo(() => {
    if (!startDateTime) return { date: null, time: null };
    const [d, t] = startDateTime.split("T");
    return { date: d || null, time: t || null };
  }, [startDateTime]);

  const calculatedEndDate = useMemo(() => {
    if (!parsedDate.date || !durationDays || Number(durationDays) <= 0) return null;
    return format(addDays(new Date(parsedDate.date + "T12:00:00"), Number(durationDays)), "yyyy-MM-dd");
  }, [parsedDate.date, durationDays]);

  const calculatedEndDateLabel = useMemo(() => {
    if (!calculatedEndDate) return null;
    return format(new Date(calculatedEndDate + "T12:00:00"), "dd/MM/yyyy");
  }, [calculatedEndDate]);

  const frequencyLabel = useMemo(() => {
    const opt = FREQUENCY_OPTIONS.find((o) => o.value === frequencyHours);
    return opt?.label ?? (frequencyHours ? `A cada ${frequencyHours}h` : "");
  }, [frequencyHours]);

  // Auto-fill doctor from selected consultation
  const handleConsultationChange = (value: string) => {
    setConsultationId(value);
    if (value !== "none") {
      const selected = consultations.find((c) => c.id === value);
      if (selected?.professional_name && !medicoPrescritor.trim()) {
        setMedicoPrescritor(selected.professional_name);
      }
    }
  };

  const handleAnalyzeWithAI = async () => {
    setIsAnalyzing(true);
    try {
      let urlToAnalyze = existingReceitaUrl;
      if (receitaFile) {
        const tempId = editingMedication?.id ?? crypto.randomUUID();
        urlToAnalyze = await uploadReceita(receitaFile, tempId);
        setExistingReceitaUrl(urlToAnalyze);
        setReceitaFile(null);
      }

      if (!urlToAnalyze) {
        toast.error("Nenhum arquivo disponível para análise.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("analyze-prescription", {
        body: { fileUrl: urlToAnalyze },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // New multi-medication format: { medico_prescritor, medicamentos[] }
      if (data?.medicamentos?.length > 0) {
        const med = data.medicamentos[0];
        if (med.nome_medicamento) setName(med.nome_medicamento);
        if (med.dosagem) setDosage(med.dosagem);
        if (med.frequencia) {
          // Map descriptive frequency to hours
          const freqMap: Record<string, string> = {
            "De 24 em 24 horas": "24",
            "De 12 em 12 horas": "12",
            "De 8 em 8 horas": "8",
            "De 6 em 6 horas": "6",
          };
          const mapped = freqMap[med.frequencia];
          if (mapped) setFrequencyHours(mapped);
        }
        if (med.duracao_dias) setDurationDays(String(med.duracao_dias));
        if (data.medico_prescritor) setMedicoPrescritor(data.medico_prescritor);

        const total = data.medicamentos.length;
        toast.success(
          total > 1
            ? `${total} medicamentos encontrados! Preenchido com o primeiro. (Wizard em breve)`
            : "Dados extraídos da receita com sucesso!"
        );
      } else {
        // Fallback: legacy single-medication format
        if (data?.nome_medicamento) setName(data.nome_medicamento);
        if (data?.dosagem) setDosage(data.dosagem);
        if (data?.frequencia_horas) setFrequencyHours(String(data.frequencia_horas));
        if (data?.duracao_dias) setDurationDays(String(data.duracao_dias));
        if (data?.medico_prescritor) setMedicoPrescritor(data.medico_prescritor);
        toast.success("Dados extraídos da receita com sucesso!");
      }
    } catch (err: any) {
      console.error("Prescription OCR error:", err);
      toast.error(err?.message || "Não foi possível ler a receita. Preencha manualmente.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Preencha o nome do medicamento.");
      return;
    }

    const freqNum = frequencyHours ? Number(frequencyHours) : null;
    const durNum = usoContinuo ? null : (durationDays ? Number(durationDays) : null);
    const finalEndDate = usoContinuo ? null : calculatedEndDate;
    const estTotalNum = estoqueTotal ? Number(estoqueTotal) : null;
    const estMinNum = estoqueMinimo ? Number(estoqueMinimo) : null;

    const commonFields = {
      name: name.trim(),
      dosage: dosage.trim() || null,
      start_time: parsedDate.time || null,
      frequency_hours: freqNum,
      frequency: frequencyLabel || null,
      duration_days: durNum,
      duration: durNum ? `${durNum} dias` : null,
      start_date: parsedDate.date || null,
      end_date: finalEndDate,
      consultation_id: consultationId === "none" ? null : consultationId,
      uso_continuo: usoContinuo,
      medico_prescritor: medicoPrescritor.trim() || null,
      estoque_total: estTotalNum,
      estoque_minimo: estMinNum,
    };

    try {
      setUploading(true);
      let receitaUrl: string | null = existingReceitaUrl;

      if (isEditing) {
        if (receitaFile) {
          receitaUrl = await uploadReceita(receitaFile, editingMedication.id);
        }
        await updateMedication.mutateAsync({
          id: editingMedication.id,
          ...commonFields,
          status,
          receita_url: receitaUrl,
        });
        toast.success("Medicamento atualizado!");
      } else {
        const tempId = crypto.randomUUID();
        if (receitaFile) {
          receitaUrl = await uploadReceita(receitaFile, tempId);
        }
        const medication: NewMedication = {
          family_member_id: familyMemberId,
          ...commonFields,
          receita_url: receitaUrl,
        };
        const result = await addMedication.mutateAsync(medication);
        if (user) {
          const { data: member } = await supabase
            .from("family_members")
            .select("name")
            .eq("id", familyMemberId)
            .single();
          const memberName = member?.name ?? "Familiar";
          const startStr = parsedDate.date
            ? format(new Date(parsedDate.date + "T12:00:00"), "dd/MM/yyyy")
            : "";
          const timeStr = parsedDate.time ? parsedDate.time.slice(0, 5) : "";
          const endStr = finalEndDate
            ? format(new Date(finalEndDate + "T12:00:00"), "dd/MM/yyyy")
            : "";
          let msgParts = `Medicamento: ${name.trim()}`;
          if (usoContinuo) {
            msgParts += `\nUso Contínuo`;
          }
          if (startStr) {
            msgParts += `\nInício: ${startStr}${timeStr ? ` às ${timeStr}` : ""}`;
          }
          if (endStr) {
            msgParts += `\nTérmino: ${endStr}${timeStr ? ` às ${timeStr}` : ""}`;
          }
          await supabase.from("notifications").insert({
            user_id: user.id,
            family_member_id: familyMemberId,
            title: `Novo Tratamento de ${memberName}`,
            message: msgParts,
            type: "medication",
            scheduled_for: new Date().toISOString(),
            is_read: false,
          });
        }
        toast.success("Medicamento adicionado!");
      }
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!editingMedication) return;
    try {
      await deleteMedication.mutateAsync(editingMedication.id);
      toast.success("Medicamento excluído.");
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error("Erro ao excluir. Tente novamente.");
    }
    setShowDeleteAlert(false);
  };

  const isPending = addMedication.isPending || updateMedication.isPending || uploading;
  const isReceitaPdf = existingReceitaUrl?.toLowerCase().endsWith(".pdf");

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-background outline-none">
          <DrawerHeader>
            <DrawerTitle className="text-primary">
              {isEditing ? "Editar Medicamento" : "Novo Medicamento"}
            </DrawerTitle>
            <DrawerDescription>
              {isEditing ? "Altere os dados do medicamento." : "Preencha os dados do medicamento."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain p-4 no-scrollbar">
            <div className="flex flex-col gap-4">
              {/* Linha 1: Nome */}
              <div className="space-y-1.5">
                <Label>Nome do Medicamento *</Label>
                <MedicationAutocomplete value={name} onChange={setName} />
              </div>

              {/* Linha 2: Dosagem | Frequência */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Dosagem</Label>
                  <Input placeholder="Ex: 5ml" value={dosage} onChange={(e) => setDosage(e.target.value)} className="text-[16px]" />
                </div>
                <div className="space-y-1.5">
                  <Label>Frequência</Label>
                  <Select value={frequencyHours} onValueChange={setFrequencyHours}>
                    <SelectTrigger className="text-[16px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Linha 3: Início | Duração */}
              <div className="grid grid-cols-2 gap-3 items-start">
                <div className="space-y-1.5">
                  <Label>Data e Hora de Início</Label>
                  <input
                    type="datetime-local"
                    value={startDateTime}
                    onChange={(e) => setStartDateTime(e.target.value)}
                    min="1900-01-01T00:00"
                    max="2099-12-31T23:59"
                    className={`${INPUT_CLASSES} appearance-none`}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className={usoContinuo ? "text-muted-foreground" : ""}>Duração (dias)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="Ex: 7"
                    value={usoContinuo ? "" : durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    disabled={usoContinuo}
                    className="text-[16px]"
                  />
                  {!usoContinuo && calculatedEndDateLabel && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Término previsto: {calculatedEndDateLabel}
                    </p>
                  )}
                </div>
              </div>

              {/* Linha 4: Vincular Consulta */}
              <div className="space-y-1.5">
                <Label>Vincular Consulta</Label>
                <ConsultationCombobox
                  familyMemberId={familyMemberId}
                  value={consultationId}
                  onValueChange={handleConsultationChange}
                />
              </div>

              {/* Moldura Expansível: Uso Contínuo & Avançado */}
              <div className="p-4 bg-muted/40 border border-border rounded-xl flex flex-col gap-4 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Uso Contínuo</span>
                  <Switch checked={usoContinuo} onCheckedChange={setUsoContinuo} />
                </div>

                {usoContinuo && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Médico Prescritor</Label>
                      <Input
                        placeholder="Ex: Dr. Varella"
                        value={medicoPrescritor}
                        onChange={(e) => setMedicoPrescritor(e.target.value)}
                        className="text-[16px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Controle de Estoque</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Qtd. Comprimidos</Label>
                          <Input type="number" inputMode="numeric" placeholder="Ex: 30" value={estoqueTotal} onChange={(e) => setEstoqueTotal(e.target.value)} className="text-[16px]" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Alertar Faltando</Label>
                          <Input type="number" inputMode="numeric" placeholder="Ex: 5" value={estoqueMinimo} onChange={(e) => setEstoqueMinimo(e.target.value)} className="text-[16px]" />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Receita Médica - Upload */}
              <div className="space-y-1.5">
                <Label>Receita Médica (PDF ou Imagem)</Label>
                <input
                  ref={receitaInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const selected = e.target.files?.[0] ?? null;
                    if (selected && selected.size > 20 * 1024 * 1024) {
                      toast.error("Arquivo muito grande (máx 20MB).");
                      return;
                    }
                    setReceitaFile(selected);
                  }}
                />
                {receitaFile ? (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border border-border">
                    <Paperclip size={16} className="text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground truncate flex-1">{receitaFile.name}</span>
                    <button onClick={() => { setReceitaFile(null); if (receitaInputRef.current) receitaInputRef.current.value = ""; }}>
                      <X size={16} className="text-muted-foreground" />
                    </button>
                  </div>
                ) : existingReceitaUrl ? (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border border-border">
                    <Paperclip size={16} className="text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground truncate flex-1">Receita anexada</span>
                    <Button variant="ghost" size="sm" className="h-auto p-1" onClick={() => setViewerOpen(true)}>
                      <Eye size={16} className="text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-500 h-8 w-8" onClick={() => { setExistingReceitaUrl(null); setReceitaFile(null); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-muted-foreground"
                    onClick={() => receitaInputRef.current?.click()}
                  >
                    <Paperclip size={16} />
                    Selecionar arquivo
                  </Button>
                )}
              </div>

              {/* AI Prescription Reader */}
              {(receitaFile || existingReceitaUrl) && (
                <div className="space-y-1.5">
                  <Button
                    type="button"
                    disabled={isAnalyzing || isPending}
                    onClick={handleAnalyzeWithAI}
                    className="w-full gap-2 bg-gradient-to-r from-accent to-primary text-primary-foreground hover:opacity-90 shadow-md"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Lendo receita...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Preencher formulário com IA
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Nossa IA lê a foto da receita e preenche o formulário para você.
                  </p>
                </div>
              )}

              {/* Status do Tratamento (apenas edição) - último item */}
              {isEditing && (
                <div className="flex flex-col gap-2">
                  <Label>Status do Tratamento</Label>
                  <div className="flex p-1 bg-muted rounded-lg">
                    <button
                      type="button"
                      onClick={() => setStatus('Ativo')}
                      className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                        status === 'Ativo'
                          ? 'bg-[#F2A97F] text-slate-900 shadow-sm font-bold'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Ativo
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('Concluído')}
                      className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                        status === 'Concluído'
                          ? 'bg-[#A7D3CB] text-slate-900 shadow-sm font-bold'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Concluído
                    </button>
                  </div>
                </div>
              )}

              {/* Botão Excluir (apenas edição) */}
              {isEditing && (
                <div className="pt-2 border-t border-border">
                  <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setShowDeleteAlert(true)}>
                    <Trash2 size={16} className="mr-2" />
                    Excluir Medicamento
                  </Button>
                </div>
              )}
            </div>
          </div>

          <DrawerFooter className="flex-row gap-3">
            <DrawerClose asChild>
              <Button variant="ghost" className="flex-1">Cancelar</Button>
            </DrawerClose>
            <Button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1"
            >
              {isPending ? <Loader2 className="animate-spin" size={18} /> : isEditing ? "Salvar Alterações" : "Salvar Medicamento"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este medicamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita e os dados do tratamento serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMedication.isPending ? <Loader2 className="animate-spin" size={16} /> : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Visualizador de Receita */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-[95vw] w-full max-h-[90vh] p-0 gap-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="text-primary">Receita Médica</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-4 flex-1 overflow-auto">
            {existingReceitaUrl && (
              isReceitaPdf ? (
                <iframe src={`https://docs.google.com/gview?url=${encodeURIComponent(existingReceitaUrl)}&embedded=true`} className="w-full h-[70vh] rounded-md border-0" />
              ) : (
                <img src={existingReceitaUrl} alt="Receita médica" className="w-full object-contain max-h-[70vh] rounded-md" />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AddMedicationDrawer;
