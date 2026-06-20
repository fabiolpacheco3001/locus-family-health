import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Tempo de inatividade antes de revogar a sessão Supabase (60 minutos)
const SESSION_TIMEOUT_MS = 60 * 60 * 1000;

// Eventos que contam como "atividade do usuário"
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;

/**
 * Após SESSION_TIMEOUT_MS de inatividade real (sem nenhuma interação),
 * revoga o token Supabase e redireciona para login.
 *
 * Diferente do app lock (que apenas bloqueia a UI):
 * - App lock: 5 min → tela bloqueada, token ativo, biometria desbloqueia
 * - Session timeout: 60 min → token REVOGADO, precisa fazer login novamente
 */
export function useSessionTimeout(enabled = true) {
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      await supabase.auth.signOut();
      toast.info("Sessão encerrada por inatividade. Faça login novamente.", {
        duration: 5000,
      });
      navigate("/");
    }, SESSION_TIMEOUT_MS);
  }, [navigate]);

  useEffect(() => {
    if (!enabled) return;

    // Iniciar timer ao montar
    resetTimer();

    // Reiniciar em qualquer interação
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [resetTimer, enabled]);
}
