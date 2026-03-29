import { useState, useRef } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface VaccineImportCardProps {
  onImportReady: (fileUrl: string) => void;
}

const VaccineImportCard = ({ onImportReady }: VaccineImportCardProps) => {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.type !== "application/pdf") {
      toast.error("Apenas arquivos PDF são aceitos.");
      return;
    }

    setUploading(true);
    try {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from("vaccine_documents")
        .upload(filePath, file);
      if (error) throw error;
      onImportReady(filePath);
    } catch {
      toast.error("Erro ao enviar o arquivo. Tente novamente.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border/50 p-4 mb-4">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />
      {uploading ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground text-center">
            IA está lendo sua carteira de vacinação... Aguarde.
          </p>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center gap-3 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileUp className="text-primary" size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm">
              Importar Carteira de Vacinação Digital (SUS)
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Envie o PDF do Meu SUS para importar automaticamente
            </p>
          </div>
        </button>
      )}
    </div>
  );
};

export default VaccineImportCard;
