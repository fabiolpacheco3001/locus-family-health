import { useRef, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import MobileShell from "./MobileShell";
import BottomNav from "./BottomNav";
import { useMedicationAlarms } from "@/hooks/useMedicationAlarms";
import { useStockAlerts } from "@/hooks/useStockAlerts";
import { useMedications } from "@/hooks/useMedications";
import { useMenstrualAlerts } from "@/hooks/useMenstrualAlerts";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const AppLayout = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
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
    prefetchIfEmpty(["notifications", user.id], async () => {
      const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("scheduled_for", { ascending: false });
      return data ?? [];
    });
  }, [user, queryClient]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return (
    <MobileShell>
      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-24 no-scrollbar">
        <Outlet />
      </div>
      <BottomNav />
    </MobileShell>
  );
};

export default AppLayout;
