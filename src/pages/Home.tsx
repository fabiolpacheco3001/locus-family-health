import { useNavigate } from "react-router-dom";
import { Bell, Pill, Stethoscope, FileText, Calendar, ChevronRight, Activity, LayoutDashboard, Users, Zap, Sun, Moon, Infinity } from "lucide-react";
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
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import MemberAvatar from "@/components/MemberAvatar";
import { format, startOfDay, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calculateNextDose } from "@/lib/calculateNextDose";

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userName = (user?.user_metadata?.full_name || "Usuário").split(' ')[0];
  const { members } = useFamilyMembers();
  const [quickAction, setQuickAction] = React.useState<'consultas' | 'exames' | 'medicamentos' | null>(null);

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
        .or("status.eq.Agendado,status.eq.Realizado,status.eq.Coletado");
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
          .or("status.eq.Agendado,and(status.eq.Realizado,result_date.not.is.null),and(status.eq.Coletado,result_date.not.is.null)")
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
        const isRealizado = e.status === "Realizado" || e.status === "Coletado";
        const displayDate = isRealizado ? e.result_date : e.exam_date;
        const overdue = e.status === "Agendado" && e.exam_date ? isBefore(new Date(e.exam_date), startOfDay(new Date())) : false;
        items.push({
          id: e.id,
          title: isRealizado ? `Buscar Resultado` : e.name,
          subtitle: isRealizado ? e.name : (e.location ?? "Exame"),
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
    <div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
      <div className="flex-1 overflow-y-auto no-scrollbar pb-4">
      {/* Header with gradient splash */}
      <div className="bg-gradient-to-b from-[#C4BFB3] to-[#f2f0eb] px-5 pt-6 pb-6 rounded-b-3xl mb-2">
      <div className="flex items-center justify-between mb-0">
        <div className="flex items-center gap-3">
          <div
            onClick={() => navigate('/meus-dados', { state: { from: '/home' } })}
            className="cursor-pointer transition-transform active:scale-95"
          >
            <MemberAvatar
              avatarUrl={members.find(m => m.relationship === 'Titular')?.avatar_url}
              name={userName}
              size="md"
            />
          </div>
          <div>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              {(() => {
                const h = new Date().getHours();
                const isDay = h >= 6 && h < 18;
                const greeting = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
                return (
                  <>
                    {greeting}
                    {isDay ? <Sun className="w-4 h-4 text-yellow-500 inline-block" /> : <Moon className="w-4 h-4 text-[#DCC5F1] inline-block" />}
                  </>
                );
              })()}
            </p>
            <h1 className="text-2xl font-bold text-foreground">Olá, {userName}!</h1>
          </div>
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
      </div>

      <div className="px-5">
      {/* Visão Geral */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
          <LayoutDashboard size={18} style={{ color: '#6A978F' }} />
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
                className="border-border/50 bg-[#6A978F] cursor-pointer active:bg-[#6A978F]/90 sm:hover:bg-[#6A978F]/90 transition-colors"
                onClick={() => navigate('/medicamentos')}
              >
                <CardContent className="flex items-center justify-between w-full py-3 px-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-[#A7D3CB]">
                      <Pill className="w-6 h-6 text-black" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-3xl font-bold text-black leading-none">{activeMeds.length}</span>
                      <span className="text-sm font-medium text-black mt-1">Tratamentos Ativos</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-black" />
                </CardContent>
              </Card>
            </CarouselItem>
            <CarouselItem className="pl-2 basis-full">
              <Card
                className="border-border/50 bg-[#6A978F] cursor-pointer active:bg-[#6A978F]/90 sm:hover:bg-[#6A978F]/90 transition-colors"
                onClick={() => navigate('/agenda?filter=upcoming')}
              >
                <CardContent className="flex items-center justify-between w-full py-3 px-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-[#A7D3CB]">
                      <Calendar className="w-6 h-6 text-black" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-3xl font-bold text-black leading-none">{upcoming.length}</span>
                      <span className="text-sm font-medium text-black mt-1">Compromissos</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-black" />
                </CardContent>
              </Card>
            </CarouselItem>
            <CarouselItem className="pl-2 basis-full">
              <Card
                className="border-border/50 bg-[#6A978F] cursor-pointer active:bg-[#6A978F]/90 sm:hover:bg-[#6A978F]/90 transition-colors"
                onClick={() => navigate('/agenda?filter=consultas')}
              >
                <CardContent className="flex items-center justify-between w-full py-3 px-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-[#A7D3CB]">
                      <Stethoscope className="w-6 h-6 text-black" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-3xl font-bold text-black leading-none">{pendingConsultations}</span>
                      <span className="text-sm font-medium text-black mt-1">Consultas Pendentes</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-black" />
                </CardContent>
              </Card>
            </CarouselItem>
            <CarouselItem className="pl-2 basis-full">
              <Card
                className="border-border/50 bg-[#6A978F] cursor-pointer active:bg-[#6A978F]/90 sm:hover:bg-[#6A978F]/90 transition-colors"
                onClick={() => navigate('/agenda?filter=exames')}
              >
                <CardContent className="flex items-center justify-between w-full py-3 px-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-[#A7D3CB]">
                      <FileText className="w-6 h-6 text-black" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-3xl font-bold text-black leading-none">{pendingExams}</span>
                      <span className="text-sm font-medium text-black mt-1">Exames Pendentes</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-black" />
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

      {/* Acesso Rápido */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
          <Zap size={18} style={{ color: '#6A978F' }} />
          Acesso Rápido
        </h2>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {[
            { icon: Stethoscope, label: "Consultas", action: () => setQuickAction('consultas') },
            { icon: FileText, label: "Exames", action: () => setQuickAction('exames') },
            { icon: Pill, label: "Medicamentos", action: () => setQuickAction('medicamentos') },
            { icon: Users, label: "Família", action: () => navigate('/familia') },
          ].map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              onClick={action}
              className="flex flex-col items-center justify-center p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:bg-slate-50 transition-colors active:scale-95"
            >
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3 bg-[#A7D3CB] text-black">
                <Icon className="w-6 h-6" />
              </div>
              <span className="text-sm font-semibold text-slate-700">
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Accordion Sections */}
      <Accordion type="multiple" defaultValue={["acoes-hoje"]}>
        {/* Today's Actions */}
        <AccordionItem value="acoes-hoje" id="acoes-hoje" className="border-b-0">
          <AccordionTrigger className="text-base font-semibold text-foreground hover:no-underline py-3">
            <span className="flex items-center gap-2">
              <Activity size={18} style={{ color: '#6A978F' }} />
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

                  let doseLabel = "";
                  if (isContinuous) {
                    if (med.start_date && med.start_time) {
                      const now = new Date();
                      const todayStr = format(now, "yyyy-MM-dd");
                      const todayDose = new Date(`${todayStr}T${med.start_time}`);
                      const tomorrowDose = new Date(`${format(new Date(now.getTime() + 86400000), "yyyy-MM-dd")}T${med.start_time}`);
                      const targetDose = todayDose > now ? todayDose : tomorrowDose;
                      if (!isNaN(targetDose.getTime())) {
                        doseLabel = `Próxima dose: ${format(targetDose, "dd MMM 'às' HH:mm", { locale: ptBR })}`;
                      }
                    }
                  } else if (isValidNextDose) {
                    doseLabel = `Próxima dose: ${format(nextDose, "dd MMM 'às' HH:mm", { locale: ptBR })}`;
                  }

                  return (
                    <button
                      key={med.id}
                      onClick={() => navigate(`/familiar/${med.family_member_id}/medicamentos`)}
                      className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/50 shadow-sm text-left active:bg-accent/50 sm:hover:bg-accent/50 transition-colors w-full"
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#A7D3CB] flex items-center justify-center shrink-0">
                        <Pill className="text-black" size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {med.name}
                          {(() => {
                            const firstName = med.family_members?.name?.split(' ')[0];
                            return firstName ? <span className="font-normal text-muted-foreground"> · {firstName}</span> : null;
                          })()}
                        </p>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-0">
                          <span>{med.dosage ?? ""}</span>
                          {isContinuous && <Infinity className="inline w-3 h-3 mx-1 text-muted-foreground shrink-0" />}
                          {doseLabel && <span>{isContinuous ? "" : " · "}{doseLabel}</span>}
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

        {/* Upcoming Appointments */}
        <AccordionItem value="proximos-compromissos" className="border-b-0">
          <AccordionTrigger className="text-base font-semibold text-foreground hover:no-underline py-3">
            <span className="flex items-center gap-2">
              <Calendar size={18} style={{ color: '#6A978F' }} />
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
                          <Badge className={`text-[10px] px-1.5 py-0 shrink-0 border-none ${isExam ? "bg-[#FFF4A3] text-black" : "bg-[#DCC5F1] text-black"}`}>
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
                      <ChevronRight size={16} className="text-black shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Drawer de seleção de familiar */}
      <Drawer open={!!quickAction} onOpenChange={(open) => !open && setQuickAction(null)}>
        <DrawerContent className="flex flex-col max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>
              {quickAction === 'consultas' && 'Para quem é a consulta?'}
              {quickAction === 'exames' && 'Para quem é o exame?'}
              {quickAction === 'medicamentos' && 'Para quem é o medicamento?'}
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 space-y-2">
            {(() => {
              const ordemParentesco: Record<string, number> = {
                "Titular": 1, "Cônjuge": 2, "Filho(a)": 3, "Pai/Mãe": 4, "Irmão(ã)": 5, "Outro": 6,
              };
              return [...members].sort((a, b) => {
                const pesoA = ordemParentesco[a.relationship] || 99;
                const pesoB = ordemParentesco[b.relationship] || 99;
                return pesoA - pesoB;
              }).map((member) => (
                <button
                  key={member.id}
                  onClick={() => {
                    setQuickAction(null);
                    navigate(`/familiar/${member.id}/${quickAction}`, { state: { from: '/home' } });
                  }}
                  className="flex items-center gap-3 w-full h-14 px-4 bg-card rounded-xl border border-border/50 shadow-sm text-left active:bg-accent/50 sm:hover:bg-accent/50 transition-colors"
                >
                  <MemberAvatar avatarUrl={member.avatar_url} name={member.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-black truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.relationship}</p>
                  </div>
                  <ChevronRight size={16} className="text-black shrink-0" />
                </button>
              ));
            })()}
            {members.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum familiar cadastrado.
              </p>
            )}
          </div>
        </DrawerContent>
      </Drawer>
      </div>
      </div>
    </div>
  );
};

export default Home;
