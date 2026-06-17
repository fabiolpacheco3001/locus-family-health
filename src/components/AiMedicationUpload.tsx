import { useState, useRef, useEffect } from "react";
import { Loader2, Paperclip, X, Upload, AlertTriangle } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAiStatus } from "@/hooks/useAiStatus";
import { logAiUsage } from "@/hooks/useLogAiUsage";
import PaywallModal from "@/components/PaywallModal";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose,
} from "@/components/ui/drawer";
import { toast } from "sonner";
import { useMedications } from "@/hooks/useMedications";
import { getEdgeSignedUrl } from "@/lib/storage";
import { differenceInYears } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMemberId: string;
  onAnalysisComplete: (data: any, receitaUrl: string | null) => void;
}

const AiMedicationUpload = ({ open, onOpenChange, familyMemberId, onAnalysisComplete }: Props) => {
  const { canUsePremium } = useSubscription();
  const { isAiActive } = useAiStatus();
  const [showPaywall, setShowPaywall] = useState(false);
  const { uploadReceita } = useMedications(familyMemberId);
  const [receitaFile, setReceitaFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [patientAge, setPatientAge] = useState<number | null>(null);
  const receitaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!familyMemberId || !open) return;
    setReceitaFile(null);
    setLgpdConsent(false);
    supabase
      .from("family_members")
      .select("birth_date")
      .eq("id", familyMemberId)
      .single()
      .then(({ data }) => {
        if (data?.birth_date) {
          setPatientAge(differenceInYears(new Date(), new Date(data.birth_date)));
        } else {
          setPatientAge(null);
        }
      });
  }, [familyMemberId, open]);

  const handleAnalyze = async () => {
    if (!isAiActive) {
      toast.error("A Inteligência Artificial está temporariamente em manutenção. Insira os dados manualmente.");
      return;
    }
    if (!canUsePremium) {
      setShowPaywall(true);
      return;
    }
    if (!receitaFile) {
      toast.error("Selecione uma foto da receita.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const tempId = crypto.randomUUID();
      const receitaPath = await uploadReceita(receitaFile, tempId);

      // Generate a short-lived signed URL for the edge function (private bucket)
      const receitaUrl = await getEdgeSignedUrl(receitaPath);
      if (!receitaUrl) throw new Error("Não foi possível gerar URL para análise.");

      const { data, error } = await supabase.functions.invoke("analyze-prescription", {
        body: { fileUrl: receitaUrl, ...(patientAge !== null ? { patientAge } : {}) },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      logAiUsage("receita", 0);
      onOpenChange(false);
      onAnalysisComplete(data, receitaPath); // pass path (not signed URL) so callers store the stable path
    } catch (err: any) {
      console.error("Prescription OCR error:", err);
      toast.error(err?.message || "Não foi possível ler a receita. Tente novamente.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[70dvh] flex flex-col rounded-t-2xl bg-background outline-hidden">
          <DrawerHeader>
            <DrawerTitle className="text-primary">Ler Receita com IA</DrawerTitle>
            <DrawerDescription>Envie uma foto da receita médica para preenchimento automático.</DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Após a leitura, você poderá revisar e corrigir todos os dados antes de salvar.
              </p>
            </div>

            <input
              ref={receitaInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null;
                if (selected && selected.size > 20 * 1024 * 1024) {
                  toast.error("Arquivo muito grande (máx 20MB).");
                  return;
                }
                setReceitaFile(selected);
              }}
            />

            {receitaFile ? (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-xl border border-border">
                <Paperclip size={16} className="text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground truncate flex-1">{receitaFile.name}</span>
                <button onClick={() => { setReceitaFile(null); if (receitaInputRef.current) receitaInputRef.current.value = ""; }}>
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => receitaInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 active:bg-primary/10 sm:hover:bg-primary/10 transition-colors"
              >
                <Upload className="text-primary" size={32} />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Tirar foto ou anexar arquivo</p>
                  <p className="text-xs text-muted-foreground mt-1">Aponte a câmera para a receita ou escolha da galeria.</p>
                </div>
              </button>
            )}

            {receitaFile && (
              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox
                  checked={lgpdConsent}
                  onCheckedChange={(v) => setLgpdConsent(v === true)}
                  className="mt-0.5 shrink-0"
                />
                <span className="text-xs text-muted-foreground leading-relaxed text-justify">
                  Concordo que a imagem será processada temporariamente por uma Inteligência Artificial parceira para extração dos dados, sendo descartada imediatamente após o uso.
                </span>
              </label>
            )}
          </div>

          <DrawerFooter>
            <div className="flex w-full gap-4">
              <DrawerClose asChild>
                <Button variant="outline" className="flex-1">Cancelar</Button>
              </DrawerClose>
              <Button
                onClick={handleAnalyze}
                disabled={!receitaFile || !lgpdConsent || isAnalyzing}
                className="flex-1 gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Lendo receita...
                  </>
                ) : (
                  "Analisar Receita"
                )}
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
      <PaywallModal open={showPaywall} onOpenChange={setShowPaywall} />
    </>
  );
};

export default AiMedicationUpload;
