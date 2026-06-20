import { useMemo, useState } from "react";
import { PLAN_MONTHLY_DISPLAY_PERIOD, PLAN_ANNUAL_DISPLAY_PERIOD } from "@/lib/planConfig";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, Clock, Crown, FlaskConical, Loader2 } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { supabase } from "@/integrations/supabase/client";
import { createSubscription } from "@/services/asaasService";
import { withTimeout, PAYMENT_TIMEOUT_MS } from "@/lib/withTimeout";
import { toast } from "sonner";
import { captureException } from "@/lib/sentry";

const MeuPlano = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const {
    subscription,
    isActive,
    isPastDue,
    isCanceled,
    isTrialing,
    trialDaysLeft,
    trialExpired,
    isImplicitTrial,
    implicitTrialExpired,
    isLoading,
  } = useSubscription();

  const { members } = useFamilyMembers();
  const { linkedMemberId } = useFamilyGroup();
  // PROD-01 guard: check if user has CPF filled for Asaas anti-fraud
  const hasCpf = !!members?.find((m) => m.id === linkedMemberId)?.cpf;

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [loadingSubscription, setLoadingSubscription] = useState(false);

  // Parser de data blindado contra erros de Cache/Javascript
  const formattedBillingDate = useMemo(() => {
    try {
      if (!subscription || !subscription.next_billing_date) return "Data não disponível";
      const rawDate = String(subscription.next_billing_date);
      const normalizedDate = rawDate.length === 10 ? `${rawDate}T12:00:00` : rawDate;
      const parsedDate = parseISO(normalizedDate);
      if (!isValid(parsedDate)) return "Data não disponível";
      return format(parsedDate, "dd MMM yyyy", { locale: ptBR });
    } catch (error) {
      return "Data não disponível";
    }
  }, [subscription?.next_billing_date]);

  // Design System Fixo (Garante que as cores não quebrem)
  const statusData = useMemo(() => {
    if (isActive) return { label: "Ativo", color: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    if (isPastDue) return { label: "Pagamento Pendente", color: "bg-red-100 text-red-800 border-red-200" };
    if (isCanceled) return { label: "Cancelado", color: "bg-gray-200 text-gray-800 border-gray-300" };
    if (isTrialing && !trialExpired)
      return { label: "Período Gratuito", color: "bg-blue-100 text-blue-800 border-blue-200" };
    if (trialExpired || implicitTrialExpired)
      return { label: "Expirado", color: "bg-gray-100 text-gray-500 border-gray-200" };
    return { label: "Gratuito", color: "bg-gray-100 text-gray-500 border-gray-200" };
  }, [isActive, isPastDue, isCanceled, isTrialing, trialExpired, implicitTrialExpired]);

  const headerClass = isActive
    ? "bg-gradient-to-r from-emerald-600 to-teal-500"
    : isPastDue
      ? "bg-gradient-to-r from-red-600 to-rose-500"
      : "bg-gradient-to-r from-slate-700 to-slate-600";

  const handleRegularize = async () => {
    if (!hasCpf) {
      toast.warning(
        "Preencha seu CPF em Ajustes → Meus Dados para garantir aprovação do pagamento.",
        { duration: 6000 }
      );
    }
    setLoadingSubscription(true);
    const checkoutWindow = window.open("about:blank", "_blank");
    try {
      const planType = subscription?.plan_type === "annual" ? "annual" : "monthly";
      const url = await withTimeout(
        createSubscription(planType as "monthly" | "annual"),
        PAYMENT_TIMEOUT_MS,
        "Tempo limite de pagamento atingido. Tente novamente."
      );
      if (checkoutWindow) checkoutWindow.location.href = url;
      else window.location.href = url;
    } catch (err) {
      if (checkoutWindow) checkoutWindow.close();
      captureException(err);
      toast.error(err instanceof Error ? err.message : "Erro ao gerar link de pagamento.");
    } finally {
      setLoadingSubscription(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelling(true);
    try {
      if (!user?.id) throw new Error("Sessão inválida.");
      if (!subscription?.asaas_subscription_id) throw new Error("Assinatura não encontrada.");

      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData?.session) throw new Error("Sessão inválida.");

      const { data, error } = await supabase.functions.invoke("cancel-asaas-subscription", {
        body: { asaasSubscriptionId: subscription.asaas_subscription_id },
        headers: {
          Authorization: `Bearer ${refreshData.session.access_token}`,
          "x-request-id": crypto.randomUUID(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Trava de segurança: Atualiza apenas o status e preserva as datas intactas
      const { data: updatedSubscription, error: confirmError } = await supabase
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("user_id", user.id)
        .select("id, user_id, asaas_customer_id, plan_type, status, trial_end, next_billing_date, created_at, updated_at, asaas_subscription_id, test_mode, asaas_payment_id")
        .single();

      if (confirmError) throw confirmError;

      // Sincroniza o cache do React
      queryClient.setQueryData(["subscription", user.id], updatedSubscription);
      await queryClient.invalidateQueries({ queryKey: ["subscription", user.id] });

      setShowCancelDialog(false);
      toast.success("Assinatura cancelada. O acesso foi mantido até o final do período.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro desconhecido ao cancelar");
    } finally {
      setCancelling(false);
    }
  };

  const handleReactivate = async () => {
    if (!hasCpf) {
      toast.warning(
        "Preencha seu CPF em Ajustes → Meus Dados para garantir aprovação do pagamento.",
        { duration: 6000 }
      );
    }
    setLoadingSubscription(true);
    const checkoutWindow = window.open("about:blank", "_blank");
    try {
      const planType = subscription?.plan_type === "annual" ? "annual" : "monthly";
      const url = await withTimeout(
        createSubscription(planType as "monthly" | "annual"),
        PAYMENT_TIMEOUT_MS,
        "Tempo limite de pagamento atingido. Tente novamente."
      );
      if (checkoutWindow) checkoutWindow.location.href = url;
      else window.location.href = url;
    } catch (err) {
      if (checkoutWindow) checkoutWindow.close();
      captureException(err);
      toast.error(err instanceof Error ? err.message : "Erro ao gerar link de reativação.");
    } finally {
      setLoadingSubscription(false);
    }
  };

  return (
    <div className="fixed inset-x-0 top-0 bottom-[72px] z-10 flex flex-col overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="min-h-[calc(100%+1px)] space-y-4 px-4 pb-32">
          <div className="sticky top-0 z-30 -mx-4 bg-background/80 px-5 pb-4 pt-6 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="rounded-full p-1 transition-colors hover:bg-muted/60">
                <ArrowLeft size={22} className="text-foreground" />
              </button>
              <h1 className="text-2xl font-bold text-foreground">Meu Plano</h1>
            </div>
          </div>

          {subscription?.test_mode && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <FlaskConical size={14} className="shrink-0" />
              <span>Conta em modo de teste (sandbox) — pagamentos não são reais.</span>
            </div>
          )}

          {isLoading ? (
            <div className="rounded-xl border border-border/40 bg-card p-8 shadow-xs space-y-3">
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            </div>
          ) : !subscription ? (
            <div className="rounded-xl border border-border/40 bg-card p-8 shadow-xs text-center">
              <p className="text-sm font-medium text-muted-foreground">Você ainda não possui uma assinatura ativa.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/40 shadow-xs">
              <div className={`px-4 py-4 ${headerClass}`}>
                <div className="flex items-center gap-2 text-white">
                  <Crown size={18} />
                  <span className="text-base font-bold">
                    {subscription.plan_type === "annual" ? "Locus Vita Premium Anual" : "Locus Vita Premium Mensal"}
                  </span>
                </div>
              </div>

              <div className="space-y-4 bg-card p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge className={`${statusData.color} text-xs font-semibold px-2 py-0.5 border`}>
                    {statusData.label}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Valor</span>
                  <span className="text-sm font-semibold text-foreground">
                    {subscription.plan_type === "annual" ? PLAN_ANNUAL_DISPLAY_PERIOD : PLAN_MONTHLY_DISPLAY_PERIOD}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">
                    {isCanceled ? "Acesso válido até" : "Próxima renovação"}
                  </span>
                  <span className="text-right text-sm font-semibold text-foreground">{formattedBillingDate}</span>
                </div>

                {(isImplicitTrial || (isTrialing && !trialExpired)) && trialDaysLeft > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">
                    <Clock size={14} className="shrink-0" />
                    <span>
                      Faltam <strong>{trialDaysLeft} dias</strong> para o fim do seu acesso gratuito.
                    </span>
                  </div>
                )}

                {isCanceled && (
                  <div className="mt-6 space-y-4 rounded-xl bg-slate-50 border border-slate-100 p-4">
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Sua assinatura foi cancelada, mas <strong>não se preocupe!</strong> Você e sua família poderão
                      continuar usando o aplicativo normalmente até o dia <strong>{formattedBillingDate}</strong>.
                    </p>
                    <Button
                      onClick={handleReactivate}
                      disabled={loadingSubscription}
                      className="w-full h-11 bg-[#2A5C82] hover:bg-[#2A5C82]/90 text-white font-bold rounded-xl"
                    >
                      {loadingSubscription ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                      Reativar Plano
                    </Button>
                  </div>
                )}

                {isPastDue && (
                  <Button
                    onClick={handleRegularize}
                    disabled={loadingSubscription}
                    className="h-11 w-full rounded-xl bg-red-600 font-bold text-white hover:bg-red-700 mt-4"
                  >
                    {loadingSubscription ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <span className="flex items-center gap-2">
                        <AlertCircle size={16} />
                        Regularizar Pagamento
                      </span>
                    )}
                  </Button>
                )}

                {isActive && !isCanceled && (
                  <Button
                    variant="outline"
                    onClick={() => setShowCancelDialog(true)}
                    className="h-11 w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50 mt-4"
                  >
                    Cancelar Assinatura
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <AlertDialog
        open={showCancelDialog}
        onOpenChange={(open) => {
          if (!cancelling) setShowCancelDialog(open);
        }}
      >
        <AlertDialogContent className="w-[90vw] max-w-[340px] rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja cancelar?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block text-slate-600">
                Você e sua família perderão acesso total ao aplicativo Locus Vita ao final do período vigente.
              </span>
              {formattedBillingDate !== "Data não disponível" && (
                <span className="block font-medium text-foreground mt-2">
                  Seu acesso continua garantido até {formattedBillingDate}.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-semibold rounded-xl" disabled={cancelling}>
              Desistir
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleCancelSubscription();
              }}
              className="bg-red-600 text-white hover:bg-red-700 rounded-xl"
              disabled={cancelling}
            >
              {cancelling ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cancelando...
                </span>
              ) : (
                "Confirmar Cancelamento"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MeuPlano;
