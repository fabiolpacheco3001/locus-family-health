import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import AddMemberDrawer from "@/components/AddMemberDrawer";
import FixedFAB from "@/components/ui/FixedFAB";

const Familia = () => {
  const { members, isLoading } = useFamilyMembers();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      {!drawerOpen && <FixedFAB onClick={() => setDrawerOpen(true)} />}
      <AddMemberDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      <div className="px-5 pt-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground mb-4">Família</h1>

        {members.length === 0 && !isLoading && (
          <p className="text-muted-foreground text-sm">
            Toque no botão <span className="font-semibold text-accent-foreground">+</span> para adicionar um membro.
          </p>
        )}

        {members.length > 0 && (
          <div className="flex flex-col space-y-3 w-full">
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => navigate(`/familiar/${m.id}`)}
                className="flex items-center p-4 bg-card rounded-xl shadow-sm border border-border/50 hover:bg-muted/50 transition-colors text-left w-full"
              >
                <Avatar className="h-12 w-12 border-2 border-secondary shrink-0">
                  <AvatarFallback className="bg-secondary/20 text-secondary font-bold text-lg">
                    {m.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col ml-4 min-w-0 flex-1">
                  <p className="text-sm font-semibold text-primary truncate">{m.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.relationship}</p>
                </div>
                <ChevronRight className="text-muted-foreground ml-auto shrink-0" size={20} />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Familia;
