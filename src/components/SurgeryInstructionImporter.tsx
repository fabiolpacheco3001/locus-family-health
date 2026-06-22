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
import type { InstructionItem } from "@/hooks/useSurgeries";
import { parseISO, isValid } from "date-fns";

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
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [newItemText, setNewItemText] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const phaseLabel = phase === "pre" ? "pré-cirúrgicas" : "pós-cirúrgicas";

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

      // Deletar do storage após extração (minimização LGPD)
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

  const addManualItem = () => {
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

      {/* Ações */
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
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
              Analisando documento...
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
          className="text-base px-3"
          onClick={() => setShowManualAdd(!showManualAdd)}
          disabled={analyzing}
          aria-label="Adicionar instrução manualmente"
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
            className="w-full text-base bg-background border border-input rounded-md px-3 py-2 resize-none min-h-[72px] outline-none focus:ring-1 focus:ring-ring"
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="text-base flex-1"
              onClick={addManualItem}
            >
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

              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Lista vazia */}
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhuma instrução adicionada.
          <br />
          Use "Importar via IA" ou adicione manualmente.
        </p>
      )}

      {/* Items */}
      <div className="space-y-2">
        {items.map((item) => {
          const alarmDate = item.alarmAt ? parseISO(item.alarmAt) : null;
          const alarmFormatted =
            alarmDate && isValid(alarmDate)
              ? alarmDate.toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null;

          return (
            <div
              key={item.id}
              className={`bg-card rounded-lg border border-border/50 p-3 transition-opacity ${
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
                    className={`text-sm leading-snug ${
                      item.completed
                        ? "line-through text-muted-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {item.text}
                  </p>
                  {item.createdByAi && (
                    <p className="text-[10px] text-amber-600 mt-0.5">
                      ⚠ Verificar com seu médico
                    </p>
                  )}
                  {alarmFormatted && item.alarmEnabled && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      🔔 Alarme: {alarmFormatted}
                    </p>
                  )}
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
                    aria-label="Remover instrução"
                  >
                    <Trash2 size={14} className="text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
