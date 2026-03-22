import { useNavigate } from "react-router-dom";
import { Bell, Pill, Stethoscope, FileText, Calendar, ChevronRight, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useMedications } from "@/hooks/useMedications";
import { useNotifications } from "@/hooks/useNotifications";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addHours, startOfDay, isToday, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userName = user?.user_metadata?.full_name || "Usuário";

  // All active medications across family
  const { medications, isLoading: medsLoading } = useMedications();
  const activeMeds = medications.filter((m) => m.status === "Ativo");

  // Unread notifications count
  const { unreadCount } = useNotifications();

  // Upcoming appointments (2 nearest consultations + exams)
  const { data: upcoming = [], isLoading: upcomingLoading } = useQuery({
    queryKey: ["upcoming-appointments", user?.id],
    queryFn: async () => {
      const [consultRes, examRes] = await Promise.all([
        supabase
          .from("consultations")
          .select("id, family_member_id, specialty, professional_name, consultation_date, status, family_members(name)")
          .eq("user_id", user!.id)
          .in("status", ["Agendada"])
          .order("consultation_date", { ascending: true })
          .limit(5),
        supabase
          .from("exams")
          .select("id, family_member_id, name, exam_date, location, status, result_date, family_members(name)")
          .eq("user_id", user!.id)
          .or("status.eq.Agendado,and(status.eq.Coletado,result_date.not.is.null)")
          .order("exam_date", { ascending: true })
          .limit(5),
      ]);

      const items: Array<{
        id: string;
        title: string;
        subtitle: string;
        date: string | null;
        memberName: string;
        kind: "consultation" | "exam";
        familyMemberId: string;
        isOverdue: boolean;
      }> = [];

      (consultRes.data ?? []).forEach((c: any) => {
        const dateStr = c.consultation_date;
        const overdue = c.status === "Agendada" && dateStr ? isBefore(new Date(dateStr), new Date()) : false;
        items.push({
          id: c.id,
          title: c.specialty,
          subtitle: c.professional_name ? `com ${c.professional_name}` : "Consulta",
          date: dateStr,
          memberName: c.family_members?.name ?? "Familiar",
          kind: "consultation",
          familyMemberId: c.family_member_id,
          isOverdue: overdue,
        });
      });

      (examRes.data ?? []).forEach((e: any) => {
        const isColetado = e.status === "Coletado";
        const displayDate = isColetado ? e.result_date : e.exam_date;
        const overdue = e.status === "Agendado" && e.exam_date ? isBefore(new Date(e.exam_date), startOfDay(new Date())) : false;
        items.push({
          id: e.id,
          title: isColetado ? `Buscar Resultado` : e.name,
          subtitle: isColetado ? e.name : (e.location ?? "Exame"),
          date: displayDate,
          memberName: e.family_members?.name ?? "Familiar",
          kind: "exam",
          familyMemberId: e.family_member_id,
          isOverdue: overdue,
        });
      });

      // Sort: overdue first, then by date ascending
      items.sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      return items.slice(0, 5);
    },
    enabled: !!user,
  });

  // Compute next dose for active meds
  const getNextDose = (med: typeof activeMeds[0]) => {
    if (!med.start_time || !med.frequency_hours || med.frequency_hours === 0) return null;
    const now = new Date();
    const [h, m] = med.start_time.split(":").map(Number);
    const todayStart = new Date();
    todayStart.setHours(h, m, 0, 0);

    // Find next dose time from start_time cycling by frequency_hours
    let next = new Date(todayStart);
    while (isBefore(next, now)) {
      next = addHours(next, med.frequency_hours);
    }
    // Only show if it's today
    if (!isToday(next)) return null;
    return format(next, "HH:mm");
  };

  const isLoading = medsLoading || upcomingLoading;

  return (
    <div className="px-5 pt-6 pb-28 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-muted-foreground">
            {(() => {
              const h = new Date().getHours();
              if (h < 12) return "Bom dia 👋";
              if (h < 18) return "Boa tarde 👋";
              return "Boa noite 👋";
            })()}
          </p>
          <h1 className="text-2xl font-bold text-foreground">Olá, {userName}</h1>
        </div>
        <button
          onClick={() => navigate("/notificacoes", { state: { from: "/home" } })}
          className="relative p-2 rounded-full hover:bg-muted/50 active:bg-muted/50 transition-colors"
        >
          <Bell size={24} className="text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-background" />
          )}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Pill className="text-primary" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeMeds.length}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Medicamentos Ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
              <Calendar className="text-secondary" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{upcoming.length}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Próximos Compromissos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Actions */}
      <section className="mb-6">
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Activity size={18} className="text-primary" />
          Ações de Hoje
        </h2>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : activeMeds.length === 0 ? (
          <Card className="border-border/50 bg-muted/30">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Nenhum medicamento ativo no momento.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col space-y-2">
            {activeMeds.slice(0, 5).map((med) => {
              const nextDose = getNextDose(med);
              return (
                <button
                  key={med.id}
                  onClick={() => navigate(`/familiar/${med.family_member_id}/medicamentos`)}
                  className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/50 shadow-sm text-left active:bg-accent/50 sm:hover:bg-accent/50 transition-colors w-full"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Pill className="text-primary" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{med.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {med.dosage ?? ""}
                      {nextDose ? ` · Próxima dose: ${nextDose}` : med.frequency_hours === 0 ? " · Uso contínuo" : ""}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Upcoming Appointments */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Calendar size={18} className="text-secondary" />
          Próximos Compromissos
        </h2>
        {isLoading ? (
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
              const Icon = isExam ? FileText : Stethoscope;
              const route = isExam
                ? `/familiar/${item.familyMemberId}/exames`
                : `/familiar/${item.familyMemberId}/consultas`;

              return (
                <button
                  key={`${item.kind}-${item.id}`}
                  onClick={() => navigate(route, { state: { from: "/home" } })}
                  className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/50 shadow-sm text-left active:bg-accent/50 sm:hover:bg-accent/50 transition-colors w-full"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isExam ? "bg-secondary/10" : "bg-primary/10"}`}>
                    <Icon className={isExam ? "text-secondary" : "text-primary"} size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                      {item.isOverdue && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                          Atrasado
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                        {isExam ? "Exame" : "Consulta"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.date
                        ? format(
                            new Date(item.date.length === 10 ? item.date + "T12:00:00" : item.date),
                            "dd MMM · HH:mm",
                            { locale: ptBR }
                          )
                        : "Sem data"}{" "}
                      — {item.memberName}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
