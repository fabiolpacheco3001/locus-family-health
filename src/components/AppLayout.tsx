import { useRef, useState, useEffect, Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import MobileShell from "./MobileShell";
import { Skeleton } from "@/components/ui/skeleton";
import BottomNav from "./BottomNav";
import InviteAcceptInterceptor from "./InviteAcceptInterceptor";
import { useMedicationAlarms } from "@/hooks/useMedicationAlarms";
import { useStockAlerts } from "@/hooks/useStockAlerts";
import { useMedications } from "@/hooks/useMedications";
import { useMenstrualAlerts } from "@/hooks/useMenstrualAlerts";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import PaywallModal from "@/components/PaywallModal";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppLock } from "@/hooks/useAppLock";
import { AppLockScreen } from "@/components/AppLockScreen";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";

/** Lightweight inline loader — keeps shell/nav visible while lazy chunk loads */
const InlineRouteLoader = () => (
  <div className="px-5 pt-16 space-y-4">
    <Skeleton className="h-8 w-40" />
    <Skeleton className="h-24 w-full rounded-xl" />
    <Skeleton className="h-24 w-full rounded-xl" />
    <Skeleton className="h-24 w-full rounded-xl" />
  </div>
);

const AppLayout = () => {
  const { user, session, signOut } = useAuth();
  const queryClient = useQueryClient();
  const { isLocked, isReady, hadInitialSession, unlock } = useAppLock();
  const { canUsePremium, isLoading: subLoading, isFetching: subFetching, subscription, implicitTrialExpired } = useSubscription();
  const { medications } = useMedications();
  useMedicationAlarms(medications);
  useStockAlerts(medications);
  useMenstrualAlerts();
  useSessionTimeout(!!user);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  // Cold Start prefetch: when user is already authenticated (PWA resume)
  useEffect(() => {
    if (!user) return;
    const prefetchIfEmpty = (key: string[], fn: () => Promise<any>) => {
      if (!queryClient.getQueryData(key)) {
        queryClient.prefetchQuery({ queryKey: key, queryFn: fn, staleTime: 5 * 60 * 1000 });
      }
    };
    prefetchIfEmpty(["medications", "all"], async () => {
      const { data } = await supabase.from("medications").select("*, family_members(name)").eq("user_id", user.id);
      return data ?? [];
    });
    prefetchIfEmpty(["family_members", user.id], async () => {
      const { data } = await supabase.from("family_members").select("*").is("deleted_at", null).order("created_at");
      return data ?? [];
    });
    // Notifications prefetch removed — useNotifications handles its own group-aware fetch
  }, [user, queryClient]);

  // Background prefetch all critical lazy chunks after first paint
  useEffect(() => {
    const tid = setTimeout(() => {
      import("@/App").then(m => m.prefetchCriticalChunks?.());
    }, 1500);
    return () => clearTimeout(tid);
  }, []);

  // Reset scroll on navigation
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  // Exorcise stale body styles left by Radix Dialog on abrupt unmounts
  useEffect(() => {
    return () => {
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
    };
  }, []);

  // Rotas onde o paywall é suprimido para que o usuário possa preencher dados obrigatórios
  // (ex: CPF exigido pelo Asaas). Qualquer outra rota mostra o paywall normalmente.
  // Ao sair de uma bypass route, o effect re-executa e retoma a lógica normal de paywall.
  const PAYWALL_BYPASS_PATHS = ["/meus-dados"];

  // Stable paywall gate: only update when subscription is confirmed (session + query complete).
  // Prevents cycling caused by session briefly going null during JWT refresh.
  const paywallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref always tracks the freshest canUsePremium — used inside setTimeout to avoid stale closures.
  const canUsePremiumRef = useRef(canUsePremium);
  canUsePremiumRef.current = canUsePremium;

  const [showPaywall, setShowPaywall] = useState(false);
  useEffect(() => {
    // Clear any pending timer whenever deps change.
    // Rationale: on iPhone unlock, Supabase fires TOKEN_REFRESHED → session ref changes →
    // this effect runs BEFORE TanStack Query's refetchOnWindowFocus starts. At that instant
    // canUsePremium can be false (stale) and subFetching is still false (not yet started),
    // which would open the paywall incorrectly for paying subscribers.
    // The debounce below gives TanStack ~1 s to start + finish the refetch and restore
    // canUsePremium=true, at which point the timer is cancelled before it ever fires.
    if (paywallTimerRef.current) {
      clearTimeout(paywallTimerRef.current);
      paywallTimerRef.current = null;
    }

    if (!subLoading && !!session) {
      if (canUsePremium) {
        // Fecha o paywall IMEDIATAMENTE quando subscription confirmada ativa
        setShowPaywall(false);
      } else if (!subFetching) {
        // Bypass: usuário foi redirecionado para preencher dados obrigatórios antes de assinar.
        // Fecha o paywall (se aberto) e NÃO agenda reabertura enquanto estiver nessa rota.
        // Quando o usuário navegar para outra rota, pathname muda → effect re-executa →
        // retoma lógica normal → paywall volta a aparecer se ainda não tiver assinado.
        if (PAYWALL_BYPASS_PATHS.includes(pathname)) {
          setShowPaywall(false);
          return;
        }
        // Debounce 1 s antes de abrir o paywall.
        // Se o refetch de subscription completar dentro desse janela e canUsePremium voltar
        // a true, o timer é cancelado e o paywall NUNCA aparece para assinantes ativos.
        paywallTimerRef.current = setTimeout(() => {
          paywallTimerRef.current = null;
          if (!canUsePremiumRef.current) setShowPaywall(true);
        }, 1000);
      }
    }

    return () => {
      if (paywallTimerRef.current) {
        clearTimeout(paywallTimerRef.current);
        paywallTimerRef.current = null;
      }
    };
  // pathname adicionado: re-avalia bypass a cada navegação.
  // Quando usuário sai de /meus-dados (sem CPF) → retoma lógica normal do paywall.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUsePremium, subLoading, subFetching, session, pathname]);

  // ── App Lock: show logo while passkeys load (avoids content flash) ──────────
  // Only blocks render if session was restored from localStorage (not fresh login).
  if (hadInitialSession && !isReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#f2f0eb] z-[100]">
        <img src="/logo-carregamento.svg" alt="Locus Vita" className="w-40 h-40 animate-breathing" />
      </div>
    );
  }

  if (isLocked) {
    return <AppLockScreen onUnlock={unlock} />;
  }

  return (
    <InviteAcceptInterceptor>
      <MobileShell>
        <div ref={scrollRef} className="flex-1 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom,0px))] no-scrollbar">
          <Suspense fallback={<InlineRouteLoader />}>
            <Outlet />
          </Suspense>
        </div>
        <BottomNav />
        {/* Always render the modal to avoid Radix body-style cleanup issues on unmount */}
        <PaywallModal
          open={showPaywall ?? false}
          onOpenChange={(v) => { if (!v) setShowPaywall(false); }}
          locked={showPaywall ?? false}
          onLogout={async () => {
            await signOut();
            // Força reload completo para limpar estado React e navegar para login
            window.location.replace("/");
          }}
          implicitTrialExpired={implicitTrialExpired}
        />
      </MobileShell>
    </InviteAcceptInterceptor>
  );
};

export default AppLayout;
