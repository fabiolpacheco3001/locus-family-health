import { ArrowLeft, Pill, Clock, ChevronRight, CalendarClock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMedications } from "@/hooks/useMedications";
import useSmartBack from "@/hooks/useSmartBack";
import { useNavigate } from "react-router-dom";
import { calculateNextDose } from "@/lib/calculateNextDose";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const MedicamentosGeral = () => {
  const goBack = useSmartBack();
  const navigate = useNavigate();
  const { medications, isLoading } = useMedications();
  const activeMeds = medications.filter((m) => m.status === "Ativo");

  return (
    <div className="px-4 pt-6 pb-28 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft size={22} />
        </Button>
        <h1 className="text-lg font-bold text-foreground flex-1">Medicamentos Ativos</h1>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Badge variant="secondary" className="text-xs px-2.5 py-1">
          Medicamentos Ativos
        </Badge>
        <button
          onClick={goBack}
          className="p-1 rounded-full hover:bg-muted/50 active:bg-muted/50 transition-colors"
        >
          <X size={14} className="text-muted-foreground" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : activeMeds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-[#A7D3CB] flex items-center justify-center mb-4">
             <Pill className="text-black" size={28} />
          </div>
          <p className="text-foreground font-semibold mb-1">Nenhum medicamento ativo</p>
          <p className="text-muted-foreground text-sm">Seus familiares não possuem medicamentos ativos.</p>
        </div>
      ) : (
        <div className="flex flex-col space-y-3">
          {activeMeds.map((m) => {
            const firstName = m.family_members?.name?.split(" ")[0];

            // Calculate next dose
            const dateOnly = m.start_date?.slice(0, 10);
            let startDateISO: string | null = null;
            if (dateOnly && m.start_time) {
              startDateISO = `${dateOnly}T${m.start_time}`;
            } else if (dateOnly) {
              startDateISO = `${dateOnly}T12:00:00`;
            }
            const nextDose = calculateNextDose(startDateISO, m.frequency_hours, m.end_date);

            return (
              <button
                key={m.id}
                onClick={() => navigate(`/familiar/${m.family_member_id}/medicamentos`, { state: { from: "/medicamentos" } })}
                className="flex items-start gap-4 p-4 bg-card rounded-xl border border-border/50 shadow-sm text-left active:bg-accent/50 sm:hover:bg-accent/50 transition-colors w-full"
              >
                <div className="w-10 h-10 rounded-full bg-[#A7D3CB] flex items-center justify-center shrink-0 mt-0.5">
                   <Pill className="text-black" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-foreground truncate">{m.name}</p>
                    {firstName && (
                      <span className="text-xs text-muted-foreground">· {firstName}</span>
                    )}
                    <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 bg-secondary/10 text-secondary border-secondary/20 shrink-0">
                      Ativo
                    </Badge>
                  </div>
                  {m.dosage && (
                    <p className="text-xs text-muted-foreground truncate">{m.dosage}</p>
                  )}
                  {m.frequency_hours != null && m.frequency_hours > 0 && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                      <Clock size={12} className="shrink-0" />
                      <span>{m.frequency_hours === 24 ? "1x ao dia" : `A cada ${m.frequency_hours}h`}</span>
                    </div>
                  )}
                  {m.frequency_hours === 0 && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                      <Clock size={12} className="shrink-0" />
                      <span>Uso contínuo</span>
                    </div>
                  )}
                  {nextDose && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-primary">
                      <CalendarClock size={12} className="shrink-0" />
                      <span>Próxima dose: {format(nextDose, "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
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
  );
};

export default MedicamentosGeral;
