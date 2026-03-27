import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, Calendar, Activity, Users, Settings, ChevronRight } from "lucide-react";
import MemberAvatar from "@/components/MemberAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

const navItems = [
  { icon: Home, label: "Início", path: "/home" },
  { icon: Calendar, label: "Agenda", path: "/agenda" },
  { icon: Activity, label: "Minha Saúde", path: "__drawer_saude__" },
  { icon: Users, label: "Família", path: "/gerenciar-familia" },
  { icon: Settings, label: "Ajustes", path: "/ajustes" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { members, isLoading: membersLoading } = useFamilyMembers();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isSaudeActive = location.pathname.startsWith("/familiar/");

  // Intent-to-navigate prefetch: start loading chunk on touch/hover
  const handlePrefetch = (path: string) => {
    import("@/App").then(m => m.prefetchByRoute?.[path]?.());
  };

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
              onTouchStart={() => handlePrefetch(path)}
              onMouseEnter={() => handlePrefetch(path)}
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
          <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 space-y-2">
            {(() => {
              const ordemParentesco: Record<string, number> = {
                "Titular": 1, "Cônjuge": 2, "Filho(a)": 3, "Pai/Mãe": 4, "Irmão(ã)": 5, "Outro": 6,
              };
              return [...members].sort((a, b) => {
                const pesoA = ordemParentesco[a.relationship] || 99;
                const pesoB = ordemParentesco[b.relationship] || 99;
                return pesoA - pesoB;
              }).map((member) => (
                <button
                  key={member.id}
                  onClick={() => {
                    setDrawerOpen(false);
                    navigate(`/familiar/${member.id}`, { state: { from: location.pathname } });
                  }}
                  className="flex items-center gap-3 w-full h-14 px-4 bg-card rounded-xl border border-border/50 shadow-sm text-left active:bg-accent/50 sm:hover:bg-accent/50 transition-colors"
                >
                  <MemberAvatar avatarUrl={member.avatar_url} name={member.name} size="sm" memberType={member.member_type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-black truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.relationship}</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </button>
              ));
            })()}
            {membersLoading && members.length === 0 && (
              <div className="space-y-3 py-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 h-14 px-4 bg-card rounded-xl border border-border/50">
                    <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!membersLoading && members.length === 0 && (
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
