import { Sparkles, PencilLine } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAI: () => void;
  onSelectManual: () => void;
}

const MedicationActionDrawer = ({ open, onOpenChange, onSelectAI, onSelectManual }: Props) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[50dvh] flex flex-col rounded-t-2xl bg-background outline-hidden">
        <DrawerHeader>
          <DrawerTitle className="text-primary">Novo Medicamento</DrawerTitle>
          <DrawerDescription>Como deseja registrar?</DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-3 px-4 pb-8">
          {/* Opção 1: Manual */}
          <button
            onClick={() => {
              onOpenChange(false);
              setTimeout(onSelectManual, 300);
            }}
            className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card text-left active:bg-accent/50 sm:hover:bg-accent/50 transition-colors w-full"
          >
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <PencilLine className="text-muted-foreground" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Preencher Manualmente</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Registrar um novo medicamento campo a campo.
              </p>
            </div>
          </button>

          {/* Opção 2: IA */}
          <button
            onClick={() => {
              onOpenChange(false);
              setTimeout(onSelectAI, 300);
            }}
            className="flex items-start gap-4 p-4 rounded-xl border border-primary/20 bg-primary/5 text-left active:bg-primary/10 sm:hover:bg-primary/10 transition-colors w-full"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="text-primary" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Ler Receita com IA</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Envie uma foto da receita e preenchemos tudo para você.
              </p>
            </div>
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MedicationActionDrawer;
