import { Plus } from "lucide-react";

interface FixedFABProps {
  onClick: () => void;
}

const FixedFAB = ({ onClick }: FixedFABProps) => {
  return (
    <button
      onClick={onClick}
      style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px) + 1rem)" }}
      className="!fixed !right-6 !z-40 w-14 h-14 rounded-full bg-[#FFB085] hover:bg-[#ff9b66] text-slate-900 shadow-lg flex items-center justify-center transition-none"
    >
      <Plus size={24} />
    </button>
  );
};

export default FixedFAB;
