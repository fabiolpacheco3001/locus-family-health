import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { isFuture } from "date-fns";
import { useEffect } from "react";

const LOCAL_SUB_KEY = "lv_sub_cache";

export interface Subscription {
  id: string;
  user_id: string;
  asaas_subscription_id?: string | null;
  plan_type: string;
  status: string;
  trial_end: string | null;
  next_billing_date: string | null;
  asaas_customer_id: string | null;
  test_mode?: boolean;
  created_at: string;
  updated_at: string;
}

/** Read a valid active subscription from localStorage (max 24h cache, must have future billing date). */
function readLocalCache(): Subscription | undefined {
  try {
    const raw = localStorage.getItem(LOCAL_SUB_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Subscription & { _cachedAt: number };
    if (parsed.status !== "active" && parsed.status !== "trialing") return undefined;
    // Cache expires after 24 hours
    if (Date.now() - (parsed._cachedAt ?? 0) > 24 * 60 * 60 * 1000) return undefined;
    // Subscription itself must still be valid
    if (parsed.next_billing_date && !isFuture(new Date(parsed.next_billing_date))) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function writeLocalCache(sub: Subscription) {
  try {
    localStorage.setItem(LOCAL_SUB_KEY, JSON.stringify({ ...sub, _cachedAt: Date.now() }));
  } catch {}
}

function clearLocalCache() {
  try {
    localStorage.removeItem(LOCAL_SUB_KEY);
  } catch {}
}

export function useSubscription() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();

  // Read localStorage cache once (synchronous, before query runs)
  const localCache = readLocalCache();

  const { data: subscription, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Garante JWT fresco — usa refreshSession apenas se o token expira em < 5 min.
      // getSession() não garante renovação real em iOS PWA cold starts; refreshSession()
      // force-renova via rede. Evitamos chamar no caso normal para não sobrecarregar o
      // polling de 15s de usuários não-premium.
      const { data: sessionData } = await supabase.auth.getSession();
      const expiresAt = sessionData?.session?.expires_at ?? 0;
      const secondsUntilExpiry = expiresAt - Math.floor(Date.now() / 1000);
      if (secondsUntilExpiry < 300) {
        // Token expira em < 5 min (ou já expirou) — força renovação real via rede
        const { error: refreshErr } = await supabase.auth.refreshSession();
        if (refreshErr) {
          // Falha de rede/auth — preserva cache ativo para não derrubar usuário premium
          const fallback = queryClient.getQueryData(["subscription", user.id]) as { status?: string } | null;
          if (fallback?.status === "active" || fallback?.status === "trialing") {
            return fallback as unknown as Subscription;
          }
          return null;
        }
      }

      // Sticky active: se já temos subscription ativa em cache, preservamos
      // durante falhas transitórias (ex: janela de refresh do JWT do Supabase)
      const cachedSub = queryClient.getQueryData(["subscription", user.id]) as { status?: string } | null;
      const hadActiveCached = cachedSub?.status === "active" || cachedSub?.status === "trialing";

      // M5: Run Q1 (own subscription) and Q2 (family membership) in parallel —
      // they're independent; saves one round-trip for non-active subscribers.
      const [{ data: ownSub, error }, { data: membership }] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("family_group_members")
          .select("group_id")
          .eq("auth_user_id", user.id)
          .maybeSingle(),
      ]);

      if (error) {
        // Se falhou mas tínhamos subscription ativa, retorna o cache
        // (previne PaywallModal durante janela de refresh do JWT)
        if (hadActiveCached && cachedSub) return cachedSub as unknown as Subscription;
        throw error;
      }

      // Se query retornou null mas tínhamos subscription ativa (falha transitória RLS),
      // preservar o dado em cache em vez de retornar null
      if (!ownSub && hadActiveCached && cachedSub) {
        return cachedSub as unknown as Subscription;
      }

      // 1. Active own subscription — fast path
      if (ownSub && ownSub.status === "active") {
        return ownSub as Subscription;
      }

      // 2. If no active own sub, check family owner's subscription (Tenant Billing)
      if (membership?.group_id) {
        const { data: group } = await supabase
          .from("family_groups")
          .select("created_by")
          .eq("id", membership.group_id)
          .maybeSingle();

        if (group?.created_by && group.created_by !== user.id) {
          // Use SECURITY DEFINER RPC that returns only non-sensitive columns
          const { data: ownerSubRows } = await supabase
            .rpc("get_owner_subscription_safe", { _owner_id: group.created_by });
          const ownerSub = Array.isArray(ownerSubRows) ? ownerSubRows[0] : null;

          if (ownerSub && ownerSub.status === "active") {
            return ownerSub as unknown as Subscription;
          }
        }
      }

      // 3. Fall back to own subscription (trialing, past_due, etc.)
      return (ownSub as Subscription | null) ?? null;
    },
    // Wait for session to be confirmed before querying — ensures JWT is fresh.
    // Without this, the query fires with a cached (possibly expired) JWT from
    // localStorage, RLS returns null, canUsePremium flips false, PaywallModal flashes.
    enabled: !!user?.id && !!session,
    // Use localStorage cache as initial data so a UI nunca pisca "sem assinatura"
    // no cold start enquanto a query ainda não resolveu.
    initialData: localCache,
    // NÃO usar initialDataUpdatedAt: 0. Isso causava race condition crítica:
    // forçava background refetch imediato, que disparava antes do JWT estar fresco
    // (iOS PWA cold start), RLS retornava null, clearLocalCache() era chamado e o
    // PaywallModal abria para usuários com assinatura ativa. A confirmação ocorre
    // no próximo refetch natural (window focus ou staleTime de 5min).
    // 5-min stale time: prevents refetchOnWindowFocus from triggering too often
    staleTime: 5 * 60 * 1000,
    // Poll every 15 s while the user has no premium access (e.g., waiting for webhook after payment)
    // Stops polling once canUsePremium is true (refetchInterval returns false)
    refetchInterval: (query) => {
      const sub = query.state.data as { status?: string } | null | undefined;
      const isPremium = sub?.status === "active" || sub?.status === "trialing";
      return isPremium ? false : 15_000;
    },
    refetchIntervalInBackground: false,
  });

  // Persist active subscription to localStorage for faster cold-start and resilience
  useEffect(() => {
    if (subscription?.status === "active" || subscription?.status === "trialing") {
      writeLocalCache(subscription);
    } else if (subscription === null) {
      // Explicitly null means server confirmed no subscription — clear cache
      clearLocalCache();
    }
  }, [subscription]);

  const isSuspended = subscription?.status === "suspended";
  const isCanceled = subscription?.status === "canceled";
  const isActive = subscription?.status === "active";
  const isTrialing = subscription?.status === "trialing";
  const isPastDue = subscription?.status === "past_due";

  // Implicit 30-day trial: if no subscription record exists, use auth created_at
  const implicitTrialDaysLeft = (() => {
    if (subscription) return null; // has explicit record, don't use implicit
    if (!user?.created_at) return null;
    const createdAt = new Date(user.created_at).getTime();
    const diff = 30 - Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  })();

  const trialDaysLeft = (() => {
    if (implicitTrialDaysLeft !== null) return implicitTrialDaysLeft;
    if (!isTrialing || !subscription?.trial_end) return 0;
    const diff = new Date(subscription.trial_end).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  const trialExpired = isTrialing && trialDaysLeft <= 0;

  // Grace period: canceled but still within paid cycle
  const canceledButGracePeriod = (() => {
    if (!isCanceled) return false;
    const endStr = subscription?.next_billing_date;
    if (!endStr) return false;
    const endDate = new Date(endStr);
    return !isNaN(endDate.getTime()) && isFuture(endDate);
  })();

  // Hierarchy: 1) Explicit block → 2) Grace period → 3) Explicit access → 4) Implicit trial
  const canUsePremium = (() => {
    if (isSuspended) return false;
    if (isCanceled) return canceledButGracePeriod;
    if (isActive) return true;
    if (isTrialing && !trialExpired) return true;
    // No subscription record: implicit trial
    if (!subscription && implicitTrialDaysLeft !== null) return implicitTrialDaysLeft > 0;
    return false;
  })();

  // Whether user is on implicit trial (no subscription record, within 30 days)
  const isImplicitTrial = !subscription && implicitTrialDaysLeft !== null && implicitTrialDaysLeft > 0;
  const implicitTrialExpired = !subscription && implicitTrialDaysLeft !== null && implicitTrialDaysLeft <= 0;

  return {
    subscription,
    isLoading,
    isFetching,
    refetch,
    isTrialing: isTrialing || isImplicitTrial,
    isActive,
    isPastDue,
    isCanceled,
    canceledButGracePeriod,
    trialDaysLeft,
    trialExpired: trialExpired || implicitTrialExpired,
    canUsePremium,
    isImplicitTrial,
    implicitTrialExpired,
  };
}
