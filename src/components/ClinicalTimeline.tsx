import { useState } from "react";
import { Stethoscope, Pill, FileText, ExternalLink, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ClinicalEvent } from "@/hooks/useClinicalTimeline";

const typeConfig: Record<ClinicalEvent["type"], { icon: React.ElementType; bg: string; iconColor: string }> = {
  consulta: { icon: Stethoscope, bg: "bg-blue-100", iconColor: "text-blue-700" },
  medicamento: { icon: Pill, bg: "bg-emerald-100", iconColor: "text-emerald-700" },
  exame: { icon: FileText, bg: "bg-violet-100", iconColor: "text-violet-700" },
};

const statusBadge: Record<string, string> = {
  Agendada: "bg-[#AEE2D4] text-[#1C3333]",
  Realizada: "bg-[#1C3333] text-white",
  Cancelada: "bg-red-100 text-red-700",
  Ativo: "bg-emerald-100 text-emerald-800",
  Finalizado: "bg-muted text-muted-foreground",
  Agendado: "bg-[#AEE2D4] text-[#1C3333]",
  Coletado: "bg-amber-100 text-amber-800",
  Pronto: "bg-[#1C3333] text-white",
};

const formatDate = (dateStr: string) => {
  try {
    const d = parseISO(dateStr);
    const day = format(d, "dd MMM yyyy", { locale: ptBR });
    const weekday = format(d, "EEEE", { locale: ptBR }).substring(0, 3);
    const time = format(d, "HH:mm");
    return `${day} — ${weekday} às ${time}`;
  } catch {
    return dateStr;
  }
};

const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url);

interface Props {
  events: ClinicalEvent[];
}

const ClinicalTimeline = ({ events }: Props) => {
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  if (events.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-8">
        Nenhum registro clínico encontrado.
      </p>
    );
  }

  return (
    <>
      <div className="relative pl-6">
        {/* Timeline vertical line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

        <div className="space-y-4">
          {events.map((ev) => {
            const cfg = typeConfig[ev.type];
            const Icon = cfg.icon;
            const badgeClass = ev.status ? statusBadge[ev.status] || "bg-muted text-muted-foreground" : null;

            return (
              <div key={`${ev.type}-${ev.id}`} className="relative">
                {/* Timeline dot */}
                <div className={`absolute -left-6 top-3 w-[22px] h-[22px] rounded-full ${cfg.bg} flex items-center justify-center ring-2 ring-background`}>
                  <Icon className={cfg.iconColor} size={12} />
                </div>

                {/* Card */}
                <div className="rounded-xl bg-card border border-border/50 p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-foreground leading-snug flex-1">{ev.title}</p>
                    {badgeClass && (
                      <Badge className={`${badgeClass} text-[10px] shrink-0 border-0`}>
                        {ev.status}
                      </Badge>
                    )}
                  </div>

                  <p className="text-[10px] text-muted-foreground capitalize mb-1.5">
                    {formatDate(ev.date)}
                  </p>

                  {ev.subtitle && (
                    <p className="text-xs text-muted-foreground">{ev.subtitle}</p>
                  )}

                  {ev.details && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ev.details}</p>
                  )}

                  {ev.fileUrl && (
                    <button
                      onClick={() => setViewerUrl(ev.fileUrl)}
                      className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-primary hover:underline"
                    >
                      <ExternalLink size={12} />
                      Visualizar Laudo/Anexo
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* In-App Document Viewer */}
      <Dialog open={!!viewerUrl} onOpenChange={(open) => !open && setViewerUrl(null)}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 gap-0 flex flex-col rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
            <p className="text-sm font-semibold text-foreground">Visualizar Documento</p>
            <Button variant="ghost" size="icon" onClick={() => setViewerUrl(null)}>
              <X size={18} />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden bg-muted">
            {viewerUrl && (
              isImageUrl(viewerUrl) ? (
                <img src={viewerUrl} alt="Anexo" className="w-full h-full object-contain" />
              ) : (
                <iframe
                  src={`https://docs.google.com/gview?url=${encodeURIComponent(viewerUrl)}&embedded=true`}
                  className="w-full h-full border-0"
                  title="Visualizador de documento"
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClinicalTimeline;
