import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createSubscription } from "@/services/asaasService";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let attempts = 0;
    const MAX_ATTEMPTS = 25; // ~5s with 200ms intervals

    const interval = setInterval(async () => {
      attempts++;
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        clearInterval(interval);
        const user = session.user;

        // RN-02 — LGPD consent for new users via social login
        try {
          const { count } = await supabase
            .from("consent_log")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id);

          if (count === 0) {
            const userAgent = navigator.userAgent.slice(0, 500);
            await supabase.from("consent_log").insert([
              { user_id: user.id, consent_type: "privacy_policy",           policy_version: "1.0", user_agent: userAgent },
              { user_id: user.id, consent_type: "health_data",              policy_version: "1.0", user_agent: userAgent },
              { user_id: user.id, consent_type: "social_auth_data_sharing", policy_version: "1.0", user_agent: userAgent },
            ]);
          }
        } catch { /* non-blocking */ }

        // RN-03 — Checkout tunnel via localStorage
        const plan = localStorage.getItem("lv_oauth_plan");
        if (plan) {
          localStorage.removeItem("lv_oauth_plan");
          try {
            const url = await createSubscription(plan as "monthly" | "annual");
            window.location.href = url;
            return;
          } catch {
            toast.error("Conta criada, mas houve um erro ao redirecionar para o pagamento. Tente em Ajustes → Meu Plano.");
            navigate("/home", { replace: true });
            return;
          }
        }

        navigate("/home", { replace: true });
        return;
      }

      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(interval);
        toast.error("Autenticação falhou. Tente novamente.");
        navigate("/login");
      }
    }, 200);

    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#f2f0eb] animate-fade-in">
      <Loader2 className="animate-spin text-primary mb-4" size={48} />
      <p className="text-sm text-muted-foreground">Autenticando...</p>
    </div>
  );
};

export default AuthCallback;
