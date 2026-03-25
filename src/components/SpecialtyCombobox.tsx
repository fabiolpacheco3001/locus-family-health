import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

const ESPECIALIDADES_MEDICAS = [
  "Alergista", "Angiologista", "Cardiologista", "Cirurgião Geral", "Clínico Geral",
  "Dermatologista", "Endocrinologista", "Fisioterapeuta", "Fonoaudiólogo",
  "Gastroenterologista", "Geriatra", "Ginecologista", "Hematologista",
  "Infectologista", "Neurologista", "Nutricionista", "Nutrólogo",
  "Odontologista", "Oftalmologista", "Oncologista", "Ortopedista",
  "Otorrinolaringologista", "Pediatra", "Pneumologista", "Psicólogo",
  "Psiquiatra", "Reumatologista", "Urologista",
];

interface Props {
  value: string;
  onValueChange: (value: string) => void;
}

const SpecialtyCombobox = ({ value, onValueChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = ESPECIALIDADES_MEDICAS.filter((e) =>
    e.toLowerCase().includes(search.toLowerCase())
  );

  const showCustomOption = search.trim().length > 0 && !ESPECIALIDADES_MEDICAS.some(
    (e) => e.toLowerCase() === search.trim().toLowerCase()
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="flex h-10 w-full max-w-full min-w-0 justify-between rounded-md border border-input bg-background px-3 py-2 text-[16px] font-normal hover:bg-background"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || "Ex: Cardiologista"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-50" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Ex: Cardiologista"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Nenhuma especialidade encontrada.</CommandEmpty>
            <CommandGroup>
              {showCustomOption && (
                <CommandItem
                  value={search.trim()}
                  onSelect={() => {
                    onValueChange(search.trim());
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === search.trim() ? "opacity-100" : "opacity-0")} />
                  Usar "{search.trim()}"
                </CommandItem>
              )}
              {filtered.map((esp) => (
                <CommandItem
                  key={esp}
                  value={esp}
                  onSelect={() => {
                    onValueChange(esp);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === esp ? "opacity-100" : "opacity-0")} />
                  {esp}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default SpecialtyCombobox;
