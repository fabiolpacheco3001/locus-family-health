import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import MobileShell from "./MobileShell";
import BottomNav from "./BottomNav";
import AddMemberDrawer from "./AddMemberDrawer";

const FAB_ROUTES = ["/home", "/familia"];

const AppLayout = () => {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const showFab = FAB_ROUTES.includes(location.pathname);

  return (
    <MobileShell>
      <div className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </div>
      <BottomNav />

      {showFab && (
        <Button
          variant="fab"
          size="icon"
          className="fixed right-6 bottom-24 z-[100] !mb-0 !pb-0 w-14 h-14 rounded-full shadow-lg"
          onClick={() => setDrawerOpen(true)}
        >
          <Plus size={28} strokeWidth={2.5} />
        </Button>
      )}

      <AddMemberDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </MobileShell>
  );
};

export default AppLayout;
