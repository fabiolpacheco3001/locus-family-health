import { useState } from "react";
import { Rocket, Loader2, LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createSubscription } from "@/services/asaasService";
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

const PaywallModal = ({ open, onOpenChange, locked, onLogout }: PaywallModalProps) => {
  const [loadingPlan, setLoadingPlan] = useState<"monthly" | "annual" | null>(null);

  const handleSubscribe = async (planType: "monthly" | "annual") => {
    setLoadingPlan(planType);
    try {
      const url = await createSubscription(planType);
      window.location.href = url;
    } catch {
      toast.error("Erro ao gerar link de pagamento. Tente novamente.");
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
        <DialogHeader className="items-center text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center mx-auto">
            <Rocket size={32} className="text-accent" />
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">
            Eleve a saúde da sua família
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground text-center leading-relaxed">
            Seu período de avaliação terminou ou há pendências no seu plano. Assine o Locus Vita para
            continuar usando nossas tecnologias premium.
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
                <span className="text-base font-bold">R$ 19,90</span>
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
                <span className="text-base font-bold">R$ 191,00</span>
              </>
            )}
          </Button>
        </div>

        {locked && onLogout && (
          <Button
            variant="ghost"
            className="mt-3 w-full text-muted-foreground"
            onClick={onLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair da conta
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaywallModal;
