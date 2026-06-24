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
  getUserIdentities: () => Promise<ReturnType<typeof supabase.auth.getUserIdentities>>;
  linkIdentity: (provider: "google" | "apple") => Promise<{ error: Error | null }>;
  unlinkIdentity: (identity: any) => Promise<{ error: Error | null }>;
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

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) setFreshlyLoggedIn(true);
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
    });
    if (!error) setFreshlyLoggedIn(true);
    return { error: error as Error | null };
  };

  const signOut = async () => {
    // Clear subscription cache so the next user doesn't inherit it
    try { localStorage.removeItem("lv_sub_cache"); } catch { /* ignore */ }
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
