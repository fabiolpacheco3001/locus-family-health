import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Loader2 } from "lucide-react";

export type ImportedVaccine = {
  name: string;
  dose_label: string;
  applied_date: string; // yyyy-MM-dd
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaccines: ImportedVaccine[];
  onConfirm: (selected: ImportedVaccine[]) => void;
  isPending: boolean;
}

const VaccineImportReviewDrawer = ({
  open,
  onOpenChange,
  vaccines,
  onConfirm,
  isPending,
}: Props) => {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(vaccines.map((_, i) => i))
  );

  const toggle = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const count = selected.size;

  const handleConfirm = () => {
    const items = vaccines.filter((_, i) => selected.has(i));
    onConfirm(items);
  };

  const formatDate = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-background outline-none">
        <DrawerHeader>
          <DrawerTitle>Revisão de Importação de Vacinas</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-contain no-scrollbar">
          <p className="text-sm text-muted-foreground mb-2">
            Desmarque as vacinas que não deseja importar:
          </p>
          {vaccines.map((v, i) => (
            <label
              key={i}
              className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-card cursor-pointer active:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={selected.has(i)}
                onCheckedChange={() => toggle(i)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {v.dose_label}
                </p>
                <p className="text-xs text-muted-foreground">{v.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Data: {formatDate(v.applied_date)}
                </p>
              </div>
            </label>
          ))}
        </div>

        <div className="p-4 border-t mt-auto bg-background space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            className="w-full"
            onClick={handleConfirm}
            disabled={count === 0 || isPending}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            {isPending
              ? "Importando..."
              : `Confirmar Importação (${count} Vacina${count !== 1 ? "s" : ""})`}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default VaccineImportReviewDrawer;
