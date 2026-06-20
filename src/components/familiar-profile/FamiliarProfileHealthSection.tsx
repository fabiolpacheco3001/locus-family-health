import { Droplet, Weight, Ruler, Calculator, Dumbbell, LineChart } from "lucide-react";
import type { FamilyMember } from "@/hooks/useFamilyMembers";

type ProfileCard = {
  icon: React.ElementType;
  label: string;
  value: string;
  route?: string;
  action?: string;
};

interface FamiliarProfileHealthSectionProps {
  member: FamilyMember;
  onNavigate: (route: string) => void;
  onOpenMedidas: () => void;
}

export function FamiliarProfileHealthSection({
  member,
  onNavigate,
  onOpenMedidas,
}: FamiliarProfileHealthSectionProps) {
  const isPet = (member.member_type || "human") === "pet";
  const memberWeight = member.weight ?? null;
  const memberHeight = member.height ?? null;
  const memberActivity = member.physical_activity ?? null;
  const calculatedBMI =
    memberWeight && memberHeight && memberHeight > 0
      ? (memberWeight / (memberHeight * memberHeight)).toFixed(1)
      : null;

  const profileCards: ProfileCard[] = [
    ...(!isPet ? [{ icon: Droplet, label: "Tipo Sanguíneo", value: member.blood_type || "—", action: "medidas" }] : []),
    { icon: Weight, label: "Peso", value: memberWeight ? `${memberWeight} kg` : "— kg", action: "medidas" },
    { icon: Ruler, label: "Altura", value: memberHeight ? `${memberHeight} m` : "— m", action: "medidas" },
    ...(!isPet ? [{ icon: Calculator, label: "IMC", value: calculatedBMI || "—", action: "medidas" }] : []),
    ...(!isPet ? [{ icon: Dumbbell, label: "Atividade Física", value: memberActivity || "—", action: "medidas" }] : []),
    { icon: LineChart, label: "Evolução Corporal", value: "Histórico", route: "saude" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {profileCards.map(({ icon: Icon, label, value, route, action }) => (
        <button
          key={label}
          onClick={() => {
            if (route) onNavigate(route);
            else if (action === "medidas") onOpenMedidas();
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
  );
}
