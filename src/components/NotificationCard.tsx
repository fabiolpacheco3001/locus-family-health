import { useState } from "react";
import { Pill, Stethoscope, FileText, ChevronDown, Trash2, AlertTriangle, Droplets } from "lucide-react";
import { Notification } from "@/hooks/useNotifications";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, useMotionValue, useTransform, PanInfo, AnimatePresence } from "framer-motion";

const iconMap: Record<string, React.ElementType> = {
  medication: Pill,
  consultation: Stethoscope,
  exam: FileText,
  stock: AlertTriangle,
  menstrual: Droplets,
};

const iconBgMap: Record<string, string> = {
  medication: "bg-[#A7D3CB]",
  consultation: "bg-[#A7D3CB]",
  exam: "bg-[#A7D3CB]",
  stock: "bg-amber-400",
  menstrual: "bg-pink-400",
};

const SWIPE_THRESHOLD = -80;

interface NotificationCardProps {
  notification: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}

const NotificationCard = ({ notification, onRead, onDelete }: NotificationCardProps) => {
  const Icon = iconMap[notification.type] || FileText;
  const isUnread = !notification.is_read;
  const [expanded, setExpanded] = useState(false);
  const x = useMotionValue(0);
  const trashOpacity = useTransform(x, [-100, -40, 0], [1, 0.5, 0]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < SWIPE_THRESHOLD) {
      onDelete(notification.id);
    }
  };

  const handleToggle = () => {
    const willExpand = !expanded;
    setExpanded(willExpand);
    if (willExpand && isUnread) {
      onRead(notification.id);
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
        className={`relative rounded-xl border w-full transition-colors cursor-grab active:cursor-grabbing ${
          isUnread
            ? "bg-accent/30 border-primary/20"
            : "bg-card border-border/50"
        }`}
      >
        {/* Header - always visible */}
        <button
          onClick={handleToggle}
          className="flex items-center gap-3 p-4 w-full text-left"
        >
          <div className="relative shrink-0">
            <div className={`w-10 h-10 rounded-xl ${iconBgMap[notification.type] || "bg-[#A7D3CB]"} flex items-center justify-center`}>
              <Icon className={notification.type === "stock" ? "text-white" : "text-black"} size={20} />
            </div>
            {isUnread && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-background" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className={`text-sm truncate ${isUnread ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
              {notification.title.includes(" de ")
                ? notification.title.split(" de ").slice(0, -1).join(" de ") + " de " + notification.title.split(" de ").pop()!.split(" ")[0]
                : notification.title}
            </h4>
            {notification.created_at && (
              <span className="text-[11px] text-muted-foreground/70 font-medium">
                {format(new Date(notification.created_at), "dd MMM · HH:mm", { locale: ptBR })}
              </span>
            )}
          </div>

          <ChevronDown
            size={18}
            className={`shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </button>

        {/* Expandable content */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-0 ml-[52px]">
                <div className="text-justify text-xs text-muted-foreground flex flex-col gap-1">
                  {notification.message.split("\n").map((line, i) => (
                    <p key={i} className="m-0">{line}</p>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

export default NotificationCard;
