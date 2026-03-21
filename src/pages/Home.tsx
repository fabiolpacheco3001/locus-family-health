import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const Home = () => {
  const userName = "Usuário";

  return (
    <div className="px-5 pt-6 pb-24 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-muted-foreground">Bom dia 👋</p>
          <h1 className="text-2xl font-bold text-foreground">
            Olá, {userName}
          </h1>
        </div>
        <Avatar className="h-11 w-11 border-2 border-secondary">
          <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
            {userName[0]}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Welcome Card */}
      <Card className="bg-welcome border-none shadow-none mb-6">
        <CardContent className="p-5 flex gap-4 items-start">
          <div className="w-10 h-10 rounded-xl bg-secondary/30 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="text-secondary" size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-welcome-foreground mb-1">
              Bem-vindo ao Locus Health
            </h2>
            <p className="text-sm text-welcome-foreground/80 leading-relaxed">
              Comece adicionando os membros da sua família para gerenciar a saúde de todos em um só lugar.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Empty state hint */}
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <Plus className="text-muted-foreground" size={32} />
        </div>
        <p className="text-muted-foreground text-sm max-w-[240px]">
          Toque no botão <span className="font-semibold text-accent-foreground">+</span> para adicionar um membro da família
        </p>
      </div>

      {/* FAB */}
      <Button
        variant="fab"
        size="icon"
        className="fixed bottom-20 w-14 h-14"
        style={{ right: "max(1.25rem, calc(50% - 240px + 1.25rem))" }}
      >
        <Plus size={28} strokeWidth={2.5} />
      </Button>
    </div>
  );
};

export default Home;
