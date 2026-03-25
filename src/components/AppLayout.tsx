import { useRef, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import MobileShell from "./MobileShell";
import BottomNav from "./BottomNav";
import { useMedicationAlarms } from "@/hooks/useMedicationAlarms";
import { useStockAlerts } from "@/hooks/useStockAlerts";
import { useMedications } from "@/hooks/useMedications";
import { useMenstrualAlerts } from "@/hooks/useMenstrualAlerts";

const AppLayout = () => {
  const { medications } = useMedications();
  useMedicationAlarms(medications);
  useStockAlerts(medications);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

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
