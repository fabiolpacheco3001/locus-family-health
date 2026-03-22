import { useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, Hand, AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import FixedFAB from "@/components/ui/FixedFAB";
import useSmartBack from "@/hooks/useSmartBack";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Allergy = {
  id: string;
  substance: string;
  type: string;
  severity: string;
  created_at: string;
};

const severityColors: Record<string, string> = {
  Leve: "bg-primary/10 text-primary border-primary/20",
  Moderada: "bg-accent/20 text-accent-foreground border-accent/30",
  Grave: "bg-destructive/10 text-destructive border-destructive/20",
};

const typeOptions = ["Medicamento", "Alimento", "Outros"];
const severityOptions = ["Leve", "Moderada", "Grave"];

const Alergias = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const goBack = useSmartBack();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState({ substance: "", type: "Medicamento", severity: "Leve" });

  const { data: allergies = [], isLoading } = useQuery({
    queryKey: ["allergies", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("allergies")
        .select("*")
        .eq("family_member_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Allergy[];
    },
    enabled: !!id,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("allergies").insert({
        user_id: user!.id,
        family_member_id: id!,
        substance: form.substance.trim(),
        type: form.type,
        severity: form.severity,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allergies", id] });
      setDrawerOpen(false);
      setForm({ substance: "", type: "Medicamento", severity: "Leve" });
      toast.success("Alergia registrada com sucesso");
    },
    onError: () => toast.error("Erro ao registrar alergia"),
  });

  const handleSubmit = () => {
    if (!form.substance.trim()) {
      toast.error("Informe a substância/alérgeno");
      return;
    }
    addMutation.mutate();
  };

  return (
    <>
      {!drawerOpen && <FixedFAB onClick={() => setDrawerOpen(true)} />}

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="flex flex-col max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>Nova Alergia</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Substância / Alérgeno</label>
              <input
                type="text"
                placeholder="Ex: Dipirona, Amendoim..."
                value={form.substance}
                onChange={(e) => setForm({ ...form, substance: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Tipo</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none"
                >
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Gravidade</label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none"
                >
                  {severityOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <DrawerFooter>
            <Button onClick={handleSubmit} disabled={addMutation.isPending} className="w-full">
              {addMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <div className="px-4 pt-6 pb-28 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft size={22} />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex-1">Alergias</h1>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : allergies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Hand className="text-muted-foreground" size={28} />
            </div>
            <p className="text-foreground font-semibold mb-1">Nenhuma alergia registrada</p>
            <p className="text-muted-foreground text-sm">Toque no botão + para adicionar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allergies.map((a) => (
              <div
                key={a.id}
                className="bg-card rounded-xl border border-border/50 p-4 flex items-start gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="text-destructive" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">{a.substance}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.type}</p>
                </div>
                <Badge
                  variant="outline"
                  className={`shrink-0 text-[10px] ${severityColors[a.severity] || ""}`}
                >
                  {a.severity}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Alergias;
