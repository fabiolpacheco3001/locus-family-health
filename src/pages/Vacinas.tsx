/**
 * Vacinas — Shell de composição.
 * Import flow: useVaccineImport | Formulário: VaccineFormDrawer
 * Refatorado em M3 (de 802 LOC → ~250 LOC).
 */
import { parseDateInSP, toSPTime } from "@/lib/dateUtils";
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useAiStatus } from "@/hooks/useAiStatus";
import PaywallModal from "@/components/PaywallModal";
import { ArrowLeft, Syringe, ChevronRight, FileUp, PenLine, ArrowUpDown, Share2, Loader2 } from "lucide-react";
import ExamSwipeableCard from "@/components/ExamSwipeableCard";
import { AnimatePresence } from "framer-motion";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
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
import VaccineImportReviewDrawer from "@/components/VaccineImportReviewDrawer";
import { useIbgeLocations } from "@/hooks/useIbgeLocations";
import { useVaccineImport } from "@/hooks/useVaccineImport";
import { VaccineFormDrawer } from "@/components/vacinas/VaccineFormDrawer";

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
  "BCG", "Covid-19", "Dengue", "DT - Difteria e Tétano", "Febre Amarela",
  "Gripe (Influenza)", "Hepatite A", "Hepatite B", "HPV", "Meningocócica",
  "Pneumocócica", "Poliomielite (VIP/VOP)", "Rotavírus", "Tríplice Viral (SCR)",
  "Outra (especificar)",
];

const PET_VACCINE_OPTIONS = [
  "V8 / V10 (Polivalente)", "Antirrábica", "Gripe Canina (Tosse dos Canis)",
  "Giardíase", "Leishmaniose", "Tríplice Felina (V3)", "Quádrupla Felina (V4)",
  "FeLV (Leucemia Felina)", "Outra (especificar)",
];

const formatDate = (dateStr: string) => {
  const d = toSPTime(parseDateInSP(dateStr) ?? new Date());
  const formatted = format(d, "dd MMM yyyy - EEE", { locale: ptBR });
  const parts = formatted.split(" - ");
  return `${parts[0]} - ${parts[1]?.substring(0, 3)}`;
};

const EMPTY_FORM = {
  name: "", customName: "", applied_date: "", booster_date: "",
  batch: "", side_effects: "", details: "", dose_type: "",
  facility: "", city: "", state: "",
};

