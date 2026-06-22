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
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { InstructionItem } from "@/hooks/useSurgeries";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <div className="space-y-4">
      {/* Lista numerada de instruções */}
      {items.length > 0 && (
        <ol className="space-y-2">
          {items.map((item, idx) => (
            <li key={item.id} className="flex items-start gap-3">
              {/* Número do passo */}
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

              {/* Texto */}
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
            </li>
          ))}
        </ol>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-3">
          Nenhuma instrução ainda. Adicione abaixo ou importe via IA.
        </p>
      )}

      {/* Adicionar instrução inline */}
      <div className="flex gap-2">
        <Input
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Adicionar instrução..."
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

      {/* Importar via IA */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full text-muted-foreground text-sm"
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
    </div>
  );
}
