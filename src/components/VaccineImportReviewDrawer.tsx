import { useState, useEffect } from "react";
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
  details?: string;
  dose_label?: string;
  applied_date: string; // yyyy-MM-dd
  batch?: string;
  facility?: string;
  city?: string;
  state?: string;
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
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    setSelected(new Set(vaccines.map((_, i) => i)));
  }, [vaccines]);

  const toggle = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === vaccines.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(vaccines.map((_, i) => i)));
    }
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
        <DrawerHeader className="pb-2">
          <DrawerTitle>Revisão de Importação</DrawerTitle>
          <p className="text-sm text-muted-foreground">
            {vaccines.length} vacina{vaccines.length !== 1 ? "s" : ""} encontrada{vaccines.length !== 1 ? "s" : ""}. Desmarque as que não deseja importar.
          </p>
        </DrawerHeader>

        <div className="px-4 pb-2">
          <button onClick={toggleAll} className="text-xs font-medium text-primary">
            {selected.size === vaccines.length ? "Desmarcar todas" : "Selecionar todas"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-2 overscroll-contain no-scrollbar max-h-[50dvh]">
          {vaccines.map((v, i) => (
            <label
              key={i}
              className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-card cursor-pointer active:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={selected.has(i)}
                onCheckedChange={() => toggle(i)}
                className="mt-0.5 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight">
                  {v.name}
                </p>
                {v.details && v.details !== v.name && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{v.details}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[v.dose_label, formatDate(v.applied_date)].filter(Boolean).join(" · ")}
                </p>
                {(v.batch || v.facility || v.city || v.state) && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {[v.batch && `Lote: ${v.batch}`, v.facility, [v.city, v.state].filter(Boolean).join("/")].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </label>
          ))}
        </div>

        <div className="p-4 border-t mt-auto bg-background space-y-3">
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button className="w-full" onClick={handleConfirm} disabled={count === 0 || isPending}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {isPending ? "Importando..." : `Confirmar Importação (${count} Vacina${count !== 1 ? "s" : ""})`}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default VaccineImportReviewDrawer;
