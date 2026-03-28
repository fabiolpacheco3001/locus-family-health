import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

const DEFAULT_REASONS = [
  "Dor e Febre",
  "Inflamação",
  "Infecção",
  "Uso Contínuo",
  "Alergia",
];

interface Props {
  value: string;
  onChange: (value: string) => void;
  groupId?: string | null;
  placeholder?: string;
}

const ReasonCombobox = ({ value, onChange, groupId, placeholder = "Ex: Dor e Febre" }: Props) => {
  const [open, setOpen] = useState(false);
  const [historicReasons, setHistoricReasons] = useState<string[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!groupId) return;
    const fetchReasons = async () => {
      const { data } = await supabase
        .from("medications")
        .select("reason")
        .not("reason", "is", null)
        .neq("reason", "");

      if (data) {
        const unique = [...new Set(data.map((d: any) => d.reason as string).filter(Boolean))];
        setHistoricReasons(unique);
      }
    };
    fetchReasons();
  }, [groupId]);

  const suggestions = useMemo(() => {
    const all = [...DEFAULT_REASONS, ...historicReasons];
    const unique = [...new Set(all.map((s) => s.trim()))];
    if (!value.trim()) return unique;
    return unique.filter((s) => s.toLowerCase().includes(value.toLowerCase()));
  }, [historicReasons, value]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex h-10 w-full max-w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[16px] ring-offset-background box-border appearance-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pr-8"
        />
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto no-scrollbar">
          {suggestions.map((reason) => (
            <li
              key={reason}
              onClick={() => {
                onChange(reason);
                setOpen(false);
              }}
              className={cn(
                "px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors",
                reason === value && "bg-accent/50"
              )}
            >
              {reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ReasonCombobox;
