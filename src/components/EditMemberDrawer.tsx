import { useState, useEffect } from "react";
import { Loader2, Trash2, Camera } from "lucide-react";
import AvatarSelector from "@/components/AvatarSelector";
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
import { useFamilyMembers, FamilyMember } from "@/hooks/useFamilyMembers";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: FamilyMember;
}

const relationships = ["Titular", "Filho(a)", "Cônjuge", "Pai/Mãe", "Irmão(ã)", "Outro"];
const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const genders = ["Masculino", "Feminino", "Outro", "Prefiro não informar"];

const EditMemberDrawer = ({ open, onOpenChange, member }: Props) => {
  const { updateMember, deleteMember } = useFamilyMembers();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [gender, setGender] = useState("");
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  const initials = member?.name?.[0]?.toUpperCase() ?? "?";

  useEffect(() => {
    if (open && member) {
      setName(member.name);
      setRelationship(member.relationship);
      setBirthDate(member.birth_date || "");
      setBloodType(member.blood_type || "");
      setGender(member.gender || "");
    }
  }, [open, member]);

  const handleSave = async () => {
    if (!name.trim() || !relationship) {
      toast.error("Preencha o nome e o parentesco.");
      return;
    }
    try {
      await updateMember.mutateAsync({
        id: member.id,
        name: name.trim(),
        relationship,
        birth_date: birthDate || null,
        blood_type: bloodType || null,
        gender: gender || null,
      });
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

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-background outline-none">
          <DrawerHeader>
            <DrawerTitle className="text-primary">Editar Familiar</DrawerTitle>
            <DrawerDescription>Atualize os dados abaixo.</DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain no-scrollbar">
            {/* Avatar */}
            <div className="flex justify-center mb-2">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-secondary/20 border-2 border-secondary flex items-center justify-center">
                  <span className="text-xl font-bold text-secondary">{initials}</span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                  <Camera className="w-3 h-3 text-muted-foreground" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Nome Completo *</Label>
              <Input placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} className="w-full max-w-full box-border min-w-0 text-[16px]" />
            </div>

            {/* Grid: Parentesco + Nascimento */}
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

            {/* Grid: Gênero + Tipo Sanguíneo */}
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

            <div className="pt-4 border-t border-border">
              <Button
                variant="outline"
                className="w-full text-red-500 border-red-200 hover:bg-red-50 flex items-center justify-center gap-2"
                onClick={() => setShowDeleteAlert(true)}
              >
                <Trash2 className="w-4 h-4" />
                Excluir Familiar
              </Button>
            </div>
          </div>

          <DrawerFooter className="flex-row gap-3">
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {member.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Esta ação não pode ser desfeita e apagará todo o histórico de saúde no futuro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMember.isPending ? <Loader2 className="animate-spin" size={16} /> : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EditMemberDrawer;
