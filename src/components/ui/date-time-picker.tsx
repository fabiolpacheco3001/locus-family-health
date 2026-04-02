import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateTimePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Selecione",
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedHour = value ? value.getHours() : 12;
  const selectedMinute = value ? value.getMinutes() : 0;

  const handleDateSelect = (day: Date | undefined) => {
    if (!day) {
      onChange(undefined);
      return;
    }
    const next = new Date(day);
    next.setHours(value ? value.getHours() : 12);
    next.setMinutes(value ? value.getMinutes() : 0);
    next.setSeconds(0);
    onChange(next);
  };

  const handleHourChange = (h: number) => {
    const next = value ? new Date(value) : new Date();
    if (!value) {
      next.setSeconds(0);
      next.setMinutes(0);
    }
    next.setHours(h);
    onChange(next);
  };

  const handleMinuteChange = (m: number) => {
    const next = value ? new Date(value) : new Date();
    if (!value) {
      next.setSeconds(0);
      next.setHours(12);
    }
    next.setMinutes(m);
    onChange(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-10",
            !value && "text-muted-foreground",
            className
          )}
        >
          {value ? (
            <span className="whitespace-nowrap text-sm">
              {format(value, "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </span>
          ) : (
            <span className="text-sm">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        side="top"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col">
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleDateSelect}
            locale={ptBR}
            captionLayout="dropdown-buttons"
            fromYear={1920}
            toYear={new Date().getFullYear() + 10}
            className="p-3 pointer-events-auto"
          />
          <div className="border-t px-3 py-2 flex items-center gap-2">
            <span className="text-sm font-medium text-foreground shrink-0">Hora:</span>
            <select
              value={selectedHour}
              onChange={(e) => handleHourChange(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm appearance-none min-w-[52px]"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}
                </option>
              ))}
            </select>
            <span className="text-sm font-bold">:</span>
            <select
              value={selectedMinute}
              onChange={(e) => handleMinuteChange(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm appearance-none min-w-[52px]"
            >
              {MINUTES.map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, "0")}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-xs"
              onClick={() => setOpen(false)}
            >
              OK
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
