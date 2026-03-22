import { useNavigate } from "react-router-dom";
import { Bell, Pill, Stethoscope, FileText, Calendar, ChevronRight, Activity, LayoutDashboard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import * as React from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useMedications } from "@/hooks/useMedications";
import { useNotifications } from "@/hooks/useNotifications";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calculateNextDose } from "@/lib/calculateNextDose";

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userName = (user?.user_metadata?.full_name || "Usuário").split(' ')[0];

  // All active medications across family
  const { medications, isLoading: medsLoading } = useMedications();
  const activeMeds = medications.filter((m) => m.status === "Ativo");

  // Unread notifications count
  const { unreadCount } = useNotifications();

  // Upcoming appointments (2 nearest consultations + exams)
  // Pending consultations count
  const { data: pendingConsultations = 0 } = useQuery({
    queryKey: ["pending-consultations-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("consultations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("status", "Agendada");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });

  // Pending exams count
  const { data: pendingExams = 0 } = useQuery({
    queryKey: ["pending-exams-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("exams")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .or("status.eq.Agendado,status.eq.Coletado");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });

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

  // Build list of active meds with their next dose
  const medsWithNextDose = activeMeds
    .map((med) => {
      const dateOnly = med.start_date?.slice(0, 10);
      let startDateISO: string | null = null;
      if (dateOnly && med.start_time) {
        startDateISO = `${dateOnly}T${med.start_time}`;
      } else if (dateOnly) {
        startDateISO = `${dateOnly}T12:00:00`;
      }

      const nextDose = calculateNextDose(startDateISO, med.frequency_hours, med.end_date);
      return { med, nextDose };
    })
    .filter(({ med, nextDose }) => {
      if (!med.frequency_hours || med.frequency_hours <= 0) return true;
      return nextDose !== null;
    })
    .sort((a, b) => {
      if (!a.nextDose && !b.nextDose) return 0;
      if (!a.nextDose) return 1;
      if (!b.nextDose) return -1;
      return a.nextDose.getTime() - b.nextDose.getTime();
    });

  const isLoading = medsLoading || upcomingLoading;

  const [carouselApi, setCarouselApi] = React.useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [slideCount, setSlideCount] = React.useState(0);

  React.useEffect(() => {
    if (!carouselApi) return;
    setSlideCount(carouselApi.scrollSnapList().length);
    setCurrentSlide(carouselApi.selectedScrollSnap());
    carouselApi.on("select", () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    });
  }, [carouselApi]);

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
          <h1 className="text-2xl font-bold text-foreground">Olá, {userName}!</h1>
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

      {/* Visão Geral */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
          <LayoutDashboard size={18} className="text-primary" />
          Visão Geral
        </h2>
        <Carousel
          setApi={setCarouselApi}
          opts={{ align: "start", loop: true }}
          plugins={[Autoplay({ delay: 4000, stopOnInteraction: true })]}
          className="w-full"
        >
          <CarouselContent className="-ml-2">
            <CarouselItem className="pl-2 basis-full">
              <Card
                className="border-border/50 cursor-pointer active:bg-accent/50 sm:hover:bg-accent/50 transition-colors"
                onClick={() => navigate('/medicamentos')}
              >
                <CardContent className="flex items-center justify-between w-full p-5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-primary/10">
                      <Pill className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-3xl font-bold text-foreground leading-none">{activeMeds.length}</span>
                      <span className="text-sm font-medium text-muted-foreground mt-1">Meds Ativos</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground/30" />
                </CardContent>
              </Card>
            </CarouselItem>
            <CarouselItem className="pl-2 basis-full">
              <Card
                className="border-border/50 cursor-pointer active:bg-accent/50 sm:hover:bg-accent/50 transition-colors"
                onClick={() => navigate('/agenda?filter=upcoming')}
              >
                <CardContent className="flex items-center justify-between w-full p-5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-secondary/10">
                      <Calendar className="w-6 h-6 text-secondary" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-3xl font-bold text-foreground leading-none">{upcoming.length}</span>
                      <span className="text-sm font-medium text-muted-foreground mt-1">Compromissos</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground/30" />
                </CardContent>
              </Card>
            </CarouselItem>
            <CarouselItem className="pl-2 basis-full">
              <Card
                className="border-border/50 cursor-pointer active:bg-accent/50 sm:hover:bg-accent/50 transition-colors"
                onClick={() => navigate('/agenda')}
              >
                <CardContent className="flex items-center justify-between w-full p-5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-primary/10">
                      <Stethoscope className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-3xl font-bold text-foreground leading-none">{pendingConsultations}</span>
                      <span className="text-sm font-medium text-muted-foreground mt-1">Consultas Pendentes</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground/30" />
                </CardContent>
              </Card>
            </CarouselItem>
            <CarouselItem className="pl-2 basis-full">
              <Card
                className="border-border/50 cursor-pointer active:bg-accent/50 sm:hover:bg-accent/50 transition-colors"
                onClick={() => navigate('/agenda')}
              >
                <CardContent className="flex items-center justify-between w-full p-5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-secondary/10">
                      <FileText className="w-6 h-6 text-secondary" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-3xl font-bold text-foreground leading-none">{pendingExams}</span>
                      <span className="text-sm font-medium text-muted-foreground mt-1">Exames Pendentes</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground/30" />
                </CardContent>
              </Card>
            </CarouselItem>
          </CarouselContent>
        </Carousel>
        <div className="flex justify-center gap-1.5 mt-3">
          {Array.from({ length: slideCount }).map((_, i) => (
            <button
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${i === currentSlide ? "bg-primary" : "bg-muted-foreground/30"}`}
              onClick={() => carouselApi?.scrollTo(i)}
            />
          ))}
        </div>
      </div>

      {/* Accordion Sections */}
      <Accordion type="multiple" defaultValue={["acoes-hoje"]}>
        {/* Today's Actions */}
        <AccordionItem value="acoes-hoje" id="acoes-hoje" className="border-b-0">
          <AccordionTrigger className="text-base font-semibold text-foreground hover:no-underline py-3">
            <span className="flex items-center gap-2">
              <Activity size={18} className="text-primary" />
              Ações de Hoje
            </span>
          </AccordionTrigger>
          <AccordionContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : medsWithNextDose.length === 0 ? (
              <Card className="border-border/50 bg-muted/30">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">Nenhum medicamento ativo no momento.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col space-y-2">
                {medsWithNextDose.slice(0, 5).map(({ med, nextDose }) => {
                  const isContinuous = !med.frequency_hours || med.frequency_hours <= 0;
                  const isValidNextDose = nextDose && !isNaN(nextDose.getTime());
                  const doseLabel = isValidNextDose
                    ? `Próxima dose: ${format(nextDose, "dd MMM 'às' HH:mm", { locale: ptBR })}`
                    : isContinuous
                      ? "Uso contínuo"
                      : "";

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
                        <p className="text-sm font-semibold text-foreground truncate">
                          {med.name}
                          {(() => {
                            const firstName = med.family_members?.name?.split(' ')[0];
                            return firstName ? <span className="font-normal text-muted-foreground"> · {firstName}</span> : null;
                          })()}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {med.dosage ?? ""}{doseLabel ? ` · ${doseLabel}` : ""}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Upcoming Appointments */}
        <AccordionItem value="proximos-compromissos" className="border-b-0">
          <AccordionTrigger className="text-base font-semibold text-foreground hover:no-underline py-3">
            <span className="flex items-center gap-2">
              <Calendar size={18} className="text-secondary" />
              Próximos Compromissos
            </span>
          </AccordionTrigger>
          <AccordionContent>
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default Home;
