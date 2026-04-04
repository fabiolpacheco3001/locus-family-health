import { useNavigate } from "react-router-dom";
import { Bell, Pill, Stethoscope, FileText, Calendar, ChevronRight, Activity, LayoutDashboard, Users, Zap, Sun, Moon, Infinity, PawPrint, Search, HelpCircle } from "lucide-react";
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
import { sortFamilyMembers } from "@/lib/sortFamilyMembers";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import MemberAvatar from "@/components/MemberAvatar";
import { MedicationDoseActions } from "@/components/agenda/MedicationDoseActions";

import { toast } from "sonner";
import { format, startOfDay, startOfYesterday, isBefore, isToday, isYesterday, isPast } from "date-fns";
import { AlertCircle } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { calculateNextDose } from "@/lib/calculateNextDose";
import { parseDateInSP, toSPTime } from "@/lib/dateUtils";

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userName = (user?.user_metadata?.full_name || "Usuário").split(' ')[0];
  const { members, isLoading: membersLoading } = useFamilyMembers();
  const { groupId, isAdmin, linkedMemberId, managedProfiles, role } = useFamilyGroup();
  const [quickAction, setQuickAction] = React.useState<'consultas' | 'exames' | 'medicamentos' | null>(null);
  const [showAllActions, setShowAllActions] = React.useState(false);
  const DISPLAY_LIMIT = 4;

  const getFilteredMembers = () => {
    const allowedIds = role === "user" && linkedMemberId
      ? [linkedMemberId, ...managedProfiles]
      : null;
    return allowedIds
      ? members.filter(m => allowedIds.includes(m.id))
      : members;
  };

  const handleQuickAction = (action: 'consultas' | 'exames' | 'medicamentos') => {
    const filtered = getFilteredMembers();
    if (filtered.length === 1) {
      navigate(`/familiar/${filtered[0].id}/${action}`, { state: { from: '/home' } });
    } else {
      setQuickAction(action);
    }
  };
  

  const myProfile = members.find((m) => m.id === linkedMemberId) ?? null;

  // All active medications across family
  const { medications, isLoading: medsLoading } = useMedications();
  const activeMeds = medications.filter((m) => m.status === "Ativo");

  // Unread notifications count
  const { unreadCount } = useNotifications();

  // Upcoming appointments (2 nearest consultations + exams)
  // Pending counts (consolidated single query)
  const { data: pendingCounts } = useQuery({
    queryKey: ["pending-counts", groupId, isAdmin, linkedMemberId, managedProfiles],
    queryFn: async () => {
      let cq = supabase.from("consultations").select("id", { count: "exact", head: true }).eq("status", "Agendada");
      let eq = supabase.from("exams").select("id", { count: "exact", head: true }).eq("status", "Agendado");
      let pq = supabase.from("pet_routines").select("id", { count: "exact", head: true }).eq("status", "Agendado");

      if (isAdmin && groupId) {
        // Don't filter by group_id (may be null on old rows); RLS handles access
      } else if (linkedMemberId) {
        const allowedIds = [linkedMemberId, ...(managedProfiles ?? [])];
        cq = cq.in("family_member_id", allowedIds);
        eq = eq.in("family_member_id", allowedIds);
        pq = pq.in("family_member_id", allowedIds);
      } else {
        cq = cq.eq("user_id", user!.id);
        eq = eq.eq("user_id", user!.id);
        pq = pq.eq("user_id", user!.id);
      }

      const [consultRes, examRes, petRes] = await Promise.all([cq, eq, pq]);
      if (consultRes.error) throw consultRes.error;
      if (examRes.error) throw examRes.error;
      if (petRes.error) throw petRes.error;
      return { consultations: consultRes.count ?? 0, exams: examRes.count ?? 0, petRoutines: petRes.count ?? 0 };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
  const pendingConsultations = pendingCounts?.consultations ?? 0;
  const pendingExams = pendingCounts?.exams ?? 0;

  // Derived: total open appointments
  const totalOpenAppointments = pendingConsultations + pendingExams + (pendingCounts?.petRoutines ?? 0);

  const { data: upcoming = [], isLoading: upcomingLoading } = useQuery({
    queryKey: ["upcoming-appointments", groupId, isAdmin, linkedMemberId, managedProfiles],
    queryFn: async () => {
      let cq = supabase
        .from("consultations")
        .select("id, family_member_id, specialty, professional_name, consultation_date, type, status, family_members(name, member_type)")
        .in("status", ["Agendada"])
        .order("consultation_date", { ascending: true })
        .limit(5);

      let eq = supabase
        .from("exams")
        .select("id, family_member_id, name, exam_date, location, status, result_date, family_members(name, member_type)")
        .or("status.eq.Agendado,and(status.eq.Realizado,result_date.not.is.null),and(status.eq.Coletado,result_date.not.is.null)")
        .order("exam_date", { ascending: true })
        .limit(5);

      let pq = supabase
        .from("pet_routines")
        .select("id, family_member_id, routine_type, date_performed, status, recurrence, notes, family_members(name, member_type)")
        .eq("status", "Agendado")
        .order("date_performed", { ascending: true })
        .limit(5);

      if (isAdmin && groupId) {
        // Don't filter by group_id (may be null on old rows); RLS handles access
      } else if (linkedMemberId) {
        const allowedIds = [linkedMemberId, ...(managedProfiles ?? [])];
        cq = cq.in("family_member_id", allowedIds);
        eq = eq.in("family_member_id", allowedIds);
        pq = pq.in("family_member_id", allowedIds);
      } else {
        cq = cq.eq("user_id", user!.id);
        eq = eq.eq("user_id", user!.id);
        pq = pq.eq("user_id", user!.id);
      }

      const [consultRes, examRes, petRes] = await Promise.all([cq, eq, pq]);

      const items: Array<{
        id: string;
        title: string;
        subtitle: string;
        date: string | null;
        memberName: string;
        kind: "consultation" | "exam" | "pet_routine";
        familyMemberId: string;
        isOverdue: boolean;
        consultationType?: string | null;
        isPet: boolean;
      }> = [];

      const now = new Date();
      (consultRes.data ?? []).forEach((c: any) => {
        const dateStr = c.consultation_date;
        if (dateStr && new Date(dateStr) <= now) return;
        items.push({
          id: c.id,
          title: c.specialty,
          subtitle: c.professional_name ? `com ${c.professional_name}` : "Consulta",
          date: dateStr,
          memberName: c.family_members?.name ?? "Usuário",
          kind: "consultation",
          familyMemberId: c.family_member_id,
          isOverdue: false,
          consultationType: c.type,
          isPet: (c.family_members?.member_type || "human") === "pet",
        });
      });

      (examRes.data ?? []).forEach((e: any) => {
        const isRealizado = e.status === "Realizado" || e.status === "Coletado";
        const displayDate = isRealizado ? e.result_date : e.exam_date;
        if (e.status === "Agendado" && e.exam_date && isBefore(new Date(e.exam_date), startOfDay(now))) return;
        items.push({
          id: e.id,
          title: isRealizado ? `Buscar Resultado` : e.name,
          subtitle: isRealizado ? e.name : (e.location ?? "Exame"),
          date: displayDate,
          memberName: e.family_members?.name ?? "Usuário",
          kind: "exam",
          familyMemberId: e.family_member_id,
          isOverdue: false,
          isPet: (e.family_members?.member_type || "human") === "pet",
        });
      });

      (petRes.data ?? []).forEach((p: any) => {
        const dateStr = p.date_performed;
        if (dateStr && isBefore(parseDateInSP(dateStr) ?? new Date(), startOfDay(now))) return;
        items.push({
          id: p.id,
          title: p.routine_type,
          subtitle: p.notes || "Rotina Pet",
          date: dateStr,
          memberName: p.family_members?.name ?? "Pet",
          kind: "pet_routine",
          familyMemberId: p.family_member_id,
          isOverdue: false,
          isPet: true,
        });
      });

      items.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      return items.slice(0, 5);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Pet routines for today (Ações de Hoje)
  const { data: todayPetRoutines = [] } = useQuery({
    queryKey: ["today-pet-routines", groupId, isAdmin, linkedMemberId, managedProfiles],
    queryFn: async () => {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      let pq = supabase
        .from("pet_routines")
        .select("id, family_member_id, routine_type, date_performed, status, notes, family_members(name, member_type)")
        .eq("date_performed", todayStr)
        .eq("status", "Agendado");

      if (isAdmin && groupId) {
        // no group_id on pet_routines, rely on RLS
      } else if (linkedMemberId) {
        const allowedIds = [linkedMemberId, ...(managedProfiles ?? [])];
        pq = pq.in("family_member_id", allowedIds);
      } else {
        pq = pq.eq("user_id", user!.id);
      }

      const { data, error } = await pq;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch dose statuses for all active meds (must be before useMemo that depends on it)
  const activeMedIds = React.useMemo(() => activeMeds.map(m => m.id), [activeMeds]);
  const { data: homeDoseStatuses = {} } = useQuery({
    queryKey: ["medication_doses_home", activeMedIds],
    queryFn: async () => {
      if (activeMedIds.length === 0) return {};
      const { data, error } = await supabase
        .from("medication_doses")
        .select("medication_id, scheduled_for, status")
        .in("medication_id", activeMedIds);
      if (error) throw error;
      const map: Record<string, "taken" | "skipped"> = {};
      for (const d of (data ?? []) as any[]) {
        const key = `${d.medication_id}-${new Date(d.scheduled_for).toISOString()}`;
        map[key] = d.status;
      }
      return map;
    },
    enabled: activeMedIds.length > 0,
    staleTime: 30 * 1000,
  });

  // Build list of active meds with their effective next dose (pre-computed for correct sorting)
  const medsWithNextDose = React.useMemo(() => {
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");

    return activeMeds
      .map((med) => {
        const isContinuous = !med.frequency_hours || med.frequency_hours <= 0;
        const dateOnly = med.start_date?.slice(0, 10);
        let startDateISO: string | null = null;
        if (dateOnly && med.start_time) {
          startDateISO = `${dateOnly}T${med.start_time}`;
        } else if (dateOnly) {
          startDateISO = dateOnly;
        }

        let effectiveScheduledFor: string | null = null;
        let doseLabel = "";

        if (isContinuous) {
          if (med.start_date && med.start_time) {
            let targetDose = new Date(`${todayStr}T${med.start_time}`);
            let advanceLimit = 50;
            while (advanceLimit > 0) {
              const key = `${med.id}-${targetDose.toISOString()}`;
              if (!homeDoseStatuses[key]) break;
              targetDose = new Date(targetDose.getTime() + 24 * 60 * 60 * 1000);
              advanceLimit--;
            }
            if (!isNaN(targetDose.getTime())) {
              effectiveScheduledFor = targetDose.toISOString();
              doseLabel = `Próxima dose: ${format(toSPTime(targetDose), "dd MMM 'às' HH:mm", { locale: ptBR })}`;
            }
          }
        } else {
          const nextDose = calculateNextDose(startDateISO, med.frequency_hours, med.end_date, startOfYesterday());
          if (nextDose && !isNaN(nextDose.getTime())) {
            let candidate = new Date(nextDose.getTime());
            let advanceLimit = 50;
            while (advanceLimit > 0 && med.frequency_hours && med.frequency_hours > 0) {
              const key = `${med.id}-${candidate.toISOString()}`;
              if (!homeDoseStatuses[key]) break;
              candidate = new Date(candidate.getTime() + med.frequency_hours * 60 * 60 * 1000);
              advanceLimit--;
            }
            if (med.end_date) {
              const endStr = med.end_date.length === 10 ? med.end_date + "T23:59:59" : med.end_date;
              const endDt = parseDateInSP(endStr);
              if (endDt && candidate > endDt) {
                effectiveScheduledFor = null;
              } else {
                effectiveScheduledFor = candidate.toISOString();
                doseLabel = `Próxima dose: ${format(toSPTime(candidate), "dd MMM 'às' HH:mm", { locale: ptBR })}`;
              }
            } else {
              effectiveScheduledFor = candidate.toISOString();
              doseLabel = `Próxima dose: ${format(toSPTime(candidate), "dd MMM 'às' HH:mm", { locale: ptBR })}`;
            }
          }
        }

        const effectiveDate = effectiveScheduledFor ? new Date(effectiveScheduledFor) : null;
        const isOverdue = effectiveDate ? isPast(effectiveDate) : false;
        const doseKey = effectiveScheduledFor ? `${med.id}-${effectiveScheduledFor}` : null;
        const doseStatus: "taken" | "skipped" | null = doseKey ? (homeDoseStatuses[doseKey] ?? null) : null;

        return { med, effectiveScheduledFor, doseLabel, isOverdue, doseStatus, isContinuous };
      })
      .filter(({ effectiveScheduledFor, isContinuous }) => {
        if (isContinuous) return true;
        if (!effectiveScheduledFor) return false;
        const d = new Date(effectiveScheduledFor);
        return isToday(d) || isYesterday(d) || d > now;
      })
      .sort((a, b) => {
        if (!a.effectiveScheduledFor && !b.effectiveScheduledFor) return 0;
        if (!a.effectiveScheduledFor) return 1;
        if (!b.effectiveScheduledFor) return -1;
        return new Date(a.effectiveScheduledFor).getTime() - new Date(b.effectiveScheduledFor).getTime();
      });
  }, [activeMeds, homeDoseStatuses]);

  // Progressive rendering: each section uses its own loading state

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
      {/* Sticky Header Escuro */}
      <div className="sticky top-0 z-40 w-full bg-[#1C3333] px-5 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              onClick={() => navigate('/meus-dados', { state: { from: '/home' } })}
              className="cursor-pointer transition-transform active:scale-95"
            >
              <MemberAvatar
                avatarUrl={myProfile?.avatar_url}
                name={userName}
                size="md"
                memberType={myProfile?.member_type}
              />
            </div>
            <div>
              <p className="text-sm text-white/70 flex items-center gap-1">
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
              <h1 className="text-2xl font-bold text-white">Olá, {userName}!</h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => toast.info("Em breve: Busque funcionalidades ou agende compromissos via Chat Conversacional com IA!")}
              className="p-2 rounded-full hover:bg-white/10 active:bg-white/10 transition-colors"
            >
              <Search size={22} className="text-white" />
            </button>
            <button
              onClick={() => navigate("/ajuda")}
              className="p-2 rounded-full hover:bg-white/10 active:bg-white/10 transition-colors"
            >
              <HelpCircle size={22} className="text-white" />
            </button>
            <button
              onClick={() => navigate("/notificacoes", { state: { from: "/home" } })}
              className="relative p-2 rounded-full hover:bg-white/10 active:bg-white/10 transition-colors"
            >
              <Bell size={22} className="text-white" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-[#1C3333]" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Color Block do Topo (continuação) */}
      <div className="bg-[#1C3333] pt-6 pb-16 px-5 rounded-b-[2.5rem]">

        {/* Visão Geral */}
        <div>
          <h2 className="text-base font-semibold text-white/90 flex items-center gap-2 mb-3">
            <LayoutDashboard size={18} className="text-[#A7D3CB]" />
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
                  className="bg-white/10 backdrop-blur-md border border-white/20 cursor-pointer active:bg-white/15 sm:hover:bg-white/15 transition-colors rounded-2xl shadow-sm"
                  onClick={() => navigate('/medicamentos')}
                >
                  <CardContent className="flex items-center justify-between w-full py-3 px-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                        <Pill className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-3xl font-bold text-white leading-none">{activeMeds.length}</span>
                        <span className="text-sm font-medium text-white/80 mt-1">Medicamentos Ativos</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/60" />
                  </CardContent>
                </Card>
              </CarouselItem>
              <CarouselItem className="pl-2 basis-full">
                <Card
                  className="bg-white/10 backdrop-blur-md border border-white/20 cursor-pointer active:bg-white/15 sm:hover:bg-white/15 transition-colors rounded-2xl shadow-sm"
                  onClick={() => navigate('/agenda?filter=upcoming')}
                >
                  <CardContent className="flex items-center justify-between w-full py-3 px-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-3xl font-bold text-white leading-none">{totalOpenAppointments}</span>
                        <span className="text-sm font-medium text-white/80 mt-1">Compromissos</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/60" />
                  </CardContent>
                </Card>
              </CarouselItem>
              <CarouselItem className="pl-2 basis-full">
                <Card
                  className="bg-white/10 backdrop-blur-md border border-white/20 cursor-pointer active:bg-white/15 sm:hover:bg-white/15 transition-colors rounded-2xl shadow-sm"
                  onClick={() => navigate('/agenda?filter=consultas')}
                >
                  <CardContent className="flex items-center justify-between w-full py-3 px-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                        <Stethoscope className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-3xl font-bold text-white leading-none">{pendingConsultations}</span>
                        <span className="text-sm font-medium text-white/80 mt-1">Consultas Pendentes</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/60" />
                  </CardContent>
                </Card>
              </CarouselItem>
              <CarouselItem className="pl-2 basis-full">
                <Card
                  className="bg-white/10 backdrop-blur-md border border-white/20 cursor-pointer active:bg-white/15 sm:hover:bg-white/15 transition-colors rounded-2xl shadow-sm"
                  onClick={() => navigate('/agenda?filter=exames')}
                >
                  <CardContent className="flex items-center justify-between w-full py-3 px-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-3xl font-bold text-white leading-none">{pendingExams}</span>
                        <span className="text-sm font-medium text-white/80 mt-1">Exames Pendentes</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/60" />
                  </CardContent>
                </Card>
              </CarouselItem>
            </CarouselContent>
          </Carousel>
          <div className="flex justify-center gap-1.5 mt-3">
            {Array.from({ length: slideCount }).map((_, i) => (
              <button
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${i === currentSlide ? "bg-white" : "bg-white/30"}`}
                onClick={() => carouselApi?.scrollTo(i)}
              />
            ))}
          </div>
        </div>
        {/* Acesso Rápido - título dentro do bloco escuro */}
        <h2 className="text-base font-semibold text-white flex items-center gap-2 mt-4 mb-0">
          <Zap size={18} className="text-[#A7D3CB]" />
          Acesso Rápido
        </h2>
      </div>

      {/* Conteúdo flutuante */}
      <div className="px-5 -mt-[3.5rem] relative z-10 space-y-6">

      {/* Acesso Rápido - Cards */}
      <div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Stethoscope, label: "Consultas", key: 'consultas' as const },
            { icon: FileText, label: "Exames", key: 'exames' as const },
            { icon: Pill, label: "Medicamentos", key: 'medicamentos' as const },
            { icon: Users, label: "Família", key: null },
          ].map(({ icon: Icon, label, key }) => {
            const action = key === null
              ? () => navigate('/gerenciar-familia', { state: { from: '/home' } })
              : () => handleQuickAction(key);
            return (
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
            );
          })}
        </div>
      </div>

      {/* Accordion Sections */}
      <Accordion type="multiple">
        {/* Today's Actions */}
        <AccordionItem value="acoes-hoje" id="acoes-hoje" className="border-b-0">
          <AccordionTrigger className="text-base font-semibold text-foreground hover:no-underline py-3">
            <span className="flex items-center gap-2">
              <Pill size={18} style={{ color: '#6A978F' }} />
              Ações Medicamentosas
            </span>
          </AccordionTrigger>
          <AccordionContent>
            {medsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : medsWithNextDose.length === 0 && todayPetRoutines.length === 0 ? (
              <Card className="border-border/50 bg-muted/30">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">Nenhuma ação para hoje.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col space-y-2">
                {/* Pet routines for today */}
                {todayPetRoutines.map((p: any) => (
                  <button
                    key={`pet-${p.id}`}
                    onClick={() => navigate(`/familiar/${p.family_member_id}/rotinas-pet`, { state: { from: "/home" } })}
                    className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/50 shadow-sm text-left active:bg-accent/50 sm:hover:bg-accent/50 transition-colors w-full"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#A7D3CB] flex items-center justify-center shrink-0">
                      <PawPrint className="text-black" size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {p.routine_type}
                        <span className="font-normal text-muted-foreground"> · {p.family_members?.name ?? "Pet"} 🐾</span>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">Rotina agendada para hoje</p>
                    </div>
                    <ChevronRight size={16} className="text-black shrink-0" />
                  </button>
                ))}
                {/* Medications */}
                {(showAllActions ? medsWithNextDose : medsWithNextDose.slice(0, DISPLAY_LIMIT)).map(({ med, effectiveScheduledFor, doseLabel, isOverdue, doseStatus, isContinuous }) => (
                    <div
                      key={med.id}
                      className="flex flex-col p-3 bg-card rounded-xl border border-border/50 shadow-sm text-left w-full"
                    >
                      <button
                        onClick={() => navigate(`/familiar/${med.family_member_id}/medicamentos`)}
                        className="flex items-center gap-3 active:bg-accent/50 sm:hover:bg-accent/50 transition-colors w-full rounded-lg"
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
                          <p className="text-xs text-muted-foreground truncate">
                            <span>{med.dosage ?? ""}</span>
                            {isContinuous && <Infinity className="inline w-3 h-3 mx-1 text-muted-foreground shrink-0" />}
                            {doseLabel && <span>{isContinuous ? "" : " · "}{doseLabel}</span>}
                          </p>
                        </div>
                        <ChevronRight size={16} className="text-black shrink-0" />
                      </button>
                      {effectiveScheduledFor && (
                         <div className="flex w-full items-center justify-between mt-4 pt-3 border-t border-border/30">
                           <div className="flex items-center justify-start h-full">
                            {!doseStatus && isOverdue && (
                              <Badge className="bg-destructive text-destructive-foreground border-destructive text-[10px] font-bold px-2 py-0.5 h-fit self-center flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Atrasado
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <MedicationDoseActions
                              medicationId={med.id}
                              scheduledFor={effectiveScheduledFor}
                              doseStatus={doseStatus}
                              frequencyHours={med.frequency_hours}
                              endDate={med.end_date}
                              usoContinuo={med.uso_continuo}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                {medsWithNextDose.length > DISPLAY_LIMIT && (
                  <button
                    onClick={() => setShowAllActions(prev => !prev)}
                    className="w-full py-2.5 text-sm font-medium text-primary hover:text-primary/80 active:text-primary/60 transition-colors rounded-xl border border-border/50 bg-card"
                  >
                    {showAllActions ? "Ocultar Ações" : "Ver mais Ações"}
                  </button>
                )}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Upcoming Appointments */}
        <AccordionItem value="proximos-compromissos" className="border-b-0">
          <AccordionTrigger className="text-base font-semibold text-foreground hover:no-underline py-3">
            <span className="flex items-center gap-2">
              <Calendar size={18} style={{ color: '#6A978F' }} />
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
                          <Badge className={`text-[10px] px-1.5 py-0 shrink-0 border-none ${
                            isPetRoutine
                              ? "bg-[#A7D3CB]/30 text-[#1C3333]"
                              : isExam
                              ? "bg-[#FFF4A3] text-black"
                              : item.consultationType === "Retorno"
                              ? "bg-[#A0C4D7] text-slate-800"
                              : item.consultationType === "Emergência"
                              ? "bg-[#F87171] text-white"
                              : "bg-[#DCC5F1] text-black"
                          }`}>
                            {isPetRoutine ? "Rotina Pet" : isExam ? "Exame" : item.consultationType === "Retorno" ? "Retorno" : item.consultationType === "Emergência" ? "Emergência" : "Consulta"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.date
                            ? format(
                                toSPTime(item.date.length === 10 ? (parseDateInSP(item.date) ?? new Date()) : new Date(item.date)),
                                "dd MMM · HH:mm",
                                { locale: ptBR }
                              )
                            : "Sem data"}{" "}
                          — {item.memberName}{item.isPet ? " 🐾" : ""}
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
      </div>

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
              const allowedIds = role === "user" && linkedMemberId
                ? [linkedMemberId, ...managedProfiles]
                : null;
              const filtered = allowedIds
                ? members.filter(m => allowedIds.includes(m.id))
                : members;
              return sortFamilyMembers(filtered).map((member) => (
                <button
                  key={member.id}
                  onClick={() => {
                    setQuickAction(null);
                    navigate(`/familiar/${member.id}/${quickAction}`, { state: { from: '/home' } });
                  }}
                  className="flex items-center gap-3 w-full h-14 px-4 bg-card rounded-xl border border-border/50 shadow-sm text-left active:bg-accent/50 sm:hover:bg-accent/50 transition-colors"
                >
                  <MemberAvatar avatarUrl={member.avatar_url} name={member.name} size="sm" memberType={member.member_type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-black truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.relationship}</p>
                  </div>
                  <ChevronRight size={16} className="text-black shrink-0" />
                </button>
              ));
            })()}
            {membersLoading && members.length === 0 && (
              <div className="space-y-3 py-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 h-14 px-4 bg-card rounded-xl border border-border/50">
                    <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!membersLoading && members.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum usuário cadastrado.
              </p>
            )}
          </div>
        </DrawerContent>
      </Drawer>
      </div>
      
    </div>
  );
};

export default Home;
