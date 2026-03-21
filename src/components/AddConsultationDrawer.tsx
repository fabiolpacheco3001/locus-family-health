import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import { toast } from "sonner";
import { useConsultations, NewConsultation } from "@/hooks/useConsultations";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMemberId: string;
}

const AddConsultationDrawer = ({ open, onOpenChange, familyMemberId }: Props) => {
  const { addConsultation } = useConsultations(familyMemberId);
  const [specialty, setSpecialty] = useState("");
  const [professionalName, setProfessionalName] = useState("");
  const [consultationDate, setConsultationDate] = useState("");
  const [type, setType] = useState("Rotina");
  const [symptoms, setSymptoms] = useState("");
  const [questions, setQuestions] = useState("");

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

    const consultation: NewConsultation = {
      family_member_id: familyMemberId,
      specialty: specialty.trim(),
      professional_name: professionalName.trim() || null,
      consultation_date: consultationDate || null,
      type,
      symptoms: symptoms.trim() || null,
      questions: questions.trim() || null,
    };

    try {
      await addConsultation.mutateAsync(consultation);
      toast.success("Consulta agendada com sucesso!");
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error("Erro ao agendar. Tente novamente.");
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-primary">Nova Consulta</DrawerTitle>
          <DrawerDescription>Preencha os dados da consulta e pré-consulta.</DrawerDescription>
        </DrawerHeader>

        <div className="max-h-[60vh] overflow-y-auto px-4 pb-20 space-y-4">
          <div className="space-y-1.5">
            <Label>Especialidade *</Label>
            <Input
              placeholder="Ex: Pediatria, Cardiologia"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="text-base scroll-m-20"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Nome do Profissional</Label>
            <Input
              placeholder="Ex: Dr. Carlos Silva"
              value={professionalName}
              onChange={(e) => setProfessionalName(e.target.value)}
              className="text-base scroll-m-20"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Data e Hora</Label>
            <Input
              type="datetime-local"
              value={consultationDate}
              onChange={(e) => setConsultationDate(e.target.value)}
              className="text-base scroll-m-20"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Classificação</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="text-base scroll-m-20">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Rotina">Rotina</SelectItem>
                <SelectItem value="Emergência">Emergência</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Sintomas / Motivo da Visita</Label>
            <Textarea
              placeholder="Descreva os sintomas ou motivo..."
              rows={3}
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              className="text-base scroll-m-20 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Dúvidas para o Médico</Label>
            <Textarea
              placeholder="Anote suas perguntas..."
              rows={3}
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              className="text-base scroll-m-20 resize-none"
            />
          </div>
        </div>

        <DrawerFooter className="flex-row gap-3">
          <DrawerClose asChild>
            <Button variant="ghost" className="flex-1">Cancelar</Button>
          </DrawerClose>
          <Button
            onClick={handleSave}
            disabled={addConsultation.isPending}
            className="flex-1"
          >
            {addConsultation.isPending ? <Loader2 className="animate-spin" size={18} /> : "Agendar Consulta"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default AddConsultationDrawer;
