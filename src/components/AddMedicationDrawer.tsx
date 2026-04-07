import { useState, useEffect, useMemo } from "react";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Loader2, Trash2, Paperclip, Eye, ChevronRight, CheckCheck, ArrowLeft, AlertTriangle, Plus, X } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAiStatus } from "@/hooks/useAiStatus";
import PaywallModal from "@/components/PaywallModal";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MedicationAutocomplete from "@/components/MedicationAutocomplete";
import ReasonCombobox from "@/components/ReasonCombobox";
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
import { addDays, format, differenceInYears, parseISO } from "date-fns";
import { parseDateInSP, toSPTime } from "@/lib/dateUtils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMemberId: string;
  editingMedication?: Medication | null;
  aiData?: { data: any; receitaUrl: string | null } | null;
}

const FREQUENCY_OPTIONS = [
  { label: "1x dia", value: "24" },
  { label: "12/12 h", value: "12" },
  { label: "8/8 h", value: "8" },
  { label: "6/6 h", value: "6" },
  { label: "4/4 h", value: "4" },
  { label: "2/2 h", value: "2" },
  { label: "1/1 h", value: "1" },
  { label: "Horários Específicos", value: "specific_times" },
  { label: "Dias da Semana", value: "specific_days" },
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

const DAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const INPUT_CLASSES = "flex h-10 w-full max-w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[16px] ring-offset-background box-border";

type ExtractedMed = {
  nome_medicamento: string;
  dosagem?: string | null;
  frequencia?: string | null;
  frequency_type?: "fixed_interval" | "specific_times" | "specific_days" | null;
  frequency_hours?: number | null;
  specific_times?: string[] | null;
  specific_days?: number[] | null;
  duracao_dias?: number | null;
  confianca?: "alta" | "media" | "baixa" | null;
  _name?: string;
  _dosage?: string;
  _frequencyHours?: string;
  _frequencyType?: string;
  _specificTimes?: string[];
  _specificDays?: number[];
  _durationDays?: string;
  _usoContinuo?: boolean;
  _estoqueTotal?: string;
  _estoqueMinimo?: string;
};

const AddMedicationDrawer = ({ open, onOpenChange, familyMemberId, editingMedication, aiData }: Props) => {
  const { user } = useAuth();
  const { groupId } = useFamilyGroup();
  const { canUsePremium } = useSubscription();
  const { isAiActive } = useAiStatus();
  const [showPaywall, setShowPaywall] = useState(false);
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
  const [reason, setReason] = useState("");
  const [frequencyType, setFrequencyType] = useState<string>("fixed_interval");
  const [specificTimes, setSpecificTimes] = useState<string[]>([]);
  const [specificDays, setSpecificDays] = useState<number[]>([]);
  const [newTimeInput, setNewTimeInput] = useState("");
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [receitaFile, setReceitaFile] = useState<File | null>(null);
  const [existingReceitaUrl, setExistingReceitaUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [patientAge, setPatientAge] = useState<number | null>(null);
  const [patientName, setPatientName] = useState<string | null>(null);
  const isEditing = !!editingMedication;
  const isPediatric = patientAge !== null && patientAge < 12;

  const [extractedMeds, setExtractedMeds] = useState<ExtractedMed[]>([]);
  const [currentMedIndex, setCurrentMedIndex] = useState(0);
  const [aiReviewMode, setAiReviewMode] = useState(false);
  const isWizardMode = extractedMeds.length > 1;

  // Fetch patient age from family_members
  useEffect(() => {
    if (!familyMemberId || !open) return;
    supabase
      .from("family_members")
      .select("birth_date, name")
      .eq("id", familyMemberId)
      .single()
      .then(({ data }) => {
        if (data?.birth_date) {
          setPatientAge(differenceInYears(new Date(), new Date(data.birth_date)));
        } else {
          setPatientAge(null);
        }
        setPatientName(data?.name?.split(" ")[0] ?? null);
      });
  }, [familyMemberId, open]);

  useEffect(() => {
    if (editingMedication) {
      setName(editingMedication.name);
      setDosage(editingMedication.dosage ?? "");
      const startDate = editingMedication.start_date?.slice(0, 10) ?? "";
      const startTime = (editingMedication.start_time || "00:00:00").slice(0, 8);
      if (startDate) {
        const initialDateObj = new Date(`${startDate}T${startTime}`);

        if (!isNaN(initialDateObj.getTime())) {
          setStartDateTime(format(initialDateObj, "yyyy-MM-dd'T'HH:mm"));
        } else {
          const parsedDate = parseISO(`${startDate}T${startTime}`);
          setStartDateTime(!isNaN(parsedDate.getTime()) ? format(parsedDate, "yyyy-MM-dd'T'HH:mm") : "");
        }
      } else {
        setStartDateTime("");
      }
      // Populate frequency type fields
      const editFreqType = (editingMedication as any).frequency_type ?? "fixed_interval";
      setFrequencyType(editFreqType);
      if (editFreqType === "specific_times") {
        setFrequencyHours("specific_times");
        setSpecificTimes(Array.isArray((editingMedication as any).specific_times) ? (editingMedication as any).specific_times : []);
        setSpecificDays([]);
      } else if (editFreqType === "specific_days") {
        setFrequencyHours("specific_days");
        setSpecificTimes(Array.isArray((editingMedication as any).specific_times) ? (editingMedication as any).specific_times : []);
        setSpecificDays(Array.isArray((editingMedication as any).specific_days) ? (editingMedication as any).specific_days : []);
      } else {
        setFrequencyHours(editingMedication.frequency_hours?.toString() ?? "");
        setSpecificTimes([]);
        setSpecificDays([]);
      }
      setDurationDays(editingMedication.duration_days?.toString() ?? "");
      setStatus(editingMedication.status);
      setConsultationId(editingMedication.consultation_id ?? "none");
      setUsoContinuo(editingMedication.uso_continuo ?? false);
      setMedicoPrescritor(editingMedication.medico_prescritor ?? "");
      setEstoqueTotal(editingMedication.estoque_total?.toString() ?? "");
      setEstoqueMinimo(editingMedication.estoque_minimo?.toString() ?? "");
      setExistingReceitaUrl(editingMedication.receita_url ?? null);
      setReason((editingMedication as any).reason ?? "");
      setReceitaFile(null);
      setExtractedMeds([]);
      setCurrentMedIndex(0);
    } else {
      resetForm();
    }
  }, [editingMedication, open]);

  // Process AI data when received from AiMedicationUpload
  useEffect(() => {
    if (!aiData || !open) return;
    const data = aiData.data;
    if (aiData.receitaUrl) setExistingReceitaUrl(aiData.receitaUrl);

    if (data?.medico_prescritor) setMedicoPrescritor(data.medico_prescritor);
    setAiReviewMode(true);

    if (data?.medicamentos?.length > 0) {
      if (data.medicamentos.length > 1) {
        setExtractedMeds(data.medicamentos);
        setCurrentMedIndex(0);
        populateFromExtracted(data.medicamentos[0]);
        toast.success(`${data.medicamentos.length} medicamentos encontrados! Revise cada um antes de salvar.`);
      } else {
        setExtractedMeds([data.medicamentos[0]]);
        setCurrentMedIndex(0);
        populateFromExtracted(data.medicamentos[0]);
        toast.success("Dados extraídos! Revise antes de salvar.");
      }
    } else {
      if (data?.nome_medicamento) setName(data.nome_medicamento);
      if (data?.dosagem) setDosage(data.dosagem);
      if (data?.frequencia_horas) setFrequencyHours(String(data.frequencia_horas));
      if (data?.duracao_dias) setDurationDays(String(data.duracao_dias));
      toast.success("Dados extraídos! Revise antes de salvar.");
    }
  }, [aiData, open]);

  const resetForm = () => {
    setName("");
    setDosage("");
    setStartDateTime("");
    setFrequencyHours("");
    setFrequencyType("fixed_interval");
    setSpecificTimes([]);
    setSpecificDays([]);
    setNewTimeInput("");
    setDurationDays("");
    setStatus("Ativo");
    setConsultationId("none");
    setUsoContinuo(false);
    setMedicoPrescritor("");
    setEstoqueTotal("");
    setEstoqueMinimo("");
    setReason("");
    setReceitaFile(null);
    setExistingReceitaUrl(null);
    
    setExtractedMeds([]);
    setCurrentMedIndex(0);
    setAiReviewMode(false);
  };

  const parsedDate = useMemo(() => {
    if (!startDateTime) return { date: null, time: null };
    const [d, t] = startDateTime.split("T");
    return { date: d || null, time: t || null };
  }, [startDateTime]);

  const calculatedEndDate = useMemo(() => {
    if (!parsedDate.date || !durationDays || Number(durationDays) <= 0) return null;
    return format(addDays(toSPTime(parseDateInSP(parsedDate.date) ?? new Date()), Number(durationDays)), "yyyy-MM-dd");
  }, [parsedDate.date, durationDays]);

  const calculatedEndDateLabel = useMemo(() => {
    if (!calculatedEndDate) return null;
    return format(toSPTime(parseDateInSP(calculatedEndDate) ?? new Date()), "dd/MM/yyyy");
  }, [calculatedEndDate]);

  const frequencyLabel = useMemo(() => {
    const opt = FREQUENCY_OPTIONS.find((o) => o.value === frequencyHours);
    return opt?.label ?? (frequencyHours ? `A cada ${frequencyHours}h` : "");
  }, [frequencyHours]);

  const handleFrequencySelect = (value: string) => {
    setFrequencyHours(value);
    if (value === "specific_times") {
      setFrequencyType("specific_times");
      setSpecificDays([]);
    } else if (value === "specific_days") {
      setFrequencyType("specific_days");
    } else {
      setFrequencyType("fixed_interval");
      setSpecificTimes([]);
      setSpecificDays([]);
      setNewTimeInput("");
    }
  };

  const handleAddTime = () => {
    const t = newTimeInput.trim();
    if (!t || specificTimes.includes(t)) return;
    setSpecificTimes((prev) => [...prev, t].sort());
    setNewTimeInput("");
  };

  const handleRemoveTime = (time: string) => {
    setSpecificTimes((prev) => prev.filter((tt) => tt !== time));
  };

  const toggleDay = (day: number) => {
    setSpecificDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const currentConfidence = useMemo(() => {
    if (!aiReviewMode || extractedMeds.length === 0) return null;
    return extractedMeds[currentMedIndex]?.confianca ?? null;
  }, [aiReviewMode, extractedMeds, currentMedIndex]);

  const lowConfidenceClass = "ring-2 ring-amber-400 border-amber-400";

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


  const [showDateAlert, setShowDateAlert] = useState(false);
  const [pendingAction, setPendingAction] = useState<"next" | "save" | null>(null);

  const checkDateAndProceed = (action: "next" | "save") => {
    if (!startDateTime) {
      setPendingAction(action);
      setShowDateAlert(true);
    } else {
      if (action === "next") proceedNext();
      else handleSave();
    }
  };

  const handleDateAlertConfirm = () => {
    setShowDateAlert(false);
    if (pendingAction === "next") proceedNext();
    else if (pendingAction === "save") handleSave();
    setPendingAction(null);
  };

  const proceedNext = () => {
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
    const isSpecific = frequencyType === "specific_times" || frequencyType === "specific_days";
    const freqNum = isSpecific ? null : (frequencyHours ? Number(frequencyHours) : null);
    const durNum = usoContinuo ? null : (durationDays ? Number(durationDays) : null);
    const finalEndDate = usoContinuo ? null : calculatedEndDate;
    const estTotalNum = estoqueTotal ? Number(estoqueTotal) : null;
    const estMinNum = estoqueMinimo ? Number(estoqueMinimo) : null;
    const freqLbl = FREQUENCY_OPTIONS.find((o) => o.value === frequencyHours)?.label ?? (frequencyHours ? `A cada ${frequencyHours}h` : null);

    return {
      name: name.trim(),
      dosage: dosage.trim() || null,
      start_time: isSpecific ? null : (parsedDate.time || null),
      frequency_hours: freqNum,
      frequency: freqLbl || null,
      frequency_type: frequencyType,
      specific_times: isSpecific ? specificTimes : [],
      specific_days: frequencyType === "specific_days" ? specificDays : [],
      duration_days: durNum,
      duration: durNum ? `${durNum} dias` : null,
      start_date: parsedDate.date || null,
      end_date: finalEndDate,
      consultation_id: consultationId === "none" ? null : consultationId,
      uso_continuo: usoContinuo,
      medico_prescritor: medicoPrescritor.trim() || null,
      estoque_total: estTotalNum,
      estoque_minimo: estMinNum,
      reason: reason.trim() || null,
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
      endDate = format(addDays(toSPTime(parseDateInSP(parsedDate.date) ?? new Date()), durNum), "yyyy-MM-dd");
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
          const memberName = member?.name ?? "Usuário";
          const firstName = memberName.split(" ")[0];

          const notifInserts = validMeds.map((m) => {
            let msgParts = `Medicamento: ${m.name}`;
            if (m.uso_continuo) {
              msgParts += `\nUso Contínuo`;
            }
            if (m.start_date) {
              const startStr = format(toSPTime(parseDateInSP(m.start_date) ?? new Date()), "dd/MM/yyyy");
              const timeStr = m.start_time ? m.start_time.slice(0, 5) : "";
              msgParts += `\nInício: ${startStr}${timeStr ? ` às ${timeStr}` : ""}`;
            }
            if (m.end_date) {
              const endStr = format(toSPTime(parseDateInSP(m.end_date) ?? new Date()), "dd/MM/yyyy");
              msgParts += `\nTérmino: ${endStr}`;
            }
            return {
              user_id: user.id,
              family_member_id: familyMemberId,
              title: `Novo Tratamento de ${firstName}`,
              message: msgParts,
              type: "medication",
              scheduled_for: new Date().toISOString(),
              is_read: false,
              ...(groupId ? { group_id: groupId } : {}),
            };
          });

          await supabase.from("notifications").insert(notifInserts);
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
          const memberName = member?.name ?? "Usuário";
          const startStr = parsedDate.date
            ? format(toSPTime(parseDateInSP(parsedDate.date) ?? new Date()), "dd/MM/yyyy")
            : "";
          const timeStr = parsedDate.time ? parsedDate.time.slice(0, 5) : "";
          const finalEndDate = usoContinuo ? null : calculatedEndDate;
          const endStr = finalEndDate
            ? format(toSPTime(parseDateInSP(finalEndDate) ?? new Date()), "dd/MM/yyyy")
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
            ...(groupId ? { group_id: groupId } : {}),
          } as any);
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

          <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-24 no-scrollbar">
            <div className="flex flex-col gap-6">

              {/* Banner de Revisão IA */}
              {aiReviewMode && (
                <div className="flex items-start gap-3 p-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Revisão Necessária</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      Deciframos a receita, mas por favor, confira os nomes e as dosagens antes de salvar.
                    </p>
                  </div>
                </div>
              )}

              {/* Banner de Alerta Pediátrico */}
              {aiReviewMode && isPediatric && (
                <div className="flex items-start gap-3 p-3 rounded-xl border border-destructive bg-destructive/10 dark:bg-destructive/20">
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-destructive">⚠️ ALERTA CLÍNICO: Perfil PEDIÁTRICO</p>
                    <p className="text-xs text-destructive/80 mt-0.5">
                      {patientName ? `Criança: ${patientName}, ` : ""}{patientAge} {patientAge === 1 ? "ano" : "anos"}. Atenção redobrada à adequação do medicamento e dosagens para a idade.
                    </p>
                  </div>
                </div>
              )}


              <div className="p-4 border border-border rounded-xl bg-muted/30 space-y-4">
                {/* Receita anexada (somente visualização, quando veio da IA ou edição) */}
                {existingReceitaUrl && (
                  <div className="space-y-1.5">
                    <Label>Receita Médica</Label>
                    <div className="flex items-center gap-2 p-3 bg-background rounded-md border border-border">
                      <Paperclip size={16} className="text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground truncate flex-1">Receita anexada</span>
                      <Button variant="ghost" size="sm" className="h-auto p-1" onClick={() => setViewerOpen(true)}>
                        <Eye size={16} className="text-primary" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Médico Prescritor */}
                <div className="space-y-1.5">
                  <Label>Médico Prescritor</Label>
                  <Input
                    placeholder="Ex: Dr. Varella - CRM 12345"
                    value={medicoPrescritor}
                    onChange={(e) => setMedicoPrescritor(e.target.value)}
                    className="text-[16px]"
                  />
                </div>

                {/* Vincular Consulta */}
                <div className="space-y-1.5">
                  <Label>Vincular Consulta</Label>
                  <ConsultationCombobox
                    familyMemberId={familyMemberId}
                    value={consultationId}
                    onValueChange={handleConsultationChange}
                  />
                </div>
              </div>

              {/* ═══════ BLOCO 2: Tratamento Principal (com moldura) ═══════ */}
              <div className="p-4 border border-border rounded-xl bg-muted/30 space-y-4">
                <div className="space-y-1.5">
                  <Label>Nome do Medicamento *</Label>
                  <div className={currentConfidence && currentConfidence !== "alta" ? lowConfidenceClass + " rounded-md" : ""}>
                    <MedicationAutocomplete value={name} onChange={setName} />
                  </div>
                  {currentConfidence === "baixa" && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Leitura difícil — verifique com atenção
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Motivo do Tratamento</Label>
                  <ReasonCombobox value={reason} onChange={setReason} groupId={groupId} familyMemberId={familyMemberId} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Dosagem</Label>
                    <Input placeholder="Ex: 5ml" value={dosage} onChange={(e) => setDosage(e.target.value)} className={`text-[16px] ${currentConfidence && currentConfidence !== "alta" ? lowConfidenceClass : ""}`} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Frequência</Label>
                    <Select value={frequencyHours} onValueChange={handleFrequencySelect}>
                      <SelectTrigger className="text-[16px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {FREQUENCY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value} className="text-base">{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Progressive Disclosure: Horários Específicos */}
                {frequencyType === "specific_times" && (
                  <div className="space-y-2">
                    <Label>Horários das Doses</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={newTimeInput}
                        onChange={(e) => setNewTimeInput(e.target.value)}
                        className="text-[16px] flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleAddTime}
                        disabled={!newTimeInput.trim()}
                        className="h-10 px-3"
                      >
                        <Plus size={16} />
                      </Button>
                    </div>
                    {specificTimes.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {specificTimes.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                          >
                            {t}
                            <button
                              type="button"
                              onClick={() => handleRemoveTime(t)}
                              className="rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Progressive Disclosure: Dias da Semana */}
                {frequencyType === "specific_days" && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Dias da Semana</Label>
                      <div className="flex items-center justify-between gap-1.5">
                        {DAY_LABELS.map((label, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleDay(idx)}
                            className={`w-9 h-9 rounded-full text-xs font-semibold transition-colors flex items-center justify-center ${
                              specificDays.includes(idx)
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {specificDays.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          {specificDays.map((d) => DAY_NAMES[d]).join(", ")}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Horários das Doses</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={newTimeInput}
                          onChange={(e) => setNewTimeInput(e.target.value)}
                          className="text-[16px] flex-1"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleAddTime}
                          disabled={!newTimeInput.trim()}
                          className="h-10 px-3"
                        >
                          <Plus size={16} />
                        </Button>
                      </div>
                      {specificTimes.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {specificTimes.map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                            >
                              {t}
                              <button
                                type="button"
                                onClick={() => handleRemoveTime(t)}
                                className="rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-[2fr_1fr] gap-4 items-start">
                  <div className="space-y-1.5">
                    <Label>{frequencyType === "fixed_interval" ? "Data/Hora Início" : "Data de Início"}</Label>
                    <DatePickerField
                      value={frequencyType === "fixed_interval" ? startDateTime : (startDateTime?.split("T")[0] ?? "")}
                      onChange={(val) => {
                        if (frequencyType !== "fixed_interval") {
                          setStartDateTime(val ? `${val}T00:00` : "");
                        } else {
                          setStartDateTime(val);
                        }
                      }}
                      mode={frequencyType === "fixed_interval" ? "datetime" : "date"}
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

          <DrawerFooter>
            <div className="flex w-full gap-4 pt-4">
              {isWizardMode && currentMedIndex > 0 ? (
                <Button variant="ghost" className="flex-1 flex items-center justify-center gap-2" onClick={handleBackMed}>
                  <ArrowLeft size={16} />
                  Voltar
                </Button>
              ) : (
                <DrawerClose asChild>
                  <Button variant="ghost" className="flex-1">Cancelar</Button>
                </DrawerClose>
              )}
              {isWizardMode && !isLastWizardStep ? (
                <Button
                  onClick={() => checkDateAndProceed("next")}
                  className="flex-1 gap-2 bg-[#1C3333] hover:bg-[#2A4B4B] text-white"
                >
                  Próximo Medicamento
                  <ChevronRight size={16} />
                </Button>
              ) : (
                <Button
                  onClick={() => checkDateAndProceed("save")}
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
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={showDateAlert} onOpenChange={setShowDateAlert}>
        <AlertDialogContent className="max-w-[320px] rounded-[24px] w-[90vw] p-6">
          <AlertDialogHeader className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              <AlertDialogTitle className="text-lg font-bold text-slate-800">Alerta de Preenchimento</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-center text-slate-600 text-sm">
              Data e Hora de início do tratamento não inserido. Continuar mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="rounded-xl" onClick={() => setPendingAction(null)}>Voltar</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl" onClick={handleDateAlertConfirm}>
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
      <PaywallModal open={showPaywall} onOpenChange={setShowPaywall} />
    </>
  );
};

export default AddMedicationDrawer;
