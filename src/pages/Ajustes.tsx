import { useNavigate } from "react-router-dom";
import { parseDateInSP } from "@/lib/dateUtils";
import { useState } from "react";
import {
  LogOut, User, Users, Bell, Shield, Scale, HelpCircle,
  ChevronRight, Loader2, Crown, AlertCircle, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { createSubscription } from "@/services/asaasService";
import MemberAvatar from "@/components/MemberAvatar";
import PaywallModal from "@/components/PaywallModal";
import { toast } from "sonner";
import { format } from "date-fns";
import { PLAN_MONTHLY_DISPLAY, PLAN_ANNUAL_DISPLAY } from "@/lib/planConfig";
import { ptBR } from "date-fns/locale";

// ── Menu de topo: 6 itens fixos ───────────────────────────────────────────────
export interface TopMenuItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

export const topMenuItems: TopMenuItem[] = [
  { icon: User,        label: "Meus Dados",        path: "/meus-dados" },
  { icon: Users,       label: "Gerenciar Família",  path: "/gerenciar-familia" },
  { icon: Shield,      label: "Segurança",          path: "/ajustes/seguranca" },
  { icon: Bell,        label: "Notificações",       path: "/notificacoes" },
  { icon: Scale,       label: "Conformidade",       path: "/ajustes/conformidade" },
  { icon: HelpCircle,  label: "Suporte",            path: "/ajustes/suporte" },
];

const Ajustes = () => {
  const { signOut, user } = useAuth();
  const { isAdmin } = useFamilyGroup();
  const navigate = useNavigate();
  const { members } = useFamilyMembers();
  const { linkedMemberId } = useFamilyGroup();
  const {
    subscription, isLoading, isActive, isPastDue, isCanceled,
    canceledButGracePeriod, trialDaysLeft, implicitTrialExpired,
    isTrialing,
  } = useSubscription();

  const isSubscriptionOwner = !isLoading && (!subscription || subscription.user_id === user?.id);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const myProfile = members?.find((m) => m.id === linkedMemberId) ?? members?.[0];

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const handleRegularize = async () => {
    setLoadingSubscription(true);
    // iOS Safari popup blocker: must open window synchronously BEFORE any await.
    const checkoutWindow = window.open("about:blank", "_blank");
    try {
      const planType = subscription?.plan_type === "annual" ? "annual" : "monthly";
      const url = await createSubscription(planType as "monthly" | "annual");
      if (checkoutWindow) checkoutWindow.location.href = url;
      else window.location.href = url;
    } catch (err) {
      if (checkoutWindow) checkoutWindow.close();
      toast.error(err instanceof Error ? err.message : "Erro ao gerar link de pagamento.");
    } finally {
      setLoadingSubscription(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-4 pb-6 space-y-4 min-h-[calc(100%+1px)]">

          {/* Header */}
          <div className="sticky top-0 z-30 bg-[#F4F1EB]/80 backdrop-blur-md pt-6 pb-4 -mx-4 px-5">
            <h1 className="font-bold text-foreground px-1 text-lg">Ajustes</h1>
          </div>

          {/* Profile Card */}
          <div className="flex items-center gap-4 p-4 bg-card rounded-xl shadow-xs border border-border/40">
            <MemberAvatar
              avatarUrl={myProfile?.avatar_url}
              name={myProfile?.name ?? "?"}
              size="lg"
              memberType={myProfile?.member_type}
            />
            <div>
              <p className="text-base font-semibold text-foreground">{myProfile?.name ?? "Carregando..."}</p>
              <p className="text-sm text-muted-foreground">{myProfile?.relationship ?? "Membro"}</p>
            </div>
          </div>

          {/* Subscription Card */}
          {isAdmin ? (
            isLoading ? (
              <div className="rounded-xl border border-border/40 p-4 space-y-3 animate-pulse">
                <div className="h-10 bg-muted rounded-lg" />
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-10 bg-muted rounded-xl" />
              </div>
            ) : subscription ? (
              <div className="rounded-xl overflow-hidden shadow-xs border border-border/40">
                <div className={`px-4 py-3 ${
                  isActive      ? "bg-gradient-to-r from-[#2A5C82] to-[#78C2AD]"
                  : isPastDue   ? "bg-gradient-to-r from-red-600 to-red-400"
                  : isCanceled  ? "bg-gradient-to-r from-gray-500 to-gray-400"
                                : "bg-gradient-to-r from-amber-500 to-amber-400"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crown size={16} className="text-white" />
                      <span className="text-sm font-bold text-white">
                        {isActive
                          ? subscription.plan_type === "annual" ? "Plano Anual Locus Vita" : "Plano Mensal Locus Vita"
                          : isPastDue  ? "Pagamento Pendente"
                          : isCanceled ? "Assinatura Cancelada"
                          : "Assinatura"}
                      </span>
                    </div>
                    {isActive   && <Badge className="bg-white/20 text-white border-none text-xs backdrop-blur-sm">Ativo</Badge>}
                    {isCanceled && <Badge className="bg-white/20 text-white border-none text-xs backdrop-blur-sm">Cancelado</Badge>}
                  </div>
                </div>
                <div className="bg-card p-4 space-y-3">
                  {isActive && (
                    <div className="flex justify-center items-baseline gap-1 mt-4">
                      <span className="text-2xl font-bold text-foreground">
                        {subscription.plan_type === "annual" ? PLAN_ANNUAL_DISPLAY : PLAN_MONTHLY_DISPLAY}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        /{subscription.plan_type === "annual" ? "ano" : "mês"}
                      </span>
                    </div>
                  )}
                  {isActive && subscription.next_billing_date && (
                    <p className="text-sm text-muted-foreground">
                      Próximo pagamento:{" "}
                      <strong className="text-foreground">
                        {format(parseDateInSP(subscription.next_billing_date.substring(0, 10)) ?? new Date(), "dd MMM yyyy", { locale: ptBR })}
                      </strong>
                    </p>
                  )}
                  {isCanceled && canceledButGracePeriod && subscription.next_billing_date && (
                    <p className="text-sm text-muted-foreground">
                      Acesso válido até:{" "}
                      <strong className="text-foreground">
                        {format(parseDateInSP(subscription.next_billing_date.substring(0, 10)) ?? new Date(), "dd MMM yyyy", { locale: ptBR })}
                      </strong>
                    </p>
                  )}
                  {isSubscriptionOwner && (
                    <Button
                      variant="outline"
                      onClick={() => navigate("/meu-plano")}
                      className="w-full h-10 rounded-xl border-primary/30 text-primary font-semibold"
                    >
                      {isCanceled ? "Ver Meu Plano" : "Gerenciar Assinatura"}
                    </Button>
                  )}
                  {isPastDue && isSubscriptionOwner && (
                    <Button
                      onClick={handleRegularize}
                      disabled={loadingSubscription}
                      className="w-full h-10 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold shadow-md"
                    >
                      {loadingSubscription ? <Loader2 className="animate-spin" size={16} /> : (
                        <span className="flex items-center gap-2">
                          <AlertCircle size={16} />
                          Regularizar Pagamento
                        </span>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              /* Plano Grátis */
              <div className="rounded-xl overflow-hidden shadow-xs border border-border/40">
                <div className={`px-4 py-3 ${
                  implicitTrialExpired
                    ? "bg-gradient-to-r from-gray-500 to-gray-400"
                    : "bg-gradient-to-r from-[#2A5C82] to-[#A0C4D7]"
                }`}>
                  <div className="flex items-center gap-2">
                    <Crown size={16} className="text-white" />
                    <span className="text-sm font-bold text-white">
                      {implicitTrialExpired ? "Acesso Gratuito Expirado" : "Você está no Plano Grátis"}
                    </span>
                  </div>
                </div>
                <div className="bg-card p-4 space-y-3">
                  {!implicitTrialExpired && trialDaysLeft > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock size={14} />
                      <span>Faltam <strong className="text-foreground">{trialDaysLeft} dias</strong> para o fim do seu acesso gratuito.</span>
                    </div>
                  )}
                  {implicitTrialExpired && (
                    <p className="text-sm text-muted-foreground">
                      Seus 30 dias de acesso gratuito terminaram. Assine para continuar.
                    </p>
                  )}
                  <Button
                    onClick={() => setShowPaywall(true)}
                    className="w-full h-10 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-bold shadow-md"
                  >
                    Assinar Agora
                  </Button>
                </div>
              </div>
            )
          ) : (
            /* Usuário não-admin */
            <div className="rounded-xl overflow-hidden shadow-xs border border-border/40">
              <div className="px-4 py-3 bg-gradient-to-r from-[#2A5C82] to-[#78C2AD]">
                <div className="flex items-center gap-2">
                  <Crown size={16} className="text-white" />
                  <span className="text-sm font-bold text-white">Plano Familiar</span>
                </div>
              </div>
              <div className="bg-card p-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Você está usando o Locus Vita através do plano do administrador do grupo.
                  Para gerenciar a assinatura, entre em contato com o administrador da sua família.
                </p>
              </div>
            </div>
          )}

          {/* Menu Principal — 6 itens de topo */}
          <div className="space-y-2">
            {topMenuItems.map(({ icon: Icon, label, path }) => (
              <button
                key={label}
                onClick={() => navigate(path, { state: { from: "/ajustes" } })}
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

          {/* Sair */}
          <Button
            onClick={handleLogout}
            className="w-full bg-[#A7D3CB] hover:bg-[#A7D3CB]/90 text-red-600 border-none font-semibold flex items-center justify-center gap-2 h-11 rounded-xl"
          >
            <LogOut size={18} />
            Sair da conta
          </Button>
        </div>
      </div>

      <PaywallModal open={showPaywall} onOpenChange={setShowPaywall} />
    </div>
  );
};

export default Ajustes;
