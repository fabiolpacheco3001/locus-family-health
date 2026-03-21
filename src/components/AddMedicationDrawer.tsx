import { useState, useEffect } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useMedications, Medication, NewMedication } from "@/hooks/useMedications";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMemberId: string;
  editingMedication?: Medication | null;
}

const AddMedicationDrawer = ({ open, onOpenChange, familyMemberId, editingMedication }: Props) => {
  const { addMedication, updateMedication, deleteMedication } = useMedications(familyMemberId);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [startDate, setStartDate] = useState("");
  const [status, setStatus] = useState("Ativo");
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  const isEditing = !!editingMedication;

  useEffect(() => {
    if (editingMedication) {
      setName(editingMedication.name);
      setDosage(editingMedication.dosage ?? "");
      setFrequency(editingMedication.frequency ?? "");
      setDuration(editingMedication.duration ?? "");
      setStartDate(editingMedication.start_date ? editingMedication.start_date.slice(0, 10) : "");
      setStatus(editingMedication.status);
    } else {
      resetForm();
    }
  }, [editingMedication, open]);

  const resetForm = () => {
    setName("");
    setDosage("");
    setFrequency("");
    setDuration("");
    setStartDate("");
    setStatus("Ativo");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Preencha o nome do medicamento.");
      return;
    }

    try {
      if (isEditing) {
        await updateMedication.mutateAsync({
          id: editingMedication.id,
          name: name.trim(),
          dosage: dosage.trim() || null,
          frequency: frequency.trim() || null,
          duration: duration.trim() || null,
          start_date: startDate || null,
          status,
        });
        toast.success("Medicamento atualizado!");
      } else {
        const medication: NewMedication = {
          family_member_id: familyMemberId,
          name: name.trim(),
          dosage: dosage.trim() || null,
          frequency: frequency.trim() || null,
          duration: duration.trim() || null,
          start_date: startDate || null,
        };
        await addMedication.mutateAsync(medication);
        toast.success("Medicamento adicionado!");
      }
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
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

  const isPending = addMedication.isPending || updateMedication.isPending;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-primary">
              {isEditing ? "Editar Medicamento" : "Novo Medicamento"}
            </DrawerTitle>
            <DrawerDescription>
              {isEditing ? "Altere os dados do medicamento." : "Preencha os dados do medicamento."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="max-h-[80vh] overflow-y-auto overscroll-contain px-4 pb-32 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="space-y-1.5">
              <Label>Nome do Medicamento *</Label>
              <Input
                placeholder="Ex: Amoxicilina, Dipirona"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-[16px] scroll-m-20"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Dosagem</Label>
              <Input
                placeholder="Ex: 5ml, 1 comprimido"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                className="text-[16px] scroll-m-20"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Frequência</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger className="text-[16px] scroll-m-20">
                  <SelectValue placeholder="Selecione a frequência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1x ao dia">1x ao dia</SelectItem>
                  <SelectItem value="De 8 em 8 horas">De 8 em 8 horas</SelectItem>
                  <SelectItem value="De 12 em 12 horas">De 12 em 12 horas</SelectItem>
                  <SelectItem value="De 6 em 6 horas">De 6 em 6 horas</SelectItem>
                  <SelectItem value="Uso contínuo">Uso contínuo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Duração</Label>
              <Input
                placeholder="Ex: 7 dias, Uso contínuo"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="text-[16px] scroll-m-20"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Data de Início</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-base scroll-m-20"
              />
            </div>

            {isEditing && (
              <>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="text-base scroll-m-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Concluído">Concluído</SelectItem>
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
                    Excluir Medicamento
                  </Button>
                </div>
              </>
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
    </>
  );
};

export default AddMedicationDrawer;
