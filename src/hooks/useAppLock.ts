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

export function useAppLock() {
  const { user, session, lastAuthEvent } = useAuth();
  const { passkeys, isLoading } = usePasskeys();

  const hasPasskeys = passkeys.length > 0;

  // Capture the auth event at the moment AppLayout first mounts.
  // 'INITIAL_SESSION' = session restored from localStorage (PWA resume) → lock.
  // 'SIGNED_IN'       = user just typed email/password → do NOT lock on first render.
  // null              = event not yet fired (shouldn't happen in practice).
  const mountAuthEvent = useRef(lastAuthEvent).current;

  const [isLocked, setIsLocked] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  // ── Initial lock decision (runs once when passkeys query resolves) ──────────
  useEffect(() => {
    if (isLoading) return;
    const isRestoredSession = mountAuthEvent === "INITIAL_SESSION";
    if (session && hasPasskeys && isRestoredSession) {
      // Session was restored from localStorage and user has passkeys → lock
      setIsLocked(true);
    }
    setIsReady(true);
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
      setIsReady(false);
    }
  }, [user]);

  const unlock = useCallback(() => setIsLocked(false), []);

  // hadInitialSession: true when the session was restored from storage (not fresh login)
  // Used by AppLayout to decide whether to show a pre-lock logo spinner.
  const hadInitialSession = mountAuthEvent === "INITIAL_SESSION";

  return { isLocked, isReady, hadInitialSession, unlock };
}
