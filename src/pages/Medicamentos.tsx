import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, Pill, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type Medication } from "@/hooks/useMedications";
import AddMedicationDrawer from "@/components/AddMedicationDrawer";
import MedicationActionDrawer from "@/components/MedicationActionDrawer";
import AiMedicationUpload from "@/components/AiMedicationUpload";
import FixedFAB from "@/components/ui/FixedFAB";
import useSmartBack from "@/hooks/useSmartBack";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { useFamilyAccessGuard } from "@/hooks/useFamilyAccessGuard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useMedicationPageData } from "@/hooks/useMedicationPageData";
import { MedicationListItem } from "@/components/medications/MedicationListItem";


const Medicamentos = () => {
  const { id } = useParams();
  const goBack = useSmartBack();
  const { isAdmin, managedProfiles } = useFamilyGroup();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionDrawerOpen, setActionDrawerOpen] = useState(false);
  const [aiUploadOpen, setAiUploadOpen] = useState(false);
  const [aiData, setAiData] = useState<{ data: any; receitaUrl: string | null } | null>(null);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'ativos' | 'historico'>('ativos');
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useFamilyAccessGuard(id);

  const {
    medications,
    inactiveMedications,
    activeMedsWithEffective,
    isLoading,
    addMedication,
    updateMedication,
    deleteMedication,
  } = useMedicationPageData(id!);

  const medicamentosFiltrados = useMemo(() => {
    if (abaAtiva === 'historico') {
      return [...inactiveMedications].sort((a, b) => {
        const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
        const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });
    }
    const sorted = [...activeMedsWithEffective].sort((a, b) => {
      if (!a.effectiveScheduledFor && !b.effectiveScheduledFor) return 0;
      if (!a.effectiveScheduledFor) return 1;
      if (!b.effectiveScheduledFor) return -1;
      const diff = new Date(a.effectiveScheduledFor).getTime() - new Date(b.effectiveScheduledFor).getTime();
      return sortOrder === 'asc' ? diff : -diff;
    });
    return sorted.map(s => s.med);
  }, [inactiveMedications, abaAtiva, sortOrder, activeMedsWithEffective]);


  const handleOpenEdit = (m: Medication) => {
    setEditingMedication(m);
    setDrawerOpen(true);
  };

  const handleDrawerChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      setEditingMedication(null);
      setAiData(null);
    }
  };

  const handleAdd = () => {
    setEditingMedication(null);
    setAiData(null);
    setActionDrawerOpen(true);
  };

  const handleSelectManual = () => {
    setAiData(null);
    setDrawerOpen(true);
  };

  const handleSelectAI = () => {
    setAiUploadOpen(true);
  };

  const handleAiAnalysisComplete = (data: any, receitaUrl: string | null) => {
    setAiData({ data, receitaUrl });
    setDrawerOpen(true);
  };

  const handleQuickStatusUpdate = async (medId: string, newStatus: string) => {
    const med = medications.find(m => m.id === medId);
    const previousStatus = med?.status ?? 'Ativo';
    try {
      await updateMedication.mutateAsync({ id: medId, status: newStatus });
      toast(`Medicamento marcado como ${newStatus}`, {
        action: {
          label: "Desfazer",
          onClick: async () => {
            try {
              await updateMedication.mutateAsync({ id: medId, status: previousStatus });
              toast.success("Status revertido.");
            } catch { /* handled */ }
          },
        },
        duration: 5000,
      });
    } catch { /* handled */ }
  };

  const handleInstantDelete = async (medId: string) => {
    const toDelete = medications.find(m => m.id === medId);
    if (!toDelete) return;
    const cached = { ...toDelete };
    delete (cached as Record<string, unknown>).consultations;
    delete (cached as Record<string, unknown>).family_members;
    try {
      await deleteMedication.mutateAsync(medId);
      toast("Medicamento excluído.", {
        action: {
          label: "Desfazer",
          onClick: async () => {
            try {
              await addMedication.mutateAsync({
                family_member_id: cached.family_member_id,
                name: cached.name,
                dosage: cached.dosage,
                frequency: cached.frequency,
                frequency_hours: cached.frequency_hours,
                duration: cached.duration,
                duration_days: cached.duration_days,
                start_date: cached.start_date,
                start_time: cached.start_time,
                end_date: cached.end_date,
                consultation_id: cached.consultation_id,
                uso_continuo: cached.uso_continuo,
                medico_prescritor: cached.medico_prescritor,
                estoque_total: cached.estoque_total,
                estoque_minimo: cached.estoque_minimo,
                receita_url: cached.receita_url,
                status: cached.status,
                reason: cached.reason,
              });
              toast.success("Medicamento restaurado.");
            } catch { /* handled */ }
          },
        },
        duration: 5000,
      });
    } catch { /* handled */ }
  };

  const handleBack = goBack;

  return (
    <>
      {!drawerOpen && !actionDrawerOpen && !aiUploadOpen && <FixedFAB onClick={handleAdd} />}
      <MedicationActionDrawer
        open={actionDrawerOpen}
        onOpenChange={setActionDrawerOpen}
        onSelectAI={handleSelectAI}
        onSelectManual={handleSelectManual}
      />
      <AiMedicationUpload
        open={aiUploadOpen}
        onOpenChange={setAiUploadOpen}
        familyMemberId={id!}
        onAnalysisComplete={handleAiAnalysisComplete}
      />
      <AddMedicationDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerChange}
        familyMemberId={id!}
        editingMedication={editingMedication}
        aiData={aiData}
      />

      <div className="px-4 pt-6 pb-28 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft size={22} />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex-1">Medicamentos</h1>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <div className="flex p-1 bg-slate-100 rounded-xl flex-1">
            <button
              onClick={() => setAbaAtiva('ativos')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                abaAtiva === 'ativos'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Ativos
            </button>
            <button
              onClick={() => setAbaAtiva('historico')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                abaAtiva === 'historico'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Concluídos
            </button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortOrder('asc')} className={sortOrder === 'asc' ? 'font-semibold' : ''}>
                Mais antigos primeiro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder('desc')} className={sortOrder === 'desc' ? 'font-semibold' : ''}>
                Mais recentes primeiro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : medicamentosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-[#A7D3CB] flex items-center justify-center mb-4">
              <Pill className="text-black" size={28} />
            </div>
            <p className="text-foreground font-semibold mb-1">
              {abaAtiva === 'ativos' ? 'Nenhum medicamento ativo' : 'Nenhum histórico encontrado'}
            </p>
            <p className="text-muted-foreground text-sm">
              {abaAtiva === 'ativos' ? 'Toque no botão abaixo para adicionar.' : 'Tratamentos concluídos aparecerão aqui.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col space-y-3">
            <AnimatePresence mode="popLayout">
              {medicamentosFiltrados.map((m) => {
                const isAtivo = m.status === 'Ativo';
                const precomputed = isAtivo ? activeMedsWithEffective.find(a => a.med.id === m.id) : null;
                return (
                  <MedicationListItem
                    key={m.id}
                    med={m}
                    isAtivo={isAtivo}
                    nextDoseDate={precomputed?.nextDoseDate ?? null}
                    scheduledFor={precomputed?.scheduledFor ?? null}
                    doseStatus={precomputed?.doseStatus ?? null}
                    isOverdue={precomputed?.isOverdue ?? false}
                    isOpen={openCardId === m.id}
                    disableDelete={!isAdmin && !managedProfiles.includes(id!)}
                    onOpenChange={(isOpen) => setOpenCardId(isOpen ? m.id : null)}
                    onEdit={() => handleOpenEdit(m)}
                    onDelete={() => handleInstantDelete(m.id)}
                    onConcluir={() => handleQuickStatusUpdate(m.id, 'Concluído')}
                  />
                );
              })}
            </AnimatePresence>

          </div>
        )}
      </div>
    </>
  );
};

export default Medicamentos;
