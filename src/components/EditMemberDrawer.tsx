import { useState, useEffect } from "react";
import { Loader2, Trash2, Camera, X, PawPrint, Crown, User } from "lucide-react";
import AvatarSelector from "@/components/AvatarSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { useFamilyMembers, FamilyMember } from "@/hooks/useFamilyMembers";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: FamilyMember;
  memberRole?: string;
}

const relationships = ["Titular", "Filho(a)", "Cônjuge", "Pai/Mãe", "Irmão(ã)", "Outro"];
const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const genders = ["Masculino", "Feminino", "Outro", "Prefiro não informar"];
const speciesOptions = ["Cachorro", "Gato", "Pássaro", "Outro"];

const EditMemberDrawer = ({ open, onOpenChange, member, memberRole }: Props) => {
  const { updateMember, deleteMember } = useFamilyMembers();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [gender, setGender] = useState("");
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [tracksCycle, setTracksCycle] = useState(false);
  const [species, setSpecies] = useState("");
  const [breed, setBreed] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");

  const isPet = (member?.member_type || "human") === "pet";

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

  useEffect(() => {
    if (open && member) {
      setName(member.name);
      setRelationship(member.relationship);
      setBirthDate(member.birth_date || "");
      setBloodType(member.blood_type || "");
      setGender(member.gender || "");
      setAvatarUrl(member.avatar_url || "");
      setTracksCycle(!!member.tracks_menstrual_cycle);
      setSpecies(member.species || "");
      setBreed(member.breed || "");
      setCpf(member.cpf || "");
      setPhone(member.phone || "");
    }
  }, [open, member]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Preencha o nome.");
      return;
    }
    if (!isPet && !relationship) {
      toast.error("Preencha o parentesco.");
      return;
    }
    try {
      const payload: any = {
        id: member.id,
        name: name.trim(),
        relationship: isPet ? "Pet" : relationship,
        birth_date: birthDate || null,
        blood_type: isPet ? null : (bloodType || null),
        gender: isPet ? null : (gender || null),
        avatar_url: avatarUrl || null,
        species: isPet ? species : null,
        breed: isPet ? (breed.trim() || null) : null,
      };
      await updateMember.mutateAsync(payload);

      // Update tracks_menstrual_cycle separately
      if (!isPet) {
        const { supabase } = await import("@/integrations/supabase/client");
        await supabase
          .from("family_members")
          .update({ tracks_menstrual_cycle: tracksCycle } as any)
          .eq("id", member.id);
      }
      toast.success("Dados atualizados!");
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMember.mutateAsync(member.id);
      toast.success("Familiar removido.");
      onOpenChange(false);
      navigate("/home");
    } catch {
      toast.error("Erro ao excluir. Tente novamente.");
    }
  };

  const renderAvatar = () => {
    const isImage = avatarUrl?.startsWith("data:image") || avatarUrl?.startsWith("http");
    const isEmoji = avatarUrl && !isImage && avatarUrl.length > 0 && avatarUrl.length <= 2;

    return (
      <div className="flex justify-center mb-2 w-full">
        <div className="relative">
          <button onClick={() => setAvatarOpen(true)}>
            <div className="w-16 h-16 rounded-full bg-secondary/20 border-2 border-secondary flex items-center justify-center overflow-hidden">
              {isImage ? (
                <img src={avatarUrl!} className="w-full h-full object-cover rounded-full" alt="Avatar" />
              ) : isEmoji ? (
                <span className="text-4xl flex items-center justify-center w-full h-full">{avatarUrl}</span>
              ) : isPet ? (
                <PawPrint className="w-7 h-7 text-secondary" />
              ) : (
                <span className="text-xl font-bold text-secondary">
                  {(() => {
                    const parts = (member?.name ?? "").trim().split(" ").filter(Boolean);
                    if (parts.length <= 1) return (parts[0]?.[0] ?? "?").toUpperCase();
                    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
                  })()}
                </span>
              )}
            </div>
          </button>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
            <Camera className="w-3 h-3 text-muted-foreground" />
          </div>
          {avatarUrl && (
            <button
              onClick={() => setAvatarUrl("")}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-800/60 backdrop-blur-sm hover:bg-slate-800/80 border border-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-background outline-none">
          <DrawerHeader>
            <DrawerTitle className="text-primary">{isPet ? "Editar Pet 🐾" : "Editar Familiar"}</DrawerTitle>
            <DrawerDescription>Atualize os dados abaixo.</DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4 overscroll-contain no-scrollbar">
            {/* Type indicator (read-only) */}
            <div className="flex rounded-lg border border-border overflow-hidden pointer-events-none opacity-70">
              <div className={`flex-1 py-2 text-sm font-semibold text-center ${!isPet ? "bg-foreground text-background" : "bg-card text-muted-foreground"}`}>
                👤 Pessoa
              </div>
              <div className={`flex-1 py-2 text-sm font-semibold text-center ${isPet ? "bg-[#F2A97F] text-slate-900" : "bg-card text-muted-foreground"}`}>
                🐾 Pet
              </div>
            </div>

            {renderAvatar()}

            {memberRole === "admin" && (
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[10px] bg-slate-100/60 text-slate-700 border border-slate-200/80 px-2 py-0.5 rounded-full font-medium leading-none backdrop-blur-sm">Admin</span>
              </div>
            )}
            {memberRole === "user" && (
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] bg-slate-100/60 text-muted-foreground border border-slate-200/80 px-2 py-0.5 rounded-full font-medium leading-none backdrop-blur-sm">Usuário Convidado</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{isPet ? "Nome do Pet *" : "Nome Completo *"}</Label>
              <Input placeholder={isPet ? "Ex: Rex, Luna..." : "Ex: Maria da Silva"} value={name} onChange={(e) => setName(e.target.value)} className="w-full max-w-full box-border min-w-0 text-[16px]" />
            </div>

            {isPet ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Espécie</Label>
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

                {/* Toggle: Ciclo Menstrual */}
                <div className="flex items-center justify-between rounded-xl bg-card border border-border/50 p-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Controle de Ciclo Menstrual</Label>
                    <p className="text-[11px] text-muted-foreground">Habilita o módulo de ciclo menstrual</p>
                  </div>
                  <Switch checked={tracksCycle} onCheckedChange={setTracksCycle} />
                </div>
              </>
            )}
          </div>

          {/* Delete button */}
          <div className="px-4 pb-2">
            <Button
              variant="outline"
              className="w-full text-destructive border-destructive/30 hover:bg-destructive/5 flex items-center justify-center gap-2"
              onClick={() => setShowDeleteAlert(true)}
            >
              <Trash2 className="w-4 h-4" />
              {isPet ? "Excluir Pet" : "Excluir Familiar"}
            </Button>
          </div>

          <DrawerFooter className="flex-row gap-3 pt-2">
            <DrawerClose asChild>
              <Button variant="ghost" className="flex-1">Cancelar</Button>
            </DrawerClose>
            <Button
              onClick={handleSave}
              disabled={updateMember.isPending}
              className="flex-1"
            >
              {updateMember.isPending ? <Loader2 className="animate-spin" size={18} /> : "Salvar Alterações"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent className="max-w-[320px] rounded-[24px] w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {member.name}? Esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMember.isPending ? <Loader2 className="animate-spin" size={16} /> : "Sim, Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AvatarSelector open={avatarOpen} onOpenChange={setAvatarOpen} onSelect={setAvatarUrl} />
    </>
  );
};

export default EditMemberDrawer;
