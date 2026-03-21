import { Outlet } from "react-router-dom";
import MobileShell from "./MobileShell";
import BottomNav from "./BottomNav";
import GlobalFAB from "./GlobalFAB";

const AppLayout = () => {
  return (
    <MobileShell>
      <div className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </div>
      <BottomNav />
      <GlobalFAB />
    </MobileShell>
  );
};

export default AppLayout;
