import { ReactNode, useState } from "react";
import { Trash2, CheckCircle, FileCheck } from "lucide-react";
import { motion, PanInfo, useMotionValue, useTransform } from "framer-motion";

const DELETE_THRESHOLD = -60;
const ACTION_THRESHOLD = 60;
const BUTTON_WIDTH = 72;

interface ExamSwipeableCardProps {
  children: ReactNode;
  onDelete: () => void;
  onMarkRealizado: () => void;
  onMarkPronto: () => void;
  showQuickActions?: boolean;
}

const ExamSwipeableCard = ({
  children,
  onDelete,
  onMarkRealizado,
  onMarkPronto,
  showQuickActions = true,
}: ExamSwipeableCardProps) => {
  const x = useMotionValue(0);
  const [dragging, setDragging] = useState(false);

  // Right side (delete) - opacity when swiping left
  const deleteOpacity = useTransform(x, [-100, -30, 0], [1, 0.6, 0]);

  // Left side (quick actions) - opacity when swiping right
  const actionsOpacity = useTransform(x, [0, 30, 140], [0, 0.6, 1]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setDragging(false);
    // We don't auto-trigger anything on drag end - user must click the revealed buttons
  };

  const handleDragStart = () => {
    setDragging(true);
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
        className="absolute inset-0 bg-[#F87171] flex items-center justify-end rounded-xl"
        style={{ opacity: deleteOpacity }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex flex-col items-center justify-center w-[72px] h-full text-white active:opacity-80"
        >
          <Trash2 className="w-6 h-6" />
          <span className="text-[10px] mt-1 font-medium">Excluir</span>
        </button>
      </motion.div>

      {/* Quick actions (left side, revealed on swipe right) */}
      {showQuickActions && (
        <motion.div
          className="absolute inset-0 flex items-center justify-start rounded-xl overflow-hidden"
          style={{ opacity: actionsOpacity }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkRealizado();
            }}
            className="flex flex-col items-center justify-center w-[72px] h-full bg-[#F2A97F] text-slate-900 active:opacity-80"
          >
            <CheckCircle className="w-6 h-6" />
            <span className="text-[10px] mt-1 font-semibold">Realizado</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkPronto();
            }}
            className="flex flex-col items-center justify-center w-[72px] h-full bg-[#1C3333] text-white active:opacity-80"
          >
            <FileCheck className="w-6 h-6" />
            <span className="text-[10px] mt-1 font-semibold">Pronto</span>
          </button>
        </motion.div>
      )}

      {/* Main card content */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -80, right: showQuickActions ? 144 : 0 }}
        dragElastic={{ left: 0.3, right: 0.3 }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className="relative z-10"
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

export default ExamSwipeableCard;
