import { useState, ChangeEvent } from "react";
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

const applyDateMask = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const maskedToISO = (masked: string): string | null => {
  const parts = masked.split("/");
  if (parts.length !== 3 || parts[2].length !== 4) return null;
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm}-${dd}`;
};

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

  const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    setBirthDate(applyDateMask(e.target.value));
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
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-primary">Novo Membro da Família</DrawerTitle>
          <DrawerDescription>Preencha os dados abaixo para adicionar um membro.</DrawerDescription>
        </DrawerHeader>

        <div className="max-h-[80vh] overflow-y-auto overscroll-contain px-4 pb-32 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} className="text-[16px] scroll-m-20" />
          </div>

          <div className="space-y-1.5">
            <Label>Parentesco *</Label>
            <Select value={relationship} onValueChange={setRelationship}>
              <SelectTrigger className="text-base scroll-m-20"><SelectValue placeholder="Selecione" /></SelectTrigger>
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
              className="text-base scroll-m-20"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo Sanguíneo</Label>
            <Select value={bloodType} onValueChange={setBloodType}>
              <SelectTrigger className="text-base scroll-m-20"><SelectValue placeholder="Opcional" /></SelectTrigger>
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
