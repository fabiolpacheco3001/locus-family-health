import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// Tempo de inatividade antes de bloquear a sessão (60 minutos)
const SESSION_TIMEOUT_MS = 60 * 60 * 1000;

// Eventos que contam como "atividade do usuário"
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;

/**
 * Após SESSION_TIMEOUT_MS de inatividade real (sem nenhuma interação),
 * redireciona para login. A sessão Supabase NÃO é revogada — o refresh
 * token permanece válido para que o Face ID / biometria continue
 * funcionando ao retornar ao app. O app lock (5 min) cuida do bloqueio
 * de UI antes desse timeout.
 */
export function useSessionTimeout(enabled = true) {
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      toast.info("Sessão bloqueada por inatividade.", {
        duration: 4000,
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
