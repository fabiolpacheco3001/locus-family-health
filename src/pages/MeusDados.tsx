import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import AvatarSelector from "@/components/AvatarSelector";
import { Crown, User as UserIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const MeusDados = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { members, updateMember } = useFamilyMembers();
  const { role, linkedMemberId, groupId } = useFamilyGroup();
  const queryClient = useQueryClient();

  // Strictly use linkedMemberId — never fall back to Titular
  const myProfile = linkedMemberId
    ? members?.find((m) => m.id === linkedMemberId)
    : null;

  const authName = user?.user_metadata?.full_name || user?.user_metadata?.name || "";

  const initials = (() => {
    const parts = (myProfile?.name ?? authName ?? "").trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "—";
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  })();

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (myProfile) {
      setName(myProfile.name || "");
      setBirthDate(myProfile.birth_date || "");
      setGender(myProfile.gender || "");
      setPhone(myProfile.phone || "");
      setCpf(myProfile.cpf || "");
      setBloodType(myProfile.blood_type || "");
      setAvatarUrl(myProfile.avatar_url || "");
    } else {
      // No linked profile — prefill only auth name
      setName(authName);
      setBirthDate("");
      setGender("");
      setPhone("");
      setCpf("");
      setBloodType("");
      setAvatarUrl("");
    }
  }, [myProfile, authName]);

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
    if (!name.trim()) {
      toast.error("O nome é obrigatório.");
      return;
    }

    setSaving(true);
    try {
      if (myProfile) {
        // Update existing profile
        await updateMember.mutateAsync({
          id: myProfile.id,
          name: name.trim(),
          birth_date: birthDate || null,
          gender: gender || null,
          phone: phone || null,
          cpf: cpf || null,
          avatar_url: avatarUrl || null,
          blood_type: bloodType || null,
        });
      } else {
        // Auto-healing: create profile + link it
        const { data: newMember, error: insertErr } = await supabase
          .from("family_members")
          .insert({
            user_id: user!.id,
            group_id: groupId,
            name: name.trim(),
            relationship: "Titular",
            birth_date: birthDate || null,
            gender: gender || null,
            phone: phone || null,
            cpf: cpf || null,
            avatar_url: avatarUrl || null,
            blood_type: bloodType || null,
          } as any)
          .select("id")
          .single();

        if (insertErr) throw insertErr;

        // Link to family_group_members
        const { error: linkErr } = await supabase
          .from("family_group_members" as any)
          .update({ family_member_id: newMember.id })
          .eq("auth_user_id", user!.id)
          .eq("group_id", groupId!);

        if (linkErr) throw linkErr;

        // Refresh caches
        queryClient.invalidateQueries({ queryKey: ["family_members"] });
        queryClient.invalidateQueries({ queryKey: ["family_group_membership"] });
      }

      toast.success("Dados atualizados com sucesso!");
      navigate("/ajustes");
    } catch (err) {
      console.error("Erro ao salvar Meus Dados:", err);
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10 animate-fade-in">
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 pt-6 mb-4">
        <button onClick={() => navigate("/ajustes")} className="p-1">
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground flex-1 text-center pr-8">
          Meus Dados
        </h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 space-y-3">
        {/* Avatar */}
        <div className="pt-4" />
        <button className="flex justify-center mb-4 w-full" onClick={() => setAvatarOpen(true)}>
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-secondary/20 border-2 border-secondary flex items-center justify-center overflow-hidden">
              {avatarUrl && (avatarUrl.startsWith("data:image") || avatarUrl.startsWith("http")) ? (
                <img src={avatarUrl} className="w-full h-full object-cover rounded-full" alt="Avatar" />
              ) : avatarUrl && avatarUrl.length <= 2 ? (
                <span className="text-5xl flex items-center justify-center w-full h-full">{avatarUrl}</span>
              ) : (
                <span className="text-2xl font-bold text-secondary">{initials}</span>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-muted border-2 border-background flex items-center justify-center">
              <Camera className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            {avatarUrl && (
              <button
                onClick={(e) => { e.stopPropagation(); setAvatarUrl(""); }}
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-slate-800/60 backdrop-blur-sm hover:bg-slate-800/80 border border-white/20 flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            )}
          </div>
        </button>

        {/* Role Badge */}
        <div className="flex justify-center mb-2">
          {role === "admin" ? (
            <Badge className="bg-slate-100/60 text-slate-700 border border-slate-200/80 text-xs px-3 py-1 gap-1.5 backdrop-blur-sm">
              <Crown size={14} className="text-amber-500" />
              Admin
            </Badge>
          ) : (
            <Badge className="bg-slate-100/60 text-muted-foreground border border-slate-200/80 text-xs px-3 py-1 gap-1.5 backdrop-blur-sm">
              <UserIcon size={14} />
              Usuário Convidado
            </Badge>
          )}
        </div>

        <div className="space-y-1">
          <Label>Nome Completo *</Label>
          <Input
            placeholder="Ex: João da Silva"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full max-w-full box-border min-w-0 text-[16px]"
          />
        </div>

        <div className="space-y-1">
          <Label>E-mail</Label>
          <Input
            value={user?.email || ""}
            readOnly
            disabled
            className="w-full max-w-full box-border min-w-0 text-[16px] bg-muted cursor-not-allowed"
          />
          <p className="text-xs text-muted-foreground">Este é seu e-mail de login e não pode ser alterado aqui.</p>
        </div>

        {/* Grid: Nascimento + Gênero */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Nascimento</Label>
            <input
              type="date"
              lang="pt-BR"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              min="1900-01-01"
              max={new Date().toISOString().split("T")[0]}
              style={{ textAlign: "left" }}
              className="flex h-10 w-full max-w-full box-border appearance-none min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[16px] text-left justify-start ring-offset-background [&::-webkit-date-and-time-value]:text-left"
            />
          </div>

          <div className="space-y-1">
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
        </div>

        {/* Grid: CPF + Telefone */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>CPF</Label>
            <Input
              type="text"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              className="w-full max-w-full box-border min-w-0 text-[16px]"
            />
          </div>

          <div className="space-y-1">
            <Label>Telefone</Label>
            <Input
              type="tel"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              className="w-full max-w-full box-border min-w-0 text-[16px]"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-none py-2 px-4 bg-card border-t border-border flex gap-4">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => navigate('/ajustes')}
        >
          Cancelar
        </Button>
        <Button
          className="flex-1 bg-[#A7D3CB] hover:bg-[#A7D3CB]/90 text-black font-semibold border-none"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : "Salvar"}
        </Button>
      </div>

      <AvatarSelector open={avatarOpen} onOpenChange={setAvatarOpen} onSelect={setAvatarUrl} />
    </div>
  );
};

export default MeusDados;
