import { useState, useEffect } from "react";
import { Loader2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SpecialtyCombobox from "@/components/SpecialtyCombobox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useConsultations, Consultation, NewConsultation } from "@/hooks/useConsultations";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { Activity } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMemberId: string;
  editingConsultation?: Consultation | null;
  memberType?: string;
}

const AddConsultationDrawer = ({ open, onOpenChange, familyMemberId, editingConsultation, memberType }: Props) => {
  const { user } = useAuth();
  const { groupId } = useFamilyGroup();
  const { addConsultation, updateConsultation } = useConsultations(familyMemberId);
  const [specialty, setSpecialty] = useState("");
  const [professionalName, setProfessionalName] = useState("");
  const [consultationDate, setConsultationDate] = useState("");
  const [type, setType] = useState("Rotina");
  const [symptoms, setSymptoms] = useState("");
  const [questions, setQuestions] = useState("");
  const [showCancelAlert, setShowCancelAlert] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [statusValue, setStatusValue] = useState("Agendada");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");

  const isEditing = !!editingConsultation;
  const isCancelled = editingConsultation?.status === "Cancelada";

  useEffect(() => {
    if (editingConsultation) {
      setSpecialty(editingConsultation.specialty);
      setProfessionalName(editingConsultation.professional_name ?? "");
      const cd = editingConsultation.consultation_date;
      if (cd) {
        const d = new Date(cd);
        const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        setConsultationDate(local);
      } else {
        setConsultationDate("");
      }
      setType(editingConsultation.type ?? "Rotina");
      setSymptoms(editingConsultation.symptoms ?? "");
      setQuestions(editingConsultation.questions ?? "");
      setStatusValue(editingConsultation.status);

      // Fetch existing BP for this consultation
      supabase
        .from("blood_pressure_history")
        .select("systolic, diastolic")
        .eq("consultation_id", editingConsultation.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setSystolic(String(data.systolic));
            setDiastolic(String(data.diastolic));
          } else {
            setSystolic("");
            setDiastolic("");
          }
        });
    } else {
      resetForm();
      if (memberType === 'pet') {
        setSpecialty("Veterinário");
      }
    }
  }, [editingConsultation, open, memberType]);

  const resetForm = () => {
    setSpecialty("");
    setProfessionalName("");
    setConsultationDate("");
    setType("Rotina");
    setSymptoms("");
    setQuestions("");
    setStatusValue("Agendada");
    setCancelReason("");
    setSystolic("");
    setDiastolic("");
  };

  const saveBP = async (consultationId: string) => {
    const sys = parseInt(systolic, 10);
    const dia = parseInt(diastolic, 10);
    if (!systolic || !diastolic || isNaN(sys) || isNaN(dia) || sys <= 0 || dia <= 0) return;

    // Upsert: delete existing then insert new
    await supabase
      .from("blood_pressure_history")
      .delete()
      .eq("consultation_id", consultationId);

    await supabase.from("blood_pressure_history").insert({
      user_id: user!.id,
      familiar_id: familyMemberId,
      consultation_id: consultationId,
      systolic: sys,
      diastolic: dia,
      source: "consultation",
    } as any);
  };

  const handleSave = async () => {
    if (!specialty.trim()) {
      toast.error("Preencha a especialidade.");
      return;
    }

    try {
      if (isEditing) {
        await updateConsultation.mutateAsync({
          id: editingConsultation.id,
          specialty: specialty.trim(),
          professional_name: professionalName.trim() || null,
          consultation_date: consultationDate ? new Date(consultationDate).toISOString() : null,
          type,
          symptoms: symptoms.trim() || null,
          questions: questions.trim() || null,
          status: editingConsultation.status,
        });
        await saveBP(editingConsultation.id);
        toast.success("Consulta atualizada!");
      } else {
        const consultation: NewConsultation = {
          family_member_id: familyMemberId,
          specialty: specialty.trim(),
          professional_name: professionalName.trim() || null,
          consultation_date: consultationDate ? new Date(consultationDate).toISOString() : null,
          type,
          symptoms: symptoms.trim() || null,
          questions: questions.trim() || null,
        };
        const result = await addConsultation.mutateAsync(consultation);
        await saveBP(result.id);
        toast.success("Consulta agendada com sucesso!");
      }
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }
  };

  const handleCancel = async () => {
    if (!editingConsultation) return;
    try {
      await updateConsultation.mutateAsync({
        id: editingConsultation.id,
        status: "Cancelada",
        cancel_reason: cancelReason.trim() || null,
      });
      toast.success("Consulta cancelada.");
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error("Erro ao cancelar. Tente novamente.");
    }
    setShowCancelAlert(false);
  };

  const isPending = addConsultation.isPending || updateConsultation.isPending;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false} disablePreventScroll={false}>
        <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-background outline-none">
          <DrawerHeader>
            <DrawerTitle className="text-primary">
              {isEditing ? "Editar Consulta" : "Nova Consulta"}
            </DrawerTitle>
            <DrawerDescription>
              {isEditing ? "Altere os dados da consulta." : "Preencha os dados da consulta e pré-consulta."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 no-scrollbar">
            <div className="space-y-1.5">
              <Label>Especialidade *</Label>
              <SpecialtyCombobox value={specialty} onValueChange={setSpecialty} />
            </div>

            <div className="space-y-1.5">
              <Label>Nome do Profissional</Label>
              <Input
                placeholder="Ex: Dr. Carlos Silva"
                value={professionalName}
                onChange={(e) => setProfessionalName(e.target.value)}
                className="text-[16px] scroll-m-20"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Data e Hora</Label>
              <Input
                type="datetime-local"
                lang="pt-BR"
                value={consultationDate}
                onChange={(e) => setConsultationDate(e.target.value)}
                min="1900-01-01T00:00"
                max="2099-12-31T23:59"
                className="w-full max-w-full block box-border appearance-none min-w-0 text-[16px] px-3 py-2 border rounded-md bg-background scroll-m-20"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Classificação</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="text-[16px] scroll-m-20">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rotina">Rotina</SelectItem>
                  <SelectItem value="Emergência">Emergência</SelectItem>
                  <SelectItem value="Retorno">Retorno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Motivo da Visita</Label>
              <Textarea
                placeholder="Ex: Dores no estômago após as refeições"
                rows={3}
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                className="text-[16px] scroll-m-20 resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Dúvidas para o Médico</Label>
              <Textarea
                placeholder="Ex: Posso tomar com outros remédios?"
                rows={3}
                value={questions}
                onChange={(e) => setQuestions(e.target.value)}
                className="text-[16px] scroll-m-20 resize-none"
              />
            </div>

            {/* Medições Clínicas */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <Label className="text-sm font-semibold text-foreground">Medições Clínicas</Label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Sistólica (mmHg)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="Ex: 120"
                    value={systolic}
                    onChange={(e) => setSystolic(e.target.value.replace(/[^0-9]/g, ''))}
                    min={1}
                    max={300}
                    className="text-[16px] scroll-m-20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Diastólica (mmHg)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="Ex: 80"
                    value={diastolic}
                    onChange={(e) => setDiastolic(e.target.value.replace(/[^0-9]/g, ''))}
                    min={1}
                    max={300}
                    className="text-[16px] scroll-m-20"
                  />
                </div>
              </div>
            </div>
            {isEditing && !isCancelled && (
              <div className="pt-4 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => { setCancelReason(""); setShowCancelAlert(true); }}
                >
                  <Ban size={16} className="mr-2" />
                  Cancelar Consulta
                </Button>
              </div>
            )}
          </div>

          <DrawerFooter className="flex-row gap-3">
            <DrawerClose asChild>
              <Button variant="ghost" className="flex-1">Cancelar</Button>
            </DrawerClose>
            {!isCancelled && (
              <Button
                onClick={handleSave}
                disabled={isPending}
                className="flex-1"
              >
                {isPending ? <Loader2 className="animate-spin" size={18} /> : isEditing ? "Salvar Alterações" : "Agendar Consulta"}
              </Button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={showCancelAlert} onOpenChange={setShowCancelAlert}>
        <AlertDialogContent className="max-w-[320px] w-[90vw] rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Compromisso</AlertDialogTitle>
          <AlertDialogDescription className="mb-4">
              Essa ação mudará o status da consulta para cancelada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6">
            <Textarea
              placeholder="Ex: Conflito de horário, remarcação..."
              maxLength={200}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="text-[16px] resize-none min-h-[120px] border border-[hsl(var(--primary)/0.2)] focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-offset-0"
              rows={5}
              autoFocus
            />
            <p className="text-xs text-muted-foreground/60 text-right mt-2">{cancelReason.length}/200</p>
          </div>
          <AlertDialogFooter className="px-6 pb-6">
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={updateConsultation.isPending}
            >
              {updateConsultation.isPending ? <Loader2 className="animate-spin" size={16} /> : "Confirmar Cancelamento"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AddConsultationDrawer;
