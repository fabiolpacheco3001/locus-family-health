import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { parseISO } from "date-fns";
import { Calendar, Stethoscope, FileText, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import useSmartBack from "@/hooks/useSmartBack";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { format, startOfDay, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";

type AgendaItem = {
  id: string;
  family_member_id: string;
  title: string;
  subtitle: string | null;
  date: string | null;
  type: string | null;
  status: string;
  memberName: string;
  kind: "consultation" | "exam";
  isOverdue: boolean;
};

const filterLabels: Record<string, string> = {
  consultas: "Consultas Pendentes",
  exames: "Exames Pendentes",
  upcoming: "Compromissos em Aberto",
};

const Agenda = () => {
  const { user } = useAuth();
  const { groupId, isAdmin, linkedMemberId, managedProfiles } = useFamilyGroup();
  const navigate = useNavigate();
  const goBack = useSmartBack();
  const [searchParams] = useSearchParams();
  const currentFilter = searchParams.get("filter");
  const today = startOfDay(new Date());

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["agenda", groupId, isAdmin, linkedMemberId, managedProfiles],
    queryFn: async () => {
      let cq = supabase
        .from("consultations")
        .select("id, family_member_id, specialty, professional_name, consultation_date, type, status, family_members(name, member_type)")
        .neq("status", "Cancelada")
        .neq("status", "Realizada")
        .order("consultation_date", { ascending: true });

      let eq = supabase
        .from("exams")
        .select("id, family_member_id, name, exam_date, location, status, result_date, family_members(name)")
        .neq("status", "Cancelado")
        .neq("status", "Realizado")
        .neq("status", "Coletado")
        .or("status.eq.Agendado")
        .order("exam_date", { ascending: true });

      if (isAdmin && groupId) {
        cq = cq.eq("group_id", groupId);
        eq = eq.eq("group_id", groupId);
      } else if (linkedMemberId) {
        const allowedIds = [linkedMemberId, ...(managedProfiles ?? [])];
        cq = cq.in("family_member_id", allowedIds);
        eq = eq.in("family_member_id", allowedIds);
      } else {
        cq = cq.eq("user_id", user!.id);
        eq = eq.eq("user_id", user!.id);
      }

      const [consultRes, examRes] = await Promise.all([cq, eq]);

      if (consultRes.error) throw consultRes.error;
      if (examRes.error) throw examRes.error;

      const consultations: AgendaItem[] = (consultRes.data ?? []).map((c: any) => {
        const dateStr = c.consultation_date;
        return {
          id: c.id,
          family_member_id: c.family_member_id,
          title: c.specialty,
          subtitle: c.professional_name ? `com ${c.professional_name}` : null,
          date: dateStr,
          type: c.type,
          status: c.status,
          memberName: c.family_members?.name ?? "Familiar",
          kind: "consultation",
          isOverdue: c.status === "Agendada" && dateStr ? isBefore(parseISO(dateStr), new Date()) : false,
        };
      });

      const exams: AgendaItem[] = (examRes.data ?? []).map((e: any) => {
        const isRealizado = e.status === "Realizado" || e.status === "Coletado";
        const displayDate = isRealizado ? e.result_date : e.exam_date;
        const subtitle = isRealizado
          ? `Buscar Resultado de ${e.name}`
          : e.location ? `em ${e.location}` : "Exame Agendado";
        // Normalize old status names to new ones
        const normalizedStatus = e.status === "Coletado" ? "Realizado" : e.status === "Resultado Pronto" ? "Pronto" : e.status;
        return {
          id: e.id,
          family_member_id: e.family_member_id,
          title: isRealizado ? "Resultado Pendente" : e.name,
          subtitle,
          date: displayDate,
          type: null,
          status: normalizedStatus,
          memberName: e.family_members?.name ?? "Familiar",
          kind: "exam",
          isOverdue: displayDate ? isBefore(new Date(displayDate + 'T12:00:00'), today) : false,
        };
      });

      const merged = [...consultations, ...exams];
      merged.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
      return merged;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const filteredItems = React.useMemo(() => {
    if (!currentFilter) return items;
    if (currentFilter === "consultas") return items.filter((i) => i.kind === "consultation" && (i.status === "Agendada"));
    if (currentFilter === "exames") return items.filter((i) => i.kind === "exam");
    if (currentFilter === "upcoming") return items.filter((i) =>
      i.status !== "Realizada" && i.status !== "Cancelada" && i.status !== "Pronto"
    );
    return items;
  }, [items, currentFilter]);

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-4 pb-4 min-h-[calc(100%+1px)]">
        {/* Sticky Header with Glassmorphism */}
        <div className="sticky top-0 z-30 bg-[#F4F1EB]/80 backdrop-blur-md pt-6 pb-2 -mx-4 px-5">
          <div className="flex items-center gap-3">
            {currentFilter && (
              <Button variant="ghost" size="icon" onClick={goBack}>
                <ArrowLeft size={22} />
              </Button>
            )}
            <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          </div>
        </div>
        {currentFilter && filterLabels[currentFilter] && (
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="secondary" className="text-xs px-2.5 py-1">
              {filterLabels[currentFilter]}
            </Badge>
            <button
              onClick={() => navigate("/agenda", { replace: true })}
              className="p-1 rounded-full hover:bg-muted/50 active:bg-muted/50 transition-colors"
            >
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-4 p-4 bg-card rounded-xl border border-border/50">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-32" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-5 h-5 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-3.5 w-48" />
                  <div className="flex gap-2 mt-1">
                    <Skeleton className="h-4 w-14 rounded-full" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
             <div className="w-16 h-16 rounded-full bg-[#A7D3CB] flex items-center justify-center mb-4">
               <Calendar className="text-black" size={28} />
             </div>
            <p className="text-foreground font-semibold mb-1">Nenhum compromisso</p>
            <p className="text-muted-foreground text-sm">
              {currentFilter ? "Nenhum item encontrado para este filtro." : "Sua família não tem compromissos agendados no momento."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col space-y-3">
            {filteredItems.map((item) => {
              const isExam = item.kind === "exam";
              const Icon = isExam ? FileText : Stethoscope;
              const route = isExam
                ? `/familiar/${item.family_member_id}/exames`
                : `/familiar/${item.family_member_id}/consultas`;

              return (
                <button
                  key={`${item.kind}-${item.id}`}
                  onClick={() => navigate(route, { state: { from: '/agenda' } })}
                  className="flex items-start gap-4 p-4 bg-card rounded-xl border border-border/50 shadow-sm text-left active:bg-accent/50 sm:hover:bg-accent/50 transition-colors w-full"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-[#A7D3CB]">
                    <Icon className="text-black" size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    {item.date && (
                      <p className="text-sm font-bold text-black mb-1">
                        {(() => {
                          const hasTime = item.date!.length > 10;
                          const parsed = hasTime ? parseISO(item.date!) : new Date(item.date + 'T12:00:00');
                          const datePart = format(parsed, "dd MMM yyyy", { locale: ptBR });
                          const dayName = format(parsed, "EEEEEE", { locale: ptBR });
                          const dayAbbr = dayName.substring(0, 3);
                          const dayCapitalized = dayAbbr.charAt(0).toUpperCase() + dayAbbr.slice(1);
                          const timePart = hasTime ? ` às ${format(parsed, "HH:mm")}` : "";
                          return `${datePart} - ${dayCapitalized}${timePart}`;
                        })()}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mb-1">
                     <Avatar className="h-5 w-5 border border-[#1C3333]/20">
                        <AvatarFallback className="bg-secondary/20 text-secondary text-[10px] font-bold">
                          {(() => { const p = item.memberName.trim().split(' ').filter(Boolean); return p.length <= 1 ? (p[0]?.[0] ?? '').toUpperCase() : `${p[0][0]}${p[p.length-1][0]}`.toUpperCase(); })()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground truncate">{item.memberName}{(item as any).isPet ? " 🐾" : ""}</span>
                    </div>
                    <p className="text-sm text-foreground truncate">
                      {item.title}
                      {item.subtitle ? ` — ${item.subtitle}` : ""}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {item.isOverdue && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          Atrasado
                        </Badge>
                      )}
                      {isExam && (
                         <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-[#FFF4A3] text-slate-800 border-none">
                           Exame
                        </Badge>
                      )}
                      {!isExam && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 border-none ${
                            item.type === "Retorno"
                              ? "bg-[#A0C4D7] text-slate-800"
                              : item.type === "Emergência"
                              ? "bg-[#F87171] text-white"
                              : "bg-[#DCC5F1] text-black"
                          }`}
                        >
                          {item.type === "Retorno" ? "Retorno" : item.type === "Emergência" ? "Emergência" : "Consulta"}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 border-none ${
                           item.status === "Agendada" || item.status === "Agendado"
                            ? "bg-[#AEE2D4] text-slate-800"
                            : item.status === "Realizada" || item.status === "Realizado"
                            ? "bg-[#F2A97F] text-slate-900"
                            : item.status === "Pronto"
                            ? "bg-[#1C3333] text-white"
                            : item.status === "Cancelada" || item.status === "Cancelado"
                            ? "bg-[#F87171] text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default Agenda;
