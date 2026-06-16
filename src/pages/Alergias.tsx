import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Ban, AlertTriangle, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
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
  const { groupId, isAdmin, linkedMemberId, managedProfiles, isLoading: groupLoading } = useFamilyGroup();
  const goBack = useSmartBack();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (groupLoading) return;
    if (!isAdmin && id) {
      const allowedIds = [linkedMemberId, ...(managedProfiles ?? [])].filter(Boolean);
      if (!allowedIds.includes(id)) {
        toast.error("Acesso negado");
        navigate("/home", { replace: true });
      }
    }
  }, [groupLoading, isAdmin, id, linkedMemberId, managedProfiles, navigate]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingAllergy, setEditingAllergy] = useState<Allergy | null>(null);
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

  const openAdd = () => {
    setEditingAllergy(null);
    setForm({ substance: "", type: "Medicamento", severity: "Leve" });
    setDrawerOpen(true);
  };

  const openEdit = (allergy: Allergy) => {
    setEditingAllergy(allergy);
    setForm({ substance: allergy.substance, type: allergy.type, severity: allergy.severity });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingAllergy(null);
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("allergies").insert({
        user_id: user!.id,
        family_member_id: id!,
        substance: form.substance.trim(),
        type: form.type,
        severity: form.severity,
        group_id: groupId ?? undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allergies", id] });
      closeDrawer();
      toast.success("Alergia registrada com sucesso");
    },
    onError: () => toast.error("Erro ao registrar alergia"),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("allergies")
        .update({
          substance: form.substance.trim(),
          type: form.type,
          severity: form.severity,
        })
        .eq("id", editingAllergy!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allergies", id] });
      closeDrawer();
      toast.success("Alergia atualizada com sucesso");
    },
    onError: () => toast.error("Erro ao atualizar alergia"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("allergies")
        .delete()
        .eq("id", editingAllergy!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allergies", id] });
      closeDrawer();
      toast.success("Alergia excluída com sucesso");
    },
    onError: () => toast.error("Erro ao excluir alergia"),
  });

  const handleSubmit = () => {
    if (!form.substance.trim()) {
      toast.error("Informe a substância/alérgeno");
      return;
    }
    if (editingAllergy) {
      updateMutation.mutate();
    } else {
      addMutation.mutate();
    }
  };

  const handleDelete = () => {
    if (window.confirm("Tem certeza que deseja excluir esta alergia?")) {
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
            <DrawerTitle>{editingAllergy ? "Editar Alergia" : "Nova Alergia"}</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain no-scrollbar">
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

            {editingAllergy && (
              <Button
                variant="outline"
                className="w-full text-destructive border-destructive/20 hover:bg-destructive/5 mt-4"
                onClick={handleDelete}
                disabled={isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Excluir Registro
              </Button>
            )}
          </div>
          <div className="p-4 border-t mt-auto bg-background">
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
            <div className="w-16 h-16 rounded-full bg-[#A7D3CB] flex items-center justify-center mb-4">
              <Ban className="text-black" size={28} />
            </div>
            <p className="text-foreground font-semibold mb-1">Nenhuma alergia registrada</p>
            <p className="text-muted-foreground text-sm">Toque no botão + para adicionar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allergies.map((a) => (
              <button
                key={a.id}
                onClick={() => openEdit(a)}
                className="w-full bg-card rounded-xl border border-border/50 p-4 flex items-start gap-3 text-left active:bg-muted/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-[#A7D3CB] flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="text-black" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">{a.substance}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.type}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${severityColors[a.severity] || ""}`}
                  >
                    {a.severity}
                  </Badge>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Alergias;
