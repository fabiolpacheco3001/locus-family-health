import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";

const MeusDados = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { members, updateMember } = useFamilyMembers();

  const titular = members?.find((m) => m.relationship === "Titular");

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");

  useEffect(() => {
    if (titular) {
      setName(titular.name || "");
      setBirthDate(titular.birth_date || "");
      setGender(titular.gender || "");
      setPhone(titular.phone || "");
      setCpf(titular.cpf || "");
    }
  }, [titular]);

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

  const handleSave = async () => {
    if (!titular) return;
    if (!name.trim()) {
      toast.error("O nome é obrigatório.");
      return;
    }
    try {
      await updateMember.mutateAsync({
        id: titular.id,
        name: name.trim(),
        birth_date: birthDate || null,
        gender: gender || null,
        phone: phone || null,
        cpf: cpf || null,
      });
      toast.success("Dados atualizados com sucesso!");
      navigate("/ajustes");
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-card border-b border-border">
        <button onClick={() => navigate("/ajustes")} className="p-1">
          <ArrowLeft size={24} className="text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground flex-1 text-center pr-8">
          Meus Dados
        </h1>
      </div>

      {/* Miolo Rolável */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32 overscroll-contain no-scrollbar">
        <div className="space-y-1.5">
          <Label>Nome Completo *</Label>
          <Input
            placeholder="Seu nome completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full max-w-full box-border min-w-0 text-[16px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label>E-mail</Label>
          <Input
            value={user?.email || ""}
            readOnly
            disabled
            className="w-full max-w-full box-border min-w-0 text-[16px] bg-muted cursor-not-allowed"
          />
          <p className="text-xs text-muted-foreground">Este é seu e-mail de login e não pode ser alterado aqui.</p>
        </div>

        <div className="space-y-1.5">
          <Label>Data de Nascimento</Label>
          <input
            type="date"
            lang="pt-BR"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            min="1900-01-01"
            max={new Date().toISOString().split("T")[0]}
            className="flex h-10 w-full max-w-full box-border appearance-none min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[16px] ring-offset-background"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Gênero</Label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger className="w-full max-w-full box-border min-w-0 text-[16px]">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Masculino">Masculino</SelectItem>
              <SelectItem value="Feminino">Feminino</SelectItem>
              <SelectItem value="Outro">Outro</SelectItem>
              <SelectItem value="Prefiro não informar">Prefiro não informar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Telefone</Label>
          <Input
            type="tel"
            placeholder="(11) 99999-9999"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            className="w-full max-w-full box-border min-w-0 text-[16px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label>CPF</Label>
          <Input
            type="text"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            className="w-full max-w-full box-border min-w-0 text-[16px]"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 bg-card border-t border-border mt-auto">
        <Button
          onClick={handleSave}
          disabled={updateMember.isPending}
          className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
        >
          {updateMember.isPending ? <Loader2 className="animate-spin" size={18} /> : "Salvar Alterações"}
        </Button>
      </div>
    </div>
  );
};

export default MeusDados;
