import { useState, useEffect } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { useConsultations, Consultation, NewConsultation } from "@/hooks/useConsultations";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMemberId: string;
  editingConsultation?: Consultation | null;
}

const AddConsultationDrawer = ({ open, onOpenChange, familyMemberId, editingConsultation }: Props) => {
  const { addConsultation, updateConsultation, deleteConsultation } = useConsultations(familyMemberId);
  const [specialty, setSpecialty] = useState("");
  const [professionalName, setProfessionalName] = useState("");
  const [consultationDate, setConsultationDate] = useState("");
  const [type, setType] = useState("Rotina");
  const [symptoms, setSymptoms] = useState("");
  const [questions, setQuestions] = useState("");
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [statusValue, setStatusValue] = useState("Agendada");

  const isEditing = !!editingConsultation;

  useEffect(() => {
    if (editingConsultation) {
      setSpecialty(editingConsultation.specialty);
      setProfessionalName(editingConsultation.professional_name ?? "");
      setConsultationDate(
        editingConsultation.consultation_date
          ? editingConsultation.consultation_date.slice(0, 16)
          : ""
      );
      setType(editingConsultation.type ?? "Rotina");
      setSymptoms(editingConsultation.symptoms ?? "");
      setQuestions(editingConsultation.questions ?? "");
    } else {
      resetForm();
    }
  }, [editingConsultation, open]);

  const resetForm = () => {
    setSpecialty("");
    setProfessionalName("");
    setConsultationDate("");
    setType("Rotina");
    setSymptoms("");
    setQuestions("");
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
          status: statusValue,
        });
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
        await addConsultation.mutateAsync(consultation);
        toast.success("Consulta agendada com sucesso!");
      }
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }
  };

  const handleDelete = async () => {
    if (!editingConsultation) return;
    try {
      await deleteConsultation.mutateAsync(editingConsultation.id);
      toast.success("Consulta excluída.");
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error("Erro ao excluir. Tente novamente.");
    }
    setShowDeleteAlert(false);
  };

  const isPending = addConsultation.isPending || updateConsultation.isPending;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-primary">
              {isEditing ? "Editar Consulta" : "Nova Consulta"}
            </DrawerTitle>
            <DrawerDescription>
              {isEditing ? "Altere os dados da consulta." : "Preencha os dados da consulta e pré-consulta."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Especialidade *</Label>
              <Input
                placeholder="Ex: Pediatria, Cardiologia"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="text-[16px] scroll-m-20"
              />
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
                placeholder="Descreva os sintomas ou motivo..."
                rows={3}
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                className="text-[16px] scroll-m-20 resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Dúvidas para o Médico</Label>
              <Textarea
                placeholder="Anote suas perguntas..."
                rows={3}
                value={questions}
                onChange={(e) => setQuestions(e.target.value)}
                className="text-[16px] scroll-m-20 resize-none"
              />
            </div>

            {isEditing && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={editingConsultation?.status ?? "Agendada"} onValueChange={(val) => {
                    // Status will be sent on save
                    setStatusValue(val);
                  }}>
                    <SelectTrigger className="text-[16px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Agendada">Agendada</SelectItem>
                      <SelectItem value="Realizada">Realizada</SelectItem>
                      <SelectItem value="Cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => setShowDeleteAlert(true)}
                  >
                    <Trash2 size={16} className="mr-2" />
                    Excluir Consulta
                  </Button>
                </div>
              </div>
            )}
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
              {isPending ? <Loader2 className="animate-spin" size={18} /> : isEditing ? "Salvar Alterações" : "Agendar Consulta"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta consulta?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Você perderá as anotações feitas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteConsultation.isPending ? <Loader2 className="animate-spin" size={16} /> : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AddConsultationDrawer;
