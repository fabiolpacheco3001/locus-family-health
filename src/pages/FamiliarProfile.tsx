import { useState } from "react";
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
  Hand,
  Syringe,
  Activity,
  Droplet,
  Weight,
  Ruler,
  Calculator,
  Dumbbell,
  LineChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import EditMemberDrawer from "@/components/EditMemberDrawer";
import AtualizarMedidasDrawer from "@/components/AtualizarMedidasDrawer";
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

const infoItems: CardItem[] = [
  { icon: Hand, label: "Alergias", subtitle: "Acesse e cadastre", route: "alergias" },
  { icon: Syringe, label: "Vacinas", subtitle: "Carteira de vacinação", route: "vacinas" },
  { icon: Activity, label: "Doenças", subtitle: "Histórico clínico", route: "doencas" },
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
  const [editOpen, setEditOpen] = useState(false);
  const [medidasOpen, setMedidasOpen] = useState(false);


  const { data: member, isLoading, error } = useQuery({
    queryKey: ["family_member", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as FamilyMember | null;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="px-4 pt-6 space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !member) {
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
          <p className="text-foreground font-semibold mb-1">Familiar não encontrado</p>
          <p className="text-muted-foreground text-sm mb-6">Este perfil pode ter sido removido ou você não tem acesso.</p>
          <Button onClick={() => navigate("/home")}>Voltar para Home</Button>
        </div>
      </div>
    );
  }

  const age = calculateAge(member.birth_date);
  const infoParts: string[] = [];
  if (age !== null) infoParts.push(`${age} anos`);
  if (member.blood_type) infoParts.push(`Sangue ${member.blood_type}`);
  const infoLine = infoParts.join(" • ");

  const memberWeight = (member as any).weight as number | null;
  const memberHeight = (member as any).height as number | null;
  const memberActivity = (member as any).physical_activity as string | null;
  const calculatedBMI = memberWeight && memberHeight && memberHeight > 0
    ? (memberWeight / (memberHeight * memberHeight)).toFixed(1)
    : null;

  const profileCards: ProfileCard[] = [
    { icon: Droplet, label: "Tipo Sanguíneo", value: member.blood_type || "—", action: "medidas" },
    { icon: Weight, label: "Peso", value: memberWeight ? `${memberWeight} kg` : "— kg", action: "medidas" },
    { icon: Ruler, label: "Altura", value: memberHeight ? `${memberHeight} m` : "— m", action: "medidas" },
    { icon: Calculator, label: "IMC", value: calculatedBMI || "—", action: "medidas" },
    { icon: Dumbbell, label: "Atividade Física", value: memberActivity || "—", action: "medidas" },
    { icon: LineChart, label: "Evolução Corporal", value: "Histórico", route: "saude" },
  ];

  const renderCardGrid = (items: CardItem[]) => (
    <div className="grid grid-cols-3 gap-3">
      {items.map(({ icon: Icon, label, subtitle, route }) => (
        <button
          key={label}
          onClick={() => navigate(`/familiar/${id}/${route}`)}
          className="flex flex-col items-center p-4 bg-card rounded-xl border border-border/50 active:bg-muted/50 sm:hover:bg-muted/50 transition-colors text-center"
        >
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
            <Icon className="text-primary" size={22} />
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
    <div className="px-4 pt-6 pb-28 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft size={22} />
        </Button>
        <h1 className="text-lg font-bold text-foreground flex-1">Minha Saúde</h1>
      </div>

      {/* Identity Card */}
      <button
        onClick={() => setEditOpen(true)}
        className="w-full rounded-xl bg-secondary/10 p-5 flex items-center gap-4 cursor-pointer active:bg-accent/50 sm:hover:bg-accent/50 transition-colors text-left"
      >
        <Avatar className="h-14 w-14 border-2 border-secondary shrink-0">
          <AvatarFallback className="bg-secondary/20 text-secondary font-bold text-xl">
            {member.name[0]}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-primary truncate">{member.name}</p>
          <p className="text-sm text-muted-foreground">{member.relationship}</p>
          {infoLine && <p className="text-xs text-muted-foreground mt-0.5">{infoLine}</p>}
        </div>
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
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
              <Icon className="text-primary" size={22} />
            </div>
            <p className="text-xs font-semibold text-foreground">{label}</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{value}</p>
          </button>
        ))}
      </div>

      {/* Edit Drawer */}
      <EditMemberDrawer open={editOpen} onOpenChange={setEditOpen} member={member} />
    </div>
  );
};

export default FamiliarProfile;
