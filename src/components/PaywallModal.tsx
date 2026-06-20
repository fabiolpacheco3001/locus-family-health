import { useState, useEffect, useRef } from "react";
import { PLAN_MONTHLY_DISPLAY, PLAN_ANNUAL_DISPLAY } from "@/lib/planConfig";
import { TRIAL_DAYS } from "@/lib/constants";
import { Rocket, Loader2, LogOut, CheckCircle2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createSubscription } from "@/services/asaasService";
import { withTimeout, PAYMENT_TIMEOUT_MS } from "@/lib/withTimeout";
import { useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface PaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, hides close button and forces interaction */
  locked?: boolean;
  onLogout?: () => void;
  /** When true, shows implicit trial expired message */
  implicitTrialExpired?: boolean;
}

const PaywallModal = ({ open, onOpenChange, locked, onLogout, implicitTrialExpired }: PaywallModalProps) => {
  const [loadingPlan, setLoadingPlan] = useState<"monthly" | "annual" | null>(null);
  const [awaitingPayment, setAwaitingPayment] = useState(false);
  const [checkCount, setCheckCount] = useState(0);
  const queryClient = useQueryClient();
  const { canUsePremium } = useSubscription();
  const { user } = useAuth();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const MAX_POLLS = 24; // 2 minutos (24 × 5s)

  // Auto-fecha o modal quando subscription fica ativa (qualquer estado)
  useEffect(() => {
    if (open && canUsePremium) {
      stopPolling();
      setAwaitingPayment(false);
      onOpenChange(false);
      toast.success("Assinatura confirmada! Bem-vindo ao Locus Vita Premium.");
    }
  }, [open, canUsePremium]);

  // Limpa o polling quando o modal fecha
  useEffect(() => {
    if (!open) {
      stopPolling();
      setAwaitingPayment(false);
      setCheckCount(0);
    }
  }, [open]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = () => {
    setAwaitingPayment(true);
    setCheckCount(0);
    stopPolling();
    pollRef.current = setInterval(async () => {
      setCheckCount(prev => {
        const next = prev + 1;
        if (next >= MAX_POLLS) {
          stopPolling();
          setAwaitingPayment(false);
          toast.info("Não detectamos a confirmação do pagamento. Se você pagou, tente verificar manualmente.");
        }
        return next;
      });
      // type: "all" força refetch mesmo quando query está inativa (enabled=false)
      await queryClient.invalidateQueries({ queryKey: ["subscription"], type: "all" });
    }, 5000);
  };

  const handleVerifyManually = async () => {
    // type: "all" força refetch mesmo quando query está inativa
    await queryClient.refetchQueries({ queryKey: ["subscription"], type: "all" });
    // Usar chave completa ["subscription", user?.id] — mesma chave usada pelo hook
    const sub = queryClient.getQueryData<{ status?: string }>(["subscription", user?.id]);
    const isActive = sub?.status === "active" || sub?.status === "trialing";
    if (isActive) {
      onOpenChange(false);
      toast.success("Assinatura confirmada!");
    } else {
      toast.info("Assinatura ainda não confirmada. Aguarde alguns instantes e tente novamente.");
    }
  };

  const handleSubscribe = async (planType: "monthly" | "annual") => {
    setLoadingPlan(planType);
    const checkoutWindow = window.open("about:blank", "_blank");
    try {
      const url = await withTimeout(
        createSubscription(planType),
        PAYMENT_TIMEOUT_MS,
        "Tempo limite de pagamento atingido. Tente novamente."
      );
      if (checkoutWindow) {
        checkoutWindow.location.href = url;
      } else {
        window.location.href = url;
      }
      // Inicia polling para detectar confirmação do pagamento
      startPolling();
    } catch (err) {
      if (checkoutWindow) checkoutWindow.close();
      toast.error(err instanceof Error ? err.message : "Erro ao gerar link de pagamento. Tente novamente.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={locked ? () => {} : onOpenChange}>
      <DialogContent
        className="max-w-[380px] rounded-[24px] w-[92vw] p-6"
        onPointerDownOutside={locked ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={locked ? (e) => e.preventDefault() : undefined}
        hideCloseButton={locked}
      >
        {awaitingPayment ? (
          /* Estado: aguardando confirmação do Asaas */
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center">
              <Loader2 size={32} className="text-accent animate-spin" />
            </div>
            <div className="space-y-1.5">
              <p className="font-bold text-foreground">Aguardando confirmação...</p>
              <p className="text-sm text-muted-foreground">
                Finalize o pagamento na janela que abriu. Detectaremos automaticamente quando for confirmado.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl text-sm font-medium"
              onClick={handleVerifyManually}
            >
              <RefreshCw size={16} className="mr-2" />
              Já paguei — Verificar agora
            </Button>
            <Button
              variant="ghost"
              className="text-xs text-muted-foreground"
              onClick={() => { stopPolling(); setAwaitingPayment(false); }}
            >
              Voltar à seleção de planos
            </Button>
          </div>
        ) : (
          /* Estado: seleção de plano */
          <>
            <DialogHeader className="items-center text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center mx-auto">
                <Rocket size={32} className="text-accent" />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Eleve a saúde da sua família
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground text-center leading-relaxed">
                {implicitTrialExpired
                  ? `Seus ${TRIAL_DAYS} dias de teste gratuito terminaram. Assine para continuar cuidando da saúde da sua família.`
                  : "Seu período de avaliação terminou ou há pendências no seu plano. Assine o Locus Vita para continuar usando nossas tecnologias premium."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <Button
                onClick={() => handleSubscribe("monthly")}
                disabled={!!loadingPlan}
                className="h-14 flex flex-col items-center justify-center gap-0.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-lg"
              >
                {loadingPlan === "monthly" ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <span className="text-xs font-medium opacity-80">Mensal</span>
                    <span className="text-base font-bold">{PLAN_MONTHLY_DISPLAY}</span>
                  </>
                )}
              </Button>

              <Button
                onClick={() => handleSubscribe("annual")}
                disabled={!!loadingPlan}
                className="h-14 flex flex-col items-center justify-center gap-0.5 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-bold shadow-lg"
              >
                {loadingPlan === "annual" ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <span className="text-xs font-medium opacity-80">Anual</span>
                    <span className="text-base font-bold">{PLAN_ANNUAL_DISPLAY}</span>
                  </>
                )}
              </Button>
            </div>

            {locked && (
              <div className="mt-3 flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="w-full h-11 rounded-xl text-sm font-medium"
                  onClick={handleVerifyManually}
                >
                  <RefreshCw size={16} className="mr-2" />
                  Verificar minha assinatura
                </Button>
                {onLogout && (
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={onLogout}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair da conta
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaywallModal;
