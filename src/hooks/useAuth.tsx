import { useState, useEffect, useRef, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /**
   * True for ~30 s after the user explicitly called signIn/signUp in this JS session.
   * Lets useAppLock skip the initial lock right after a fresh login.
   * False on PWA resume (JS restarted, no signIn was called).
   */
  freshlyLoggedIn: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithApple: () => Promise<{ error: Error | null }>;
  getUserIdentities: () => ReturnType<typeof supabase.auth.getUserIdentities>;
  linkIdentity: (provider: "google" | "apple") => Promise<{ error: Error | null }>;
  unlinkIdentity: (identity: any) => Promise<{ error: Error | null }>;
  unlinkIdentityAdmin: (identity: { id: string; provider: string }) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  // Optimistic: try to read cached session from localStorage synchronously
  const [user, setUser] = useState<User | null>(() => {
    try {
      // B8: Project ID via env var — nunca hardcoded
      const stored = localStorage.getItem(`sb-${import.meta.env.VITE_SUPABASE_PROJECT_ID}-auth-token`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed?.user ?? null;
      }
    } catch { /* ignore stale/invalid localStorage data */ }
    return null;
  });
  const [session, setSession] = useState<Session | null>(null);
  const [freshlyLoggedIn, setFreshlyLoggedIn] = useState(false);
  // If we found a cached user, don't block rendering
  const [loading, setLoading] = useState(!user);
  const prevSessionRef = useRef<Session | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Fresh login via social OAuth (no signIn/signUp called in this JS session).
        if (_event === "SIGNED_IN" && prevSessionRef.current === null && session) {
          setFreshlyLoggedIn(true);
        }

        // Clear all cached queries on sign-out to prevent stale RBAC state
        if (_event === "SIGNED_OUT") {
          queryClient.removeQueries();
          queryClient.clear();
        }

        prevSessionRef.current = session;
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      prevSessionRef.current = session;
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  // Must stay in sync with the UNLOCK_TS_KEY constant in useAppLock.ts
  const UNLOCK_TS_KEY = "lv_app_unlock_at";

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      setFreshlyLoggedIn(true);
      // Persist unlock timestamp so the app lock skips when iOS kills and
      // restarts the PWA process within the 5-min window after email login.
      try { localStorage.setItem(UNLOCK_TS_KEY, String(Date.now())); } catch { /* ignore */ }
    }
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
    });
    if (!error) {
      setFreshlyLoggedIn(true);
      try { localStorage.setItem(UNLOCK_TS_KEY, String(Date.now())); } catch { /* ignore */ }
    }
    return { error: error as Error | null };
  };

  const signOut = async () => {
    // Remove this device's push subscription from the DB before signing out
    // so the old user stops receiving push notifications on this device.
    // The next user to log in will register their own subscription.
    try {
      if (user && "serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = await reg?.pushManager?.getSubscription();
        if (sub) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", user.id)
            .eq("endpoint", sub.endpoint);
        }
      }
    } catch { /* non-critical — don't block logout if SW or DB call fails */ }

    // Clear caches and unlock timestamp so the next user starts clean
    try { localStorage.removeItem("lv_sub_cache"); } catch { /* ignore */ }
    try { localStorage.removeItem(UNLOCK_TS_KEY); } catch { /* ignore */ }
    await supabase.auth.signOut();
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/auth/callback" },
    });
    return { error: error as Error | null };
  };

  const signInWithApple = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: window.location.origin + "/auth/callback" },
    });
    return { error: error as Error | null };
  };

  const getUserIdentities = async () => {
    return await supabase.auth.getUserIdentities();
  };

  const linkIdentity = async (provider: "google" | "apple") => {
    const { error } = await supabase.auth.linkIdentity({ provider });
    return { error: error as Error | null };
  };

  const unlinkIdentity = async (identity: any) => {
    const { error } = await supabase.auth.unlinkIdentity(identity);
    return { error: error as Error | null };
  };

  const unlinkIdentityAdmin = async (identity: { id: string; provider: string }) => {
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData?.session) {
        return { error: new Error("Sessão inválida. Faça login novamente.") };
      }

      // Contorna manual_linking_disabled via edge function com Service Role.
      const result = await supabase.functions.invoke("manage-google-identity", {
        body: { action: "unlink", identityId: identity.id },
        headers: {
          Authorization: `Bearer ${refreshData.session.access_token}`,
        },
      });

      if (result.error) {
        const detail = (result.data as Record<string, unknown>)?.error as string | undefined;
        return { error: new Error(detail || result.error.message || "Não foi possível desvincular.") };
      }
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error("Erro inesperado ao desvincular.") };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        freshlyLoggedIn,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
        signInWithApple,
        getUserIdentities,
        linkIdentity,
        unlinkIdentity,
        unlinkIdentityAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
