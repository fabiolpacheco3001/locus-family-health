import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Crown, User as UserIcon } from "lucide-react";
import { useFamilyMembers, FamilyMember } from "@/hooks/useFamilyMembers";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AddMemberDrawer from "@/components/AddMemberDrawer";
import EditMemberDrawer from "@/components/EditMemberDrawer";
import FixedFAB from "@/components/ui/FixedFAB";
import MemberAvatar from "@/components/MemberAvatar";
import { Skeleton } from "@/components/ui/skeleton";

const ordemParentesco: Record<string, number> = {
  "Titular": 1,
  "Cônjuge": 2,
  "Filho(a)": 3,
  "Pai/Mãe": 4,
  "Irmão(ã)": 5,
  "Pet": 6,
  "Outro": 7,
};

const GerenciarFamilia = () => {
  const { members, isLoading } = useFamilyMembers();
  const { groupId, isAdmin, managedProfiles } = useFamilyGroup();
  const navigate = useNavigate();
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [editMember, setEditMember] = useState<FamilyMember | null>(null);
  const [editMemberRole, setEditMemberRole] = useState<string | undefined>(undefined);

  // Fetch group members to cross-reference roles
  const { data: groupMembers = [] } = useQuery({
    queryKey: ["family_group_members_roles", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_group_members" as any)
        .select("family_member_id, role, auth_user_id")
        .eq("group_id", groupId!);
      if (error) throw error;
      return data as unknown as { family_member_id: string | null; role: string; auth_user_id: string }[];
    },
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000,
  });

  // Build role map keyed ONLY by family_member_id.
  // Do NOT fall back to auth_user_id → m.user_id because user_id is the
  // owner's auth id for ALL members (pets, kids, etc.), which would make
  // every card show the admin badge.
  const roleMap = new Map<string, string>();
  groupMembers.forEach((gm) => {
    if (gm.family_member_id) {
      roleMap.set(gm.family_member_id, gm.role);
    }
  });

  const sorted = [...members].sort(
    (a, b) => (ordemParentesco[a.relationship] || 99) - (ordemParentesco[b.relationship] || 99)
  );

  return (
    <>
      {isAdmin && !addDrawerOpen && !editMember && <FixedFAB onClick={() => setAddDrawerOpen(true)} />}
      <AddMemberDrawer open={addDrawerOpen} onOpenChange={setAddDrawerOpen} />
      {editMember && (
        <EditMemberDrawer
          open={!!editMember}
          onOpenChange={(open) => { if (!open) { setEditMember(null); setEditMemberRole(undefined); } }}
          member={editMember}
          memberRole={editMemberRole}
        />
      )}

      <div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="p-4 space-y-3 min-h-[calc(100%+1px)]">
          {/* Sticky Header with Glassmorphism */}
          <div className="sticky top-0 z-30 bg-[#F4F1EB]/80 backdrop-blur-md -mx-4 -mt-4 px-4 py-3 flex items-center gap-3">
            <button onClick={() => navigate("/ajustes")} className="p-1">
              <ArrowLeft size={22} className="text-foreground" />
            </button>
            <h1 className="text-lg font-bold text-foreground">Gerenciar Família</h1>
          </div>
          {isLoading && members.length === 0 && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center p-4 bg-card rounded-xl border border-border/50">
                  <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                  <div className="flex flex-col ml-4 flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && members.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Toque no botão <span className="font-semibold text-accent-foreground">+</span> para adicionar um membro.
            </p>
          )}

          {sorted.map((m) => {
            const memberRole = roleMap.get(m.id);
            const canEdit = isAdmin || (useFamilyGroupCtx.managedProfiles ?? []).includes(m.id);
            return (
              <div
                key={m.id}
                onClick={canEdit ? () => { setEditMember(m); setEditMemberRole(roleMap.get(m.id)); } : undefined}
                className={`flex items-center p-4 bg-card rounded-xl shadow-sm border border-border/50 ${canEdit ? "cursor-pointer active:bg-muted/30" : ""}`}
              >
                <MemberAvatar avatarUrl={m.avatar_url} name={m.name} memberType={m.member_type} />
                <div className="flex flex-col ml-4 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                    {memberRole === "admin" && (
                      <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground truncate">{m.relationship}</p>
                    {memberRole === "admin" && (
                      <span className="text-[10px] bg-slate-100/60 text-slate-700 border border-slate-200/80 px-2 py-0.5 rounded-full font-medium leading-none backdrop-blur-sm">Admin</span>
                    )}
                    {memberRole === "user" && (
                      <span className="text-[10px] bg-slate-100/60 text-muted-foreground border border-slate-200/80 px-2 py-0.5 rounded-full font-medium leading-none backdrop-blur-sm">Convidado</span>
                    )}
                  </div>
                </div>
                {canEdit && <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 ml-2" />}
              </div>
            );
          })}
          </div>
        </div>
      </div>

    </>
  );
};

export default GerenciarFamilia;
