import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Lock, LogIn, UserCog } from "lucide-react";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";

// ── Itens exportados para teste unitário ──────────────────────────────────────
export interface SegurancaItem {
  icon: React.ElementType;
  label: string;
  path: string;
  adminOnly?: boolean;
}

export const segurancaItems: SegurancaItem[] = [
  { icon: Lock,    label: "Senha e Biometria", path: "/seguranca-conta" },
  { icon: LogIn,   label: "Login Social",      path: "/login-social" },
  { icon: UserCog, label: "Gestão de Acessos", path: "/gestao-acessos", adminOnly: true },
];

const AjustesSeguranca = () => {
  const navigate = useNavigate();
  const { isAdmin } = useFamilyGroup();

  const visibleItems = segurancaItems.filter((i) => !i.adminOnly || isAdmin);

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-4 pb-6 space-y-4 min-h-[calc(100%+1px)]">

          {/* Header com back */}
          <div className="sticky top-0 z-30 bg-[#F4F1EB]/80 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="p-1 -ml-1 rounded-lg active:bg-muted/40"
              aria-label="Voltar"
            >
              <ChevronLeft size={24} className="text-foreground" />
            </button>
            <h1 className="font-bold text-foreground text-lg">Segurança</h1>
          </div>

          {/* Itens */}
          <div className="space-y-2">
            {visibleItems.map(({ icon: Icon, label, path }) => (
              <button
                key={label}
                onClick={() => navigate(path, { state: { from: "/ajustes/seguranca" } })}
                className="w-full flex items-center gap-3 p-4 bg-card rounded-xl shadow-xs border border-border/40 active:bg-muted/40 transition-colors"
                aria-label={label}
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
    </div>
  );
};

export default AjustesSeguranca;
