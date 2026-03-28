import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, FileText, Calendar, ChevronRight, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useExams, Exam } from "@/hooks/useExams";
import AddExamDrawer from "@/components/AddExamDrawer";
import FixedFAB from "@/components/ui/FixedFAB";
import ExamSwipeableCard from "@/components/ExamSwipeableCard";
import useSmartBack from "@/hooks/useSmartBack";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";

const statusColors: Record<string, string> = {
  Agendado: "bg-[#AEE2D4] text-slate-800 border-none",
  Realizado: "bg-[#F2A97F] text-slate-900 border-none",
  Coletado: "bg-[#F2A97F] text-slate-900 border-none",
  Pronto: "bg-[#1C3333] text-white border-none",
  "Resultado Pronto": "bg-[#1C3333] text-white border-none",
  Cancelado: "bg-[#F87171] text-white border-none",
};

const Exames = () => {
  const { id } = useParams();
  const goBack = useSmartBack();
  const navigate = useNavigate();
  const { isAdmin, linkedMemberId, managedProfiles, isLoading: groupLoading } = useFamilyGroup();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'pendentes' | 'resultados'>('pendentes');
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const { exams, isLoading, addExam, deleteExam, updateExam } = useExams(id!);

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

  const handleQuickStatusUpdate = async (examId: string, newStatus: string) => {
    const exam = exams.find(e => e.id === examId);
    const previousStatus = exam?.status ?? 'Agendado';
    try {
      await updateExam.mutateAsync({ id: examId, status: newStatus });
      toast(`Exame atualizado para ${newStatus}`, {
        action: {
          label: "Desfazer",
          onClick: async () => {
            try {
              await updateExam.mutateAsync({ id: examId, status: previousStatus });
              toast.success("Status revertido.");
            } catch { /* handled */ }
          },
        },
        duration: 5000,
      });
    } catch { /* handled */ }
  };

  const examesFiltrados = exams.filter(e => {
    if (abaAtiva === 'pendentes') return e.status === 'Pendente' || e.status === 'Agendado' || e.status === 'Coletado' || e.status === 'Realizado';
    return e.status === 'Pronto' || e.status === 'Concluído' || e.status === 'Resultado Pronto' || e.status === 'Resultado Disponível' || e.status === 'Cancelado';
  });

  const handleOpenEdit = (e: Exam) => {
    setEditingExam(e);
    setDrawerOpen(true);
  };

  const handleDrawerChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) setEditingExam(null);
  };

  const handleAdd = () => {
    setEditingExam(null);
    setDrawerOpen(true);
  };

  const handleInstantDelete = async (examId: string) => {
    const examToDelete = exams.find(e => e.id === examId);
    if (!examToDelete) return;
    const cached = { ...examToDelete };
    delete (cached as any).consultations;
    try {
      await deleteExam.mutateAsync(examId);
      toast("Exame excluído.", {
        action: {
          label: "Desfazer",
          onClick: async () => {
            try {
              await addExam.mutateAsync({
                family_member_id: cached.family_member_id,
                name: cached.name,
                exam_date: cached.exam_date,
                location: cached.location,
                status: cached.status,
                file_url: cached.file_url,
                consultation_id: cached.consultation_id,
              });
              toast.success("Exame restaurado.");
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
      <AddExamDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerChange}
        familyMemberId={id!}
        editingExam={editingExam}
      />

      <div className="px-4 pt-6 pb-28 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft size={22} />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex-1">Exames</h1>
        </div>

        <div className="mb-4">
          <div className="flex p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setAbaAtiva('pendentes')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                abaAtiva === 'pendentes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Ativos
            </button>
            <button
              onClick={() => setAbaAtiva('resultados')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                abaAtiva === 'resultados' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
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
        ) : examesFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-[#A7D3CB] flex items-center justify-center mb-4">
              <FileText className="text-black" size={28} />
            </div>
            <p className="text-foreground font-semibold mb-1">
              {abaAtiva === 'pendentes' ? 'Nenhum exame pendente' : 'Nenhum resultado encontrado'}
            </p>
            <p className="text-muted-foreground text-sm">
              {abaAtiva === 'pendentes' ? 'Toque no botão abaixo para adicionar.' : 'Exames com resultado aparecerão aqui.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col space-y-3">
            <AnimatePresence mode="popLayout">
              {examesFiltrados.map((e) => {
                const today = startOfDay(new Date());
                const isOverdue = e.status === "Agendado" && e.exam_date
                  ? isBefore(new Date(e.exam_date), today)
                  : false;
                const quickActionMode = abaAtiva !== 'pendentes' || e.status === 'Pronto'
                  ? 'none' as const
                  : e.status === 'Realizado'
                    ? 'pronto-only' as const
                    : 'both' as const;
                return (
                  <ExamSwipeableCard
                    key={e.id}
                    onDelete={() => handleInstantDelete(e.id)}
                    disableDelete={!isAdmin}
                    onMarkRealizado={() => handleQuickStatusUpdate(e.id, 'Realizado')}
                    onMarkPronto={() => handleQuickStatusUpdate(e.id, 'Pronto')}
                    quickActionMode={quickActionMode}
                    isOpen={openCardId === e.id}
                    onOpenChange={(isOpen) => setOpenCardId(isOpen ? e.id : null)}
                  >
                    <button
                      onClick={() => handleOpenEdit(e)}
                      className="flex items-start gap-4 p-4 bg-card rounded-xl border border-border/50 shadow-sm text-left active:bg-accent/50 sm:hover:bg-accent/50 transition-colors w-full"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#A7D3CB] flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="text-black" size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-sm font-bold text-foreground truncate">{e.name}</p>
                          {isOverdue && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              Atrasado
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 whitespace-nowrap ${statusColors[e.status] ?? ""}`}
                          >
                            {e.status === "Coletado" ? "Realizado" : e.status === "Resultado Pronto" ? "Pronto" : e.status}
                          </Badge>
                        </div>
                        {e.location && (
                          <p className="text-xs text-muted-foreground truncate">{e.location}</p>
                        )}
                        {e.consultations?.professional_name && (
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                            <Stethoscope size={12} />
                            <span>Solicitado por {e.consultations.professional_name}</span>
                          </div>
                        )}
                        {e.exam_date && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Calendar size={12} />
                            <span>
                              {(() => {
                                const hasTime = e.exam_date!.length > 10;
                                const parsed = hasTime ? parseISO(e.exam_date!) : new Date(e.exam_date + 'T12:00:00');
                                const datePart = format(parsed, "dd MMM yyyy", { locale: ptBR });
                                const dayName = format(parsed, "EEEEEE", { locale: ptBR });
                                const dayAbbr = dayName.substring(0, 3);
                                const dayCapitalized = dayAbbr.charAt(0).toUpperCase() + dayAbbr.slice(1);
                                const timePart = hasTime ? ` às ${format(parsed, "HH:mm")}` : "";
                                return `${datePart} - ${dayCapitalized}${timePart}`;
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                      <ChevronRight size={18} className="text-muted-foreground shrink-0 mt-3" />
                    </button>
                  </ExamSwipeableCard>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

    </>
  );
};

export default Exames;
