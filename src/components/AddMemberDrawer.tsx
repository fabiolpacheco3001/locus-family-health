import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import { toast } from "sonner";
import { useFamilyMembers, NewFamilyMember } from "@/hooks/useFamilyMembers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const relationships = ["Titular", "Filho(a)", "Cônjuge", "Pai/Mãe", "Irmão(ã)", "Outro"];
const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const AddMemberDrawer = ({ open, onOpenChange }: Props) => {
  const { addMember } = useFamilyMembers();
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [bloodType, setBloodType] = useState("");

  const resetForm = () => {
    setName("");
    setRelationship("");
    setBirthDate("");
    setBloodType("");
  };

  const handleSave = async () => {
    if (!name.trim() || !relationship) {
      toast.error("Preencha o nome e o parentesco.");
      return;
    }

    const member: NewFamilyMember = {
      name: name.trim(),
      relationship,
      birth_date: maskedToISO(birthDate),
      blood_type: bloodType || null,
    };

    try {
      await addMember.mutateAsync(member);
      toast.success("Membro adicionado com sucesso!", {
        style: { background: "hsl(165 34% 62%)", color: "white", border: "none" },
      });
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex flex-col max-h-[90vh] bg-background">
        <DrawerHeader>
          <DrawerTitle className="text-primary">Novo Membro da Família</DrawerTitle>
          <DrawerDescription>Preencha os dados abaixo para adicionar um membro.</DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} className="w-full max-w-full box-border min-w-0 text-[16px]" />
          </div>

          <div className="space-y-1.5">
            <Label>Parentesco *</Label>
            <Select value={relationship} onValueChange={setRelationship}>
              <SelectTrigger className="w-full max-w-full box-border min-w-0 text-[16px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {relationships.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Data de Nascimento</Label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              maxLength={10}
              value={birthDate}
              onChange={handleDateChange}
              className="w-full max-w-full box-border min-w-0 text-[16px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo Sanguíneo</Label>
            <Select value={bloodType} onValueChange={setBloodType}>
              <SelectTrigger className="w-full max-w-full box-border min-w-0 text-[16px]"><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                {bloodTypes.map((bt) => (
                  <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DrawerFooter className="flex-row gap-3">
          <DrawerClose asChild>
            <Button variant="ghost" className="flex-1">Cancelar</Button>
          </DrawerClose>
          <Button
            onClick={handleSave}
            disabled={addMember.isPending}
            className="flex-1"
          >
            {addMember.isPending ? <Loader2 className="animate-spin" size={18} /> : "Salvar"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default AddMemberDrawer;
