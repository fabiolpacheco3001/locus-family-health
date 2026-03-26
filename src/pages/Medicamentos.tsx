import { useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, Pill, Clock, ChevronRight, Stethoscope, CalendarPlus, CalendarCheck, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMedications, Medication } from "@/hooks/useMedications";
import AddMedicationDrawer from "@/components/AddMedicationDrawer";
import FixedFAB from "@/components/ui/FixedFAB";
import SwipeableActionCard from "@/components/SwipeableActionCard";
import useSmartBack from "@/hooks/useSmartBack";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const Medicamentos = () => {
  const { id } = useParams();
  const goBack = useSmartBack();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'ativos' | 'historico'>('ativos');
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const { medications, isLoading, addMedication, updateMedication, deleteMedication } = useMedications(id!);

  const medicamentosFiltrados = medications.filter(med => {
    if (abaAtiva === 'ativos') return med.status === 'Ativo';
    return med.status === 'Concluído';
  });

  const handleOpenEdit = (m: Medication) => {
    setEditingMedication(m);
    setDrawerOpen(true);
  };

  const handleDrawerChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) setEditingMedication(null);
  };

  const handleAdd = () => {
    setEditingMedication(null);
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
    delete (cached as any).consultations;
    delete (cached as any).family_members;
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
      {!drawerOpen && <FixedFAB onClick={handleAdd} />}
      <AddMedicationDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerChange}
        familyMemberId={id!}
        editingMedication={editingMedication}
      />

      <div className="px-4 pt-6 pb-28 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft size={22} />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex-1">Medicamentos</h1>
        </div>

        <div className="mb-4">
          <div className="flex p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setAbaAtiva('ativos')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                abaAtiva === 'ativos'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Ativos
            </button>
            <button
              onClick={() => setAbaAtiva('historico')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                abaAtiva === 'historico'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Concluídos
            </button>
          </div>
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
                return (
                  <SwipeableActionCard
                    key={m.id}
                    onDelete={() => handleInstantDelete(m.id)}
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
                    <button
                      onClick={() => handleOpenEdit(m)}
                      className="flex items-start gap-4 p-4 bg-card rounded-xl border border-border/50 shadow-sm text-left active:bg-accent/50 sm:hover:bg-accent/50 transition-colors w-full"
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
                                Início: {format(new Date(m.start_date.slice(0, 10) + "T12:00:00"), "dd/MM/yyyy")}
                                {m.start_time ? ` às ${m.start_time.slice(0, 5)}` : ""}
                              </span>
                            </div>
                          )}
                          {m.end_date && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CalendarCheck size={14} className="shrink-0" />
                              <span>
                                Término: {format(new Date(m.end_date.slice(0, 10) + "T12:00:00"), "dd/MM/yyyy")}
                                {m.start_time ? ` às ${m.start_time.slice(0, 5)}` : ""}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-muted-foreground shrink-0 mt-3" />
                    </button>
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
