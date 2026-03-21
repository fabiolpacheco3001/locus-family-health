import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import AddMemberDrawer from "@/components/AddMemberDrawer";

const Home = () => {
  const { user } = useAuth();
  const { members, isLoading } = useFamilyMembers();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const userName = user?.user_metadata?.full_name || "Usuário";

  return (
    <div className="px-5 pt-6 pb-24 animate-fade-in">
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

      {/* Welcome Card (show only when no members) */}
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
            <Plus className="text-muted-foreground" size={32} />
          </div>
          <p className="text-muted-foreground text-sm max-w-[240px]">
            Toque no botão <span className="font-semibold text-accent-foreground">+</span> para adicionar um membro da família
          </p>
        </div>
      )}

      {/* Family members list */}
      {members.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-3">Minha Família</h2>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-3 pb-2">
              {members.map((m) => (
                <Card key={m.id} className="min-w-[120px] max-w-[120px] shrink-0 border-border/50">
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                    <Avatar className="h-14 w-14 border-2 border-secondary">
                      <AvatarFallback className="bg-secondary/20 text-secondary font-bold text-lg">
                        {m.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="w-full">
                      <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.relationship}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* FAB */}
      <Button
        variant="fab"
        size="icon"
        className="absolute bottom-20 right-5 w-14 h-14"
        onClick={() => setDrawerOpen(true)}
      >
        <Plus size={28} strokeWidth={2.5} />
      </Button>

      <AddMemberDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
};

export default Home;
