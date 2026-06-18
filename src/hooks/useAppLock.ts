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
  const { user, session } = useAuth();
  const { passkeys, isLoading } = usePasskeys();

  const hasPasskeys = passkeys.length > 0;

  // True if session was already in localStorage when this hook first mounted.
  // This distinguishes "PWA resumed" from "just logged in".
  const hadInitialSession = useRef(user !== null).current;

  const [isLocked, setIsLocked] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  // ── Initial lock decision (runs once when passkeys query resolves) ──────────
  useEffect(() => {
    if (isLoading) return;
    if (session && hasPasskeys && hadInitialSession) {
      // Session was restored from storage and user has passkeys → lock
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

  return { isLocked, isReady, hadInitialSession, unlock };
}
