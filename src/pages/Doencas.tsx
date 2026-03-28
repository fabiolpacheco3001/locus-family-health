import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Activity, ChevronRight, Trash2 } from "lucide-react";
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

type Disease = {
  id: string;
  name: string;
  category: string;
  diagnosed_at: string | null;
  notes: string | null;
  created_at: string;
};

const diseaseGroups: Record<string, string[]> = {
  Cardíacas: ["Hipertensão", "Arritmia", "Insuficiência cardíaca", "Sopro cardíaco"],
  Endócrinas: ["Diabetes Tipo 1", "Diabetes Tipo 2", "Hipotireoidismo", "Hipertireoidismo"],
  Gástricas: ["Gastrite", "Refluxo", "Síndrome do intestino irritável", "Doença celíaca"],
  Infecciosas: ["Dengue", "COVID-19", "Hepatite", "Tuberculose"],
  Neurológicas: ["Enxaqueca", "Epilepsia", "Esclerose múltipla", "Parkinson"],
  Oftalmológicas: ["Miopia", "Astigmatismo", "Glaucoma", "Catarata"],
  Ortopédicas: ["Hérnia de disco", "Artrose", "Escoliose", "Tendinite"],
  Pele: ["Acne", "Melasma", "Psoríase", "Dermatite atópica"],
  Psicológicas: ["Ansiedade", "Depressão", "TDAH", "Transtorno bipolar"],
  Respiratórias: ["Asma", "Bronquite", "Rinite alérgica", "Sinusite crônica"],
  Outras: ["Anemia", "Fibromialgia", "Lúpus", "Outra (especificar)"],
};

const categoryColors: Record<string, string> = {
  Cardíacas: "bg-destructive/10 text-destructive",
  Endócrinas: "bg-primary/10 text-primary",
  Gástricas: "bg-accent/20 text-accent-foreground",
  Infecciosas: "bg-destructive/10 text-destructive",
  Neurológicas: "bg-secondary/10 text-secondary",
  Oftalmológicas: "bg-primary/10 text-primary",
  Ortopédicas: "bg-accent/20 text-accent-foreground",
  Pele: "bg-muted text-muted-foreground",
  Psicológicas: "bg-secondary/10 text-secondary",
  Respiratórias: "bg-primary/10 text-primary",
  Outras: "bg-muted text-muted-foreground",
};

type DrawerMode = "add" | "edit";

