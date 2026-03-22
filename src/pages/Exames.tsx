import { useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, FileText, Calendar, ChevronRight, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useExams, Exam } from "@/hooks/useExams";
import AddExamDrawer from "@/components/AddExamDrawer";
import FixedFAB from "@/components/ui/FixedFAB";
import useSmartBack from "@/hooks/useSmartBack";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, FileText, Calendar, ChevronRight, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useExams, Exam } from "@/hooks/useExams";
import AddExamDrawer from "@/components/AddExamDrawer";
import FixedFAB from "@/components/ui/FixedFAB";
import useSmartBack from "@/hooks/useSmartBack";
import { format, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusColors: Record<string, string> = {
  Agendado: "bg-primary/10 text-primary border-primary/20",
  Coletado: "bg-[#FFB085]/20 text-[#c97a3a] border-[#FFB085]/30",
  "Resultado Pronto": "bg-secondary/10 text-secondary border-secondary/20",
};

const Exames = () => {
  const { id } = useParams();
  const goBack = useSmartBack();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const { exams, isLoading } = useExams(id!);

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
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft size={22} />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex-1">Exames</h1>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : exams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <FileText className="text-primary" size={28} />
            </div>
            <p className="text-foreground font-semibold mb-1">Nenhum exame registrado</p>
            <p className="text-muted-foreground text-sm">Toque no botão abaixo para adicionar.</p>
          </div>
        ) : (
          <div className="flex flex-col space-y-3">
            {exams.map((e) => {
              const today = startOfDay(new Date());
              const isOverdue = e.status === "Agendado" && e.exam_date
                ? isBefore(new Date(e.exam_date), today)
                : false;
              return (
              <button
                key={e.id}
                onClick={() => handleOpenEdit(e)}
                className="flex items-start gap-4 p-4 bg-card rounded-xl border border-border/50 shadow-sm text-left active:bg-accent/50 sm:hover:bg-accent/50 transition-colors w-full"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="text-primary" size={20} />
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
                      {e.status}
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
                      <span>{format(new Date(e.exam_date), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                  )}
                </div>
                <ChevronRight size={18} className="text-muted-foreground shrink-0 mt-3" />
              </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default Exames;
