import { format, parseISO, isValid, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  Building2,
  User,
  Share2,
  AlertCircle,
  Scissors,
  CheckCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getSurgeryLabel } from "@/lib/surgeryTypes";
import type { Surgery } from "@/hooks/useSurgeries";
import SwipeableActionCard from "@/components/SwipeableActionCard";

const statusColors: Record<string, string> = {
  scheduled: "bg-[#AEE2D4] text-slate-800 border-none",
  completed: "bg-[#F2A97F] text-slate-900 border-none",
  canceled:  "bg-[#F87171] text-white border-none",
};

const statusLabels: Record<string, string> = {
  scheduled: "Agendada",
  completed: "Realizada",
  canceled:  "Cancelada",
};

interface SurgeryCardProps {
  surgery: Surgery;
  onClick?: () => void;
  onExportPdf?: () => void;
  onDelete?: () => void;
  onComplete?: () => void;
  isAdmin?: boolean;
  readOnly?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SurgeryCard({
  surgery,
  onClick,
  onExportPdf,
  onDelete,
  onComplete,
  isAdmin = false,
  readOnly = false,
  isOpen,
  onOpenChange,
}: SurgeryCardProps) {
  const displayName =
    surgery.surgery_type === "outro" && surgery.custom_type
      ? surgery.custom_type
      : getSurgeryLabel(surgery.surgery_type);

  const scheduledDate = surgery.scheduled_date ? parseISO(surgery.scheduled_date) : null;
  const formattedDate =
    scheduledDate && isValid(scheduledDate)
      ? format(scheduledDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
      : null;

  const isOverdue =
    surgery.status === "scheduled" &&
    scheduledDate != null &&
    isValid(scheduledDate) &&
    isPast(scheduledDate);

  const preCount =
    surgery.surgery_instructions?.find((i) => i.phase === "pre")?.items?.length ?? 0;
  const postCount =
    surgery.surgery_instructions?.find((i) => i.phase === "post")?.items?.length ?? 0;

  const cardContent = (
    <div
      className={`bg-card rounded-xl border border-border/50 p-4 shadow-xs ${
        onClick ? "active:bg-muted/50 cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Ícone */}
        <div className="w-10 h-10 rounded-xl bg-[#A7D3CB] flex items-center justify-center shrink-0">
          <Scissors size={20} className="text-black" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-foreground text-sm leading-tight truncate">
              {displayName}
            </p>

            <div className="flex items-center gap-1.5 shrink-0">
              {isOverdue ? (
                <Badge className="bg-yellow-100 text-yellow-800 border-none text-[11px]">
                  <AlertCircle size={10} className="mr-0.5" />
                  Atualizar
                </Badge>
              ) : (
                <Badge className={`${statusColors[surgery.status] ?? statusColors.scheduled} text-[11px]`}>
                  {statusLabels[surgery.status] ?? surgery.status}
                </Badge>
              )}

              {onExportPdf && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onExportPdf();
                  }}
                  className="p-1 rounded-md hover:bg-muted/50 active:bg-muted"
                  aria-label="Exportar PDF"
                >
                  <Share2 size={15} className="text-[#78C2AD]" />
                </button>
              )}
            </div>
          </div>

          {formattedDate && (
            <div className="flex items-center gap-1 mt-1">
              <Calendar size={12} className="text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">{formattedDate}</p>
            </div>
          )}

          {surgery.hospital_clinic && (
            <div className="flex items-center gap-1 mt-0.5">
              <Building2 size={12} className="text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground truncate">{surgery.hospital_clinic}</p>
            </div>
          )}

          {surgery.surgeon_name && (
            <div className="flex items-center gap-1 mt-0.5">
              <User size={12} className="text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground truncate">{surgery.surgeon_name}</p>
            </div>
          )}

          {(preCount > 0 || postCount > 0) && (
            <p className="text-xs text-muted-foreground mt-1">
              {preCount > 0 && `${preCount} instrução${preCount > 1 ? "ões" : ""} pré-op`}
              {preCount > 0 && postCount > 0 && " · "}
              {postCount > 0 && `${postCount} instrução${postCount > 1 ? "ões" : ""} pós-op`}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  if (readOnly || !onDelete) {
    return cardContent;
  }

  return (
    <SwipeableActionCard
      onDelete={onDelete}
      disableDelete={!isAdmin}
      leadingAction={
        surgery.status === "scheduled" && onComplete
          ? {
              icon: <CheckCircle size={20} />,
              label: "Concluir",
              bgColor: "#AEE2D4",
              textColor: "#1e293b",
              onAction: onComplete,
            }
          : undefined
      }
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      {cardContent}
    </SwipeableActionCard>
  );
}
