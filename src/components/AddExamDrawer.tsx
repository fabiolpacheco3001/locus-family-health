import { useState, useEffect, useRef } from "react";
import { Loader2, Trash2, Paperclip, X, ExternalLink } from "lucide-react";
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
import { useExams, Exam, NewExam } from "@/hooks/useExams";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMemberId: string;
  editingExam?: Exam | null;
}

const AddExamDrawer = ({ open, onOpenChange, familyMemberId, editingExam }: Props) => {
  const { addExam, updateExam, deleteExam, uploadFile } = useExams(familyMemberId);
  const [name, setName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("Agendado");
  const [file, setFile] = useState<File | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!editingExam;

  useEffect(() => {
    if (editingExam) {
      setName(editingExam.name);
      setExamDate(editingExam.exam_date ?? "");
      setLocation(editingExam.location ?? "");
      setStatus(editingExam.status);
      setExistingFileUrl(editingExam.file_url);
      setFile(null);
    } else {
      resetForm();
    }
  }, [editingExam, open]);

  const resetForm = () => {
    setName("");
    setExamDate("");
    setLocation("");
    setStatus("Agendado");
    setFile(null);
    setExistingFileUrl(null);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Preencha o nome do exame.");
      return;
    }

    try {
      setUploading(true);
      let fileUrl: string | null = existingFileUrl ?? null;

      if (isEditing) {
        if (file) {
          fileUrl = await uploadFile(file, editingExam.id);
        }
        await updateExam.mutateAsync({
          id: editingExam.id,
          name: name.trim(),
          exam_date: examDate || null,
          location: location.trim() || null,
          status,
          file_url: fileUrl,
        });
        toast.success("Exame atualizado!");
      } else {
        // Upload file FIRST (if any) using a temporary ID
        const tempId = crypto.randomUUID();
        if (file) {
          fileUrl = await uploadFile(file, tempId);
        }
        // Only then insert the record with the file_url already set
        await addExam.mutateAsync({
          family_member_id: familyMemberId,
          name: name.trim(),
          exam_date: examDate || null,
          location: location.trim() || null,
          status,
          file_url: fileUrl,
        });
        toast.success("Exame adicionado!");
      }
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!editingExam) return;
    try {
      await deleteExam.mutateAsync(editingExam.id);
      toast.success("Exame excluído.");
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error("Erro ao excluir. Tente novamente.");
    }
    setShowDeleteAlert(false);
  };

  const isPending = addExam.isPending || updateExam.isPending || uploading;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex flex-col max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle className="text-primary">
              {isEditing ? "Editar Exame" : "Novo Exame"}
            </DrawerTitle>
            <DrawerDescription>
              {isEditing ? "Altere os dados do exame." : "Preencha os dados do exame."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do Exame *</Label>
              <Input
                placeholder="Ex: Hemograma Completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-[16px] scroll-m-20"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Data do Exame</Label>
              <input
                type="date"
                lang="pt-BR"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="flex h-10 w-full max-w-full block box-border appearance-none min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[16px] ring-offset-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Local / Laboratório</Label>
              <Input
                placeholder="Ex: Laboratório Santa Luzia"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="text-[16px] scroll-m-20"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="text-[16px] scroll-m-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Agendado">Agendado</SelectItem>
                  <SelectItem value="Coletado">Coletado</SelectItem>
                  <SelectItem value="Resultado Pronto">Resultado Pronto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Anexo (PDF ou Imagem)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0] ?? null;
                  if (selected && selected.size > 20 * 1024 * 1024) {
                    toast.error("Arquivo muito grande (máx 20MB).");
                    return;
                  }
                  setFile(selected);
                }}
              />
              {file ? (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border border-border">
                  <Paperclip size={16} className="text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground truncate flex-1">{file.name}</span>
                  <button onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                    <X size={16} className="text-muted-foreground" />
                  </button>
                </div>
              ) : existingFileUrl ? (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border border-border">
                  <Paperclip size={16} className="text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground truncate flex-1">Arquivo existente</span>
                  <Button variant="ghost" size="sm" className="h-auto p-1 text-xs" onClick={() => fileInputRef.current?.click()}>
                    Trocar
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-muted-foreground"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip size={16} />
                  Selecionar arquivo
                </Button>
              )}
            </div>

            {isEditing && (
              <div className="pt-4 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setShowDeleteAlert(true)}
                >
                  <Trash2 size={16} className="mr-2" />
                  Excluir Exame
                </Button>
              </div>
            )}
          </div>

          <DrawerFooter className="flex-row gap-3">
            <DrawerClose asChild>
              <Button variant="ghost" className="flex-1">Cancelar</Button>
            </DrawerClose>
            <Button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1"
            >
              {isPending ? <Loader2 className="animate-spin" size={18} /> : isEditing ? "Salvar Alterações" : "Salvar Exame"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este exame?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita e os dados do exame serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteExam.isPending ? <Loader2 className="animate-spin" size={16} /> : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AddExamDrawer;
