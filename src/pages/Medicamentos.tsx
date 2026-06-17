import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Pill, Clock, ChevronRight, Stethoscope, CalendarPlus, CalendarCheck, CalendarClock, CheckCircle, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMedications, Medication } from "@/hooks/useMedications";
import AddMedicationDrawer from "@/components/AddMedicationDrawer";
import MedicationActionDrawer from "@/components/MedicationActionDrawer";
import AiMedicationUpload from "@/components/AiMedicationUpload";
import FixedFAB from "@/components/ui/FixedFAB";
import SwipeableActionCard from "@/components/SwipeableActionCard";
import useSmartBack from "@/hooks/useSmartBack";
import { format, isPast, startOfYesterday } from "date-fns";
import { AlertCircle } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { parseDateInSP, toSPTime } from "@/lib/dateUtils";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MedicationDoseActions } from "@/components/agenda/MedicationDoseActions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { advancePastTakenDoses } from "@/lib/advancePastTakenDoses";

const Medicamentos = () => {
  const { id } = useParams();
  const goBack = useSmartBack();
  const navigate = useNavigate();
  const { isAdmin, linkedMemberId, managedProfiles, isLoading: groupLoading } = useFamilyGroup();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionDrawerOpen, setActionDrawerOpen] = useState(false);
  const [aiUploadOpen, setAiUploadOpen] = useState(false);
  const [aiData, setAiData] = useState<{ data: any; receitaUrl: string | null } | null>(null);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'ativos' | 'historico'>('ativos');
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { medications, isLoading, addMedication, updateMedication, deleteMedication } = useMedications(id!);

  // Fetch dose statuses for active medications
  const activeMedIds = useMemo(() => medications.filter(m => m.status === 'Ativo').map(m => m.id), [medications]);
  const { data: medDoseStatuses = {} } = useQuery({
    queryKey: ["medication_doses_list", activeMedIds],
    queryFn: async () => {
      if (activeMedIds.length === 0) return {};
      // Limit to last 7 days to avoid Supabase 1000-row truncation on high-volume patients.
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data, error } = await supabase
        .from("medication_doses")
        .select("medication_id, scheduled_for, status")
        .in("medication_id", activeMedIds)
        .gte("scheduled_for", sevenDaysAgo.toISOString());
      if (error) throw error;
      const map: Record<string, "taken" | "skipped"> = {};
      for (const d of (data ?? [])) {
        const key = `${d.medication_id}-${new Date(d.scheduled_for).toISOString()}`;
        map[key] = d.status as "taken" | "skipped";
      }
      return map;
    },
    enabled: activeMedIds.length > 0,
    staleTime: 30 * 1000,
  });

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

  // Pre-compute effectiveScheduledFor for active meds for correct sorting
  const activeMedsWithEffective = useMemo(() => {
    return medications.filter(m => m.status === 'Ativo').map((m) => {
      const dateOnly = m.start_date?.slice(0, 10);
      let startDateISO: string | null = null;
      if (dateOnly && m.start_time) {
        startDateISO = `${dateOnly}T${m.start_time}`;
      } else if (dateOnly) {
        startDateISO = dateOnly;
      }
      const nextDoseDate = advancePastTakenDoses({
        medicationId: m.id,
        startDateISO,
        frequencyHours: m.frequency_hours,
        endDate: m.end_date,
        referenceTime: startOfYesterday(),
        frequencyType: m.frequency_type,
        specificTimes: m.specific_times as string[] | null,
        specificDays: m.specific_days as number[] | null,
        doseStatuses: medDoseStatuses,
      });
      let scheduledFor: string | null = null;
      if (nextDoseDate) {
        scheduledFor = nextDoseDate.toISOString();
      }
      const isOverdue = nextDoseDate ? isPast(nextDoseDate) : false;
      const doseKey = scheduledFor ? `${m.id}-${scheduledFor}` : null;
      const doseStatus: "taken" | "skipped" | null = doseKey ? (medDoseStatuses[doseKey] ?? null) : null;
      return { med: m, nextDoseDate, scheduledFor, isOverdue, doseStatus, effectiveScheduledFor: scheduledFor };
    });
  }, [medications, medDoseStatuses]);

  const medicamentosFiltrados = useMemo(() => {
    if (abaAtiva === 'historico') {
      return [...medications.filter(m => m.status === 'Concluído')].sort((a, b) => {
        const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
        const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });
    }
    // For active tab, sort by effectiveScheduledFor
    const sorted = [...activeMedsWithEffective].sort((a, b) => {
      if (!a.effectiveScheduledFor && !b.effectiveScheduledFor) return 0;
      if (!a.effectiveScheduledFor) return 1;
      if (!b.effectiveScheduledFor) return -1;
      const diff = new Date(a.effectiveScheduledFor).getTime() - new Date(b.effectiveScheduledFor).getTime();
      return sortOrder === 'asc' ? diff : -diff;
    });
    return sorted.map(s => s.med);
  }, [medications, abaAtiva, sortOrder, activeMedsWithEffective]);

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

                // Look up pre-computed values for active meds
                const precomputed = isAtivo ? activeMedsWithEffective.find(a => a.med.id === m.id) : null;
                const nextDoseDate = precomputed?.nextDoseDate ?? null;
                const scheduledFor = precomputed?.scheduledFor ?? null;
                const doseStatus = precomputed?.doseStatus ?? null;
                const isOverdue = precomputed?.isOverdue ?? false;

                return (
                  <SwipeableActionCard
                    key={m.id}
                    onDelete={() => handleInstantDelete(m.id)}
                    disableDelete={!isAdmin && !managedProfiles.includes(id!)}
                    leadingAction={isAtivo ? {
                      icon: <CheckCircle className="w-6 h-6" />,
                      label: "Concluído",
                      bgColor: "#1C3333",
                      textColor: "#ffffff",
                      onAction: () => handleQuickStatusUpdate(m.id, 'Concluído'),
                    } : undefined}
                    isOpen={openCardId === m.id}
                    onOpenChange={(isOpen) => setOpenCardId(isOpen ? m.id : null)}
                  >
                    <div className="flex flex-col p-4 bg-card rounded-xl border border-border/50 shadow-xs text-left w-full">
                      <button
                        onClick={() => handleOpenEdit(m)}
                        className="flex items-start gap-4 active:bg-accent/50 sm:hover:bg-accent/50 transition-colors w-full rounded-lg"
                      >
                        <div className="w-10 h-10 rounded-xl bg-[#A7D3CB] flex items-center justify-center shrink-0 mt-0.5">
                          <Pill className="text-black" size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-bold text-foreground truncate">{m.name}</p>
                            <Badge
                              className={`text-[10px] px-1.5 py-0 border-none ${
                                m.status === "Ativo"
                                  ? "bg-[#F2A97F] text-black"
                                  : "bg-[#A7D3CB] text-black"
                              }`}
                            >
                              {m.status}
                            </Badge>
                          </div>
                          {m.dosage && (
                            <p className="text-xs text-muted-foreground truncate">{m.dosage}</p>
                          )}
                          {m.consultations?.professional_name && (
                            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                              <Stethoscope size={12} />
                              <span>Solicitado por {m.consultations.professional_name}</span>
                            </div>
                          )}
                          <div className="flex flex-col gap-1.5 mt-2">
                            {m.frequency_hours != null && m.frequency_hours > 0 && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock size={14} className="shrink-0" />
                                <span>{m.frequency_hours === 24 ? "1x ao dia" : `A cada ${m.frequency_hours}h`}</span>
                              </div>
                            )}
                            {m.frequency_hours === 0 && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock size={14} className="shrink-0" />
                                <span>Uso contínuo</span>
                              </div>
                            )}
                            {m.start_date && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CalendarPlus size={14} className="shrink-0" />
                                <span>
                                Início: {format(toSPTime(parseDateInSP(m.start_date.slice(0, 10)) ?? new Date()), "dd/MM/yyyy")}
                                  {m.start_time ? ` às ${m.start_time.slice(0, 5)}` : ""}
                                </span>
                              </div>
                            )}
                            {m.end_date && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CalendarCheck size={14} className="shrink-0" />
                                <span>
                                Término: {format(toSPTime(parseDateInSP(m.end_date.slice(0, 10)) ?? new Date()), "dd/MM/yyyy")}
                                  {m.start_time ? ` às ${m.start_time.slice(0, 5)}` : ""}
                                </span>
                              </div>
                            )}
                            {isAtivo && nextDoseDate && (
                              <div className="flex items-center gap-2 text-sm text-primary">
                                <CalendarClock size={14} className="shrink-0" />
                                <span>Próxima dose: {format(toSPTime(nextDoseDate), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-muted-foreground shrink-0 mt-3" />
                      </button>
                      {isAtivo && scheduledFor && (
                         <div className="flex w-full items-center justify-between mt-4 pt-3 border-t border-border/30">
                            <div className="flex items-center">
                              {!doseStatus && isOverdue && (
                               <Badge className="bg-destructive text-destructive-foreground border-destructive text-[10px] font-bold px-2.5 h-7 m-0 inline-flex items-center justify-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Atrasado
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center">
                            <MedicationDoseActions
                              medicationId={m.id}
                              scheduledFor={scheduledFor}
                              doseStatus={doseStatus}
                              frequencyHours={m.frequency_hours}
                              frequencyType={m.frequency_type}
                              specificTimes={m.specific_times as string[] | null}
                              specificDays={m.specific_days as number[] | null}
                              startDateISO={
                                m.start_date
                                  ? m.start_time
                                    ? `${m.start_date.slice(0, 10)}T${m.start_time}`
                                    : m.start_date.slice(0, 10)
                                  : null
                              }
                              endDate={m.end_date}
                              usoContinuo={m.uso_continuo}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </SwipeableActionCard>
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
