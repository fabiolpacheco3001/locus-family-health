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
<<<<<<< HEAD
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { parseISO, isValid } from "date-fns";
import type { InstructionItem } from "@/hooks/useSurgeries";

interface SurgeryInstructionImporterProps {
  phase: "pre" | "post";
  surgeryId?: string;
=======
import type { InstructionItem } from "@/hooks/useSurgeries";
import { parseISO, isValid, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SurgeryInstructionImporterProps {
  phase: "pre" | "post";
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
  items: InstructionItem[];
  onChange: (items: InstructionItem[]) => void;
}

<<<<<<< HEAD
=======
function genId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
export function SurgeryInstructionImporter({
  phase,
  items,
  onChange,
}: SurgeryInstructionImporterProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [newItemText, setNewItemText] = useState("");
<<<<<<< HEAD
  const [newItemAlarm, setNewItemAlarm] = useState<Date | undefined>(undefined);
=======
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
  const fileInputRef = useRef<HTMLInputElement>(null);

  const phaseLabel = phase === "pre" ? "pré-cirúrgicas" : "pós-cirúrgicas";

<<<<<<< HEAD
  const newId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const handleFileSelect = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo permitido: 10MB.");
=======
  const handleFileSelect = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo: 10MB.");
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
      return;
    }

    setAnalyzing(true);
<<<<<<< HEAD
    let uploadedPath: string | null = null;
    try {
      const fileName = `${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
=======
    try {
      // Upload para bucket surgery-documents (privado)
      const ext = file.name.split(".").pop() ?? "jpg";
      const fileName = `${genId()}.${ext}`;
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("surgery-documents")
        .upload(fileName, file, { upsert: false });

<<<<<<< HEAD
      if (uploadError || !uploadData) throw uploadError ?? new Error("upload failed");
      uploadedPath = uploadData.path;

=======
      if (uploadError) throw uploadError;

      // Signed URL para a edge function (5 min)
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
      const { data: signedData, error: signedError } = await supabase.storage
        .from("surgery-documents")
        .createSignedUrl(uploadData.path, 300);

<<<<<<< HEAD
      if (signedError || !signedData) throw signedError ?? new Error("signed url failed");

=======
      if (signedError || !signedData) throw signedError ?? new Error("Erro ao gerar URL");

      // Chamar edge function
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
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
<<<<<<< HEAD
        toast.warning(err.error ?? "Limite de IA atingido. Use adição manual.");
        return;
      }

      if (!response.ok) {
        throw new Error("Erro na análise");
      }

      const result = await response.json();

      if (!result.items?.length) {
        toast.warning("Não foi possível estruturar automaticamente. Edite as instruções abaixo.");
=======
        toast.warning(
          err.error ?? "Limite de IA atingido. Adicione as instruções manualmente."
        );
        return;
      }

      if (!response.ok) throw new Error("Erro na análise do documento");

      const result = await response.json();

      // Deletar do storage após extração (minimização LGPD)
      await supabase.storage.from("surgery-documents").remove([uploadData.path]);

      if (result.confidence === "low" || !result.items?.length) {
        toast.warning(
          "Não foi possível estruturar automaticamente. Edite as instruções abaixo."
        );
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
        if (result.raw_text) {
          onChange([
            ...items,
            {
<<<<<<< HEAD
              id: newId(),
=======
              id: genId(),
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
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
<<<<<<< HEAD
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
=======
        `${result.items.length} instrução${result.items.length !== 1 ? "ões" : ""} importada${result.items.length !== 1 ? "s" : ""}!`
      );
    } catch {
      toast.error("Erro ao analisar documento. Adicione as instruções manualmente.");
    } finally {
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
      setAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

<<<<<<< HEAD
  const toggleCompleted = (id: string) => {
    onChange(items.map((i) => (i.id === id ? { ...i, completed: !i.completed } : i)));
  };

  const toggleAlarm = (id: string) => {
    onChange(items.map((i) => (i.id === id ? { ...i, alarmEnabled: !i.alarmEnabled } : i)));
  };

  const removeItem = (id: string) => {
    onChange(items.filter((i) => i.id !== id));
  };
=======
  const toggleCompleted = (id: string) =>
    onChange(items.map((i) => (i.id === id ? { ...i, completed: !i.completed } : i)));

  const toggleAlarm = (id: string) =>
    onChange(items.map((i) => (i.id === id ? { ...i, alarmEnabled: !i.alarmEnabled } : i)));

  const removeItem = (id: string) => onChange(items.filter((i) => i.id !== id));
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))

  const addManualItem = () => {
    if (!newItemText.trim()) return;
    onChange([
      ...items,
      {
<<<<<<< HEAD
        id: newId(),
        text: newItemText.trim(),
        completed: false,
        alarmEnabled: !!newItemAlarm,
        alarmAt: newItemAlarm ? newItemAlarm.toISOString() : null,
=======
        id: genId(),
        text: newItemText.trim(),
        completed: false,
        alarmEnabled: false,
        alarmAt: null,
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
        createdByAi: false,
      },
    ]);
    setNewItemText("");
<<<<<<< HEAD
    setNewItemAlarm(undefined);
=======
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
    setShowManualAdd(false);
  };

  const completedCount = items.filter((i) => i.completed).length;

  return (
    <div className="space-y-3">
<<<<<<< HEAD
=======
      {/* Progresso */}
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
      {items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {completedCount} de {items.length}{" "}
          {completedCount === 1 ? "item concluído" : "itens concluídos"}
        </p>
      )}

<<<<<<< HEAD
=======
      {/* Ações */}
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
<<<<<<< HEAD
              Analisando...
=======
              Analisando documento...
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
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
<<<<<<< HEAD
          className="text-base"
          onClick={() => setShowManualAdd(!showManualAdd)}
          disabled={analyzing}
=======
          className="text-base px-3"
          onClick={() => setShowManualAdd(!showManualAdd)}
          disabled={analyzing}
          aria-label="Adicionar instrução manualmente"
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
        >
          <Plus size={16} />
        </Button>
      </div>

<<<<<<< HEAD
=======
      {/* Adição manual */}
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
      {showManualAdd && (
        <div className="bg-muted/40 rounded-lg p-3 space-y-2 border border-border/50">
          <textarea
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder={`Descreva a instrução ${phaseLabel}...`}
<<<<<<< HEAD
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
=======
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
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
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
<<<<<<< HEAD
                setNewItemAlarm(undefined);
=======
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

<<<<<<< HEAD
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
=======
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
              ? format(alarmDate, "dd/MM 'às' HH:mm", { locale: ptBR })
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
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
      </div>
    </div>
  );
}
