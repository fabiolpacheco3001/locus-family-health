import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, Calendar, Activity, Users, Settings, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

const navItems = [
  { icon: Home, label: "Início", path: "/home" },
  { icon: Calendar, label: "Agenda", path: "/agenda" },
  { icon: Activity, label: "Minha Saúde", path: "__drawer_saude__" },
  { icon: Users, label: "Família", path: "/familia" },
  { icon: Settings, label: "Ajustes", path: "/ajustes" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { members } = useFamilyMembers();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isSaudeActive = location.pathname.includes("/saude");

  const handleClick = (path: string) => {
    if (path === "__drawer_saude__") {
      setDrawerOpen(true);
    } else {
      navigate(path);
    }
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 w-full bg-card border-t border-border flex justify-around items-center h-16 z-50">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = path === "__drawer_saude__"
            ? isSaudeActive
            : location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => handleClick(path)}
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

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="flex flex-col max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>De quem você deseja ver?</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => {
                  setDrawerOpen(false);
                  navigate(`/familiar/${member.id}`, { state: { from: location.pathname } });
                }}
                className="flex items-center gap-3 w-full h-14 px-4 bg-card rounded-xl border border-border/50 shadow-sm text-left active:bg-accent/50 sm:hover:bg-accent/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">
                    {member.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.relationship}</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </button>
            ))}
            {members.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum familiar cadastrado.
              </p>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default BottomNav;
