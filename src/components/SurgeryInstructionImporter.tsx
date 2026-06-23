import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Camera,
  Plus,
  CheckCircle2,
  Trash2,
  Bell,
  BellOff,
  Pencil,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { InstructionItem } from "@/hooks/useSurgeries";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SurgeryInstructionImporterProps {
  phase: "pre" | "post";
  surgeryId?: string;
  items: InstructionItem[];
  onChange: (items: InstructionItem[]) => void;
}

function genId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function SurgeryInstructionImporter({
  phase,
  items,
  onChange,
}: SurgeryInstructionImporterProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [newItemText, setNewItemText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [consentChecked, setConsentChecked] = useState<boolean | null>(null);

  const handleImportClick = async () => {
    if (consentChecked === true) {
      fileInputRef.current?.click();
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("consent_log")
      .select("id")
      .eq("user_id", user.id)
      .eq("consent_type", "surgery_ocr_processing")
      .limit(1)
      .maybeSingle();
    if (data) {
      setConsentChecked(true);
      fileInputRef.current?.click();
    } else {
      setShowConsentDialog(true);
    }
  };

  const handleConsentAccept = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("consent_log").insert({
      user_id: user.id,
      consent_type: "surgery_ocr_processing",
      policy_version: "1.0",
      user_agent: navigator.userAgent,
    });
    setConsentChecked(true);
    setShowConsentDialog(false);
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo: 10MB.");
      return;
    }

    setAnalyzing(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const fileName = `${genId()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("surgery-documents")
        .upload(fileName, file, { upsert: false });

      if (uploadError || !uploadData) throw uploadError ?? new Error("upload failed");

      const { data: signedData, error: signedError } = await supabase.storage
        .from("surgery-documents")
        .createSignedUrl(uploadData.path, 300);

      if (signedError || !signedData) throw signedError ?? new Error("Erro ao gerar URL");

      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-surgery-instructions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({ fileUrl: signedData.signedUrl, phase }),
        }
      );

      if (response.status === 429) {
        const err = await response.json();
        toast.warning(err.error ?? "Limite de IA atingido. Adicione as instruções manualmente.");
        return;
      }

      if (!response.ok) throw new Error("Erro na análise do documento");

      const result = await response.json();

      await supabase.storage.from("surgery-documents").remove([uploadData.path]);

      if (result.confidence === "low" || !result.items?.length) {
        toast.warning("Não foi possível estruturar automaticamente. Edite as instruções abaixo.");
        if (result.raw_text) {
          onChange([
            ...items,
            {
              id: genId(),
              text: result.raw_text,
              completed: false,
              alarmEnabled: false,
              alarmAt: null,
              createdByAi: false,
            },
          ]);
        }
        return;
      }

      onChange([...items, ...result.items]);
      toast.success(
        `${result.items.length} instrução${result.items.length !== 1 ? "ões" : ""} importada${result.items.length !== 1 ? "s" : ""}!`
      );
    } catch {
      toast.error("Erro ao analisar documento. Adicione as instruções manualmente.");
    } finally {
      setAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleCompleted = (id: string) =>
    onChange(items.map((i) => (i.id === id ? { ...i, completed: !i.completed } : i)));

  const toggleAlarm = (id: string) =>
    onChange(items.map((i) => (i.id === id ? { ...i, alarmEnabled: !i.alarmEnabled } : i)));

  const removeItem = (id: string) => onChange(items.filter((i) => i.id !== id));

  const startEdit = (item: InstructionItem) => {
    setEditingId(item.id);
    setEditText(item.text);
  };

  const confirmEdit = (id: string) => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    onChange(items.map((i) => (i.id === id ? { ...i, text: trimmed } : i)));
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const handleAddItem = () => {
    if (!newItemText.trim()) return;
    onChange([
      ...items,
      {
        id: genId(),
        text: newItemText.trim(),
        completed: false,
        alarmEnabled: false,
        alarmAt: null,
        createdByAi: false,
      },
    ]);
    setNewItemText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }
  };

  return (
    <div className="space-y-3">
      {/* 1. Importar via IA — primeira opção */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full text-sm border-dashed border-[#78C2AD] text-[#78C2AD] hover:bg-[#78C2AD]/10"
        onClick={() => fileInputRef.current?.click()}
        disabled={analyzing}
      >
        {analyzing ? (
          <>
            <Loader2 size={14} className="animate-spin mr-2" />
            Analisando documento...
          </>
        ) : (
          <>
            <Camera size={14} className="mr-2" />
            Importar instruções via IA
          </>
        )}
      </Button>

      {/* 2. Adicionar instrução manualmente */}
      <div className="flex gap-2">
        <Input
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={phase === "pre" ? "Ex: Realizar jejum de 12 horas" : "Ex: Trocar curativo 2x ao dia"}
          className="text-base flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleAddItem}
          disabled={!newItemText.trim()}
          aria-label="Adicionar"
        >
          <Plus size={16} />
        </Button>
      </div>

      {/* 3. Lista de instruções */}
      {items.length > 0 ? (
        <ol className="space-y-2">
          {items.map((item, idx) => (
            <li key={item.id} className="flex items-start gap-3">
              {/* Círculo de conclusão */}
              <button
                type="button"
                onClick={() => toggleCompleted(item.id)}
                className="shrink-0 mt-0.5"
                aria-label={item.completed ? "Marcar como pendente" : "Marcar como concluído"}
              >
                {item.completed ? (
                  <CheckCircle2 size={20} className="text-green-500" />
                ) : (
                  <span className="w-5 h-5 rounded-full border-2 border-muted-foreground flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                    {idx + 1}
                  </span>
                )}
              </button>

              {/* Texto ou input de edição */}
              {editingId === item.id ? (
                <div className="flex-1 flex gap-2">
                  <Input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); confirmEdit(item.id); }
                      if (e.key === "Escape") cancelEdit();
                    }}
                    className="text-base flex-1"
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => confirmEdit(item.id)}
                    aria-label="Confirmar edição"
                    className="shrink-0"
                  >
                    <Check size={14} />
                  </Button>
                </div>
              ) : (
                <p
                  className={`flex-1 text-sm leading-snug pt-0.5 ${
                    item.completed ? "line-through text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {item.text}
                  {item.createdByAi && (
                    <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-800 no-underline">
                      Verificar com médico
                    </span>
                  )}
                </p>
              )}

              {/* Ações (ocultas durante edição) */}
              {editingId !== item.id && (
                <>
                  {/* Editar */}
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="shrink-0 p-1 rounded hover:bg-muted/50 mt-0.5"
                    aria-label="Editar instrução"
                  >
                    <Pencil size={14} className="text-muted-foreground" />
                  </button>

                  {/* Alarme */}
                  <button
                    type="button"
                    onClick={() => toggleAlarm(item.id)}
                    className="shrink-0 p-1 rounded hover:bg-muted/50 mt-0.5"
                    aria-label={item.alarmEnabled ? "Desativar alarme" : "Ativar alarme"}
                  >
                    {item.alarmEnabled ? (
                      <Bell size={14} className="text-[#78C2AD]" />
                    ) : (
                      <BellOff size={14} className="text-muted-foreground" />
                    )}
                  </button>

                  {/* Remover */}
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 p-1 rounded hover:bg-muted/50 mt-0.5"
                    aria-label="Remover"
                  >
                    <Trash2 size={14} className="text-muted-foreground" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-3">
          Nenhuma instrução ainda. Adicione acima ou importe via IA.
        </p>
      )}
    </div>
  );
}
