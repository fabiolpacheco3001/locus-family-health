import { Calendar, PawPrint, FileText, Stethoscope, ChevronRight, Scissors } from "lucide-react";
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateInSP, toSPTime } from "@/lib/dateUtils";
import type { UpcomingItem } from "@/hooks/useHomeData";

type Props = {
  upcomingLoading: boolean;
  upcoming: UpcomingItem[];
};

export function UpcomingAppointmentsSection({ upcomingLoading, upcoming }: Props) {
  const navigate = useNavigate();

  return (
    <AccordionItem value="proximos-compromissos" className="border-b-0">
      <AccordionTrigger className="text-base font-semibold text-foreground hover:no-underline py-3">
        <span className="flex items-center gap-2">
          <Calendar size={18} style={{ color: "#6A978F" }} />
          5 Próximos Compromissos
        </span>
      </AccordionTrigger>
      <AccordionContent>
        {upcomingLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : upcoming.length === 0 ? (
          <Card className="border-border/50 bg-muted/30">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Nenhum compromisso próximo.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col space-y-2">
            {upcoming.map((item) => {
              const isExam = item.kind === "exam";
              const isPetRoutine = item.kind === "pet_routine";
              const Icon = isPetRoutine ? PawPrint : isExam ? FileText : Stethoscope;
              const route = isPetRoutine
                ? `/familiar/${item.familyMemberId}/rotinas-pet`
                : isExam
                ? `/familiar/${item.familyMemberId}/exames`
                : `/familiar/${item.familyMemberId}/consultas`;

              const badgeClass = isPetRoutine
                ? "bg-[#A7D3CB]/30 text-[#1C3333]"
                : isExam
                ? "bg-[#FFF4A3] text-black"
                : item.consultationType === "Retorno"
                ? "bg-[#A0C4D7] text-slate-800"
                : item.consultationType === "Emergência"
                ? "bg-[#F87171] text-white"
                : "bg-[#DCC5F1] text-black";

              const badgeLabel = isPetRoutine
                ? "Rotina Pet"
                : isExam
                ? "Exame"
                : item.consultationType === "Retorno"
                ? "Retorno"
                : item.consultationType === "Emergência"
                ? "Emergência"
                : "Consulta";

              return (
                <button
                  key={`${item.kind}-${item.id}`}
                  onClick={() => navigate(route, { state: { from: "/home" } })}
                  className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/50 shadow-xs text-left active:bg-accent/50 sm:hover:bg-accent/50 transition-colors w-full"
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#A7D3CB]">
                    <Icon className="text-black" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                      {item.isOverdue && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                          Atrasado
                        </Badge>
                      )}
                      <Badge className={`text-[10px] px-1.5 py-0 shrink-0 border-none ${badgeClass}`}>
                        {badgeLabel}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.date
                        ? format(
                            toSPTime(
                              item.date.length === 10
                                ? (parseDateInSP(item.date) ?? new Date())
                                : new Date(item.date)
                            ),
                            "dd MMM · HH:mm",
                            { locale: ptBR }
                          )
                        : "Sem data"}{" "}
                      — {item.memberName}
                      {item.isPet ? " 🐾" : ""}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-black shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
