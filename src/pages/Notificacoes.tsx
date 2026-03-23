import { useNavigate } from "react-router-dom";
import useSmartBack from "@/hooks/useSmartBack";
import { ArrowLeft, BellOff, Pill, Stethoscope, FileText, CheckCheck, Trash2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from "framer-motion";
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

const SWIPE_THRESHOLD = -80;

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
  const x = useMotionValue(0);
  const trashOpacity = useTransform(x, [-100, -40, 0], [1, 0.5, 0]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < SWIPE_THRESHOLD) {
      onDelete(notification.id);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 1, x: 0 }}
      exit={{ x: -400, opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="relative overflow-hidden rounded-xl mb-2"
    >
      {/* Red background with trash icon */}
      <motion.div
        className="absolute inset-0 bg-destructive flex items-center justify-end px-6 rounded-xl"
        style={{ opacity: trashOpacity }}
      >
        <Trash2 className="w-6 h-6 text-white" />
      </motion.div>

      {/* Draggable card */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.5, right: 0 }}
        onDragEnd={handleDragEnd}
        className={`relative flex items-start gap-3 p-4 rounded-xl border text-left w-full transition-colors cursor-grab active:cursor-grabbing ${
          isUnread
            ? "bg-accent/30 border-primary/20"
            : "bg-card border-border/50"
        }`}
      >
        <button
          onClick={() => { if (isUnread) onRead(notification.id); }}
          className="flex items-start gap-3 flex-1 min-w-0"
        >
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-xl bg-[#A7D3CB] flex items-center justify-center">
              <Icon className="text-black" size={20} />
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
      </motion.div>
    </motion.div>
  );
};

const Notificacoes = () => {
  const navigate = useNavigate();
  const goBack = useSmartBack();
  const { notifications, isLoading, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications } = useNotifications();

  const handleBack = () => navigate(-1);

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-background overflow-hidden z-10">
      {/* Header */}
      <div className="flex-none px-4 pt-6 pb-2 flex items-center gap-3">
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

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
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
              <NotificationCard
                key={n.id}
                notification={n}
                onRead={(id) => markAsRead.mutate(id)}
                onDelete={(id) => deleteNotification.mutate(id)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default Notificacoes;
