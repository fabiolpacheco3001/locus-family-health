import { useState } from "react";
import { DatePickerField } from "@/components/ui/date-picker-field";
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

const relationships = ["Filho(a)", "Cônjuge", "Pai/Mãe", "Irmão(ã)", "Outro"];
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
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");

  const isPet = memberType === "pet";

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").substring(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").substring(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const resetForm = () => {
    setMemberType("human");
    setName("");
    setRelationship("");
    setBirthDate("");
    setBloodType("");
    setGender("");
    setSpecies("");
    setBreed("");
    setCpf("");
    setPhone("");
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
      cpf: isPet ? null : (cpf || null),
      phone: isPet ? null : (phone || null),
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
      <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-background outline-hidden">
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

          <p className="text-xs text-muted-foreground">
            Campos marcados com <span className="text-destructive">*</span> são obrigatórios.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="am-name">
              {isPet ? "Nome do Pet" : "Nome Completo"} <span className="text-destructive">*</span>
            </Label>
            <Input id="am-name" placeholder={isPet ? "Ex: Rex, Luna..." : "Ex: Maria da Silva"} value={name} onChange={(e) => setName(e.target.value)} className="w-full max-w-full box-border min-w-0 text-[16px]" />
          </div>

          {isPet ? (
            <>
              {/* Pet fields: Espécie + Raça */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="am-species">
                    Espécie <span className="text-destructive">*</span>
                  </Label>
                  <Select value={species} onValueChange={setSpecies}>
                    <SelectTrigger id="am-species" className="w-full max-w-full box-border min-w-0 text-[16px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {speciesOptions.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="am-breed">Raça</Label>
                  <Input id="am-breed" placeholder="Ex: Labrador" value={breed} onChange={(e) => setBreed(e.target.value)} className="w-full max-w-full box-border min-w-0 text-[16px]" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="am-birth-pet">Nascimento</Label>
                <DatePickerField
                  value={birthDate}
                  onChange={setBirthDate}
                  mode="date"
                />
              </div>
            </>
          ) : (
            <>
              {/* Human fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="am-relationship">
                    Parentesco <span className="text-destructive">*</span>
                  </Label>
                  <Select value={relationship} onValueChange={setRelationship}>
                    <SelectTrigger id="am-relationship" className="w-full max-w-full box-border min-w-0 text-[16px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {relationships.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="am-birth">Nascimento</Label>
                  <DatePickerField
                    value={birthDate}
                    onChange={setBirthDate}
                    mode="date"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="am-gender">Gênero</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger id="am-gender" className="w-full max-w-full box-border min-w-0 text-[16px]"><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      {genders.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="am-blood">Tipo Sanguíneo</Label>
                  <Select value={bloodType} onValueChange={setBloodType}>
                    <SelectTrigger id="am-blood" className="w-full max-w-full box-border min-w-0 text-[16px]"><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      {bloodTypes.map((bt) => (
                        <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Grid: CPF + Telefone */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="am-cpf">CPF</Label>
                  <Input
                    id="am-cpf"
                    type="text"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(formatCpf(e.target.value))}
                    className="w-full max-w-full box-border min-w-0 text-[16px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="am-phone">Telefone</Label>
                  <Input
                    id="am-phone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    className="w-full max-w-full box-border min-w-0 text-[16px]"
                  />
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
