import { ChevronRight } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import MemberAvatar from "@/components/MemberAvatar";
import { sortFamilyMembers } from "@/lib/sortFamilyMembers";
import { useNavigate } from "react-router-dom";

type QuickAction = "consultas" | "exames" | "medicamentos";

type Member = {
  id: string;
  name: string;
  relationship?: string | null;
  avatar_url?: string | null;
  member_type?: string | null;
};

type Props = {
  quickAction: QuickAction | null;
  setQuickAction: (action: QuickAction | null) => void;
  members: Member[];
  membersLoading: boolean;
  role: string | null;
  linkedMemberId: string | null;
  managedProfiles: string[];
};

const DRAWER_TITLE: Record<QuickAction, string> = {
  consultas: "Para quem é a consulta?",
  exames: "Para quem é o exame?",
  medicamentos: "Para quem é o medicamento?",
};

export function FamilySelectDrawer({
  quickAction,
  setQuickAction,
  members,
  membersLoading,
  role,
  linkedMemberId,
  managedProfiles,
}: Props) {
  const navigate = useNavigate();

  const allowedIds =
    role === "user" && linkedMemberId ? [linkedMemberId, ...managedProfiles] : null;

  const filtered = allowedIds ? members.filter((m) => allowedIds.includes(m.id)) : members;

  return (
    <Drawer open={!!quickAction} onOpenChange={(open) => !open && setQuickAction(null)}>
      <DrawerContent className="flex flex-col max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>{quickAction ? DRAWER_TITLE[quickAction] : ""}</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 space-y-2">
          {sortFamilyMembers(filtered).map((member) => (
            <button
              key={member.id}
              onClick={() => {
                setQuickAction(null);
                navigate(`/familiar/${member.id}/${quickAction}`, { state: { from: "/home" } });
              }}
              className="flex items-center gap-3 w-full h-14 px-4 bg-card rounded-xl border border-border/50 shadow-xs text-left active:bg-accent/50 sm:hover:bg-accent/50 transition-colors"
            >
              <MemberAvatar
                avatarUrl={member.avatar_url}
                name={member.name}
                size="sm"
                memberType={member.member_type}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-black truncate">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.relationship}</p>
              </div>
              <ChevronRight size={16} className="text-black shrink-0" />
            </button>
          ))}

          {membersLoading && members.length === 0 && (
            <div className="space-y-3 py-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 h-14 px-4 bg-card rounded-xl border border-border/50"
                >
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
  );
}
