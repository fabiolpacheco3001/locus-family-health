import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const Ajustes = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="px-5 pt-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground mb-8">Ajustes</h1>

      <Button
        variant="outline"
        onClick={handleLogout}
        className="w-full justify-start gap-3 text-destructive border-destructive/30 hover:bg-destructive/10 h-12 text-base"
      >
        <LogOut size={20} />
        Sair da conta
      </Button>
    </div>
  );
};

export default Ajustes;