const Doencas = () => {
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
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("add");
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDisease, setSelectedDisease] = useState("");
  const [customDiseaseName, setCustomDiseaseName] = useState("");
  const [editingDisease, setEditingDisease] = useState<Disease | null>(null);

  const { data: diseases = [], isLoading } = useQuery({
    queryKey: ["diseases", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diseases")
        .select("*")
        .eq("family_member_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Disease[];
    },
    enabled: !!id,
  });

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("diseases").insert({
        user_id: user!.id,
        family_member_id: id!,
        name,
        category: selectedCategory,
        ...(groupId ? { group_id: groupId } : {}),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diseases", id] });
      closeDrawer();
      toast.success("Condição de saúde registrada com sucesso");
    },
    onError: () => toast.error("Erro ao registrar condição de saúde"),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const name = selectedDisease === "Outra (especificar)" ? customDiseaseName.trim() : selectedDisease;
      const { error } = await supabase
        .from("diseases")
        .update({ name, category: selectedCategory })
        .eq("id", editingDisease!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diseases", id] });
      closeDrawer();
      toast.success("Condição de saúde atualizada com sucesso");
    },
    onError: () => toast.error("Erro ao atualizar condição de saúde"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("diseases")
        .delete()
        .eq("id", editingDisease!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diseases", id] });
      closeDrawer();
      toast.success("Condição de saúde excluída com sucesso");
    },
    onError: () => toast.error("Erro ao excluir condição de saúde"),
  });

  const openAdd = () => {
    setDrawerMode("add");
    setStep(1);
    setSelectedCategory("");
    setSelectedDisease("");
    setCustomDiseaseName("");
    setEditingDisease(null);
    setDrawerOpen(true);
  };

  const openEdit = (disease: Disease) => {
    setDrawerMode("edit");
    setEditingDisease(disease);
    setSelectedCategory(disease.category);
    // Check if disease name is in the standard list
    const standardNames = diseaseGroups[disease.category] || [];
    if (standardNames.includes(disease.name)) {
      setSelectedDisease(disease.name);
      setCustomDiseaseName("");
    } else {
      setSelectedDisease("Outra (especificar)");
      setCustomDiseaseName(disease.name);
    }
    setStep(2);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setStep(1);
    setSelectedCategory("");
    setSelectedDisease("");
    setCustomDiseaseName("");
    setEditingDisease(null);
  };

  const handleCategorySelect = (cat: string) => {
    setSelectedCategory(cat);
    setSelectedDisease("");
    setCustomDiseaseName("");
    setStep(2);
  };

  const isCustom = selectedDisease === "Outra (especificar)";

  const getConfirmDisabled = () => {
    if (!selectedDisease) return true;
    if (isCustom && !customDiseaseName.trim()) return true;
    return addMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  };

  const handleConfirm = () => {
    const name = isCustom ? customDiseaseName.trim() : selectedDisease;
    if (!name) {
      toast.error("Selecione ou digite uma condição de saúde");
      return;
    }
    if (drawerMode === "edit") {
      updateMutation.mutate();
    } else {
      addMutation.mutate(name);
    }
  };

  const handleDelete = () => {
    if (window.confirm("Tem certeza que deseja excluir esta doença?")) {
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
            <DrawerTitle>
              {drawerMode === "edit"
                ? "Editar Doença"
                : step === 1
                ? "Selecione o Grupo"
                : selectedCategory}
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto p-4 overscroll-contain no-scrollbar">
            {step === 1 ? (
              <div className="grid grid-cols-2 gap-3">
                {Object.keys(diseaseGroups).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleCategorySelect(cat)}
                    className="flex items-center justify-between p-3.5 bg-card rounded-xl border border-border/50 active:bg-muted/50 transition-colors text-left"
                  >
                    <span className="text-sm font-medium text-foreground">{cat}</span>
                    <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => { setStep(1); setSelectedDisease(""); setCustomDiseaseName(""); }}
                  className="text-sm text-primary font-medium mb-3 flex items-center gap-1"
                >
                  <ArrowLeft size={14} /> Voltar aos grupos
                </button>
                {diseaseGroups[selectedCategory]?.map((disease) => (
                  <button
                    key={disease}
                    onClick={() => {
                      setSelectedDisease(disease);
                      if (disease !== "Outra (especificar)") setCustomDiseaseName("");
                    }}
                    className={`w-full p-3.5 rounded-xl border text-left text-sm font-medium transition-colors ${
                      selectedDisease === disease
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-card border-border/50 text-foreground active:bg-muted/50"
                    }`}
                  >
                    {disease}
                  </button>
                ))}

                {isCustom && (
                  <input
                    type="text"
                    placeholder="Ex: Fibromialgia, Artrite..."
                    value={customDiseaseName}
                    onChange={(e) => setCustomDiseaseName(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none mt-4"
                  />
                )}

                {drawerMode === "edit" && (
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
            )}
          </div>
          {step === 2 && (
            <div className="p-4 border-t mt-auto bg-background">
              <Button
                onClick={handleConfirm}
                disabled={getConfirmDisabled()}
                className="w-full"
              >
                {isPending ? "Salvando..." : "Confirmar"}
              </Button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      <div className="px-4 pt-6 pb-28 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft size={22} />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex-1">Condições de Saúde</h1>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : diseases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-[#A7D3CB] flex items-center justify-center mb-4">
              <Activity className="text-black" size={28} />
            </div>
            <p className="text-foreground font-semibold mb-1">Nenhuma doença registrada</p>
            <p className="text-muted-foreground text-sm">Toque no botão + para adicionar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {diseases.map((d) => (
              <button
                key={d.id}
                onClick={() => openEdit(d)}
                className="w-full bg-card rounded-xl border border-border/50 p-4 flex items-start gap-3 text-left active:bg-muted/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-[#A7D3CB] flex items-center justify-center shrink-0 mt-0.5">
                  <Activity className="text-black" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">{d.name}</p>
                  <Badge
                    variant="outline"
                    className={`mt-1 text-[10px] ${categoryColors[d.category] || "bg-muted text-muted-foreground"}`}
                  >
                    {d.category}
                  </Badge>
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

export default Doencas;
