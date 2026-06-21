/**
 * useAppLock
 *
 * App Lock logic for PWA biometric unlock.
 *
 * Behavior:
 *   - If the app was resumed from a saved session (localStorage) AND the user
 *     has at least one registered passkey → lock immediately on mount.
 *   - If the app goes to background for >LOCK_TIMEOUT_MS and comes back → lock.
 *   - Fresh logins (just typed email/password) → do NOT lock on first render.
 *   - Sign-out → always clears the lock.
 *
 * Returns:
 *   isLocked         — whether to show the lock screen
 *   isReady          — passkeys query resolved (safe to render content)
 *   hadInitialSession — session was restored from localStorage (show pre-lock loader)
 *   unlock           — call after successful biometric auth
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePasskeys } from "@/hooks/usePasskeys";

const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 min background → re-lock

/**
 * Flag de módulo JS — persiste na memória entre remontagens do AppLayout
 * dentro da mesma sessão de página (não sobrevive a page reload).
 *
 * Por que módulo e não sessionStorage?
 *  - Mais rápido (síncrono, sem serialização)
 *  - Não persiste além do ciclo de vida do JS (segurança)
 *  - Cada reload do PWA reinicia o flag corretamente
 *
 * Cenário que resolve:
 *  - PWA resume → AppLayout monta → lock/unlock acontece → wasCheckedThisSession = true
 *  - Usuário vai p/ PoliticaPrivacidade (fora do AppLayout) → AppLayout desmonta
 *  - Usuário volta → AppLayout remonta → wasCheckedThisSession = true → NÃO re-trava
 *
 * O bloqueio por inatividade (>5 min em background) reseta o flag via
 * handleVisibilityBackground() para garantir que o lock volte a funcionar.
 */
let wasCheckedThisSession = false;

export function useAppLock() {
  const { user, session, freshlyLoggedIn } = useAuth();
  const { passkeys, isLoading } = usePasskeys();

  const hasPasskeys = passkeys.length > 0;

  // Capture freshlyLoggedIn at mount time (ref = won't re-trigger effects on change).
  // true  → user just typed email/password in this JS session → do NOT lock on first render
  // false → PWA resumed with restored session (freshlyLoggedIn was never set) → lock
  const wasFreshLogin = useRef(freshlyLoggedIn).current;

  const [isLocked, setIsLocked] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  // ── Initial lock decision (runs once when passkeys query resolves) ──────────
  useEffect(() => {
    if (isLoading) return;

    // Segunda+ montagem do AppLayout na mesma sessão JS:
    // O usuário já passou pelo check inicial (biometria ou sem lock).
    // Não re-trava para evitar logout falso ao voltar de páginas externas ao layout.
    if (wasCheckedThisSession) {
      setIsReady(true);
      return;
    }

    if (session && hasPasskeys && !wasFreshLogin) {
      // Session was restored from localStorage and user has passkeys → lock
      setIsLocked(true);
    }
    setIsReady(true);
    wasCheckedThisSession = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]); // intentionally only on isLoading change (runs once on resolve)

  // ── Background visibility → re-lock after timeout ─────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else if (document.visibilityState === "visible") {
        if (hiddenAt.current && session && hasPasskeys) {
          const elapsed = Date.now() - hiddenAt.current;
          if (elapsed > LOCK_TIMEOUT_MS) {
            setIsLocked(true);
            // Reseta o flag para que o próximo mount do AppLayout também verifique
            wasCheckedThisSession = false;
          }
        }
        hiddenAt.current = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [session, hasPasskeys]);

  // ── Sign-out → always clear lock ──────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setIsLocked(false);
      // Note: isReady não é resetado aqui — representa status do check de passkeys,
      // não o estado de autenticação. Resetar causaria flash da tela de loading
      // a cada refresh de JWT.
    }
  }, [user]);

  const unlock = useCallback(() => {
    setIsLocked(false);
    wasCheckedThisSession = true; // Usuário desbloqueou — não re-trava em remontagens
  }, []);

  // hadInitialSession: true when it's a PWA resume (not a fresh login).
  // Used by AppLayout to show a pre-lock logo spinner instead of flashing content.
  const hadInitialSession = !wasFreshLogin && !!user;

  return { isLocked, isReady, hadInitialSession, unlock };
}
