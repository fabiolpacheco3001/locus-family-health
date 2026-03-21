import { useState, useEffect, ChangeEvent } from "react";
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
import { useFamilyMembers, FamilyMember } from "@/hooks/useFamilyMembers";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: FamilyMember;
}

const relationships = ["Titular", "Filho(a)", "Cônjuge", "Pai/Mãe", "Irmão(ã)", "Outro"];
const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const applyDateMask = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const isoToMasked = (iso: string | null): string => {
  if (!iso) return "";
  const [yyyy, mm, dd] = iso.split("-");
  return `${dd}/${mm}/${yyyy}`;
};

const maskedToISO = (masked: string): string | null => {
  const parts = masked.split("/");
  if (parts.length !== 3 || parts[2].length !== 4) return null;
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm}-${dd}`;
};

const EditMemberDrawer = ({ open, onOpenChange, member }: Props) => {
  const { updateMember, deleteMember } = useFamilyMembers();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  useEffect(() => {
    if (open && member) {
      setName(member.name);
      setRelationship(member.relationship);
      setBirthDate(isoToMasked(member.birth_date));
      setBloodType(member.blood_type || "");
    }
  }, [open, member]);

  const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    setBirthDate(applyDateMask(e.target.value));
  };

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
        birth_date: maskedToISO(birthDate),
        blood_type: bloodType || null,
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
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-primary">Editar Familiar</DrawerTitle>
            <DrawerDescription>Atualize os dados abaixo.</DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} className="text-[16px] scroll-m-20" />
            </div>

            <div className="space-y-1.5">
              <Label>Parentesco *</Label>
              <Select value={relationship} onValueChange={setRelationship}>
                <SelectTrigger className="text-[16px] scroll-m-20"><SelectValue placeholder="Selecione" /></SelectTrigger>
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
              className="text-[16px] scroll-m-20"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tipo Sanguíneo</Label>
              <Select value={bloodType} onValueChange={setBloodType}>
                <SelectTrigger className="text-[16px] scroll-m-20"><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {bloodTypes.map((bt) => (
                    <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Danger zone */}
            <div className="pt-4 border-t border-border">
              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteAlert(true)}
              >
                <Trash2 size={16} className="mr-2" />
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
