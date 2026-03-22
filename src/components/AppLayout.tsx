import { Outlet } from "react-router-dom";
import MobileShell from "./MobileShell";
import BottomNav from "./BottomNav";

const AppLayout = () => {
  return (
    <MobileShell>
      <div className="flex-1 overflow-y-auto pb-24 no-scrollbar">
        <Outlet />
      </div>
      <BottomNav />
    </MobileShell>
  );
};

export default AppLayout;
