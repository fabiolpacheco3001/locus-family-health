import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (avatar: string) => void;
}

const avatarEmojis = ["👨", "👩", "👴", "👵", "👦", "👧", "🐶", "🐱"];

const AvatarSelector = ({ open, onOpenChange, onSelect }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleEmojiClick = (emoji: string) => {
    onSelect?.(emoji);
    onOpenChange(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileName = `${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      onSelect?.(data.publicUrl);
      onOpenChange(false);
    } catch (err) {
      console.error("Avatar upload error:", err);
      toast.error("Erro ao enviar a foto. Tente novamente.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-background outline-none">
        <DrawerHeader>
          <DrawerTitle className="text-primary">Escolher Foto de Perfil</DrawerTitle>
          <DrawerDescription>Personalize seu avatar.</DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-5 overscroll-contain">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            variant="outline"
            className="w-full h-12 gap-2 text-base font-medium"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload size={18} />
                Fazer Upload de Foto
              </>
            )}
          </Button>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Ou escolha um avatar:</p>
            <div className="grid grid-cols-4 gap-4">
              {avatarEmojis.map((emoji) => (
                <button
                  key={emoji}
                  className="w-16 h-16 rounded-full bg-secondary/20 border-2 border-transparent hover:border-primary active:scale-95 transition-all flex items-center justify-center text-3xl mx-auto"
                  onClick={() => handleEmojiClick(emoji)}
                  disabled={uploading}
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
