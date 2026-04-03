import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Crown, AlertCircle, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { createSubscription } from "@/services/asaasService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateInSP } from "@/lib/dateUtils";

const MeuPlano = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    subscription, isActive, isPastDue, isCanceled, isTrialing,
    trialDaysLeft, trialExpired, isImplicitTrial, implicitTrialExpired, canUsePremium,
  } = useSubscription();

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [loadingSubscription, setLoadingSubscription] = useState(false);

  const planLabel = (() => {
    if (!subscription) return "Plano Gratuito";
    if (subscription.plan_type === "annual") return "Locus Vita Premium Anual";
    return "Locus Vita Premium Mensal";
  })();

  const statusBadge = (() => {
    if (isActive) return { label: "Ativo", className: "bg-emerald-500/15 text-emerald-700 border-emerald-200" };
    if (isPastDue) return { label: "Pagamento Pendente", className: "bg-amber-500/15 text-amber-700 border-amber-200" };
    if (isCanceled) return { label: "Cancelado", className: "bg-destructive/15 text-destructive border-destructive/30" };
    if (isTrialing && !trialExpired) return { label: "Período Gratuito", className: "bg-sky-500/15 text-sky-700 border-sky-200" };
    if (trialExpired || implicitTrialExpired) return { label: "Expirado", className: "bg-muted text-muted-foreground border-border" };
    return { label: "Gratuito", className: "bg-muted text-muted-foreground border-border" };
  })();

  const handleRegularize = async () => {
    setLoadingSubscription(true);
    try {
      const planType = subscription?.plan_type === "annual" ? "annual" : "monthly";
      const url = await createSubscription(planType as "monthly" | "annual");
      window.location.href = url;
    } catch {
      toast.error("Erro ao gerar link de pagamento.");
    } finally {
      setLoadingSubscription(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelling(true);
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData?.session) throw new Error("Sessão inválida.");

      const { data, error } = await supabase.functions.invoke("cancel-asaas-subscription", {
        headers: { Authorization: `Bearer ${refreshData.session.access_token}` },
      });

      if (error) throw error;

      // Wait for Edge Function to update the DB, then refresh local state
      await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", user!.id)
        .single();

      toast.success("Assinatura cancelada. Seu acesso continua até o fim do período vigente.");
      setShowCancelDialog(false);
      // Force refetch subscription
      window.location.reload();
    } catch {
      toast.error("Erro ao cancelar assinatura. Tente novamente.");
    } finally {
      setCancelling(false);
    }
  };

  const handleReactivate = async () => {
    setLoadingSubscription(true);
    try {
      const planType = subscription?.plan_type === "annual" ? "annual" : "monthly";
      const url = await createSubscription(planType as "monthly" | "annual");
      window.location.href = url;
    } catch {
      toast.error("Erro ao gerar link de reativação.");
    } finally {
      setLoadingSubscription(false);
    }
  };

  const renewalDate = subscription?.next_billing_date
    ? format(parseDateInSP(subscription.next_billing_date.substring(0, 10)) ?? new Date(), "dd MMM yyyy", { locale: ptBR })
    : null;

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-4 pb-32 space-y-4 min-h-[calc(100%+1px)]">
          {/* Sticky Header */}
          <div className="sticky top-0 z-30 bg-[#F4F1EB]/80 backdrop-blur-md pt-6 pb-4 -mx-4 px-5">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-muted/60 transition-colors">
                <ArrowLeft size={22} className="text-foreground" />
              </button>
              <h1 className="text-2xl font-bold text-foreground">Meu Plano</h1>
            </div>
          </div>

          {/* Plan Card */}
          <div className="rounded-xl overflow-hidden shadow-sm border border-border/40">
            <div className={`px-4 py-4 ${
              isActive
                ? "bg-gradient-to-r from-[#2A5C82] to-[#78C2AD]"
                : isPastDue
                ? "bg-gradient-to-r from-red-600 to-red-400"
                : "bg-gradient-to-r from-[#2A5C82] to-[#A0C4D7]"
            }`}>
              <div className="flex items-center gap-2">
                <Crown size={18} className="text-white" />
                <span className="text-base font-bold text-white">{planLabel}</span>
              </div>
            </div>

            <div className="bg-card p-5 space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge className={`${statusBadge.className} text-xs font-semibold`}>
                  {statusBadge.label}
                </Badge>
              </div>

              {/* Price */}
              {subscription && isActive && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Valor</span>
                  <span className="text-sm font-semibold text-foreground">
                    {subscription.plan_type === "annual" ? "R$ 191,00/ano" : "R$ 19,90/mês"}
                  </span>
                </div>
              )}

              {/* Renewal */}
              {renewalDate && isActive && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Próxima renovação</span>
                  <span className="text-sm font-semibold text-foreground">{renewalDate}</span>
                </div>
              )}

              {/* Trial countdown */}
              {(isImplicitTrial || (isTrialing && !trialExpired)) && trialDaysLeft > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">
                  <Clock size={14} className="shrink-0" />
                  <span>
                    Faltam <strong className="text-foreground">{trialDaysLeft} dias</strong> para o fim do seu acesso gratuito.
                  </span>
                </div>
              )}

              {/* Expired message */}
              {(trialExpired || implicitTrialExpired) && !isActive && (
                <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">
                  Seus 30 dias de acesso gratuito terminaram. Assine para continuar.
                </p>
              )}

              {/* Past due action */}
              {isPastDue && (
                <Button
                  onClick={handleRegularize}
                  disabled={loadingSubscription}
                  className="w-full h-11 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold shadow-md"
                >
                  {loadingSubscription ? <Loader2 className="animate-spin" size={16} /> : (
                    <span className="flex items-center gap-2">
                      <AlertCircle size={16} />
                      Regularizar Pagamento
                    </span>
                  )}
                </Button>
              )}

              {/* Cancel button (only for active paid subscriptions) */}
              {isActive && subscription && (
                <Button
                  variant="outline"
                  onClick={() => setShowCancelDialog(true)}
                  className="w-full h-11 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5 font-semibold"
                >
                  Cancelar Assinatura
                </Button>
              )}

              {/* Canceled message */}
              {isCanceled && (
                <div className="bg-muted/40 rounded-lg p-3 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Sua assinatura foi cancelada. Assine novamente para recuperar o acesso Premium.
                  </p>
                  <Button
                    onClick={handleRegularize}
                    disabled={loadingSubscription}
                    className="w-full h-10 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-bold"
                  >
                    {loadingSubscription ? <Loader2 className="animate-spin" size={16} /> : "Reassinar"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent className="max-w-[340px] rounded-[24px] w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja cancelar?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Tem certeza que deseja cancelar? O aplicativo Locus Vita e todos os seus recursos ficarão totalmente indisponíveis para você e sua família ao final do período vigente.
              </span>
              {renewalDate && (
                <span className="block text-foreground font-medium">
                  Seu acesso continua até {renewalDate}.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-semibold">Desistir</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelling}
            >
              {cancelling ? <Loader2 className="animate-spin" size={16} /> : "Confirmar Cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MeuPlano;
