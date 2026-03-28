import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useSmartBack from "@/hooks/useSmartBack";
import {
  ArrowLeft,
  Stethoscope,
  Pill,
  FileText,
  AlertCircle,
  HeartPulse,
  ShieldAlert,
  UserCircle,
  Ban,
  Droplets,
  PawPrint,
  Syringe,
  Activity,
  Droplet,
  Weight,
  Ruler,
  Calculator,
  Dumbbell,
  LineChart,
  ShowerHead,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import MemberAvatar from "@/components/MemberAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import EditMemberDrawer from "@/components/EditMemberDrawer";
import AtualizarMedidasDrawer from "@/components/AtualizarMedidasDrawer";

import BloodPressureHistoryDrawer from "@/components/BloodPressureHistoryDrawer";
import MenstrualCycleDrawer, { getCycleDay } from "@/components/MenstrualCycleDrawer";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { toast } from "sonner";
import type { FamilyMember } from "@/hooks/useFamilyMembers";

const calculateAge = (birthDate: string | null): number | null => {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

type CardItem = {
  icon: React.ElementType;
  label: string;
  subtitle: string;
  route: string;
};

const gestaoItems: CardItem[] = [
  { icon: Stethoscope, label: "Consultas", subtitle: "Histórico e agendamentos", route: "consultas" },
  { icon: Pill, label: "Medicamentos", subtitle: "Receitas e alarmes", route: "medicamentos" },
  { icon: FileText, label: "Exames", subtitle: "Resultados e pedidos", route: "exames" },
];

type ProfileCard = {
  icon: React.ElementType;
  label: string;
  value: string;
  route?: string;
  action?: string;
};

const FamiliarProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const goBack = useSmartBack();
  const { user } = useAuth();
  const { isAdmin, linkedMemberId, managedProfiles, isLoading: groupLoading } = useFamilyGroup();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (groupLoading) return;
    if (!isAdmin && id) {
      const allowedIds = [linkedMemberId, ...(managedProfiles ?? [])].filter(Boolean);
      if (!allowedIds.includes(id)) {
        toast.error("Acesso negado");
        navigate("/home", { replace: true });
      }
    }
  }, [groupLoading, isAdmin, id, linkedMemberId, managedProfiles, navigate]);
  const [editOpen, setEditOpen] = useState(false);
  const [medidasOpen, setMedidasOpen] = useState(false);
  const [bpOpen, setBpOpen] = useState(false);
  const [cycleOpen, setCycleOpen] = useState(false);

  // Try cache first, fallback to individual query
  const { data: member, isLoading, error } = useQuery({
    queryKey: ["family_member", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as (FamilyMember & { tracks_menstrual_cycle?: boolean }) | null;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    initialData: () => {
      // Reuse cached family_members list to avoid redundant fetch
      if (!user) return undefined;
      const cached = queryClient.getQueryData<FamilyMember[]>(["family_members", user.id]);
      const found = cached?.find((m) => m.id === id);
      return found ? (found as FamilyMember & { tracks_menstrual_cycle?: boolean }) : undefined;
    },
  });

  if (!isLoading && (error || !member)) {
    return (
      <div className="px-4 pt-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft size={22} />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Minha Saúde</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="text-destructive" size={28} />
          </div>
          <p className="text-foreground font-semibold mb-1"><p className="text-foreground font-semibold mb-1">Usuário não encontrado</p></p>
          <p className="text-muted-foreground text-sm mb-6">Este perfil pode ter sido removido ou você não tem acesso.</p>
          <Button onClick={() => navigate("/home")}>Voltar para Home</Button>
        </div>
      </div>
    );
  }

  const isPet = (member?.member_type || "human") === "pet";
  const age = member ? calculateAge(member.birth_date) : null;
  const infoParts: string[] = [];
  if (age !== null) infoParts.push(isPet ? `${age} anos` : `${age} anos`);
  if (!isPet && member?.blood_type) infoParts.push(`Sangue ${member.blood_type}`);
  if (isPet && member?.species) infoParts.push(member.species);
  if (isPet && member?.breed) infoParts.push(member.breed);
  const infoLine = infoParts.join(" • ");

  const tracksCycle = !isPet && !!member?.tracks_menstrual_cycle;

  // Build info items conditionally
  const infoItems: CardItem[] = [
    { icon: Ban, label: "Alergias", subtitle: "Acesse e cadastre", route: "alergias" },
    ...(!isPet ? [{ icon: HeartPulse, label: "Pressão Arterial", subtitle: "Histórico de PA", route: "__bp__" }] : []),
    { icon: Syringe, label: "Vacinas", subtitle: "Carteira de vacinação", route: "vacinas" },
    { icon: Activity, label: "Diagnósticos Ativos", subtitle: "Histórico clínico", route: "doencas" },
    ...(tracksCycle ? [{ icon: Droplets, label: "Ciclo Menstrual", subtitle: "Controle do ciclo", route: "__cycle__" }] : []),
  ];

  const memberWeight = (member as any)?.weight as number | null ?? null;
  const memberHeight = (member as any)?.height as number | null ?? null;
  const memberActivity = (member as any)?.physical_activity as string | null ?? null;
  const calculatedBMI = memberWeight && memberHeight && memberHeight > 0
    ? (memberWeight / (memberHeight * memberHeight)).toFixed(1)
    : null;

  const profileCards: ProfileCard[] = [
    ...(!isPet ? [{ icon: Droplet, label: "Tipo Sanguíneo", value: member?.blood_type || "—", action: "medidas" }] : []),
    { icon: Weight, label: "Peso", value: memberWeight ? `${memberWeight} kg` : "— kg", action: "medidas" },
    { icon: Ruler, label: "Altura", value: memberHeight ? `${memberHeight} m` : "— m", action: "medidas" },
    ...(!isPet ? [{ icon: Calculator, label: "IMC", value: calculatedBMI || "—", action: "medidas" }] : []),
    ...(!isPet ? [{ icon: Dumbbell, label: "Atividade Física", value: memberActivity || "—", action: "medidas" }] : []),
    { icon: LineChart, label: "Evolução Corporal", value: "Histórico", route: "saude" },
  ];

  const renderCardGrid = (items: CardItem[]) => (
    <div className="grid grid-cols-3 gap-3">
      {items.map(({ icon: Icon, label, subtitle, route }) => (
        <button
          key={label}
          onClick={() => {
            if (route === "__bp__") {
              setBpOpen(true);
            } else if (route === "__cycle__") {
              setCycleOpen(true);
            } else {
              navigate(`/familiar/${id}/${route}`);
            }
          }}
          className="flex flex-col items-center p-4 bg-card rounded-xl border border-border/50 active:bg-muted/50 sm:hover:bg-muted/50 transition-colors text-center"
        >
          <div className="w-11 h-11 rounded-xl bg-[#A7D3CB] flex items-center justify-center mb-2">
            <Icon className="text-black" size={22} />
          </div>
          <p className="text-xs font-semibold text-foreground">{label}</p>
          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{subtitle}</p>
        </button>
      ))}
    </div>
  );

  const SectionTitle = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
    <div className="flex items-center gap-2 mb-4 mt-8">
      <Icon className="w-5 h-5 text-primary" />
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
    </div>
  );

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Sticky Header */}
        <div className="sticky top-0 z-40 w-full bg-[#F4F1EB]/80 backdrop-blur-md px-4 pt-6 pb-2 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft size={22} />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex-1">Minha Saúde</h1>
        </div>
        <div className="p-4 pb-8 space-y-6 min-h-[calc(100%+1px)]">

      {/* Identity Card - Progressive: skeleton only here */}
      {isLoading && !member ? (
        <div className="w-full rounded-xl bg-primary/10 p-5 flex items-center gap-4">
          <Skeleton className="w-14 h-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ) : member ? (
        <button
          onClick={() => setEditOpen(true)}
          className="w-full rounded-xl bg-primary/10 border-none p-5 flex items-center gap-4 cursor-pointer active:bg-accent/50 sm:hover:bg-accent/50 transition-colors text-left"
        >
          <MemberAvatar avatarUrl={member.avatar_url} name={member.name} size="lg" memberType={member.member_type} />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-[#1C3333] truncate">{member.name}</p>
            <p className="text-sm text-muted-foreground">{member.relationship}</p>
            {infoLine && <p className="text-xs text-muted-foreground mt-0.5">{infoLine}</p>}
          </div>
        </button>
      ) : null}

      {/* Prontuário (RES) Button */}
      <button
        onClick={() => navigate(`/familiar/${id}/prontuario`)}
        className="w-full rounded-xl bg-[#1C3333] p-4 flex items-center gap-3 active:opacity-90 sm:hover:opacity-90 transition-opacity"
      >
        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
          <FileText className="text-white" size={20} />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-white">Prontuário (RES)</p>
          <p className="text-[10px] text-white/60">Resumo de emergência e dados clínicos</p>
        </div>
        <ArrowLeft className="text-white/40 rotate-180" size={16} />
      </button>

      {/* Group 1: Gestão de Saúde */}
      <SectionTitle icon={HeartPulse} title="Gestão de Saúde" />
      {renderCardGrid(gestaoItems)}

      {/* Group 2: Informações de Saúde */}
      <SectionTitle icon={ShieldAlert} title="Informações de Saúde" />
      {renderCardGrid(infoItems)}

      {/* Group 3: Perfil de Saúde */}
      <SectionTitle icon={UserCircle} title="Perfil de Saúde" />
      <div className="grid grid-cols-3 gap-3">
        {profileCards.map(({ icon: Icon, label, value, route, action }) => (
          <button
            key={label}
            onClick={() => {
              if (route) navigate(`/familiar/${id}/${route}`);
              else if (action === "medidas") setMedidasOpen(true);
            }}
            className="flex flex-col items-center p-4 bg-card rounded-xl border border-border/50 active:bg-muted/50 sm:hover:bg-muted/50 transition-colors text-center cursor-pointer"
          >
            <div className="w-11 h-11 rounded-xl bg-[#A7D3CB] flex items-center justify-center mb-2">
              <Icon className="text-black" size={22} />
            </div>
            <p className="text-xs font-semibold text-foreground">{label}</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{value}</p>
          </button>
        ))}
      </div>

      {/* Group 4: Cuidados com o Pet - only for pets, after Perfil de Saúde */}
      {isPet && member && (
        <>
          <SectionTitle icon={PawPrint} title="Cuidados com o Pet" />
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => navigate(`/familiar/${id}/rotinas-pet`)}
              className="flex flex-col items-center p-4 bg-card rounded-xl border border-border/50 active:bg-muted/50 sm:hover:bg-muted/50 transition-colors text-center"
            >
              <div className="w-11 h-11 rounded-xl bg-[#A7D3CB] flex items-center justify-center mb-2">
                <ShowerHead className="text-black" size={22} />
              </div>
              <p className="text-xs font-semibold text-foreground">Rotina e Higiene</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Banho, tosa e mais</p>
            </button>
          </div>
        </>
      )}

        </div>
      </div>

      {/* Edit Drawer */}
      {member && (
        <>
          <EditMemberDrawer open={editOpen} onOpenChange={setEditOpen} member={member} />
          <AtualizarMedidasDrawer
            open={medidasOpen}
            onOpenChange={setMedidasOpen}
            memberId={member.id}
            memberType={member.member_type}
            currentData={{
              blood_type: member.blood_type,
              weight: memberWeight,
              height: memberHeight,
              physical_activity: memberActivity,
            }}
          />
          <BloodPressureHistoryDrawer
            open={bpOpen}
            onOpenChange={setBpOpen}
            familyMemberId={member.id}
          />
          {tracksCycle && (
            <MenstrualCycleDrawer
              open={cycleOpen}
              onOpenChange={setCycleOpen}
              familyMemberId={member.id}
            />
          )}
        </>
      )}
    </div>
  );
};

export default FamiliarProfile;
