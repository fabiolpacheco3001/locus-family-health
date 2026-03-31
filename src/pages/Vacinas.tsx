import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import PaywallModal from "@/components/PaywallModal";
import { ArrowLeft, Syringe, ChevronRight, FileUp, PenLine, ArrowUpDown } from "lucide-react";
import ExamSwipeableCard from "@/components/ExamSwipeableCard";
import { AnimatePresence } from "framer-motion";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import FixedFAB from "@/components/ui/FixedFAB";
import useSmartBack from "@/hooks/useSmartBack";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import VaccineImportReviewDrawer, { type ImportedVaccine } from "@/components/VaccineImportReviewDrawer";
import { parseSusVaccinePdf } from "@/lib/parseSusVaccinePdf";
import { useIbgeLocations } from "@/hooks/useIbgeLocations";

type Vaccine = {
  id: string;
  name: string;
  applied_date: string | null;
  booster_date: string | null;
  batch: string | null;
  side_effects: string | null;
  details: string | null;
  dose_type: string | null;
  facility: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
};


const HUMAN_VACCINE_OPTIONS = [
  "BCG",
  "Covid-19",
  "Dengue",
  "DT - Difteria e Tétano",
  "Febre Amarela",
  "Gripe (Influenza)",
  "Hepatite A",
  "Hepatite B",
  "HPV",
  "Meningocócica",
  "Pneumocócica",
  "Poliomielite (VIP/VOP)",
  "Rotavírus",
  "Tríplice Viral (SCR)",
  "Outra (especificar)",
];

const PET_VACCINE_OPTIONS = [
  "V8 / V10 (Polivalente)",
  "Antirrábica",
  "Gripe Canina (Tosse dos Canis)",
  "Giardíase",
  "Leishmaniose",
  "Tríplice Felina (V3)",
  "Quádrupla Felina (V4)",
  "FeLV (Leucemia Felina)",
  "Outra (especificar)",
];

const INPUT_CLASSES =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none";

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + "T12:00:00");
  const formatted = format(d, "dd MMM yyyy - EEE", { locale: ptBR });
  const parts = formatted.split(" - ");
  return `${parts[0]} - ${parts[1]?.substring(0, 3)}`;
};


