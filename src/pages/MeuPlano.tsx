import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, Clock, Crown, Loader2 } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { createSubscription } from "@/services/asaasService";
import { toast } from "sonner";

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
  } = useSubscription();

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [loadingSubscription, setLoadingSubscription] = useState(false);

  const planLabel = useMemo(() => {
    if (!subscription) return "Plano Gratuito";
    return subscription.plan_type === "annual"
      ? "Locus Vita Premium Anual"
      : "Locus Vita Premium Mensal";
  }, [subscription]);

  const statusBadge = useMemo(() => {
    if (isActive) {
      return {
        label: "Ativo",
        className: "bg-primary/15 text-foreground border-primary/30",
      };
    }

    if (isPastDue) {
      return {
        label: "Pagamento Pendente",
        className: "bg-accent/20 text-foreground border-accent/30",
      };
    }

    if (isCanceled) {
      return {
        label: "Cancelado",
        className: "bg-destructive/15 text-destructive border-destructive/30",
      };
    }

    if (isTrialing && !trialExpired) {
      return {
        label: "Período Gratuito",
        className: "bg-secondary/15 text-foreground border-secondary/30",
      };
    }

    if (trialExpired || implicitTrialExpired) {
      return {
        label: "Expirado",
        className: "bg-muted text-muted-foreground border-border",
      };
    }

    return {
      label: "Gratuito",
      className: "bg-muted text-muted-foreground border-border",
    };
  }, [implicitTrialExpired, isActive, isCanceled, isPastDue, isTrialing, trialExpired]);

  const billingDateLabel = isCanceled ? "Acesso válido até" : "Próxima renovação";

  const formattedBillingDate = useMemo(() => {
    const rawDate = subscription?.next_billing_date;
    if (!rawDate) return "Data não disponível";

    const normalizedDate = rawDate.length === 10 ? `${rawDate}T12:00:00` : rawDate;
    const parsedDate = parseISO(normalizedDate);

    if (!isValid(parsedDate)) return "Data não disponível";

    return format(parsedDate, "dd MMM yyyy", { locale: ptBR });
  }, [subscription?.next_billing_date]);

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
      if (!user?.id) throw new Error("Sessão inválida.");
      if (!subscription?.asaas_subscription_id) throw new Error("Assinatura não encontrada.");

      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData?.session) throw new Error("Sessão inválida.");

      const { data, error } = await supabase.functions.invoke("cancel-asaas-subscription", {
        body: {
          asaasSubscriptionId: subscription.asaas_subscription_id,
        },
        headers: {
          Authorization: `Bearer ${refreshData.session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { data: updatedSubscription, error: confirmError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (confirmError) throw confirmError;
      if (!updatedSubscription) throw new Error("Assinatura não encontrada após cancelamento.");
      if (updatedSubscription.status !== "canceled") {
        throw new Error("O cancelamento ainda não foi confirmado no banco.");
      }

      queryClient.setQueryData(["subscription", user.id], updatedSubscription);
      await queryClient.invalidateQueries({ queryKey: ["subscription", user.id] });
+
      setShowCancelDialog(false);
      toast.success("Assinatura cancelada com sucesso");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro desconhecido ao cancelar");
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

  return (
    <div className="fixed inset-x-0 top-0 bottom-[72px] z-10 flex flex-col overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="min-h-[calc(100%+1px)] space-y-4 px-4 pb-32">
          <div className="sticky top-0 z-30 -mx-4 bg-background/80 px-5 pb-4 pt-6 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="rounded-full p-1 transition-colors hover:bg-muted/60"
              >
                <ArrowLeft size={22} className="text-foreground" />
              </button>
              <h1 className="text-2xl font-bold text-foreground">Meu Plano</h1>
            </div>
          </div>

          {!subscription ? (
            <div className="rounded-xl border border-border/40 bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Nenhum plano contratado.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/40 shadow-sm">
              <div
                className={[
                  "px-4 py-4",
                  isActive
                    ? "bg-gradient-to-r from-foreground to-secondary"
                    : isPastDue
                      ? "bg-destructive"
                      : "bg-gradient-to-r from-foreground to-primary",
                ].join(" ")}
              >
                <div className="flex items-center gap-2 text-primary-foreground">
                  <Crown size={18} />
                  <span className="text-base font-bold">{planLabel}</span>
                </div>
              </div>

              <div className="space-y-4 bg-card p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge className={`${statusBadge.className} text-xs font-semibold`}>
                    {statusBadge.label}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Valor</span>
                  <span className="text-sm font-semibold text-foreground">
                    {subscription.plan_type === "annual" ? "R$ 191,00/ano" : "R$ 19,90/mês"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">{billingDateLabel}</span>
                  <span className="text-right text-sm font-semibold text-foreground">
                    {formattedBillingDate}
                  </span>
                </div>

                {(isImplicitTrial || (isTrialing && !trialExpired)) && trialDaysLeft > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                    <Clock size={14} className="shrink-0" />
                    <span>
                      Faltam <strong className="text-foreground">{trialDaysLeft} dias</strong> para o fim do seu acesso gratuito.
                    </span>
                  </div>
                )}

                {(trialExpired || implicitTrialExpired) && !isActive && !isCanceled && (
                  <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                    Seus 30 dias de acesso gratuito terminaram. Assine para continuar.
                  </p>
                )}

                {isPastDue && (
                  <Button
                    onClick={handleRegularize}
                    disabled={loadingSubscription}
                    className="h-11 w-full rounded-xl bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
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

                {isActive && (
                  <Button
                    variant="outline"
                    onClick={() => setShowCancelDialog(true)}
                    className="h-11 w-full rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5"
                  >
                    Cancelar Assinatura
                  </Button>
                )}

                {isCanceled && (
                  <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                    <p className="text-sm text-muted-foreground">
                      {formattedBillingDate !== "Data não disponível"
                        ? `Plano cancelado. Você poderá utilizar o aplicativo normalmente até a data ${formattedBillingDate}.`
                        : "Plano cancelado. Data não disponível."}
                    </p>
                    <Button
                      onClick={handleReactivate}
                      disabled={loadingSubscription}
                      className="h-10 w-full rounded-xl font-bold"
                    >
                      {loadingSubscription ? <Loader2 className="animate-spin" size={16} /> : "Reativar Plano"}
                    </Button>
                  </div>
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
              <span className="block">
                Você e sua família perderão acesso total ao aplicativo Locus Vita ao final do período vigente.
              </span>
              {formattedBillingDate !== "Data não disponível" && (
                <span className="block font-medium text-foreground">
                  Seu acesso continua até {formattedBillingDate}.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-semibold" disabled={cancelling}>
              Desistir
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleCancelSubscription();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
