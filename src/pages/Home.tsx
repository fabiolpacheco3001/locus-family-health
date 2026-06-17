/**
 * Home — Shell de composição.
 * Lógica de dados: useHomeData | Sub-componentes: src/components/home/
 * Refatorado em M3 (de 849 LOC → ~100 LOC).
 */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Stethoscope, FileText, Pill, Users, Zap } from "lucide-react";
import { Accordion } from "@/components/ui/accordion";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { useNotifications } from "@/hooks/useNotifications";
import { useHomeData } from "@/hooks/useHomeData";
import { HomeHeader } from "@/components/home/HomeHeader";
import { OverviewCarousel } from "@/components/home/OverviewCarousel";
import { TodayMedicationsSection } from "@/components/home/TodayMedicationsSection";
import { UpcomingAppointmentsSection } from "@/components/home/UpcomingAppointmentsSection";
import { FamilySelectDrawer } from "@/components/home/FamilySelectDrawer";

type QuickAction = "consultas" | "exames" | "medicamentos";

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userName = (user?.user_metadata?.full_name || "Usuário").split(" ")[0];

  const { members, isLoading: membersLoading } = useFamilyMembers();
  const { isAdmin, linkedMemberId, managedProfiles, role } = useFamilyGroup();
  const { unreadCount } = useNotifications();

  const {
    activeMeds,
    medsLoading,
    totalOpenAppointments,
    pendingConsultations,
    pendingExams,
    upcoming,
    upcomingLoading,
    todayPetRoutines,
    medsWithNextDose,
  } = useHomeData();

  const myProfile = members.find((m) => m.id === linkedMemberId) ?? null;

  const [quickAction, setQuickAction] = React.useState<QuickAction | null>(null);
  const [showAllActions, setShowAllActions] = React.useState(false);

  const getFilteredMembers = () => {
    const allowedIds =
      role === "user" && linkedMemberId ? [linkedMemberId, ...managedProfiles] : null;
    return allowedIds ? members.filter((m) => allowedIds.includes(m.id)) : members;
  };

  const handleQuickAction = (action: QuickAction) => {
    const filtered = getFilteredMembers();
    if (filtered.length === 1) {
      navigate(`/familiar/${filtered[0].id}/${action}`, { state: { from: "/home" } });
    } else {
      setQuickAction(action);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
      <div className="flex-1 overflow-y-auto no-scrollbar pb-4">
        {/* Cabeçalho */}
        <HomeHeader userName={userName} myProfile={myProfile} unreadCount={unreadCount} />

        {/* Bloco escuro superior */}
        <div className="bg-[#1C3333] pt-6 pb-16 px-5 rounded-b-[2.5rem]">
          <OverviewCarousel
            activeMedsCount={activeMeds.length}
            totalOpenAppointments={totalOpenAppointments}
            pendingConsultations={pendingConsultations}
            pendingExams={pendingExams}
          />
          <h2 className="text-base font-semibold text-white flex items-center gap-2 mt-4 mb-0">
            <Zap size={18} className="text-[#A7D3CB]" />
            Acesso Rápido
          </h2>
        </div>

        {/* Conteúdo flutuante */}
        <div className="px-5 -mt-[3.5rem] relative z-10 space-y-6">
          {/* Acesso Rápido */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Stethoscope, label: "Consultas", action: () => handleQuickAction("consultas") },
              { icon: FileText,    label: "Exames",    action: () => handleQuickAction("exames") },
              { icon: Pill,        label: "Medicamentos", action: () => handleQuickAction("medicamentos") },
              { icon: Users,       label: "Família",   action: () => navigate("/gerenciar-familia", { state: { from: "/home" } }) },
            ].map(({ icon: Icon, label, action }) => (
              <button
                key={label}
                onClick={action}
                className="flex flex-col items-center justify-center p-4 bg-white border border-slate-100 rounded-2xl shadow-xs hover:bg-slate-50 transition-colors active:scale-95"
              >
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3 bg-[#A7D3CB] text-black">
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-sm font-semibold text-slate-700">{label}</span>
              </button>
            ))}
          </div>

          {/* Seções em accordion */}
          <Accordion type="multiple">
            <TodayMedicationsSection
              medsLoading={medsLoading}
              medsWithNextDose={medsWithNextDose}
              todayPetRoutines={todayPetRoutines}
              showAllActions={showAllActions}
              setShowAllActions={setShowAllActions}
            />
            <UpcomingAppointmentsSection
              upcomingLoading={upcomingLoading}
              upcoming={upcoming}
            />
          </Accordion>
        </div>
      </div>

      {/* Drawer de seleção de familiar */}
      <FamilySelectDrawer
        quickAction={quickAction}
        setQuickAction={setQuickAction}
        members={members}
        membersLoading={membersLoading}
        role={role}
        linkedMemberId={linkedMemberId}
        managedProfiles={managedProfiles}
      />
    </div>
  );
};

export default Home;
