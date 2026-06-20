import MemberAvatar from "@/components/MemberAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { calculateAge } from "@/lib/dateUtils";
import type { FamilyMember } from "@/hooks/useFamilyMembers";

interface FamiliarProfileHeaderProps {
  member: (FamilyMember & { tracks_menstrual_cycle?: boolean }) | null | undefined;
  isLoading: boolean;
  onEdit: () => void;
}

export function FamiliarProfileHeader({ member, isLoading, onEdit }: FamiliarProfileHeaderProps) {
  if (isLoading && !member) {
    return (
      <div className="w-full rounded-xl bg-primary/10 p-5 flex items-center gap-4">
        <Skeleton className="w-14 h-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    );
  }

  if (!member) return null;

  const isPet = (member.member_type || "human") === "pet";
  const age = calculateAge(member.birth_date);
  const infoParts: string[] = [];
  if (age !== null) infoParts.push(`${age} anos`);
  if (!isPet && member.blood_type) infoParts.push(`Sangue ${member.blood_type}`);
  if (isPet && member.species) infoParts.push(member.species);
  if (isPet && member.breed) infoParts.push(member.breed);
  const infoLine = infoParts.join(" • ");

  return (
    <button
      onClick={onEdit}
      className="w-full rounded-xl bg-primary/10 border-none p-5 flex items-center gap-4 cursor-pointer active:bg-accent/50 sm:hover:bg-accent/50 transition-colors text-left"
    >
      <MemberAvatar avatarUrl={member.avatar_url} name={member.name} size="lg" memberType={member.member_type} />
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold text-[#1C3333] truncate">{member.name}</p>
        <p className="text-sm text-muted-foreground">{member.relationship}</p>
        {infoLine && <p className="text-xs text-muted-foreground mt-0.5">{infoLine}</p>}
      </div>
    </button>
  );
}
