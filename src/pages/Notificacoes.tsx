import { useNavigate } from "react-router-dom";
import useSmartBack from "@/hooks/useSmartBack";
import { ArrowLeft, BellOff, Pill, Stethoscope, FileText, CheckCheck, Trash2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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

const iconMap: Record<string, React.ElementType> = {
  medication: Pill,
  consultation: Stethoscope,
  exam: FileText,
};

const NotificationCard = ({
  notification,
  onRead,
  onDelete,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) => {
  const Icon = iconMap[notification.type] || FileText;
  const isUnread = !notification.is_read;

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border text-left w-full transition-colors ${
        isUnread
          ? "bg-accent/30 border-primary/20"
          : "bg-card border-border/50"
      }`}
    >
      <button
        onClick={() => { if (isUnread) onRead(notification.id); }}
        className="flex items-start gap-3 flex-1 min-w-0 active:bg-accent/50 sm:hover:bg-accent/50 rounded-lg transition-colors"
      >
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="text-primary" size={20} />
          </div>
          {isUnread && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-background" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm truncate ${isUnread ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
            {notification.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.message}</p>
          {notification.created_at && (
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              {format(new Date(notification.created_at), "dd MMM · HH:mm", { locale: ptBR })}
            </p>
          )}
        </div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
        className="shrink-0 p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
};

const Notificacoes = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { notifications, isLoading, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications } = useNotifications();

  const handleBack = () => {
    const from = (location.state as any)?.from;
    navigate(from || "/home", { replace: true });
  };

  return (
    <div className="px-4 pt-6 pb-28 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={handleBack}>
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
                <AlertDialogContent>
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

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <BellOff className="text-muted-foreground" size={28} />
          </div>
          <p className="text-foreground font-semibold mb-1">Nenhuma notificação</p>
          <p className="text-muted-foreground text-sm">Você não tem novas notificações.</p>
        </div>
      ) : (
        <div className="flex flex-col space-y-2">
          {notifications.map((n) => (
            <NotificationCard
              key={n.id}
              notification={n}
              onRead={(id) => markAsRead.mutate(id)}
              onDelete={(id) => deleteNotification.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Notificacoes;
