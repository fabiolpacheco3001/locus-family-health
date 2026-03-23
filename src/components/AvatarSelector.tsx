import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const avatarEmojis = ["👨", "👩", "👴", "👵", "👦", "👧", "🐶", "🐱"];

const AvatarSelector = ({ open, onOpenChange }: Props) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-background outline-none">
        <DrawerHeader>
          <DrawerTitle className="text-primary">Escolher Foto de Perfil</DrawerTitle>
          <DrawerDescription>Personalize seu avatar.</DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-5 overscroll-contain">
          <Button
            variant="outline"
            className="w-full h-12 gap-2 text-base font-medium"
            onClick={() => {/* Upload logic TBD */}}
          >
            <Upload size={18} />
            Fazer Upload de Foto
          </Button>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Ou escolha um avatar:</p>
            <div className="grid grid-cols-4 gap-4">
              {avatarEmojis.map((emoji) => (
                <button
                  key={emoji}
                  className="w-16 h-16 rounded-full bg-secondary/20 border-2 border-transparent hover:border-primary active:scale-95 transition-all flex items-center justify-center text-3xl mx-auto"
                  onClick={() => {/* Selection logic TBD */}}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default AvatarSelector;
