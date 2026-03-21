import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const Notificacoes = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    const from = (location.state as any)?.from;
    if (from) {
      navigate(from, { replace: true });
    } else {
      navigate("/home", { replace: true });
    }
  };

  return (
    <div className="px-4 pt-6 pb-28 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft size={22} />
        </Button>
        <h1 className="text-lg font-bold text-foreground flex-1">Notificações</h1>
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <BellOff className="text-muted-foreground" size={28} />
        </div>
        <p className="text-foreground font-semibold mb-1">Nenhuma notificação</p>
        <p className="text-muted-foreground text-sm">Você não tem novas notificações.</p>
      </div>
    </div>
  );
};

export default Notificacoes;
