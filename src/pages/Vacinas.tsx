import { useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, Syringe, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import FixedFAB from "@/components/ui/FixedFAB";
import useSmartBack from "@/hooks/useSmartBack";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type Vaccine = {
  id: string;
  name: string;
  applied_date: string | null;
  booster_date: string | null;
  batch: string | null;
  side_effects: string | null;
  created_at: string;
};

const VACCINE_OPTIONS = [
  "BCG",
  "Covid-19",
  "Dengue",
  "DT - Difteria e Tétano",
  "Febre Amarela",
  "Gripe (Influenza)",
  "Hepatite A",
  "Hepatite B",
  "HPV",
  "Meningocócica",
  "Pneumocócica",
  "Poliomielite (VIP/VOP)",
  "Rotavírus",
  "Tríplice Viral (SCR)",
  "Outra (especificar)",
];

const INPUT_CLASSES =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none";

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + "T12:00:00");
  const formatted = format(d, "dd MMM yyyy - EEE", { locale: ptBR });
  const parts = formatted.split(" - ");
  return `${parts[0]} - ${parts[1]?.substring(0, 3)}`;
};

const Vacinas = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const goBack = useSmartBack();
  const queryClient = useQueryClient();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingVaccine, setEditingVaccine] = useState<Vaccine | null>(null);
  const [form, setForm] = useState({
    name: "",
    customName: "",
    applied_date: "",
    booster_date: "",
    batch: "",
    side_effects: "",
  });

  const isCustom = form.name === "Outra (especificar)";

  const { data: vaccines = [], isLoading } = useQuery({
    queryKey: ["vaccines", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vaccines")
        .select("*")
        .eq("family_member_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Vaccine[];
    },
    enabled: !!id,
  });

  const resetForm = () =>
    setForm({ name: "", customName: "", applied_date: "", booster_date: "", batch: "", side_effects: "" });

  const openAdd = () => {
    setEditingVaccine(null);
    resetForm();
    setDrawerOpen(true);
  };

  const openEdit = (v: Vaccine) => {
    setEditingVaccine(v);
    const isStandard = VACCINE_OPTIONS.includes(v.name);
    setForm({
      name: isStandard ? v.name : "Outra (especificar)",
      customName: isStandard ? "" : v.name,
      applied_date: v.applied_date ?? "",
      booster_date: v.booster_date ?? "",
      batch: v.batch ?? "",
      side_effects: v.side_effects ?? "",
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingVaccine(null);
  };

  const getFinalName = () => (isCustom ? form.customName.trim() : form.name);

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vaccines").insert({
        user_id: user!.id,
        family_member_id: id!,
        name: getFinalName(),
        applied_date: form.applied_date || null,
        booster_date: form.booster_date || null,
        batch: form.batch.trim() || null,
        side_effects: form.side_effects.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaccines", id] });
      closeDrawer();
      toast.success("Vacina registrada com sucesso");
    },
    onError: () => toast.error("Erro ao registrar vacina"),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("vaccines")
        .update({
          name: getFinalName(),
          applied_date: form.applied_date || null,
          booster_date: form.booster_date || null,
          batch: form.batch.trim() || null,
          side_effects: form.side_effects.trim() || null,
        })
        .eq("id", editingVaccine!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaccines", id] });
      closeDrawer();
      toast.success("Vacina atualizada com sucesso");
    },
    onError: () => toast.error("Erro ao atualizar vacina"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vaccines").delete().eq("id", editingVaccine!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaccines", id] });
      closeDrawer();
      toast.success("Vacina excluída com sucesso");
    },
    onError: () => toast.error("Erro ao excluir vacina"),
  });

  const handleSubmit = () => {
    const finalName = getFinalName();
    if (!finalName) {
      toast.error("Informe o nome da vacina");
      return;
    }
    if (editingVaccine) {
      updateMutation.mutate();
    } else {
      addMutation.mutate();
    }
  };

  const handleDelete = () => {
    if (window.confirm("Tem certeza que deseja excluir esta vacina?")) {
      deleteMutation.mutate();
    }
  };

  const isPending = addMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <>
      {!drawerOpen && <FixedFAB onClick={openAdd} />}

      <Drawer open={drawerOpen} onOpenChange={(open) => !open && closeDrawer()} repositionInputs={false}>
        <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-background outline-none">
          <DrawerHeader>
            <DrawerTitle>{editingVaccine ? "Editar Vacina" : "Nova Vacina"}</DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain no-scrollbar">
            {/* Vaccine name */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Vacina</label>
              <select
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value, customName: "" })}
                className={INPUT_CLASSES}
              >
                <option value="">Selecione...</option>
                {VACCINE_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {isCustom && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Nome da Vacina</label>
                <input
                  type="text"
                  placeholder="Digite o nome..."
                  value={form.customName}
                  onChange={(e) => setForm({ ...form, customName: e.target.value })}
                  className={INPUT_CLASSES}
                />
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Data da aplicação</label>
                <input
                  type="date"
                  value={form.applied_date}
                  onChange={(e) => setForm({ ...form, applied_date: e.target.value })}
                  className={INPUT_CLASSES}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Data de reforço</label>
                <input
                  type="date"
                  value={form.booster_date}
                  onChange={(e) => setForm({ ...form, booster_date: e.target.value })}
                  className={INPUT_CLASSES}
                />
              </div>
            </div>

            {/* Batch */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Lote</label>
              <input
                type="text"
                placeholder="Ex: FA123/2026"
                value={form.batch}
                onChange={(e) => setForm({ ...form, batch: e.target.value })}
                className={INPUT_CLASSES}
              />
            </div>

            {/* Side effects */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Efeitos colaterais</label>
              <textarea
                placeholder="Descreva se houve alguma reação..."
                value={form.side_effects}
                onChange={(e) => setForm({ ...form, side_effects: e.target.value })}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none resize-none"
              />
            </div>
          </div>

          {/* Fixed footer */}
          <div className="p-4 border-t mt-auto bg-background space-y-3">
            {editingVaccine && (
              <Button
                variant="outline"
                className="w-full text-destructive border-destructive/20 hover:bg-destructive/5"
                onClick={handleDelete}
                disabled={isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Excluir Registro
              </Button>
            )}
            <Button onClick={handleSubmit} disabled={isPending} className="w-full">
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      <div className="px-4 pt-6 pb-28 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft size={22} />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex-1">Vacinas</h1>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : vaccines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Syringe className="text-muted-foreground" size={28} />
            </div>
            <p className="text-foreground font-semibold mb-1">Nenhuma vacina registrada</p>
            <p className="text-muted-foreground text-sm">Toque no botão + para adicionar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {vaccines.map((v) => (
              <button
                key={v.id}
                onClick={() => openEdit(v)}
                className="w-full bg-card rounded-xl border border-border/50 p-4 flex items-start gap-3 text-left active:bg-muted/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Syringe className="text-secondary" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">{v.name}</p>
                  {v.applied_date && (
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                      {formatDate(v.applied_date)}
                    </p>
                  )}
                  {v.booster_date && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Reforço: <span className="capitalize">{formatDate(v.booster_date)}</span>
                    </p>
                  )}
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-2" />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Vacinas;
