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
    <div className="px-5 pt-6 animate-fade-in flex flex-col min-h-[calc(100dvh-160px)]">
      <h1 className="text-2xl font-bold text-foreground mb-8">Ajustes</h1>

      <div className="mt-auto px-4 w-full pb-6">
        <Button
          onClick={handleLogout}
          className="w-full max-w-md mx-auto bg-[#A7D3CB] hover:bg-[#A7D3CB]/90 text-red-600 border-none font-semibold flex items-center justify-center gap-2 h-12 rounded-xl"
        >
          <LogOut size={20} />
          Sair da conta
        </Button>
      </div>
    </div>
  );
};

export default Ajustes;
