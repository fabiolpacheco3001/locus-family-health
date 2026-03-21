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
      birth_date: birthDate || null,
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
      <DrawerContent className="max-w-[480px] mx-auto">
        <DrawerHeader>
          <DrawerTitle className="text-primary">Novo Membro da Família</DrawerTitle>
          <DrawerDescription>Preencha os dados abaixo para adicionar um membro.</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {/* Relationship */}
          <div className="space-y-1.5">
            <Label>Parentesco *</Label>
            <Select value={relationship} onValueChange={setRelationship}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {relationships.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Birth Date */}
          <div className="space-y-1.5">
            <Label>Data de Nascimento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !birthDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {birthDate ? format(birthDate, "dd/MM/yyyy") : "Selecione uma data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={birthDate}
                  onSelect={setBirthDate}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Blood Type */}
          <div className="space-y-1.5">
            <Label>Tipo Sanguíneo</Label>
            <Select value={bloodType} onValueChange={setBloodType}>
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
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