const Vacinas = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { groupId, isAdmin, linkedMemberId, managedProfiles, isLoading: groupLoading } = useFamilyGroup();
  const goBack = useSmartBack();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (groupLoading) return;
    if (!isAdmin && id) {
      const allowedIds = [linkedMemberId, ...(managedProfiles ?? [])].filter(Boolean);
      if (!allowedIds.includes(id)) {
        toast.error("Acesso negado");
        navigate("/home", { replace: true });
      }
    }
  }, [groupLoading, isAdmin, id, linkedMemberId, managedProfiles, navigate]);

  const { members } = useFamilyMembers();
  const currentMember = members.find((m) => m.id === id);
  const isPet = (currentMember?.member_type || "human") === "pet";
  const VACCINE_OPTIONS = isPet ? PET_VACCINE_OPTIONS : HUMAN_VACCINE_OPTIONS;

  // --- Drawer states ---
  const [actionDrawerOpen, setActionDrawerOpen] = useState(false);
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [editingVaccine, setEditingVaccine] = useState<Vaccine | null>(null);
  const [sortDesc, setSortDesc] = useState(true);
  const [form, setForm] = useState({
    name: "",
    customName: "",
    applied_date: "",
    booster_date: "",
    batch: "",
    side_effects: "",
    details: "",
    dose_type: "",
    facility: "",
    city: "",
    state: "",
  });

  const isCustom = form.name === "Outra (especificar)";
  const { ufs, cities, loadingCities } = useIbgeLocations(form.state);

  // Pending city: stores the raw city value (e.g. "FLORIANOPOLIS" from PDF/DB)
  // so it survives the async IBGE fetch cycle and can be matched after cities load
  const [pendingCity, setPendingCity] = useState("");

  // Auto-match IBGE city name (PDF comes UPPERCASE without accents)
  const normalizeStr = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  useEffect(() => {
    // Only attempt match when cities are loaded and we have a pending value
    if (!pendingCity || !cities.length || loadingCities) return;

    // If already matches an IBGE name exactly, just apply and clear pending
    const exactMatch = cities.find((c) => c.nome === pendingCity);
    if (exactMatch) {
      setForm((prev) => ({ ...prev, city: exactMatch.nome }));
      setPendingCity("");
      return;
    }

    // Try normalized match (removes accents + lowercase)
    const match = cities.find(
      (c) => normalizeStr(c.nome) === normalizeStr(pendingCity)
    );
    if (match) {
      setForm((prev) => ({ ...prev, city: match.nome }));
    }
    setPendingCity("");
  }, [cities, pendingCity, loadingCities]);

  const { data: vaccines = [], isLoading } = useQuery({
    queryKey: ["vaccines", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vaccines")
        .select("*")
        .eq("family_member_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Vaccine[];
    },
    enabled: !!id,
  });

  const resetForm = () => {
    setForm({ name: "", customName: "", applied_date: "", booster_date: "", batch: "", side_effects: "", details: "", dose_type: "", facility: "", city: "", state: "" });
    setPendingCity("");
  };

  const openManual = () => {
    setActionDrawerOpen(false);
    setEditingVaccine(null);
    resetForm();
    setTimeout(() => setFormDrawerOpen(true), 200);
  };

  const openEdit = (v: Vaccine) => {
    setEditingVaccine(v);
    const isStandard = VACCINE_OPTIONS.includes(v.name);
    const rawCity = v.city ?? "";
    setForm({
      name: isStandard ? v.name : "Outra (especificar)",
      customName: isStandard ? "" : v.name,
      applied_date: v.applied_date ?? "",
      booster_date: v.booster_date ?? "",
      batch: v.batch ?? "",
      side_effects: v.side_effects ?? "",
      details: v.details ?? "",
      dose_type: v.dose_type ?? "",
      facility: v.facility ?? "",
      city: "", // will be resolved by pendingCity match
      state: v.state ?? "",
    });
    setPendingCity(rawCity);
    setFormDrawerOpen(true);
  };

  const closeFormDrawer = () => {
    setFormDrawerOpen(false);
    setEditingVaccine(null);
  };

  const getFinalName = () => (isCustom ? form.customName.trim() : form.name);

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vaccines").insert({
        user_id: user!.id,
        family_member_id: id!,
        name: getFinalName(),
        applied_date: form.applied_date || null,
        booster_date: form.booster_date || null,
        batch: form.batch.trim() || null,
        side_effects: form.side_effects.trim() || null,
        details: form.details.trim() || null,
        dose_type: form.dose_type.trim() || null,
        facility: form.facility.trim() || null,
        city: form.city.trim() || null,
        state: form.state || null,
        ...(groupId ? { group_id: groupId } : {}),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaccines", id] });
      closeFormDrawer();
      toast.success("Vacina registrada com sucesso");
    },
    onError: () => toast.error("Erro ao registrar vacina"),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("vaccines")
        .update({
          name: getFinalName(),
          applied_date: form.applied_date || null,
          booster_date: form.booster_date || null,
          batch: form.batch.trim() || null,
          side_effects: form.side_effects.trim() || null,
          details: form.details.trim() || null,
          dose_type: form.dose_type.trim() || null,
          facility: form.facility.trim() || null,
          city: form.city.trim() || null,
          state: form.state || null,
        })
        .eq("id", editingVaccine!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaccines", id] });
      closeFormDrawer();
      toast.success("Vacina atualizada com sucesso");
    },
    onError: () => toast.error("Erro ao atualizar vacina"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (vaccineId: string) => {
      const { error } = await supabase.from("vaccines").delete().eq("id", vaccineId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaccines", id] });
    },
    onError: () => toast.error("Erro ao excluir vacina"),
  });

  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const handleSwipeDelete = async (vaccineId: string) => {
    const vaccineToDelete = vaccines.find((v) => v.id === vaccineId);
    if (!vaccineToDelete) return;
    const cached = { ...vaccineToDelete };
    try {
      await deleteMutation.mutateAsync(vaccineId);
      toast("Vacina excluída.", {
        action: {
          label: "Desfazer",
          onClick: async () => {
            try {
              const { error } = await supabase.from("vaccines").insert({
                family_member_id: id!,
                user_id: user!.id,
                name: cached.name,
                applied_date: cached.applied_date,
                booster_date: cached.booster_date,
                batch: cached.batch,
                side_effects: cached.side_effects,
                details: cached.details,
                dose_type: cached.dose_type,
                facility: cached.facility,
                city: cached.city,
                state: cached.state,
                ...(groupId ? { group_id: groupId } : {}),
              } as any);
              if (error) throw error;
              queryClient.invalidateQueries({ queryKey: ["vaccines", id] });
              toast.success("Vacina restaurada.");
            } catch { /* handled */ }
          },
        },
        duration: 5000,
      });
    } catch { /* handled */ }
  };

  const handleSubmit = () => {
    const finalName = getFinalName();
    if (!finalName) {
      toast.error("Informe o nome da vacina");
      return;
    }
    if (editingVaccine) updateMutation.mutate();
    else addMutation.mutate();
  };

  const isPending = addMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  // --- Import flow ---
  const [uploading, setUploading] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [importPending, setImportPending] = useState(false);
  const [importVaccines, setImportVaccines] = useState<ImportedVaccine[]>([]);

  const handleImportClick = () => {
    setActionDrawerOpen(false);
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
      // 1. Upload file to storage
      const safeName = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
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

      // 2. Parse PDF locally with pdfjs-dist
      const result = await parseSusVaccinePdf(file);

      // 3. CPF Validation (Fail-Closed)
      const memberCpf = currentMember?.cpf?.replace(/\D/g, "") ?? "";

      if (!memberCpf) {
        toast.error("Erro: Cadastre o CPF deste familiar antes de importar documentos do SUS.");
        return;
      }

      // Array-match: check if the DB CPF exists among ALL CPF-like patterns in the PDF
      const cleanCandidates = result.allCpfCandidates;
      console.log("DEBUG CPF -> Candidatos no PDF:", cleanCandidates, "| Banco:", memberCpf);
      const isDocumentOwner = cleanCandidates.includes(memberCpf);
      if (!isDocumentOwner) {
        toast.error("Este documento pertence a outra pessoa. Verifique o arquivo e o perfil selecionado.");
        return;
      }

      // 4. Check if any vaccines were found
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
    if (!user || !id) return;
    setImportPending(true);
    try {
      // Anti-duplicate: fetch existing vaccines for this member
      const { data: existing } = await supabase
        .from("vaccines")
        .select("name, applied_date")
        .eq("family_member_id", id);

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
        family_member_id: id,
        name: v.name,
        applied_date: v.applied_date,
        details: v.details || null,
        dose_type: v.dose_label || null,
        batch: v.batch || null,
        facility: v.facility || null,
        city: v.city || null,
        state: v.state || null,
        ...(groupId ? { group_id: groupId } : {}),
      }));

      const { error } = await supabase.from("vaccines").insert(rows as any);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["vaccines", id] });
      setReviewOpen(false);

      const skipped = selected.length - newVaccines.length;
      const msg = skipped > 0
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

  const anyDrawerOpen = actionDrawerOpen || formDrawerOpen || reviewOpen;

  return (
    <>
      {!anyDrawerOpen && <FixedFAB onClick={() => setActionDrawerOpen(true)} />}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Action Sheet Drawer */}
      <Drawer open={actionDrawerOpen} onOpenChange={setActionDrawerOpen}>
        <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[50dvh] flex flex-col rounded-t-2xl bg-background outline-none">
          <DrawerHeader>
            <DrawerTitle>Adicionar Vacina</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-3">
            <button
              onClick={openManual}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card active:bg-muted/50 transition-colors text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <PenLine className="text-primary" size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">Preencher Manualmente</p>
                <p className="text-xs text-muted-foreground mt-0.5">Registrar uma nova vacina avulsa</p>
              </div>
            </button>

            {!isPet && (
              <button
                onClick={handleImportClick}
                disabled={uploading}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card active:bg-muted/50 transition-colors text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FileUp className="text-primary" size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">Importar Carteira do SUS (PDF)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Envie o PDF do Meu SUS para importar automaticamente
                  </p>
                </div>
              </button>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Upload loading overlay */}
      {uploading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground text-center px-8">
            IA está lendo sua carteira de vacinação... Aguarde.
          </p>
        </div>
      )}

      {/* Import Review */}
      <VaccineImportReviewDrawer
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        vaccines={importVaccines}
        onConfirm={handleConfirmImport}
        isPending={importPending}
      />

      {/* Form Drawer */}
      <Drawer open={formDrawerOpen} onOpenChange={(open) => !open && closeFormDrawer()} repositionInputs={false}>
        <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-background outline-none">
          <DrawerHeader>
            <DrawerTitle>{editingVaccine ? "Editar Vacina" : "Nova Vacina"}</DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain no-scrollbar">
            {/* Linha 1: Vacina (70%) + Dose (30%) */}
            <div className="flex gap-4">
              <div className="w-[70%]">
                <label className="text-sm font-medium text-foreground mb-1 block">Vacina</label>
                <select
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value, customName: "" })}
                  className={INPUT_CLASSES}
                >
                  <option value="">Selecione...</option>
                  {VACCINE_OPTIONS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="w-[30%]">
                <label className="text-sm font-medium text-foreground mb-1 block">Dose</label>
                <select
                  value={form.dose_type}
                  onChange={(e) => setForm({ ...form, dose_type: e.target.value })}
                  className={INPUT_CLASSES}
                >
                  <option value="">Selecione...</option>
                  <option value="1ª Dose">1ª Dose</option>
                  <option value="2ª Dose">2ª Dose</option>
                  <option value="3ª Dose">3ª Dose</option>
                  <option value="Reforço">Reforço</option>
                  <option value="Única">Única</option>
                </select>
              </div>
            </div>

            {isCustom && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Nome da Vacina</label>
                <input
                  type="text"
                  placeholder="Ex: Febre Tifoide, Herpes Zóster..."
                  value={form.customName}
                  onChange={(e) => setForm({ ...form, customName: e.target.value })}
                  className={INPUT_CLASSES}
                />
              </div>
            )}

            {/* Linha 2: Data (50%) + Lote (50%) */}
            <div className="flex gap-4">
              <div className="w-[50%]">
                <label className="text-sm font-medium text-foreground mb-1 block">Data da aplicação</label>
                <input
                  type="date"
                  value={form.applied_date}
                  onChange={(e) => setForm({ ...form, applied_date: e.target.value })}
                  min="1900-01-01"
                  max={new Date().toISOString().split("T")[0]}
                  className={INPUT_CLASSES}
                />
              </div>
              <div className="w-[50%]">
                <label className="text-sm font-medium text-foreground mb-1 block">Lote</label>
                <input
                  type="text"
                  placeholder="Ex: FA123/2026"
                  value={form.batch}
                  onChange={(e) => setForm({ ...form, batch: e.target.value })}
                  className={INPUT_CLASSES}
                />
              </div>
            </div>

            {/* Linha 3: Informações Adicionais (100%) */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Informações Adicionais</label>
              <input
                type="text"
                placeholder="Ex: Pfizer, Coronavac..."
                value={form.details}
                onChange={(e) => setForm({ ...form, details: e.target.value })}
                className={INPUT_CLASSES}
              />
            </div>

            {/* Linha 4: UF (30%) + Município (70%) */}
            <div className="flex gap-4">
              <div className="w-[30%]">
                <label className="text-sm font-medium text-foreground mb-1 block">UF</label>
                <select
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value, city: "" })}
                  className={INPUT_CLASSES}
                >
                  <option value="">UF...</option>
                  {ufs.map((uf) => (
                    <option key={uf.sigla} value={uf.sigla}>{uf.sigla}</option>
                  ))}
                </select>
              </div>
              <div className="w-[70%]">
                <label className="text-sm font-medium text-foreground mb-1 block">Município</label>
                <select
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className={INPUT_CLASSES}
                  disabled={!form.state || loadingCities}
                >
                  <option value="">{loadingCities ? "Carregando..." : "Selecione..."}</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.nome}>{c.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Linha 5: Estabelecimento (100%) */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Estabelecimento de Saúde</label>
              <input
                type="text"
                placeholder="Ex: UBS Centro"
                value={form.facility}
                onChange={(e) => setForm({ ...form, facility: e.target.value })}
                className={INPUT_CLASSES}
              />
            </div>

            {/* Linha 6: Efeitos Colaterais */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Efeitos colaterais</label>
              <textarea
                placeholder="Ex: Dor no braço, febre leve..."
                value={form.side_effects}
                onChange={(e) => setForm({ ...form, side_effects: e.target.value })}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none resize-none"
              />
            </div>
          </div>

          <div className="p-4 border-t mt-auto bg-background space-y-3">
            <Button onClick={handleSubmit} disabled={isPending} className="w-full">
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
            <Button type="button" variant="outline" onClick={closeFormDrawer} className="w-full">
              Cancelar
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Main list */}
      <div className="px-4 pt-6 pb-28 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft size={22} />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex-1">Vacinas</h1>
          {vaccines.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortDesc(true)}>
                  Mais recentes primeiro
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortDesc(false)}>
                  Mais antigos primeiro
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : vaccines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-[#A7D3CB] flex items-center justify-center mb-4">
              <Syringe className="text-black" size={28} />
            </div>
            <p className="text-foreground font-semibold mb-1">Nenhuma vacina registrada</p>
            <p className="text-muted-foreground text-sm">Toque no botão + para adicionar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {[...vaccines].sort((a, b) => {
                const dateA = a.applied_date || a.created_at;
                const dateB = b.applied_date || b.created_at;
                return sortDesc ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
              }).map((v) => (
                <ExamSwipeableCard
                  key={v.id}
                  onDelete={() => handleSwipeDelete(v.id)}
                  onMarkRealizado={() => {}}
                  onMarkPronto={() => {}}
                  quickActionMode="none"
                  isOpen={openCardId === v.id}
                  onOpenChange={(isOpen) => setOpenCardId(isOpen ? v.id : null)}
                >
                  <button
                    onClick={() => openEdit(v)}
                    className="w-full bg-card rounded-xl border border-border/50 p-4 flex items-start gap-3 text-left active:bg-muted/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#A7D3CB] flex items-center justify-center shrink-0 mt-0.5">
                      <Syringe className="text-black" size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm">{v.name}</p>
                      {v.details && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{v.details}</p>
                      )}
                      {v.applied_date && (
                        <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                          {[v.dose_type, formatDate(v.applied_date)].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {v.booster_date && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Reforço: <span className="capitalize">{formatDate(v.booster_date)}</span>
                        </p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-2" />
                  </button>
                </ExamSwipeableCard>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </>
  );
};

export default Vacinas;
