import { useRef, useEffect, Suspense } from "react";
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
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const { isLocked, isReady, hadInitialSession, unlock } = useAppLock();
  const { canUsePremium, isLoading: subLoading, subscription, implicitTrialExpired } = useSubscription();
  const { medications } = useMedications();
  useMedicationAlarms(medications);
  useStockAlerts(medications);
  useMenstrualAlerts();
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
      const { data } = await supabase.from("family_members").select("*").eq("user_id", user.id).is("deleted_at", null).order("created_at");
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

  // Show locked paywall if subscription is not premium-eligible
  const showPaywall = !subLoading && user && !canUsePremium;

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
        <div ref={scrollRef} className="flex-1 overflow-y-auto pb-24 no-scrollbar">
          <Suspense fallback={<InlineRouteLoader />}>
            <Outlet />
          </Suspense>
        </div>
        <BottomNav />
        {/* Always render the modal to avoid Radix body-style cleanup issues on unmount */}
        <PaywallModal
          open={showPaywall ?? false}
          onOpenChange={() => {}}
          locked={showPaywall ?? false}
          onLogout={signOut}
          implicitTrialExpired={implicitTrialExpired}
        />
      </MobileShell>
    </InviteAcceptInterceptor>
  );
};

export default AppLayout;
