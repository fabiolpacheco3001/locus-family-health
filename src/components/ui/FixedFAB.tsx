import { Plus } from "lucide-react";

interface FixedFABProps {
  onClick: () => void;
}

const FixedFAB = ({ onClick }: FixedFABProps) => {
  return (
    <button
      onClick={onClick}
      className="!fixed !right-6 !bottom-24 !z-[100] w-14 h-14 rounded-full bg-[#FFB085] hover:bg-[#ff9b66] text-slate-900 shadow-lg flex items-center justify-center transition-none"
    >
      <Plus size={24} />
    </button>
  );
};

export default FixedFAB;
