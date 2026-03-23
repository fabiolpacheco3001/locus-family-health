import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import MemberAvatar from "@/components/MemberAvatar";

const Familia = () => {
  const { members, isLoading } = useFamilyMembers();
  const navigate = useNavigate();

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-background overflow-hidden z-10">
      {/* Header */}
      <div className="flex-none px-5 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-foreground">Família</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-5 pb-4 min-h-[calc(100%+1px)]">
        {members.length === 0 && !isLoading && (
          <p className="text-muted-foreground text-sm">
            Toque no botão <span className="font-semibold text-accent-foreground">+</span> para adicionar um membro.
          </p>
        )}

        {members.length > 0 && (
          <div className="flex flex-col space-y-3 w-full">
            {(() => {
              const ordemParentesco: Record<string, number> = {
                "Titular": 1,
                "Cônjuge": 2,
                "Filho(a)": 3,
                "Pai/Mãe": 4,
                "Irmão(ã)": 5,
                "Outro": 6,
              };
              return [...members].sort((a, b) => {
                const pesoA = ordemParentesco[a.relationship] || 99;
                const pesoB = ordemParentesco[b.relationship] || 99;
                return pesoA - pesoB;
              }).map((m) => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/familiar/${m.id}`)}
                  className="flex items-center p-4 bg-card rounded-xl shadow-sm border border-border/50 hover:bg-muted/50 transition-colors text-left w-full"
                >
                  <MemberAvatar avatarUrl={m.avatar_url} name={m.name} />
                  <div className="flex flex-col ml-4 min-w-0 flex-1">
                    <p className="text-sm font-semibold text-black truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.relationship}</p>
                  </div>
                  <ChevronRight className="text-muted-foreground ml-auto shrink-0" size={20} />
                </button>
              ));
            })()}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default Familia;
