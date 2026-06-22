import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Camera,
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  Bell,
  BellOff,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { parseISO, isValid } from "date-fns";
import type { InstructionItem } from "@/hooks/useSurgeries";

interface SurgeryInstructionImporterProps {
  phase: "pre" | "post";
  surgeryId?: string;
  items: InstructionItem[];
  onChange: (items: InstructionItem[]) => void;
}

export function SurgeryInstructionImporter({
  phase,
  items,
  onChange,
}: SurgeryInstructionImporterProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [newItemText, setNewItemText] = useState("");
  const [newItemAlarm, setNewItemAlarm] = useState<Date | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const phaseLabel = phase === "pre" ? "pré-cirúrgicas" : "pós-cirúrgicas";

  const newId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const handleFileSelect = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo permitido: 10MB.");
      return;
    }

    setAnalyzing(true);
    let uploadedPath: string | null = null;
    try {
      const fileName = `${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("surgery-documents")
        .upload(fileName, file, { upsert: false });

      if (uploadError || !uploadData) throw uploadError ?? new Error("upload failed");
      uploadedPath = uploadData.path;

      const { data: signedData, error: signedError } = await supabase.storage
        .from("surgery-documents")
        .createSignedUrl(uploadData.path, 300);

      if (signedError || !signedData) throw signedError ?? new Error("signed url failed");

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
        toast.warning(err.error ?? "Limite de IA atingido. Use adição manual.");
        return;
      }

      if (!response.ok) {
        throw new Error("Erro na análise");
      }

      const result = await response.json();

      if (!result.items?.length) {
        toast.warning("Não foi possível estruturar automaticamente. Edite as instruções abaixo.");
        if (result.raw_text) {
          onChange([
            ...items,
            {
              id: newId(),
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
        `${result.items.length} instrução${result.items.length > 1 ? "ões" : ""} importada${
          result.items.length > 1 ? "s" : ""
        } com sucesso!`
      );
    } catch {
      toast.error("Erro ao analisar documento. Tente adicionar manualmente.");
    } finally {
      // Minimização LGPD: remover arquivo após extração
      if (uploadedPath) {
        try {
          await supabase.storage.from("surgery-documents").remove([uploadedPath]);
        } catch {
          // silencioso
        }
      }
      setAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleCompleted = (id: string) => {
    onChange(items.map((i) => (i.id === id ? { ...i, completed: !i.completed } : i)));
  };

  const toggleAlarm = (id: string) => {
    onChange(items.map((i) => (i.id === id ? { ...i, alarmEnabled: !i.alarmEnabled } : i)));
  };

  const removeItem = (id: string) => {
    onChange(items.filter((i) => i.id !== id));
  };

  const addManualItem = () => {
    if (!newItemText.trim()) return;
    onChange([
      ...items,
      {
        id: newId(),
        text: newItemText.trim(),
        completed: false,
        alarmEnabled: !!newItemAlarm,
        alarmAt: newItemAlarm ? newItemAlarm.toISOString() : null,
        createdByAi: false,
      },
    ]);
    setNewItemText("");
    setNewItemAlarm(undefined);
    setShowManualAdd(false);
  };

  const completedCount = items.filter((i) => i.completed).length;

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {completedCount} de {items.length}{" "}
          {completedCount === 1 ? "item concluído" : "itens concluídos"}
        </p>
      )}

      <div className="flex gap-2">
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
          variant="outline"
          size="sm"
          className="text-base flex-1"
          onClick={() => fileInputRef.current?.click()}
          disabled={analyzing}
        >
          {analyzing ? (
            <>
              <Loader2 size={16} className="animate-spin mr-2" />
              Analisando...
            </>
          ) : (
            <>
              <Camera size={16} className="mr-2" />
              Importar via IA
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-base"
          onClick={() => setShowManualAdd(!showManualAdd)}
          disabled={analyzing}
        >
          <Plus size={16} />
        </Button>
      </div>

      {showManualAdd && (
        <div className="bg-muted/40 rounded-lg p-3 space-y-2 border border-border/50">
          <textarea
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder={`Descreva a instrução ${phaseLabel}...`}
            className="w-full text-base bg-background border border-input rounded-md px-3 py-2 resize-none min-h-[80px]"
            rows={3}
          />
          <DateTimePicker
            value={newItemAlarm}
            onChange={setNewItemAlarm}
            placeholder="Alarme (opcional)"
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" className="text-base flex-1" onClick={addManualItem}>
              Adicionar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-base"
              onClick={() => {
                setShowManualAdd(false);
                setNewItemText("");
                setNewItemAlarm(undefined);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhuma instrução adicionada. Use "Importar via IA" ou adicione manualmente.
        </p>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`bg-card rounded-lg border border-border/50 p-3 ${
              item.completed ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => toggleCompleted(item.id)}
                className="shrink-0 mt-0.5"
                aria-label={item.completed ? "Marcar como pendente" : "Marcar como concluído"}
              >
                {item.completed ? (
                  <CheckCircle2 size={18} className="text-green-500" />
                ) : (
                  <Circle size={18} className="text-muted-foreground" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm ${
                    item.completed ? "line-through text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {item.text}
                </p>
                {item.createdByAi && (
                  <p className="text-[10px] text-amber-600 mt-0.5">⚠ Verificar com seu médico</p>
                )}
                {item.alarmAt &&
                  (() => {
                    const d = parseISO(item.alarmAt);
                    return isValid(d) ? (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        🔔 Alarme:{" "}
                        {d.toLocaleString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    ) : null;
                  })()}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleAlarm(item.id)}
                  className="p-1 rounded hover:bg-muted/50"
                  aria-label={item.alarmEnabled ? "Desativar alarme" : "Ativar alarme"}
                >
                  {item.alarmEnabled ? (
                    <Bell size={14} className="text-[#78C2AD]" />
                  ) : (
                    <BellOff size={14} className="text-muted-foreground" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="p-1 rounded hover:bg-muted/50"
                  aria-label="Remover item"
                >
                  <Trash2 size={14} className="text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
