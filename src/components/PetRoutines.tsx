import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Droplets, Plus, Scissors, Bug, Pill, HelpCircle, ArrowUpDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import AddPetRoutineDrawer from "@/components/AddPetRoutineDrawer";

const ROUTINE_ICONS: Record<string, React.ElementType> = {
  Banho: Droplets,
  Tosa: Scissors,
  Antipulgas: Bug,
  Vermífugo: Pill,
};

interface PetRoutinesProps {
  familyMemberId: string;
}

const PetRoutines = ({ familyMemberId }: PetRoutinesProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data: routines = [] } = useQuery({
    queryKey: ["pet_routines", familyMemberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_routines")
        .select("*")
        .eq("family_member_id", familyMemberId)
        .order("date_performed", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!familyMemberId,
    staleTime: 5 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pet_routines")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro excluído!");
      queryClient.invalidateQueries({ queryKey: ["pet_routines", familyMemberId] });
      queryClient.invalidateQueries({ queryKey: ["pending-counts"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["today-pet-routines"] });
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
    },
    onError: () => toast.error("Erro ao excluir registro."),
  });

  const handleDelete = (id: string) => {
    if (!window.confirm("Deseja excluir este registro?")) return;
    deleteMutation.mutate(id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Droplets className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Rotina e Higiene</h2>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortOrder('asc')} className={sortOrder === 'asc' ? 'font-semibold' : ''}>
                Mais antigos primeiro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder('desc')} className={sortOrder === 'desc' ? 'font-semibold' : ''}>
                Mais recentes primeiro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setDrawerOpen(true)}
          >
            <Plus size={16} />
            Adicionar
          </Button>
        </div>
      </div>

      {routines.length === 0 ? (
        <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-5">
          <p className="text-sm text-muted-foreground text-center">
            Nenhum registro de rotina ainda. Adicione banhos, tosas e vermífugos.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...routines].sort((a, b) => {
            const dateA = new Date(a.date_performed).getTime();
            const dateB = new Date(b.date_performed).getTime();
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
          }).map((r) => {
            const Icon = ROUTINE_ICONS[r.routine_type] || HelpCircle;
            const dateStr = format(parseISO(r.date_performed + "T12:00:00"), "dd MMM yyyy", { locale: ptBR });
            const recurrenceLabels: Record<string, string> = {
              weekly: "Semanal", biweekly: "Quinzenal", monthly: "Mensal",
              quarterly: "Trimestral", semiannually: "Semestral", annually: "Anual",
            };
            const recurrenceLabel = recurrenceLabels[(r as any).recurrence] || null;

            return (
              <button
                key={r.id}
                onClick={() => handleDelete(r.id)}
                className="w-full bg-card rounded-xl border border-border/50 px-4 py-3 flex items-center gap-3 text-left active:bg-muted/50 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-[#A7D3CB] flex items-center justify-center flex-shrink-0">
                  <Icon className="text-black" size={18} />
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-sm font-medium text-foreground">{r.routine_type}</p>
                  <p className="text-xs text-muted-foreground capitalize">{dateStr}</p>
                  {recurrenceLabel && (
                    <p className="text-[10px] text-muted-foreground">
                      🔁 {recurrenceLabel}
                    </p>
                  )}
                  {r.notes && (
                    <p className="text-[10px] text-muted-foreground truncate">{r.notes}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <AddPetRoutineDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        familyMemberId={familyMemberId}
      />
    </div>
  );
};

export default PetRoutines;
