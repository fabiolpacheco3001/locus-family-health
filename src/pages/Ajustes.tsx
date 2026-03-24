import { useNavigate } from "react-router-dom";
import { LogOut, User, Users, Bell, Shield, HelpCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import MemberAvatar from "@/components/MemberAvatar";

const menuItems = [
  { icon: User, label: "Meus Dados", path: "/meus-dados" },
  { icon: Users, label: "Gerenciar Família", path: "/gerenciar-familia" },
  { icon: Bell, label: "Notificações", path: "/notificacoes" },
  { icon: Shield, label: "Segurança e Senha", path: "/seguranca" },
  { icon: HelpCircle, label: "Ajuda e Suporte", path: null },
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
    <div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
      {/* Header */}
      <div className="flex-none px-4 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-foreground px-1">Ajustes</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-4 pb-4 space-y-4 min-h-[calc(100%+1px)]">
        {/* Profile Card */}
        <div className="flex items-center gap-4 p-4 bg-card rounded-xl shadow-sm border border-border/40">
          <MemberAvatar avatarUrl={titular?.avatar_url} name={titular?.name ?? "?"} size="lg" />
          <div>
            <p className="text-base font-semibold text-foreground">{titular?.name ?? "Carregando..."}</p>
            <p className="text-sm text-muted-foreground">Titular / Conta Principal</p>
          </div>
        </div>

        {/* Menu Items */}
        <div className="space-y-3">
          {menuItems.map(({ icon: Icon, label, path }) => (
            <button
              key={label}
              onClick={() => path && navigate(path)}
              className="w-full flex items-center gap-3 p-4 bg-card rounded-xl shadow-sm border border-border/40 active:bg-muted/40 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-[#A7D3CB] flex items-center justify-center shrink-0">
                <Icon size={20} className="text-black" />
              </div>
              <span className="flex-1 text-left text-sm font-medium text-foreground">{label}</span>
              <ChevronRight size={18} className="text-muted-foreground" />
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* Footer - Logout */}
      <div className="flex-none py-2 px-4 bg-card border-t">
        <Button
          onClick={handleLogout}
          className="w-full bg-[#A7D3CB] hover:bg-[#A7D3CB]/90 text-red-600 border-none font-semibold flex items-center justify-center gap-2 h-11 rounded-xl"
        >
          <LogOut size={18} />
          Sair da conta
        </Button>
      </div>
    </div>
  );
};

export default Ajustes;
