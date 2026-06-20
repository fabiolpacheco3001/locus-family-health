import { useEffect, useState } from "react";
import { Lock, Share2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import type { ClinicalEvent } from "@/hooks/useClinicalTimeline";

interface ProntuarioExportButtonProps {
  member: {
    name: string;
    birth_date: string | null;
    blood_type: string | null;
    weight: number | null;
    height: number | null;
  };
  allergies: { substance: string; severity: string }[];
  diseases: { name: string; category: string | null }[];
  timeline: ClinicalEvent[];
  timelineLoading: boolean;
}

export function ProntuarioExportButton({
  member,
  allergies,
  diseases,
  timeline,
  timelineLoading,
}: ProntuarioExportButtonProps) {
  const { user } = useAuth();
  const { linkedMemberId } = useFamilyGroup();
  const [showPrivacyAlert, setShowPrivacyAlert] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch("/logo-locus-vita-pdf.png")
      .then((r) => r.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => setLogoBase64(reader.result as string);
        reader.readAsDataURL(blob);
      })
      .catch(() => {});
  }, []);

  const { data: emitterProfile } = useQuery({
    queryKey: ["emitter_profile", user?.id],
    queryFn: async () => {
      if (linkedMemberId) {
        const { data } = await supabase
          .from("family_members")
          .select("name")
          .eq("id", linkedMemberId)
          .maybeSingle();
        return data?.name || null;
      }
      return null;
    },
    enabled: !!user && !!linkedMemberId,
  });

  const handleExport = async () => {
    setShowPrivacyAlert(false);
    setExporting(true);
    try {
      const { generateProntuarioPdf } = await import("@/lib/generateProntuarioPdf");
      const blob = generateProntuarioPdf({
        member,
        allergies,
        diseases: diseases.map((d) => ({ name: d.name, category: d.category ?? "" })),
        timeline,
        emitterName:
          emitterProfile || user?.user_metadata?.name || user?.email || "Usuário",
        logoBase64,
      });

      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
      const hh = String(now.getHours()).padStart(2, "0");
      const min = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      const fileName = `RES_${member.name.replace(/\s+/g, "_")}_${dd}${mm}${yyyy}_${hh}${min}${ss}.pdf`;

      if (navigator.share) {
        const file = new File([blob], fileName, { type: "application/pdf" });
        try {
          await navigator.share({
            files: [file],
            title: "Prontuário Médico",
            text: "Segue o resumo de saúde exportado do Locus Vita.",
          });
          return;
        } catch (shareErr: any) {
          if (shareErr?.name === "AbortError") return;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF gerado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar o PDF.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        disabled={exporting || timelineLoading}
        onClick={() => setShowPrivacyAlert(true)}
      >
        <Share2 size={20} className="text-primary" />
      </Button>

      <AlertDialog open={showPrivacyAlert} onOpenChange={setShowPrivacyAlert}>
        <AlertDialogContent className="rounded-xl mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock size={18} className="text-destructive" />
              Atenção: Dados Sensíveis
            </AlertDialogTitle>
            <AlertDialogDescription>
              O documento a seguir contém informações médicas confidenciais. Você é o único responsável pelo compartilhamento seguro destes dados. Deseja prosseguir?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExport}>Gerar Documento</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
