import { useNavigate } from "react-router-dom";
import { LogOut, User, Users, Bell, Shield, HelpCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";

const menuItems = [
  { icon: User, label: "Meus Dados" },
  { icon: Users, label: "Gerenciar Família" },
  { icon: Bell, label: "Notificações" },
  { icon: Shield, label: "Segurança e Senha" },
  { icon: HelpCircle, label: "Ajuda e Suporte" },
];

const Ajustes = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { members } = useFamilyMembers();

  const titular = members?.find((m) => m.relationship === "Titular");
  const initials = titular?.name
    ?.split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() ?? "—";

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-80px)]">
      <div className="px-5 pt-6">
        <h1 className="text-2xl font-bold text-foreground mb-4">Ajustes</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 overscroll-contain no-scrollbar">
        {/* Profile Card */}
        <div className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-border/40">
          <div className="w-14 h-14 rounded-full bg-secondary/20 border-2 border-secondary flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-secondary">{initials}</span>
          </div>
          <div>
            <p className="text-base font-semibold text-black">{titular?.name ?? "Carregando..."}</p>
            <p className="text-sm text-muted-foreground">Titular / Conta Principal</p>
          </div>
        </div>

        {/* Menu Items */}
        <div className="space-y-3">
          {menuItems.map(({ icon: Icon, label, path }) => (
            <button
              key={label}
              onClick={() => path && navigate(path)}
              className="w-full flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-border/40 active:bg-muted/40 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-[#A7D3CB] flex items-center justify-center shrink-0">
                <Icon size={20} className="text-black" />
              </div>
              <span className="flex-1 text-left text-sm font-medium text-black">{label}</span>
              <ChevronRight size={18} className="text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 bg-background border-t mt-auto">
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