const Vacinas = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { groupId, isAdmin, linkedMemberId, managedProfiles, isLoading: groupLoading } = useFamilyGroup();
  const { canUsePremium } = useSubscription();
  const { isAiActive } = useAiStatus();
  const goBack = useSmartBack();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // RBAC guard
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

  // Drawer states
  const [actionDrawerOpen, setActionDrawerOpen] = useState(false);
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [editingVaccine, setEditingVaccine] = useState<Vaccine | null>(null);
  const [sortDesc, setSortDesc] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const emitterName = user?.user_metadata?.full_name ?? user?.email ?? "Usuário";

  const handleExportPdf = async (scope: "member" | "family") => {
    setGeneratingPdf(true);
    try {
      const { generateVaccinesPdf } = await import("@/lib/generateVaccinesPdf");
      let membersData;

      if (scope === "member") {
        membersData = [{
          memberName: currentMember?.name ?? "Membro",
          vaccines: vaccines.map((v) => ({
            name: v.name,
            applied_date: v.applied_date,
            dose_type: v.dose_type,
            batch: v.batch,
            facility: v.facility,
            booster_date: v.booster_date,
          })),
        }];
      } else {
        const allIds = members.map((m) => m.id);
        const { data: allVaccines } = await supabase
          .from("vaccines")
          .select("family_member_id, name, applied_date, dose_type, batch, facility, booster_date")
          .in("family_member_id", allIds)
          .order("applied_date", { ascending: false });

        membersData = members.map((m) => ({
          memberName: m.name,
          vaccines: (allVaccines ?? []).filter((v) => v.family_member_id === m.id),
        }));
      }

      const blob = generateVaccinesPdf({ members: membersData, emitterName });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = scope === "family" ? "vacinas-familia.pdf" : `vacinas-${currentMember?.name?.split(" ")[0]?.toLowerCase() ?? "membro"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF gerado com sucesso!");
    } catch {
      toast.error("Erro ao gerar PDF.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const isCustom = form.name === "Outra (especificar)";
  const { ufs, cities, loadingCities } = useIbgeLocations(form.state);

  // Pending city for async IBGE match
  const [pendingCity, setPendingCity] = useState("");
  const normalizeStr = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  useEffect(() => {
    if (!pendingCity || !cities.length || loadingCities) return;
    const exactMatch = cities.find((c) => c.nome === pendingCity);
    if (exactMatch) {
      setForm((prev) => ({ ...prev, city: exactMatch.nome }));
      setPendingCity("");
      return;
    }
    const match = cities.find((c) => normalizeStr(c.nome) === normalizeStr(pendingCity));
    if (match) setForm((prev) => ({ ...prev, city: match.nome }));
    setPendingCity("");
  }, [cities, pendingCity, loadingCities]);

  // Vaccines query
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

  // Mutations
  const resetForm = () => { setForm(EMPTY_FORM); setPendingCity(""); };
  const closeFormDrawer = () => { setFormDrawerOpen(false); setEditingVaccine(null); };
  const getFinalName = () => (isCustom ? form.customName.trim() : form.name);

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vaccines").insert({
        user_id: user!.id, family_member_id: id!,
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
        group_id: groupId ?? undefined,
      });
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vaccines", id] }),
    onError: () => toast.error("Erro ao excluir vacina"),
  });

  const handleSwipeDelete = async (vaccineId: string) => {
    const cached = vaccines.find((v) => v.id === vaccineId);
    if (!cached) return;
    try {
      await deleteMutation.mutateAsync(vaccineId);
      toast("Vacina excluída.", {
        action: {
          label: "Desfazer",
          onClick: async () => {
            try {
              const { error } = await supabase.from("vaccines").insert({
                family_member_id: id!, user_id: user!.id,
                name: cached.name, applied_date: cached.applied_date,
                booster_date: cached.booster_date, batch: cached.batch,
                side_effects: cached.side_effects, details: cached.details,
                dose_type: cached.dose_type, facility: cached.facility,
                city: cached.city, state: cached.state,
                group_id: groupId ?? undefined,
              });
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
    if (!getFinalName()) { toast.error("Informe o nome da vacina"); return; }
    if (editingVaccine) updateMutation.mutate();
    else addMutation.mutate();
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
      city: "",
      state: v.state ?? "",
    });
    setPendingCity(v.city ?? "");
    setFormDrawerOpen(true);
  };

  const isPending = addMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  // Import flow (hook)
  const {
    fileRef,
    uploading,
    reviewOpen, setReviewOpen,
    importPending,
    importVaccines,
    showPaywall, setShowPaywall,
    handleImportClick,
    handleFileChange,
    handleConfirmImport,
  } = useVaccineImport({
    user,
    familyMemberId: id,
    groupId,
    currentMember,
    isAiActive,
    canUsePremium,
    queryClient,
  });

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

      {/* Action Sheet */}
      <Drawer open={actionDrawerOpen} onOpenChange={setActionDrawerOpen}>
        <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[50dvh] flex flex-col rounded-t-2xl bg-background outline-hidden">
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
                onClick={() => { setActionDrawerOpen(false); setTimeout(handleImportClick, 200); }}
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

      {/* Upload overlay */}
      {uploading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground text-center px-8">
            IA está lendo sua carteira de vacinação... Aguarde.
          </p>
        </div>
      )}

      {/* Import review */}
      <VaccineImportReviewDrawer
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        vaccines={importVaccines}
        onConfirm={handleConfirmImport}
        isPending={importPending}
      />

      {/* Form drawer */}
      <VaccineFormDrawer
        open={formDrawerOpen}
        onClose={closeFormDrawer}
        editingVaccine={editingVaccine}
        form={form}
        setForm={setForm}
        isPending={isPending}
        onSubmit={handleSubmit}
        vaccineOptions={VACCINE_OPTIONS}
        isCustom={isCustom}
        ufs={ufs}
        cities={cities}
        loadingCities={loadingCities}
      />

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
                <DropdownMenuItem onClick={() => setSortDesc(true)}>Mais recentes primeiro</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortDesc(false)}>Mais antigos primeiro</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 text-[#78C2AD]" disabled={generatingPdf}>
                <Share2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExportPdf("member")}>
                Este membro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportPdf("family")}>
                Toda a família
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
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

      <PaywallModal open={showPaywall} onOpenChange={setShowPaywall} />
    </>
  );
};

export default Vacinas;
