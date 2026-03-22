import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface MedResult {
  id: string;
  name: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const useDebounce = (value: string, delay: number) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

const MedicationAutocomplete = ({ value, onChange, placeholder = "Ex: Amoxicilina, Dipirona" }: Props) => {
  const [results, setResults] = useState<MedResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(value, 300);

  useEffect(() => {
    if (debouncedQuery.length < 3) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    let cancelled = false;
    const search = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("search-meds", {
          body: { query: debouncedQuery },
        });
        if (!cancelled && data?.data) {
          setResults(data.data);
          setShowDropdown(data.data.length > 0);
        }
      } catch {
        // silently fail – user can type freely
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    search();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (name: string) => {
    onChange(name);
    setShowDropdown(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (e.target.value.length >= 3) setShowDropdown(true);
          }}
          onFocus={() => {
            if (results.length > 0 && value.length >= 3) setShowDropdown(true);
          }}
          placeholder={placeholder}
          className="flex h-10 w-full max-w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[16px] ring-offset-background box-border appearance-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pr-8"
        />
        {isLoading && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto no-scrollbar">
          {results.map((med) => (
            <li
              key={med.id}
              onClick={() => handleSelect(med.name)}
              className={cn(
                "px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors",
                med.name === value && "bg-accent/50"
              )}
            >
              {med.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MedicationAutocomplete;
