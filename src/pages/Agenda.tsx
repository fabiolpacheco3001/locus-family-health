import { useNavigate } from "react-router-dom";
import { Calendar, Stethoscope, FileText } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
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
};

const Agenda = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["agenda", user?.id],
    queryFn: async () => {
      const [consultRes, examRes] = await Promise.all([
        supabase
          .from("consultations")
          .select("id, family_member_id, specialty, professional_name, consultation_date, type, status, family_members(name)")
          .eq("user_id", user!.id)
          .order("consultation_date", { ascending: true }),
        supabase
          .from("exams")
          .select("id, family_member_id, name, exam_date, location, status, family_members(name)")
          .eq("user_id", user!.id)
          .eq("status", "Agendado")
          .order("exam_date", { ascending: true }),
      ]);

      if (consultRes.error) throw consultRes.error;
      if (examRes.error) throw examRes.error;

      const consultations: AgendaItem[] = (consultRes.data ?? []).map((c: any) => ({
        id: c.id,
        family_member_id: c.family_member_id,
        title: c.specialty,
        subtitle: c.professional_name ? `com ${c.professional_name}` : null,
        date: c.consultation_date,
        type: c.type,
        status: c.status,
        memberName: c.family_members?.name ?? "Familiar",
        kind: "consultation",
      }));

      const exams: AgendaItem[] = (examRes.data ?? []).map((e: any) => ({
        id: e.id,
        family_member_id: e.family_member_id,
        title: e.name,
        subtitle: e.location ? `em ${e.location}` : "Exame Agendado",
        date: e.exam_date,
        type: null,
        status: e.status,
        memberName: e.family_members?.name ?? "Familiar",
        kind: "exam",
      }));

      const merged = [...consultations, ...exams];
      merged.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
      return merged;
    },
    enabled: !!user,
  });

  return (
    <div className="px-4 pt-6 pb-28 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground mb-6">Agenda</h1>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Calendar className="text-primary" size={28} />
          </div>
          <p className="text-foreground font-semibold mb-1">Nenhum compromisso</p>
          <p className="text-muted-foreground text-sm">
            Sua família não tem compromissos agendados no momento.
          </p>
        </div>
      ) : (
        <div className="flex flex-col space-y-3">
          {items.map((item) => {
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
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${isExam ? "bg-secondary/10" : "bg-primary/10"}`}>
                  <Icon className={isExam ? "text-secondary" : "text-primary"} size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  {item.date && (
                    <p className="text-sm font-bold text-primary mb-1">
                      {format(
                        new Date(item.date),
                        item.kind === "exam" ? "dd MMM yyyy" : "dd MMM yyyy '-' HH:mm",
                        { locale: ptBR }
                      )}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="bg-secondary/20 text-secondary text-[10px] font-bold">
                        {item.memberName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground truncate">{item.memberName}</span>
                  </div>
                  <p className="text-sm text-foreground truncate">
                    {item.title}
                    {item.subtitle ? ` ${item.subtitle}` : ""}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {isExam && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-secondary/10 text-secondary border-secondary/20">
                        Exame
                      </Badge>
                    )}
                    {item.type && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          item.type === "Emergência"
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : "bg-secondary/10 text-secondary border-secondary/20"
                        }`}
                      >
                        {item.type}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${
                        item.status === "Agendada" || item.status === "Agendado"
                          ? "bg-primary/10 text-primary border-primary/20"
                          : item.status === "Realizada" || item.status === "Resultado Pronto"
                          ? "bg-secondary/10 text-secondary border-secondary/20"
                          : "bg-destructive/10 text-destructive border-destructive/20"
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
  );
};

export default Agenda;
