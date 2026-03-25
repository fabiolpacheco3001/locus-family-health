import { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { motion, PanInfo, useMotionValue, useTransform } from "framer-motion";

const SWIPE_THRESHOLD = -80;

interface SwipeableCardProps {
  children: ReactNode;
  onSwipeDelete: () => void;
}

const SwipeableCard = ({ children, onSwipeDelete }: SwipeableCardProps) => {
  const x = useMotionValue(0);
  const trashOpacity = useTransform(x, [-100, -40, 0], [1, 0.5, 0]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < SWIPE_THRESHOLD) {
      onSwipeDelete();
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
      <motion.div
        className="absolute inset-0 bg-destructive flex items-center justify-end px-6 rounded-xl"
        style={{ opacity: trashOpacity }}
      >
        <Trash2 className="w-6 h-6 text-white" />
      </motion.div>

      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.5, right: 0 }}
        onDragEnd={handleDragEnd}
        className="relative"
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

export default SwipeableCard;
