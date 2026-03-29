import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BellOff, CheckCheck, Trash2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications } from "@/hooks/useNotifications";
import { AnimatePresence } from "framer-motion";
import NotificationCard from "@/components/NotificationCard";
import SwipeableActionCard from "@/components/SwipeableActionCard";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const Notificacoes = () => {
  const navigate = useNavigate();
  const { notifications, isLoading, unreadCount, markAsRead, markAllAsRead, clearAllNotifications } = useNotifications();
  const queryClient = useQueryClient();
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const handleInstantDelete = async (notificationId: string) => {
    const toDelete = notifications.find(n => n.id === notificationId);
    if (!toDelete) return;
    const cached = { ...toDelete };
    try {
      const { error } = await supabase.from("notifications").delete().eq("id", notificationId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
      toast("Notificação excluída.", {
        action: {
          label: "Desfazer",
          onClick: async () => {
            try {
              const { error: restoreError } = await supabase.from("notifications").insert({
                user_id: cached.user_id,
                family_member_id: cached.family_member_id,
                title: cached.title,
                message: cached.message,
                type: cached.type,
                is_read: cached.is_read,
                action_url: cached.action_url,
                scheduled_for: cached.scheduled_for,
              });
              if (restoreError) throw restoreError;
              queryClient.invalidateQueries({ queryKey: ["notifications"] });
              queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
              toast.success("Notificação restaurada.");
            } catch { /* handled */ }
          },
        },
        duration: 5000,
      });
    } catch { /* handled */ }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
      {/* Header */}
      <div className="flex-none px-4 pt-6 pb-2 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} />
        </Button>
        <h1 className="text-lg font-bold text-foreground flex-1">Notificações</h1>
        {notifications.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <MoreVertical size={20} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {unreadCount > 0 && (
                <DropdownMenuItem
                  onClick={() => markAllAsRead.mutate()}
                  disabled={markAllAsRead.isPending}
                  className="gap-2"
                >
                  <CheckCheck size={14} />
                  Marcar todas como lidas
                </DropdownMenuItem>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="gap-2 text-destructive focus:text-destructive"
                  >
                    <Trash2 size={14} />
                    Limpar tudo
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[320px] rounded-[24px] w-[90vw]">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Limpar todas as notificações?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Todas as notificações serão excluídas permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearAllNotifications.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir tudo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-[#A7D3CB] flex items-center justify-center mb-4">
              <BellOff className="text-black" size={28} />
            </div>
            <p className="text-foreground font-semibold mb-1">Nenhuma notificação</p>
            <p className="text-muted-foreground text-sm">Você não tem novas notificações.</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {notifications.map((n) => (
              <div key={n.id} className="mb-2">
                <SwipeableActionCard
                  onDelete={() => handleInstantDelete(n.id)}
                  isOpen={openCardId === n.id}
                  onOpenChange={(open) => setOpenCardId(open ? n.id : null)}
                >
                  <NotificationCard
                    notification={n}
                    onRead={(id) => markAsRead.mutate(id)}
                  />
                </SwipeableActionCard>
              </div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default Notificacoes;
