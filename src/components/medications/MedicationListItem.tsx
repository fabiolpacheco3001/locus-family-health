import { AlertCircle, CalendarCheck, CalendarClock, CalendarPlus, CheckCircle, ChevronRight, Clock, Pill, Stethoscope } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { parseDateInSP, toSPTime } from "@/lib/dateUtils";
import SwipeableActionCard from "@/components/SwipeableActionCard";
import { MedicationDoseActions } from "@/components/agenda/MedicationDoseActions";
import type { Medication } from "@/hooks/useMedications";

interface MedicationListItemProps {
  med: Medication;
  isAtivo: boolean;
  nextDoseDate: Date | null;
  scheduledFor: string | null;
  doseStatus: "taken" | "skipped" | null;
  isOverdue: boolean;
  isOpen: boolean;
  disableDelete: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onConcluir: () => void;
}

export function MedicationListItem({
  med: m,
  isAtivo,
  nextDoseDate,
  scheduledFor,
  doseStatus,
  isOverdue,
  isOpen,
  disableDelete,
  onOpenChange,
  onEdit,
  onDelete,
  onConcluir,
}: MedicationListItemProps) {
  return (
    <SwipeableActionCard
      onDelete={onDelete}
      disableDelete={disableDelete}
      ariaLabel={`Medicamento: ${m.name}`}
      leadingAction={isAtivo ? {
        icon: <CheckCircle className="w-6 h-6" aria-hidden="true" />,
        label: "Concluído",
        bgColor: "#1C3333",
        textColor: "#ffffff",
        onAction: onConcluir,
      } : undefined}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      <div className="flex flex-col p-4 bg-card rounded-xl border border-border/50 shadow-xs text-left w-full">
        <button
          onClick={onEdit}
          aria-label={`Ver e editar ${m.name}`}
          className="flex items-start gap-4 active:bg-accent/50 sm:hover:bg-accent/50 transition-colors w-full rounded-lg"
        >
          <div className="w-10 h-10 rounded-xl bg-[#A7D3CB] flex items-center justify-center shrink-0 mt-0.5" aria-hidden="true">
            <Pill className="text-black" size={20} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-bold text-foreground truncate">{m.name}</p>
              <Badge
                className={`text-[10px] px-1.5 py-0 border-none ${
                  m.status === "Ativo" ? "bg-[#F2A97F] text-black" : "bg-[#A7D3CB] text-black"
                }`}
              >
                {m.status}
              </Badge>
            </div>
            {m.dosage && <p className="text-xs text-muted-foreground truncate">{m.dosage}</p>}
            {m.consultations?.professional_name && (
              <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                <Stethoscope size={12} aria-hidden="true" />
                <span>Solicitado por {m.consultations.professional_name}</span>
              </div>
            )}
            <div className="flex flex-col gap-1.5 mt-2">
              {m.frequency_hours != null && m.frequency_hours > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock size={14} className="shrink-0" aria-hidden="true" />
                  <span>{m.frequency_hours === 24 ? "1x ao dia" : `A cada ${m.frequency_hours}h`}</span>
                </div>
              )}
              {m.frequency_hours === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock size={14} className="shrink-0" aria-hidden="true" />
                  <span>Uso contínuo</span>
                </div>
              )}
              {m.start_date && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarPlus size={14} className="shrink-0" aria-hidden="true" />
                  <span>
                    Início: {format(toSPTime(parseDateInSP(m.start_date.slice(0, 10)) ?? new Date()), "dd/MM/yyyy")}
                    {m.start_time ? ` às ${m.start_time.slice(0, 5)}` : ""}
                  </span>
                </div>
              )}
              {m.end_date && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarCheck size={14} className="shrink-0" aria-hidden="true" />
                  <span>
                    Término: {format(toSPTime(parseDateInSP(m.end_date.slice(0, 10)) ?? new Date()), "dd/MM/yyyy")}
                    {m.start_time ? ` às ${m.start_time.slice(0, 5)}` : ""}
                  </span>
                </div>
              )}
              {isAtivo && nextDoseDate && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <CalendarClock size={14} className="shrink-0" aria-hidden="true" />
                  <span>Próxima dose: {format(toSPTime(nextDoseDate), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                </div>
              )}
            </div>
          </div>
          <ChevronRight size={18} className="text-muted-foreground shrink-0 mt-3" aria-hidden="true" />
        </button>
        {isAtivo && scheduledFor && (
          <div className="flex w-full items-center justify-between mt-4 pt-3 border-t border-border/30">
            <div className="flex items-center">
              {!doseStatus && isOverdue && (
                <Badge className="bg-destructive text-destructive-foreground border-destructive text-[10px] font-bold px-2.5 h-7 m-0 inline-flex items-center justify-center gap-1">
                  <AlertCircle className="w-3 h-3" aria-hidden="true" /> Atrasado
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
}
