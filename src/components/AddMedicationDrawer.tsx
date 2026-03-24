import { useState, useEffect, useMemo, useRef } from "react";
import { Loader2, Trash2, Paperclip, X, Eye, Sparkles, ChevronRight, CheckCheck, ArrowLeft } from "lucide-react";
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
  { label: "1x dia", value: "24" },
  { label: "12/12 h", value: "12" },
  { label: "8/8 h", value: "8" },
  { label: "6/6 h", value: "6" },
  { label: "4/4 h", value: "4" },
  { label: "2/2 h", value: "2" },
  { label: "1/1 h", value: "1" },
];

const FREQ_MAP: Record<string, string> = {
  "De 24 em 24 horas": "24",
  "1x ao dia": "24",
  "De 12 em 12 horas": "12",
  "De 8 em 8 horas": "8",
  "De 6 em 6 horas": "6",
  "De 4 em 4 horas": "4",
  "De 2 em 2 horas": "2",
  "De 1 em 1 hora": "1",
};

const INPUT_CLASSES = "flex h-10 w-full max-w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[16px] ring-offset-background box-border";

type ExtractedMed = {
  nome_medicamento: string;
  dosagem?: string | null;
  frequencia?: string | null;
  duracao_dias?: number | null;
  _name?: string;
  _dosage?: string;
  _frequencyHours?: string;
  _durationDays?: string;
  _usoContinuo?: boolean;
  _estoqueTotal?: string;
  _estoqueMinimo?: string;
};

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

  const [extractedMeds, setExtractedMeds] = useState<ExtractedMed[]>([]);
  const [currentMedIndex, setCurrentMedIndex] = useState(0);
  const isWizardMode = extractedMeds.length > 1;

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
      setExtractedMeds([]);
      setCurrentMedIndex(0);
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
    setExtractedMeds([]);
    setCurrentMedIndex(0);
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

  const populateFromExtracted = (med: ExtractedMed) => {
    setName(med._name ?? med.nome_medicamento ?? "");
    setDosage(med._dosage ?? med.dosagem ?? "");
    const freq = med._frequencyHours ?? (med.frequencia ? FREQ_MAP[med.frequencia] ?? "" : "");
    setFrequencyHours(freq);
    const dur = med._durationDays ?? (med.duracao_dias ? String(med.duracao_dias) : "");
    setDurationDays(dur);
    setUsoContinuo(med._usoContinuo ?? false);
    setEstoqueTotal(med._estoqueTotal ?? "");
    setEstoqueMinimo(med._estoqueMinimo ?? "");
  };

  const saveCurrentToExtracted = () => {
    setExtractedMeds((prev) => {
      const updated = [...prev];
      if (updated[currentMedIndex]) {
        updated[currentMedIndex] = {
          ...updated[currentMedIndex],
          _name: name,
          _dosage: dosage,
          _frequencyHours: frequencyHours,
          _durationDays: durationDays,
          _usoContinuo: usoContinuo,
          _estoqueTotal: estoqueTotal,
          _estoqueMinimo: estoqueMinimo,
        };
      }
      return updated;
    });
  };

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

      if (data?.medicamentos?.length > 0) {
        if (data.medico_prescritor) setMedicoPrescritor(data.medico_prescritor);

        if (data.medicamentos.length > 1) {
          setExtractedMeds(data.medicamentos);
          setCurrentMedIndex(0);
          populateFromExtracted(data.medicamentos[0]);
          toast.success(`${data.medicamentos.length} medicamentos encontrados! Revise um por um.`);
        } else {
          setExtractedMeds([]);
          setCurrentMedIndex(0);
          populateFromExtracted(data.medicamentos[0]);
          toast.success("Dados extraídos da receita com sucesso!");
        }
      } else {
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

  const handleNextMed = () => {
    saveCurrentToExtracted();
    const nextIndex = currentMedIndex + 1;
    setCurrentMedIndex(nextIndex);
    populateFromExtracted(extractedMeds[nextIndex]);
  };

  const handleBackMed = () => {
    saveCurrentToExtracted();
    const prevIndex = currentMedIndex - 1;
    setCurrentMedIndex(prevIndex);
    populateFromExtracted(extractedMeds[prevIndex]);
  };

  const buildMedPayload = () => {
    const freqNum = frequencyHours ? Number(frequencyHours) : null;
    const durNum = usoContinuo ? null : (durationDays ? Number(durationDays) : null);
    const finalEndDate = usoContinuo ? null : calculatedEndDate;
    const estTotalNum = estoqueTotal ? Number(estoqueTotal) : null;
    const estMinNum = estoqueMinimo ? Number(estoqueMinimo) : null;
    const freqLbl = FREQUENCY_OPTIONS.find((o) => o.value === frequencyHours)?.label ?? (frequencyHours ? `A cada ${frequencyHours}h` : null);

    return {
      name: name.trim(),
      dosage: dosage.trim() || null,
      start_time: parsedDate.time || null,
      frequency_hours: freqNum,
      frequency: freqLbl || null,
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
  };

  const buildMedPayloadFromExtracted = (med: ExtractedMed) => {
    const medName = (med._name ?? med.nome_medicamento ?? "").trim();
    const medDosage = (med._dosage ?? med.dosagem ?? "").trim() || null;
    const medFreqHours = med._frequencyHours ?? (med.frequencia ? FREQ_MAP[med.frequencia] ?? "" : "");
    const medDurDays = med._durationDays ?? (med.duracao_dias ? String(med.duracao_dias) : "");
    const medUsoContinuo = med._usoContinuo ?? false;
    const freqNum = medFreqHours ? Number(medFreqHours) : null;
    const durNum = medUsoContinuo ? null : (medDurDays ? Number(medDurDays) : null);
    const freqLbl = FREQUENCY_OPTIONS.find((o) => o.value === medFreqHours)?.label ?? (medFreqHours ? `A cada ${medFreqHours}h` : null);

    let endDate: string | null = null;
    if (!medUsoContinuo && parsedDate.date && durNum && durNum > 0) {
      endDate = format(addDays(new Date(parsedDate.date + "T12:00:00"), durNum), "yyyy-MM-dd");
    }

    const estTotalNum = med._estoqueTotal ? Number(med._estoqueTotal) : null;
    const estMinNum = med._estoqueMinimo ? Number(med._estoqueMinimo) : null;

    return {
      name: medName,
      dosage: medDosage,
      start_time: parsedDate.time || null,
      frequency_hours: freqNum,
      frequency: freqLbl || null,
      duration_days: durNum,
      duration: durNum ? `${durNum} dias` : null,
      start_date: parsedDate.date || null,
      end_date: endDate,
      consultation_id: consultationId === "none" ? null : consultationId,
      uso_continuo: medUsoContinuo,
      medico_prescritor: medicoPrescritor.trim() || null,
      estoque_total: estTotalNum,
      estoque_minimo: estMinNum,
    };
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Preencha o nome do medicamento.");
      return;
    }

    try {
      setUploading(true);
      let receitaUrl: string | null = existingReceitaUrl;

      if (isEditing) {
        if (receitaFile) {
          receitaUrl = await uploadReceita(receitaFile, editingMedication.id);
        }
        const payload = buildMedPayload();
        await updateMedication.mutateAsync({
          id: editingMedication.id,
          ...payload,
          status,
          receita_url: receitaUrl,
        });
        toast.success("Medicamento atualizado!");
      } else if (isWizardMode) {
        saveCurrentToExtracted();
        const allMeds = extractedMeds.map((med, idx) => {
          if (idx === currentMedIndex) {
            return buildMedPayload();
          }
          return buildMedPayloadFromExtracted(med);
        });

        const validMeds = allMeds.filter((m) => m.name.trim());

        if (receitaFile) {
          const tempId = crypto.randomUUID();
          receitaUrl = await uploadReceita(receitaFile, tempId);
        }

        const inserts: NewMedication[] = validMeds.map((m) => ({
          family_member_id: familyMemberId,
          ...m,
          receita_url: receitaUrl,
        }));

        await Promise.all(inserts.map((med) => addMedication.mutateAsync(med)));

        if (user) {
          const { data: member } = await supabase
            .from("family_members")
            .select("name")
            .eq("id", familyMemberId)
            .single();
          const memberName = member?.name ?? "Familiar";
          const medNames = validMeds.map((m) => m.name).join(", ");
          await supabase.from("notifications").insert({
            user_id: user.id,
            family_member_id: familyMemberId,
            title: `${validMeds.length} Medicamentos adicionados para ${memberName}`,
            message: `Medicamentos: ${medNames}`,
            type: "medication",
            scheduled_for: new Date().toISOString(),
            is_read: false,
          });
        }

        toast.success(`${validMeds.length} medicamentos salvos com sucesso!`);
      } else {
        const tempId = crypto.randomUUID();
        if (receitaFile) {
          receitaUrl = await uploadReceita(receitaFile, tempId);
        }
        const payload = buildMedPayload();
        const medication: NewMedication = {
          family_member_id: familyMemberId,
          ...payload,
          receita_url: receitaUrl,
        };
        await addMedication.mutateAsync(medication);

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
          const finalEndDate = usoContinuo ? null : calculatedEndDate;
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
  const isLastWizardStep = isWizardMode && currentMedIndex === extractedMeds.length - 1;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-background outline-none">
          <DrawerHeader>
            <DrawerTitle className="text-primary">
              {isWizardMode ? (
              <span className="text-[#1C3333] font-bold">
                  Medicamento {currentMedIndex + 1} de {extractedMeds.length}
                </span>
              ) : isEditing ? "Editar Medicamento" : "Novo Medicamento"}
            </DrawerTitle>
            <DrawerDescription>
              {isWizardMode
                ? "Revise e ajuste os dados de cada medicamento extraído pela IA."
                : isEditing ? "Altere os dados do medicamento." : "Preencha os dados do medicamento."}
            </DrawerDescription>
          </DrawerHeader>

          {/* Wizard progress bar */}
          {isWizardMode && (
            <div className="px-4 pb-2">
              <div className="flex gap-1">
                {extractedMeds.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      idx <= currentMedIndex ? "bg-[#1C3333]" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto overscroll-contain p-4 no-scrollbar">
            <div className="flex flex-col gap-6">

              {/* ═══════ BLOCO 1: Origem e Documentação (com moldura) ═══════ */}
              <div className="p-4 border border-border rounded-xl bg-muted/30 space-y-4">
                {/* Vincular Consulta */}
                <div className="space-y-1.5">
                  <Label>Vincular Consulta</Label>
                  <ConsultationCombobox
                    familyMemberId={familyMemberId}
                    value={consultationId}
                    onValueChange={handleConsultationChange}
                  />
                </div>

                {/* Receita Médica - Upload + IA */}
                <div className="space-y-3">
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
                    <div className="flex items-center gap-2 p-3 bg-background rounded-md border border-border">
                      <Paperclip size={16} className="text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground truncate flex-1">{receitaFile.name}</span>
                      <button onClick={() => { setReceitaFile(null); if (receitaInputRef.current) receitaInputRef.current.value = ""; }}>
                        <X size={16} className="text-muted-foreground" />
                      </button>
                    </div>
                  ) : existingReceitaUrl ? (
                    <div className="flex items-center gap-2 p-3 bg-background rounded-md border border-border">
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

                  {!isEditing && !isWizardMode && (
                    <div className="space-y-1.5">
                      <Button
                        type="button"
                        disabled={(!receitaFile && !existingReceitaUrl) || isAnalyzing || isPending}
                        onClick={handleAnalyzeWithAI}
                        className="w-full gap-2 bg-gradient-to-r from-accent to-primary text-primary-foreground hover:opacity-90 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
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
                        {(!receitaFile && !existingReceitaUrl)
                          ? "Anexe uma foto da receita para ativar o preenchimento automático."
                          : "Nossa IA lê a foto da receita e preenche o formulário para você."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Médico Prescritor */}
                <div className="space-y-1.5">
                  <Label>Médico Prescritor</Label>
                  <Input
                    placeholder="Ex: Dr. Varella"
                    value={medicoPrescritor}
                    onChange={(e) => setMedicoPrescritor(e.target.value)}
                    className="text-[16px]"
                  />
                </div>
              </div>

              {/* ═══════ BLOCO 2: Tratamento Principal (com moldura) ═══════ */}
              <div className="p-4 border border-border rounded-xl bg-muted/30 space-y-4">
                <div className="space-y-1.5">
                  <Label>Nome do Medicamento *</Label>
                  <MedicationAutocomplete value={name} onChange={setName} />
                </div>

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

                <div className="grid grid-cols-[2fr_1fr] gap-4 items-start">
                  <div className="space-y-1.5">
                    <Label>Data/Hora Início</Label>
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
                    <Label className={usoContinuo ? "text-muted-foreground" : ""}>Duração</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      placeholder="Ex: 7 dias"
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
              </div>

              {/* ═══════ BLOCO 3: Uso Contínuo (com moldura) ═══════ */}
              <div className="p-4 bg-muted/40 border border-border rounded-xl flex flex-col gap-4 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Uso Contínuo</span>
                  <Switch checked={usoContinuo} onCheckedChange={setUsoContinuo} />
                </div>

                {usoContinuo && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Controle de Estoque</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Qtd. Comprimidos</Label>
                        <Input type="number" inputMode="numeric" placeholder="Ex: 30" value={estoqueTotal} onChange={(e) => setEstoqueTotal(e.target.value)} className="text-[16px]" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Alerta de Compra</Label>
                        <Input type="number" inputMode="numeric" placeholder="Ex: 5" value={estoqueMinimo} onChange={(e) => setEstoqueMinimo(e.target.value)} className="text-[16px]" />
                      </div>
                    </div>
                    {/* Espaço reservado para Foto do Medicamento (próximo prompt) */}
                  </div>
                )}
              </div>

              {/* Status do Tratamento (apenas edição) */}
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
            {isWizardMode && currentMedIndex > 0 ? (
              <Button variant="ghost" className="flex-1" onClick={handleBackMed}>
                <ArrowLeft size={16} className="mr-1" />
                Voltar
              </Button>
            ) : (
              <DrawerClose asChild>
                <Button variant="ghost" className="flex-1">Cancelar</Button>
              </DrawerClose>
            )}
            {isWizardMode && !isLastWizardStep ? (
              <Button
                onClick={handleNextMed}
                className="flex-1 gap-2 bg-[#1C3333] hover:bg-[#2A4B4B] text-white"
              >
                Próximo Medicamento
                <ChevronRight size={16} />
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={isPending}
                className={`flex-1 gap-2 ${isWizardMode ? "bg-[#1C3333] hover:bg-[#2A4B4B] text-white" : ""}`}
              >
                {isPending ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : isWizardMode ? (
                  <>
                    <CheckCheck size={16} />
                    Salvar Receita
                  </>
                ) : isEditing ? "Salvar Alterações" : "Salvar Medicamento"}
              </Button>
            )}
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
