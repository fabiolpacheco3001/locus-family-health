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
const genders = ["Masculino", "Feminino", "Outro", "Prefiro não informar"];
const speciesOptions = ["Cachorro", "Gato", "Pássaro", "Outro"];

const AddMemberDrawer = ({ open, onOpenChange }: Props) => {
  const { addMember } = useFamilyMembers();
  const [memberType, setMemberType] = useState<"human" | "pet">("human");
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [gender, setGender] = useState("");
  const [species, setSpecies] = useState("");
  const [breed, setBreed] = useState("");

  const isPet = memberType === "pet";

  const resetForm = () => {
    setMemberType("human");
    setName("");
    setRelationship("");
    setBirthDate("");
    setBloodType("");
    setGender("");
    setSpecies("");
    setBreed("");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Preencha o nome.");
      return;
    }
    if (!isPet && !relationship) {
      toast.error("Preencha o parentesco.");
      return;
    }
    if (isPet && !species) {
      toast.error("Selecione a espécie.");
      return;
    }

    const member: NewFamilyMember = {
      name: name.trim(),
      relationship: isPet ? "Pet" : relationship,
      birth_date: birthDate || null,
      blood_type: isPet ? null : (bloodType || null),
      gender: isPet ? null : (gender || null),
      member_type: memberType,
      species: isPet ? species : null,
      breed: isPet ? (breed.trim() || null) : null,
    };

    try {
      await addMember.mutateAsync(member);
      toast.success(isPet ? "Pet adicionado com sucesso! 🐾" : "Membro adicionado com sucesso!", {
        style: { background: "hsl(165 34% 62%)", color: "white", border: "none" },
      });
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-background outline-none">
        <DrawerHeader>
          <DrawerTitle className="text-primary">{isPet ? "Novo Pet 🐾" : "Novo Membro da Família"}</DrawerTitle>
          <DrawerDescription>Preencha os dados abaixo para adicionar.</DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4 overscroll-contain no-scrollbar">
          {/* Segmented Control: Pessoa / Pet */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setMemberType("human")}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                !isPet ? "bg-foreground text-background" : "bg-card text-muted-foreground"
              }`}
            >
              👤 Pessoa
            </button>
            <button
              type="button"
              onClick={() => setMemberType("pet")}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                isPet ? "bg-[#F2A97F] text-slate-900" : "bg-card text-muted-foreground"
              }`}
            >
              🐾 Pet
            </button>
          </div>

          <div className="space-y-1.5">
            <Label>{isPet ? "Nome do Pet *" : "Nome Completo *"}</Label>
            <Input placeholder={isPet ? "Ex: Rex, Luna..." : "Ex: Maria da Silva"} value={name} onChange={(e) => setName(e.target.value)} className="w-full max-w-full box-border min-w-0 text-[16px]" />
          </div>

          {isPet ? (
            <>
              {/* Pet fields: Espécie + Raça */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Espécie *</Label>
                  <Select value={species} onValueChange={setSpecies}>
                    <SelectTrigger className="w-full max-w-full box-border min-w-0 text-[16px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {speciesOptions.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Raça</Label>
                  <Input placeholder="Ex: Labrador" value={breed} onChange={(e) => setBreed(e.target.value)} className="w-full max-w-full box-border min-w-0 text-[16px]" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Nascimento</Label>
                <input
                  type="date"
                  lang="pt-BR"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  min="1900-01-01"
                  max={new Date().toISOString().split('T')[0]}
                  className="flex h-10 w-full max-w-full block box-border appearance-none min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[16px] ring-offset-background"
                />
              </div>
            </>
          ) : (
            <>
              {/* Human fields */}
              <div className="grid grid-cols-2 gap-4">
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
                  <Label>Nascimento</Label>
                  <input
                    type="date"
                    lang="pt-BR"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    min="1900-01-01"
                    max={new Date().toISOString().split('T')[0]}
                    className="flex h-10 w-full max-w-full block box-border appearance-none min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[16px] ring-offset-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Gênero</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger className="w-full max-w-full box-border min-w-0 text-[16px]"><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      {genders.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            </>
          )}
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
