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

/**
 * Chave localStorage usada por LoginSocial.tsx antes de chamar linkIdentity().
 * Indica para onde redirecionar após o fluxo de vinculação de provedor (USER_UPDATED).
 * Validação: deve começar com "/" mas não com "//" (open redirect protection).
 */
const OAUTH_REDIRECT_KEY = "lv_oauth_redirect";

/**
 * Deve estar em sync com UNLOCK_TS_KEY em useAppLock.ts e useAuth.tsx.
 * Escrita após OAuth bem-sucedido (Google/Apple) para que o app lock
 * não re-trave se o iOS matar e reiniciar o processo dentro de 5 min.
 */
const UNLOCK_TS_KEY = "lv_app_unlock_at";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Usar onAuthStateChange ao invés de setInterval/polling.
    // O Supabase detecta o código OAuth na URL (detectSessionInUrl=true por padrão),
    // faz o exchange automaticamente e emite SIGNED_IN sub-100ms após a troca.
    // O polling anterior aguardava até 5s verificando getSession() a cada 200ms.

    // Declarado antes do handler para que o closure possa cancelar o timeout
    // logo ao receber SIGNED_IN — antes do async work — evitando race condition
    // onde o timeout dispara durante operações lentas de rede (ex: consent insert).
    let timeout: ReturnType<typeof setTimeout>;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        // RN-06 — Vinculação de provedor via LoginSocial.tsx.
        // linkIdentity() dispara USER_UPDATED (não SIGNED_IN); lv_oauth_redirect indica
        // o destino configurado antes do redirect para o provedor OAuth.
        if (_event === "USER_UPDATED" && session) {
          const oauthRedirect = localStorage.getItem(OAUTH_REDIRECT_KEY);
          if (oauthRedirect) {
            clearTimeout(timeout);
            subscription.unsubscribe();
            localStorage.removeItem(OAUTH_REDIRECT_KEY);
            const validPath = oauthRedirect.startsWith("/") && !oauthRedirect.startsWith("//")
              ? oauthRedirect
              : "/home";
            navigate(validPath, { replace: true });
            return;
          }
        }

        // Ignorar INITIAL_SESSION, TOKEN_REFRESHED, SIGNED_OUT — aguardar só SIGNED_IN
        if (_event !== "SIGNED_IN" || !session) return;

        // Cancelar o timeout IMEDIATAMENTE ao confirmar o login — antes de qualquer
        // await — para evitar que dispare durante operações de rede lentas
        // (ex: revogar + re-autorizar o app Google gera exchange mais lento).
        clearTimeout(timeout);
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

        // Marca unlock para o app lock: se o iOS matar e reiniciar o PWA
        // dentro de 5 min após este login Google/Apple, não re-trava o usuário.
        try { localStorage.setItem(UNLOCK_TS_KEY, String(Date.now())); } catch { /* ignore */ }

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
    timeout = setTimeout(() => {
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
