import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import AddMemberDrawer from "@/components/AddMemberDrawer";
import FixedFAB from "@/components/ui/FixedFAB";

const Home = () => {
  const { user } = useAuth();
  const { members, isLoading } = useFamilyMembers();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const userName = user?.user_metadata?.full_name || "Usuário";

  return (
    <>
      {!drawerOpen && <FixedFAB onClick={() => setDrawerOpen(true)} />}
      <AddMemberDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      <div className="px-5 pt-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-muted-foreground">Bom dia 👋</p>
            <h1 className="text-2xl font-bold text-foreground">Olá, {userName}</h1>
          </div>
          <Avatar className="h-11 w-11 border-2 border-secondary">
            <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
              {userName[0]}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Welcome Card */}
        {members.length === 0 && !isLoading && (
          <Card className="bg-welcome border-none shadow-none mb-6">
            <CardContent className="p-5 flex gap-4 items-start">
              <div className="w-10 h-10 rounded-xl bg-secondary/30 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="text-secondary" size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-welcome-foreground mb-1">Bem-vindo ao Locus Health</h2>
                <p className="text-sm text-welcome-foreground/80 leading-relaxed">
                  Comece adicionando os membros da sua família para gerenciar a saúde de todos em um só lugar.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {members.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <ChevronRight className="text-muted-foreground" size={32} />
            </div>
            <p className="text-muted-foreground text-sm max-w-[240px]">
              Toque no botão <span className="font-semibold text-accent-foreground">+</span> para adicionar um membro da família
            </p>
          </div>
        )}

        {/* Family members vertical list */}
        {members.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">Minha Família</h2>
            <div className="flex flex-col space-y-3 w-full">
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/familiar/${m.id}`)}
                  className="flex items-center p-4 bg-card rounded-xl shadow-sm border border-border/50 active:bg-muted/50 sm:hover:bg-muted/50 transition-colors text-left w-full"
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
          </div>
        )}
      </div>
    </>
  );
};

export default Home;
