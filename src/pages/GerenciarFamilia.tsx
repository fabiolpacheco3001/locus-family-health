import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useFamilyMembers, FamilyMember } from "@/hooks/useFamilyMembers";
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
  const navigate = useNavigate();
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [editMember, setEditMember] = useState<FamilyMember | null>(null);

  const sorted = [...members].sort(
    (a, b) => (ordemParentesco[a.relationship] || 99) - (ordemParentesco[b.relationship] || 99)
  );

  return (
    <>
      {!addDrawerOpen && !editMember && <FixedFAB onClick={() => setAddDrawerOpen(true)} />}
      <AddMemberDrawer open={addDrawerOpen} onOpenChange={setAddDrawerOpen} />
      {editMember && (
        <EditMemberDrawer
          open={!!editMember}
          onOpenChange={(open) => { if (!open) setEditMember(null); }}
          member={editMember}
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
          {members.length === 0 && !isLoading && (
            <p className="text-muted-foreground text-sm">
              Toque no botão <span className="font-semibold text-accent-foreground">+</span> para adicionar um membro.
            </p>
          )}

          {sorted.map((m) => (
            <div
              key={m.id}
              onClick={() => setEditMember(m)}
              className="flex items-center p-4 bg-card rounded-xl shadow-sm border border-border/50 cursor-pointer active:bg-muted/30"
            >
              <MemberAvatar avatarUrl={m.avatar_url} name={m.name} memberType={m.member_type} />
              <div className="flex flex-col ml-4 min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                <p className="text-xs text-muted-foreground truncate">{m.relationship}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 ml-2" />
            </div>
          ))}
          </div>
        </div>
      </div>

    </>
  );
};

export default GerenciarFamilia;
