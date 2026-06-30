import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createSubscription } from "@/services/asaasService";

/**
 * Chave localStorage para preservar o deep link através do fluxo de auth.
 * Escrita pelo auth guard em AppLayout (quando sessão expira em rota protegida)
 * e lida aqui após o OAuth completar.
 */
const REDIRECT_KEY = "lv_redirect_after_login";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Usar onAuthStateChange ao invés de setInterval/polling.
    // O Supabase detecta o código OAuth na URL (detectSessionInUrl=true por padrão),
    // faz o exchange automaticamente e emite SIGNED_IN sub-100ms após a troca.
    // O polling anterior aguardava até 5s verificando getSession() a cada 200ms.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        // Ignorar INITIAL_SESSION, TOKEN_REFRESHED, SIGNED_OUT — aguardar só SIGNED_IN
        if (_event !== "SIGNED_IN" || !session) return;

        subscription.unsubscribe();
        const user = session.user;

        // RN-02 — Consentimento LGPD para novos usuários via login social
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
        } catch { /* não bloquear — consentimento é best-effort aqui */ }

        // RN-03 — Tunnel de checkout: se o usuário clicou "Assinar" antes do OAuth
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

        // BK-03 — Restaurar deep link salvo pelo auth guard do AppLayout.
        // Cenário: sessão expirou enquanto usuário estava em rota protegida
        // (ex: clicou em notificação de medicamento após Google session expirar).
        // O auth guard salva o pathname em lv_redirect_after_login antes de
        // redirecionar para /login. Após o OAuth, retornamos à tela correta.
        const raw = localStorage.getItem(REDIRECT_KEY);
        const redirectTo = raw?.startsWith("/") && !raw.startsWith("//") && !raw.includes("://")
          ? raw
          : null;

        if (redirectTo) {
          localStorage.removeItem(REDIRECT_KEY);
          navigate(redirectTo, { replace: true });
          return;
        }

        navigate("/home", { replace: true });
      }
    );

    // Fallback: se SIGNED_IN nunca disparar (código inválido/expirado), falhar após 8s
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      toast.error("Autenticação falhou. Tente novamente.");
      navigate("/login");
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#f2f0eb] animate-fade-in">
      <Loader2 className="animate-spin text-primary mb-4" size={48} />
      <p className="text-sm text-muted-foreground">Autenticando...</p>
    </div>
  );
};

export default AuthCallback;
