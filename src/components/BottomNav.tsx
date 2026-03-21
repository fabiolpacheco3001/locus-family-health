import { useLocation, useNavigate } from "react-router-dom";
import { Home, Calendar, Users, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", path: "/home" },
  { icon: Calendar, label: "Agenda", path: "/agenda" },
  { icon: Users, label: "Família", path: "/familia" },
  { icon: Settings, label: "Ajustes", path: "/ajustes" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="sticky bottom-0 bg-card border-t border-border flex justify-around items-center h-16 shrink-0">
      {navItems.map(({ icon: Icon, label, path }) => {
        const isActive = location.pathname === path;
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[11px] font-medium">{label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
