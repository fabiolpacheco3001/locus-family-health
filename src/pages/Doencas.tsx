import { useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, Activity, ChevronRight } from "lucide-react";
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

const Doencas = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const goBack = useSmartBack();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDisease, setSelectedDisease] = useState("");

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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diseases", id] });
      closeDrawer();
      toast.success("Doença registrada com sucesso");
    },
    onError: () => toast.error("Erro ao registrar doença"),
  });

  const openDrawer = () => {
    setStep(1);
    setSelectedCategory("");
    setSelectedDisease("");
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setStep(1);
    setSelectedCategory("");
    setSelectedDisease("");
  };

  const handleCategorySelect = (cat: string) => {
    setSelectedCategory(cat);
    setStep(2);
  };

  const handleConfirm = () => {
    if (!selectedDisease) {
      toast.error("Selecione uma doença");
      return;
    }
    addMutation.mutate(selectedDisease);
  };

  return (
    <>
      {!drawerOpen && <FixedFAB onClick={openDrawer} />}

      <Drawer open={drawerOpen} onOpenChange={(open) => !open && closeDrawer()}>
        <DrawerContent className="flex flex-col max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>
              {step === 1 ? "Selecione o Grupo" : selectedCategory}
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto p-4 overscroll-contain">
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
                {step === 2 && (
                  <button
                    onClick={() => setStep(1)}
                    className="text-sm text-primary font-medium mb-3 flex items-center gap-1"
                  >
                    <ArrowLeft size={14} /> Voltar aos grupos
                  </button>
                )}
                {diseaseGroups[selectedCategory]?.map((disease) => (
                  <button
                    key={disease}
                    onClick={() => setSelectedDisease(disease)}
                    className={`w-full p-3.5 rounded-xl border text-left text-sm font-medium transition-colors ${
                      selectedDisease === disease
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-card border-border/50 text-foreground active:bg-muted/50"
                    }`}
                  >
                    {disease}
                  </button>
                ))}
              </div>
            )}
          </div>
          {step === 2 && (
            <DrawerFooter>
              <Button
                onClick={handleConfirm}
                disabled={!selectedDisease || addMutation.isPending}
                className="w-full"
              >
                {addMutation.isPending ? "Salvando..." : "Confirmar"}
              </Button>
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>

      <div className="px-4 pt-6 pb-28 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft size={22} />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex-1">Doenças</h1>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : diseases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Activity className="text-muted-foreground" size={28} />
            </div>
            <p className="text-foreground font-semibold mb-1">Nenhuma doença registrada</p>
            <p className="text-muted-foreground text-sm">Toque no botão + para adicionar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {diseases.map((d) => (
              <div
                key={d.id}
                className="bg-card rounded-xl border border-border/50 p-4 flex items-start gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Activity className="text-primary" size={20} />
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
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Doencas;
