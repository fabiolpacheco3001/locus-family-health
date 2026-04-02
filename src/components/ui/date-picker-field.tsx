import * as React from "react";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { parse, format } from "date-fns";

/**
 * A string-based wrapper around DateTimePicker for easy drop-in replacement
 * of native <input type="date"> and <input type="datetime-local">.
 *
 * Accepts/emits string values in "yyyy-MM-dd" (date mode) or
 * "yyyy-MM-ddTHH:mm" (datetime mode) format.
 */
interface DatePickerFieldProps {
  value: string;
  onChange: (value: string) => void;
  mode?: "date" | "datetime";
  placeholder?: string;
  className?: string;
}

export function DatePickerField({
  value,
  onChange,
  mode = "date",
  placeholder = "Selecione",
  className,
}: DatePickerFieldProps) {
  const dateValue = React.useMemo(() => {
    if (!value) return undefined;
    try {
      if (mode === "datetime") {
        // Parse "yyyy-MM-ddTHH:mm" or "yyyy-MM-dd HH:mm"
        const normalized = value.replace("T", " ");
        const parsed = parse(normalized, "yyyy-MM-dd HH:mm", new Date());
        return isNaN(parsed.getTime()) ? undefined : parsed;
      } else {
        const parsed = parse(value, "yyyy-MM-dd", new Date());
        // Set to noon to avoid timezone issues
        parsed.setHours(12, 0, 0, 0);
        return isNaN(parsed.getTime()) ? undefined : parsed;
      }
    } catch {
      return undefined;
    }
  }, [value, mode]);

  const handleChange = (date: Date | undefined) => {
    if (!date) {
      onChange("");
      return;
    }
    if (mode === "datetime") {
      onChange(format(date, "yyyy-MM-dd'T'HH:mm"));
    } else {
      onChange(format(date, "yyyy-MM-dd"));
    }
  };

  return (
    <DateTimePicker
      value={dateValue}
      onChange={handleChange}
      mode={mode}
      placeholder={placeholder}
      className={className}
    />
  );
}
