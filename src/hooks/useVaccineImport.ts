/**
 * useVaccineImport — Encapsula o fluxo de importação de carteira SUS (PDF).
 * Extraído de Vacinas.tsx (M3).
 *
 * Responsabilidades:
 *  - Upload do PDF para Storage
 *  - Parsing local via parseSusVaccinePdf (carregado on-demand — A13)
 *  - Validação de CPF do titular
 *  - Deduplicação e inserção de vacinas
 *  - Controle do drawer de revisão e do fileRef
 */
import { useRef, useState } from "react";
import type { RefObject } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import type { ImportedVaccine } from "@/components/VaccineImportReviewDrawer";

type UseVaccineImportParams = {
  user: { id: string } | null;
  familyMemberId: string | undefined;
  groupId: string | null;
  currentMember: { cpf?: string | null } | undefined;
  isAiActive: boolean;
  canUsePremium: boolean;
  queryClient: QueryClient;
};

export function useVaccineImport({
  user,
  familyMemberId,
  groupId,
  currentMember,
  isAiActive,
  canUsePremium,
  queryClient,
}: UseVaccineImportParams) {
  const fileRef = useRef<HTMLInputElement>(null) as RefObject<HTMLInputElement>;

  const [uploading, setUploading] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [importPending, setImportPending] = useState(false);
  const [importVaccines, setImportVaccines] = useState<ImportedVaccine[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);

  const handleImportClick = () => {
    if (!isAiActive) {
      toast.error(
        "A Inteligência Artificial está temporariamente em manutenção. Por favor, insira os dados manualmente."
      );
      return;
    }
    if (!canUsePremium) {
      setShowPaywall(true);
      return;
    }
    setTimeout(() => fileRef.current?.click(), 200);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.type !== "application/pdf") {
      toast.error("Apenas arquivos PDF são aceitos.");
      return;
    }

    setUploading(true);
    try {
      // 1. Upload para Storage
      const safeName = file.name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9._-]/g, "");
      const filePath = `${user.id}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("vaccine_documents")
        .upload(filePath, file);
      if (uploadError) {
        toast.error(`Erro no Upload: ${uploadError.message}`);
        return;
      }

      // 2. Parsing local (on-demand — A13)
      const { parseSusVaccinePdf } = await import("@/lib/parseSusVaccinePdf");
      const result = await parseSusVaccinePdf(file);

      // 3. Validação de CPF (Fail-Closed)
      const memberCpf = currentMember?.cpf?.replace(/\D/g, "") ?? "";
      if (!memberCpf) {
        toast.error(
          "Erro: Cadastre o CPF deste familiar antes de importar documentos do SUS."
        );
        return;
      }

      const cleanCandidates = result.allCpfCandidates;
      console.log("DEBUG CPF -> Candidatos no PDF:", cleanCandidates, "| Banco:", memberCpf);
      if (!cleanCandidates.includes(memberCpf)) {
        toast.error(
          "Este documento pertence a outra pessoa. Verifique o arquivo e o perfil selecionado."
        );
        return;
      }

      // 4. Verificar se há vacinas
      if (result.vaccines.length === 0) {
        toast.error("Nenhuma vacina encontrada no documento. Verifique se o PDF é válido.");
        return;
      }

      setImportVaccines(result.vaccines);
      setReviewOpen(true);
    } catch (error) {
      console.error("Erro no Parser:", error);
      toast.error("Erro ao processar o arquivo. Tente novamente.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleConfirmImport = async (selected: ImportedVaccine[]) => {
    if (!user || !familyMemberId) return;
    setImportPending(true);
    try {
      // Anti-duplicata
      const { data: existing } = await supabase
        .from("vaccines")
        .select("name, applied_date")
        .eq("family_member_id", familyMemberId);

      const existingSet = new Set(
        (existing ?? []).map((v) => `${v.name?.toLowerCase()}|${v.applied_date}`)
      );

      const newVaccines = selected.filter(
        (v) => !existingSet.has(`${v.name.toLowerCase()}|${v.applied_date}`)
      );

      if (newVaccines.length === 0) {
        toast("Todas as vacinas deste documento já estão cadastradas.");
        setReviewOpen(false);
        return;
      }

      const rows = newVaccines.map((v) => ({
        user_id: user.id,
        family_member_id: familyMemberId,
        name: v.name,
        applied_date: v.applied_date,
        details: v.details || null,
        dose_type: v.dose_label || null,
        batch: v.batch || null,
        facility: v.facility || null,
        city: v.city || null,
        state: v.state || null,
        group_id: groupId ?? undefined,
      }));

      const { error } = await supabase.from("vaccines").insert(rows);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["vaccines", familyMemberId] });
      setReviewOpen(false);

      const skipped = selected.length - newVaccines.length;
      const msg =
        skipped > 0
          ? `${newVaccines.length} vacina(s) importada(s). ${skipped} já existente(s) ignorada(s).`
          : `${newVaccines.length} vacina(s) importada(s) com sucesso`;
      toast.success(msg);
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Erro ao importar vacinas");
    } finally {
      setImportPending(false);
    }
  };

  return {
    fileRef,
    uploading,
    reviewOpen,
    setReviewOpen,
    importPending,
    importVaccines,
    showPaywall,
    setShowPaywall,
    handleImportClick,
    handleFileChange,
    handleConfirmImport,
  };
}
