import { useState, useEffect, useRef } from "react";
import { Loader2, Trash2, Paperclip, X, Eye, Sparkles, Ban } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useExams, Exam, NewExam } from "@/hooks/useExams";
import ConsultationSelect from "@/components/ConsultationSelect";

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
  const [status, setStatus] = useState("Agendado"); // managed by swipe, not UI
  const [resultDate, setResultDate] = useState("");
  const [consultationId, setConsultationId] = useState("none");
  const [file, setFile] = useState<File | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  const [showCancelAlert, setShowCancelAlert] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [uploading, setUploading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!editingExam;
  const isCancelled = editingExam?.status === "Cancelado";

  useEffect(() => {
    if (editingExam) {
      setName(editingExam.name);
      const ed = editingExam.exam_date;
      if (ed) {
        const d = new Date(ed);
        const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        setExamDate(local);
      } else {
        setExamDate("");
      }
      setLocation(editingExam.location ?? "");
      setStatus(editingExam.status);
      setResultDate(editingExam.result_date ?? "");
      setConsultationId(editingExam.consultation_id ?? "none");
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
    setResultDate("");
    setConsultationId("none");
    setFile(null);
    setExistingFileUrl(null);
    setCancelReason("");
    setLgpdConsent(false);
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
          exam_date: examDate ? new Date(examDate).toISOString() : null,
          location: location.trim() || null,
          status,
          file_url: fileUrl,
          result_date: status === "Realizado" && resultDate ? resultDate : null,
          consultation_id: consultationId === "none" ? null : consultationId,
        });
        toast.success("Exame atualizado!");
      } else {
        const tempId = crypto.randomUUID();
        if (file) {
          fileUrl = await uploadFile(file, tempId);
        }
        await addExam.mutateAsync({
          family_member_id: familyMemberId,
          name: name.trim(),
          exam_date: examDate ? new Date(examDate).toISOString() : null,
          location: location.trim() || null,
          status,
          file_url: fileUrl,
          consultation_id: consultationId === "none" ? null : consultationId,
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

  const handleCancelExam = async () => {
    if (!editingExam) return;
    try {
      await updateExam.mutateAsync({
        id: editingExam.id,
        status: "Cancelado",
        cancel_reason: cancelReason.trim() || null,
      });
      toast.success("Exame cancelado.");
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error("Erro ao cancelar. Tente novamente.");
    }
    setShowCancelAlert(false);
  };

  const isPending = addExam.isPending || updateExam.isPending || uploading;
  const isPdf = existingFileUrl?.toLowerCase().endsWith(".pdf");

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-background outline-none">
          <DrawerHeader>
            <DrawerTitle className="text-primary">
              {isEditing ? "Editar Exame" : "Novo Exame"}
            </DrawerTitle>
            <DrawerDescription>
              {isEditing ? "Altere os dados do exame." : "Preencha os dados do exame."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-24 space-y-4 no-scrollbar">
            <div className="space-y-1.5">
              <Label>Nome do Exame *</Label>
              <Input
                placeholder="Ex: Hemograma Completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-[16px]"
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label>Data e Hora</Label>
                <input
                  type="datetime-local"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  min="1900-01-01T00:00"
                  max="2099-12-31T23:59"
                  className="flex h-10 w-full max-w-full block box-border appearance-none min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[16px] ring-offset-background"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Clínica / Laboratório</Label>
              <Input
                placeholder="Ex: Clínica Santa Luzia"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="text-[16px]"
              />
            </div>

            <ConsultationSelect
              familyMemberId={familyMemberId}
              value={consultationId}
              onValueChange={setConsultationId}
            />

            {status === "Realizado" && (
              <div className="space-y-1.5">
                <Label>Data Prevista do Resultado</Label>
                <input
                  type="date"
                  lang="pt-BR"
                  value={resultDate}
                  onChange={(e) => setResultDate(e.target.value)}
                  min="1900-01-01"
                  max="2099-12-31"
                  className="flex h-10 w-full max-w-full block box-border appearance-none min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[16px] ring-offset-background"
                />
              </div>
            )}

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
                  <Button variant="ghost" size="sm" className="h-auto p-1" onClick={() => setViewerOpen(true)}>
                    <Eye size={16} className="text-primary" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-500 h-8 w-8 ml-auto" onClick={() => { setExistingFileUrl(null); setFile(null); }}>
                    <Trash2 className="w-4 h-4" />
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

            {/* AI OCR Button with LGPD consent */}
            {(file || existingFileUrl) && (
              <div className="space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <Checkbox
                    checked={lgpdConsent}
                    onCheckedChange={(v) => setLgpdConsent(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-xs text-muted-foreground leading-relaxed text-justify">
                    Concordo que o anexo será processado temporariamente por uma Inteligência Artificial parceira para extração dos dados, sendo descartado imediatamente após o uso.
                  </span>
                </label>
                <Button
                  type="button"
                  disabled={!lgpdConsent || isAnalyzing || isPending}
                  onClick={async () => {
                    setIsAnalyzing(true);
                    try {
                      let urlToAnalyze = existingFileUrl;
                      if (file) {
                        const tempId = editingExam?.id ?? crypto.randomUUID();
                        urlToAnalyze = await uploadFile(file, tempId);
                        setExistingFileUrl(urlToAnalyze);
                      }

                      if (!urlToAnalyze) {
                        toast.error("Nenhum arquivo disponível para análise.");
                        return;
                      }

                      const { data, error } = await supabase.functions.invoke("analyze-exam", {
                        body: { fileUrl: urlToAnalyze },
                      });

                      if (error) throw error;
                      if (data?.error) throw new Error(data.error);

                      if (data?.examName) setName(data.examName);
                      if (data?.location) setLocation(data.location);
                      if (data?.examDate) {
                        const d = new Date(data.examDate);
                        if (!isNaN(d.getTime())) {
                          const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                          setExamDate(local);
                        }
                      }
                      toast.success("Dados extraídos com sucesso!");
                    } catch (err: any) {
                      console.error("OCR error:", err);
                      toast.error(err?.message || "Não foi possível ler o documento.");
                    } finally {
                      setIsAnalyzing(false);
                    }
                  }}
                  className="w-full gap-2 bg-gradient-to-r from-accent to-primary text-primary-foreground hover:opacity-90 shadow-md"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Analisando documento...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Preencher dados com IA
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Nossa IA lê a foto do exame e preenche o formulário para você.
                </p>
              </div>
            )}

            {isEditing && !isCancelled && (
              <div className="pt-4 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full text-muted-foreground border-border hover:bg-muted/50"
                  onClick={() => { setCancelReason(""); setShowCancelAlert(true); }}
                >
                  <Ban size={16} className="mr-2" />
                  Marcar como Cancelado
                </Button>
              </div>
            )}
          </div>

          <DrawerFooter className="flex-row gap-3">
            <DrawerClose asChild>
              <Button variant="ghost" className="flex-1">Cancelar</Button>
            </DrawerClose>
            {!isCancelled && (
              <Button
                onClick={handleSave}
                disabled={isPending}
                className="flex-1"
              >
                {isPending ? <Loader2 className="animate-spin" size={18} /> : isEditing ? "Salvar Alterações" : "Salvar Exame"}
              </Button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* In-App File Viewer */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-[95vw] w-full max-h-[90vh] p-0 gap-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="text-primary">Visualizar Exame</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-4 flex-1 overflow-auto">
            {existingFileUrl && (
              isPdf ? (
                <iframe src={`https://docs.google.com/gview?url=${encodeURIComponent(existingFileUrl)}&embedded=true`} className="w-full h-[70vh] rounded-md border-0" />
              ) : (
                <img src={existingFileUrl} alt="Resultado do exame" className="w-full object-contain max-h-[70vh] rounded-md" />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCancelAlert} onOpenChange={setShowCancelAlert}>
        <AlertDialogContent className="max-w-[320px] w-[90vw] rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Compromisso</AlertDialogTitle>
          <AlertDialogDescription className="mb-4">
              Essa ação mudará o status do exame para cancelado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6">
            <Textarea
              placeholder="Ex: Remarcação, preparo inadequado..."
              maxLength={200}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="text-[16px] resize-none min-h-[120px] border border-[hsl(var(--primary)/0.2)] focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-offset-0"
              rows={5}
              autoFocus
            />
            <p className="text-xs text-muted-foreground/60 text-right mt-2">{cancelReason.length}/200</p>
          </div>
          <AlertDialogFooter className="px-6 pb-6">
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleCancelExam}
              disabled={updateExam.isPending}
            >
              {updateExam.isPending ? <Loader2 className="animate-spin" size={16} /> : "Confirmar Cancelamento"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AddExamDrawer;
