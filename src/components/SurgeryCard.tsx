import { format, parseISO, isValid, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  XCircle,
  Calendar,
  Hospital,
  User,
  Share2,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { getSurgeryLabel } from "@/lib/surgeryTypes";
import type { Surgery } from "@/hooks/useSurgeries";

interface SurgeryCardProps {
  surgery: Surgery;
  onClick?: () => void;
  onExportPdf?: () => void;
  readOnly?: boolean;
}

export function SurgeryCard({ surgery, onClick, onExportPdf, readOnly = false }: SurgeryCardProps) {
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
    scheduledDate &&
    isValid(scheduledDate) &&
    isPast(scheduledDate);

  const preCount =
    surgery.surgery_instructions?.find((i) => i.phase === "pre")?.items?.length ?? 0;
  const postCount =
    surgery.surgery_instructions?.find((i) => i.phase === "post")?.items?.length ?? 0;

  return (
    <div
      className={`bg-card rounded-xl border border-border/50 p-4 shadow-xs ${
        onClick ? "active:bg-muted/50 cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm leading-tight truncate">
            {displayName}
          </p>

          {formattedDate && (
            <div className="flex items-center gap-1 mt-1">
              <Calendar size={12} className="text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">{formattedDate}</p>
            </div>
          )}

          {surgery.hospital_clinic && (
            <div className="flex items-center gap-1 mt-0.5">
              <Hospital size={12} className="text-muted-foreground shrink-0" />
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

        <div className="flex flex-col items-end gap-2 shrink-0">
          {surgery.status === "scheduled" && !isOverdue && (
            <span className="text-[11px] font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              Agendada
            </span>
          )}
          {surgery.status === "scheduled" && isOverdue && (
            <span className="text-[11px] font-medium bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertCircle size={10} />
              Atualizar status
            </span>
          )}
          {surgery.status === "completed" && (
            <span className="text-[11px] font-medium text-green-600 flex items-center gap-1">
              <CheckCircle2 size={14} className="text-green-500" />
              Realizada
            </span>
          )}
          {surgery.status === "canceled" && (
            <span className="text-[11px] font-medium text-red-600 flex items-center gap-1">
              <XCircle size={14} className="text-red-500" />
              Cancelada
            </span>
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
              <Share2 size={16} className="text-[#78C2AD]" />
            </button>
          )}

          {!readOnly && onClick && (
            <ChevronRight size={16} className="text-muted-foreground" />
          )}
        </div>
      </div>
    </div>
  );
}
