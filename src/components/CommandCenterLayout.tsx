import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, ShieldCheck, Settings, Menu, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/command_center", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/command_center/clientes", icon: Users, label: "Clientes", end: false },
  { to: "/command_center/admins", icon: ShieldCheck, label: "Administradores", end: false },
  { to: "/command_center/config", icon: Settings, label: "Configurações", end: false },
];

const SidebarNav = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/10">
        <img src="/logo-locus-vita.svg" alt="Locus Vita" className="w-9 h-9" />
        <div>
          <span className="text-white font-semibold text-base tracking-tight">Command Center</span>
          <p className="text-white/50 text-[11px]">Locus Vita Admin</p>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-5">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/40 hover:text-white hover:bg-white/5 transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </div>
    </div>
  );
};

const CommandCenterLayout = () => {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#f2f0eb]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-shrink-0 flex-col bg-[#1C3333]">
        <SidebarNav />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar (mobile) */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#1C3333]">
          <div className="flex items-center gap-2">
            <img src="/logo-locus-vita.svg" alt="Locus Vita" className="w-7 h-7" />
            <span className="text-white font-semibold text-sm">Command Center</span>
          </div>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-[#1C3333] border-none [&>button]:hidden">
              <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
              <div className="absolute right-3 top-3 z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() => setSheetOpen(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <SidebarNav onNavigate={() => setSheetOpen(false)} />
            </SheetContent>
          </Sheet>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default CommandCenterLayout;
