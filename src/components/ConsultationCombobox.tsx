import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useConsultations } from "@/hooks/useConsultations";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

interface Props {
  familyMemberId: string;
  value: string;
  onValueChange: (value: string) => void;
}

const ConsultationCombobox = ({ familyMemberId, value, onValueChange }: Props) => {
  const { consultations } = useConsultations(familyMemberId);
  const [open, setOpen] = useState(false);

  const options = useMemo(() =>
    consultations.map((c) => {
      const dateLabel = c.consultation_date
        ? format(new Date(c.consultation_date), "dd/MM/yyyy", { locale: ptBR })
        : "Sem data";
      const profLabel = c.professional_name || c.specialty;
      return { id: c.id, label: `${dateLabel} - ${profLabel}`, searchable: `${dateLabel} ${profLabel} ${c.specialty}`.toLowerCase() };
    }), [consultations]);

  const selectedLabel = useMemo(() => {
    if (value === "none" || !value) return null;
    return options.find((o) => o.id === value)?.label ?? null;
  }, [value, options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="flex h-10 w-full max-w-full min-w-0 justify-between rounded-md border border-input bg-background px-3 py-2 text-[16px] font-normal hover:bg-background"
        >
          <span className={cn("truncate", !selectedLabel && "text-muted-foreground")}>
            {selectedLabel ?? "Buscar por data ou médico..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-50" align="start">
        <Command>
          <CommandInput placeholder="Buscar por data ou médico..." />
          <CommandList>
            <CommandEmpty>Nenhuma consulta encontrada.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__clear__"
                onSelect={() => { onValueChange("none"); setOpen(false); }}
                className="text-muted-foreground"
              >
                <X className="mr-2 h-4 w-4" />
                Nenhuma
              </CommandItem>
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.searchable}
                  onSelect={() => { onValueChange(o.id); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o.id ? "opacity-100" : "opacity-0")} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ConsultationCombobox;
