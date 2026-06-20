import { Bell, Search, HelpCircle, Sun, Moon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MemberAvatar from "@/components/MemberAvatar";
import { toast } from "sonner";

type Props = {
  userName: string;
  myProfile: { avatar_url?: string | null; member_type?: string | null } | null;
  unreadCount: number;
};

export function HomeHeader({ userName, myProfile, unreadCount }: Props) {
  const navigate = useNavigate();

  const h = new Date().getHours();
  const isDay = h >= 6 && h < 18;
  const greeting = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="sticky top-0 z-40 w-full bg-[#1C3333] px-5 pt-8 pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            onClick={() => navigate("/meus-dados", { state: { from: "/home" } })}
            className="cursor-pointer transition-transform active:scale-95"
          >
            <MemberAvatar
              avatarUrl={myProfile?.avatar_url}
              name={userName}
              size="md"
              memberType={myProfile?.member_type}
            />
          </div>
          <div>
            <p className="text-sm text-white/70 flex items-center gap-1">
              {greeting}
              {isDay ? (
                <Sun className="w-4 h-4 text-yellow-500 inline-block" />
              ) : (
                <Moon className="w-4 h-4 text-[#DCC5F1] inline-block" />
              )}
            </p>
            <h1 className="text-2xl font-bold text-white">Olá, {userName}!</h1>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Buscar"
            onClick={() =>
              toast.info(
                "Em breve: Busque funcionalidades ou agende compromissos via Chat Conversacional com IA!"
              )
            }
            className="p-2 rounded-full hover:bg-white/10 active:bg-white/10 transition-colors"
          >
            <Search size={22} className="text-white" />
          </button>
          <button
            type="button"
            aria-label="Ajuda"
            onClick={() => navigate("/ajuda")}
            className="p-2 rounded-full hover:bg-white/10 active:bg-white/10 transition-colors"
          >
            <HelpCircle size={22} className="text-white" />
          </button>
          <button
            type="button"
            aria-label={unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : "Notificações"}
            onClick={() => navigate("/notificacoes", { state: { from: "/home" } })}
            className="relative p-2 rounded-full hover:bg-white/10 active:bg-white/10 transition-colors"
          >
            <Bell size={22} className="text-white" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-[#1C3333]" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
