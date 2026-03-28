import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Trash2, CheckCircle, FileCheck } from "lucide-react";
import { motion, PanInfo, useMotionValue, useTransform, animate } from "framer-motion";

const SNAP_THRESHOLD = 50;
const DELETE_SNAP = -72;
const SINGLE_ACTION_SNAP = 72;
const DOUBLE_ACTION_SNAP = 144;

type QuickActionMode = "both" | "pronto-only" | "none";

interface ExamSwipeableCardProps {
  children: ReactNode;
  onDelete: () => void;
  onMarkRealizado: () => void;
  onMarkPronto: () => void;
  onCardTap?: () => void;
  quickActionMode?: QuickActionMode;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  /** When true, swipe-left delete is disabled (non-admin users) */
  disableDelete?: boolean;
}

const ExamSwipeableCard = ({
  children,
  onDelete,
  onMarkRealizado,
  onMarkPronto,
  onCardTap,
  quickActionMode = "both",
  isOpen,
  onOpenChange,
  disableDelete = false,
}: ExamSwipeableCardProps) => {
  const x = useMotionValue(0);
  const sideRef = useRef<"left" | "right" | "center">("center");
  const [openSide, setOpenSide] = useState<"left" | "right" | "center">("center");

  const deleteOpacity = useTransform(x, [-100, -30, 0], [1, 0.6, 0]);
  const actionsOpacity = useTransform(x, [0, 30, 80], [0, 0.6, 1]);

  const rightSnap = quickActionMode === "both" ? DOUBLE_ACTION_SNAP : quickActionMode === "pronto-only" ? SINGLE_ACTION_SNAP : 0;

  const resetPosition = useCallback(() => {
    animate(x, 0, { type: "spring", stiffness: 500, damping: 35 });
    sideRef.current = "center";
    setOpenSide("center");
    onOpenChange?.(false);
  }, [x, onOpenChange]);

  // Close when another card opens
  useEffect(() => {
    if (isOpen === false && Math.abs(x.get()) > 5) {
      animate(x, 0, { type: "spring", stiffness: 500, damping: 35 });
      sideRef.current = "center";
      setOpenSide("center");
    }
  }, [isOpen, x]);

  const handleDragStart = () => {
    // Track which side we're starting from
    const currentX = x.get();
    if (currentX < -10) sideRef.current = "left";
    else if (currentX > 10) sideRef.current = "right";
    else sideRef.current = "center";

    // Signal this card is opening
    onOpenChange?.(true);
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const currentX = x.get();
    const velocity = info.velocity.x;
    const offset = info.offset.x;
    const startedFrom = sideRef.current;

    // Context-aware: if card was open on a side and user drags toward center,
    // ALWAYS snap to center — never overshoot to opposite side
    if (startedFrom === "left" && offset > 0) {
      resetPosition();
      return;
    }
    if (startedFrom === "right" && offset < 0) {
      resetPosition();
      return;
    }

    // From center: snap open or close based on threshold
    if (!disableDelete && (offset < -SNAP_THRESHOLD || velocity < -500)) {
      animate(x, DELETE_SNAP, { type: "spring", stiffness: 400, damping: 30 });
      sideRef.current = "left";
      setOpenSide("left");
    } else if ((offset > SNAP_THRESHOLD || velocity > 500) && rightSnap > 0) {
      animate(x, rightSnap, { type: "spring", stiffness: 400, damping: 30 });
      sideRef.current = "right";
      setOpenSide("right");
    } else {
      resetPosition();
    }
  };

  const handleCardClick = () => {
    const currentX = x.get();
    if (Math.abs(currentX) > 5) {
      resetPosition();
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 1, x: 0 }}
      exit={{ x: -400, opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="relative overflow-hidden rounded-xl"
    >
      {/* Delete action (right side, revealed on swipe left) */}
      <motion.div
        className="absolute inset-0 bg-[#F87171] flex items-center justify-end rounded-xl z-[15] pointer-events-none"
        style={{ opacity: deleteOpacity }}
      >
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            resetPosition();
            onDelete();
          }}
          className={`flex flex-col items-center justify-center w-[72px] h-full text-white active:opacity-80 ${openSide === "left" ? "pointer-events-auto" : "pointer-events-none"}`}
          aria-hidden={openSide !== "left"}
          tabIndex={openSide === "left" ? 0 : -1}
        >
          <Trash2 className="w-6 h-6" />
          <span className="text-[10px] mt-1 font-medium">Excluir</span>
        </button>
      </motion.div>

      {/* Quick actions (left side, revealed on swipe right) */}
      {quickActionMode !== "none" && (
        <motion.div
          className="absolute inset-0 flex items-center justify-start rounded-xl overflow-hidden z-[15] pointer-events-none"
          style={{ opacity: actionsOpacity }}
        >
          {quickActionMode === "both" && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                resetPosition();
                onMarkRealizado();
              }}
              className={`flex flex-col items-center justify-center w-[72px] h-full bg-[#F2A97F] text-slate-900 active:opacity-80 ${openSide === "right" ? "pointer-events-auto" : "pointer-events-none"}`}
              aria-hidden={openSide !== "right"}
              tabIndex={openSide === "right" ? 0 : -1}
            >
              <CheckCircle className="w-6 h-6" />
              <span className="text-[10px] mt-1 font-semibold">Realizado</span>
            </button>
          )}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              resetPosition();
              onMarkPronto();
            }}
            className={`flex flex-col items-center justify-center w-[72px] h-full bg-[#1C3333] text-white active:opacity-80 ${openSide === "right" ? "pointer-events-auto" : "pointer-events-none"}`}
            aria-hidden={openSide !== "right"}
            tabIndex={openSide === "right" ? 0 : -1}
          >
            <FileCheck className="w-6 h-6" />
            <span className="text-[10px] mt-1 font-semibold">Pronto</span>
          </button>
        </motion.div>
      )}

      {/* Main card content */}
      <motion.div
        style={{ x, touchAction: "pan-y", willChange: "transform" }}
        drag="x"
        dragConstraints={{ left: disableDelete ? 0 : DELETE_SNAP - 10, right: rightSnap + 10 }}
        dragElastic={0.15}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleCardClick}
        className="relative z-10 cursor-grab active:cursor-grabbing"
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

export default ExamSwipeableCard;
