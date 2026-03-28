import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Droplets, Scissors, Bug, Pill, HelpCircle, Plus, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import useSmartBack from "@/hooks/useSmartBack";
import { format, parseISO, addWeeks, addMonths, addYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import SwipeableActionCard from "@/components/SwipeableActionCard";
import AddPetRoutineDrawer from "@/components/AddPetRoutineDrawer";
import EditPetRoutineDrawer from "@/components/EditPetRoutineDrawer";

const ROUTINE_ICONS: Record<string, React.ElementType> = {
  Banho: Droplets,
  Tosa: Scissors,
  Antipulgas: Bug,
  Vermífugo: Pill,
};

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  Agendado: { bg: "bg-[#AEE2D4]", text: "text-[#1C3333]", label: "Agendado" },
  Realizado: { bg: "bg-[#F2A97F]", text: "text-slate-900", label: "Realizado" },
};

const RECURRENCE_LABELS: Record<string, string> = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannually: "Semestral",
  annually: "Anual",
};

function calcNextDate(dateStr: string, recurrence: string): string {
  const base = parseISO(dateStr + "T12:00:00");
  let next: Date;
  switch (recurrence) {
    case "weekly": next = addWeeks(base, 1); break;
    case "biweekly": next = addWeeks(base, 2); break;
    case "monthly": next = addMonths(base, 1); break;
    case "quarterly": next = addMonths(base, 3); break;
    case "semiannually": next = addMonths(base, 6); break;
    case "annually": next = addYears(base, 1); break;
    default: return dateStr;
  }
  return format(next, "yyyy-MM-dd");
}

const PetRotinas = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { members } = useFamilyMembers();
  const { isAdmin, linkedMemberId, managedProfiles, isLoading: groupLoading } = useFamilyGroup();
  const navigate = useNavigate();
  const goBack = useSmartBack();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [editRoutine, setEditRoutine] = useState<any | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<"ativas" | "concluidas">("ativas");
  const undoRef = useRef<{ id: string; timeout: ReturnType<typeof setTimeout> } | null>(null);

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

  const member = members.find((m) => m.id === id);

  const { data: routines = [] } = useQuery({
    queryKey: ["pet_routines", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_routines")
        .select("*")
        .eq("family_member_id", id!)
        .order("date_performed", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!id,
    staleTime: 5 * 60 * 1000,
  });

  const filteredRoutines = routines.filter((r) => {
    const status = (r as any).status || "Agendado";
    if (abaAtiva === "ativas") return status !== "Realizado";
    return status === "Realizado";
  });

  const deleteMutation = useMutation({
    mutationFn: async (routineId: string) => {
      const { error } = await supabase.from("pet_routines").delete().eq("id", routineId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pet_routines", id] });
    },
    onError: () => toast.error("Erro ao excluir registro."),
  });

  const completeMutation = useMutation({
    mutationFn: async (routineId: string) => {
      const routine = routines.find((r) => r.id === routineId);
      const { error } = await supabase
        .from("pet_routines")
        .update({ status: "Realizado" } as any)
        .eq("id", routineId);
      if (error) throw error;

      // Auto-recurrence based on recurrence field
      const recurrence = (routine as any)?.recurrence;
      if (routine && recurrence && recurrence !== "none") {
        const nextDate = calcNextDate(routine.date_performed, recurrence);
        await supabase.from("pet_routines").insert({
          family_member_id: routine.family_member_id,
          user_id: routine.user_id,
          routine_type: routine.routine_type,
          date_performed: nextDate,
          next_due_date: null,
          notes: routine.notes,
          status: "Agendado",
          recurrence: recurrence,
        } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pet_routines", id] });
    },
    onError: () => toast.error("Erro ao atualizar registro."),
  });

  const handleDelete = (routineId: string) => {
    const prev = queryClient.getQueryData<any[]>(["pet_routines", id]);
    queryClient.setQueryData(
      ["pet_routines", id],
      (old: any[] | undefined) => old?.filter((r) => r.id !== routineId) ?? []
    );

    const timeout = setTimeout(() => {
      deleteMutation.mutate(routineId);
      undoRef.current = null;
    }, 5000);

    undoRef.current = { id: routineId, timeout };

    toast("Registro excluído", {
      action: {
        label: "Desfazer",
        onClick: () => {
          clearTimeout(timeout);
          undoRef.current = null;
          queryClient.setQueryData(["pet_routines", id], prev);
        },
      },
      duration: 5000,
    });
  };

  const handleComplete = (routineId: string) => {
    const prev = queryClient.getQueryData<any[]>(["pet_routines", id]);
    queryClient.setQueryData(
      ["pet_routines", id],
      (old: any[] | undefined) =>
        old?.map((r) => (r.id === routineId ? { ...r, status: "Realizado" } : r)) ?? []
    );

    const timeout = setTimeout(() => {
      completeMutation.mutate(routineId);
    }, 5000);

    toast("Marcado como Realizado", {
      action: {
        label: "Desfazer",
        onClick: () => {
          clearTimeout(timeout);
          queryClient.setQueryData(["pet_routines", id], prev);
        },
      },
      duration: 5000,
    });
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
      {/* Header */}
      <div className="flex-none bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={goBack} className="p-1 -ml-1">
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <Droplets className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Rotina e Higiene</h1>
        </div>
        {member && (
          <Badge variant="secondary" className="ml-auto text-xs">
            {member.name.split(" ")[0]}
          </Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="p-4 pb-8 space-y-3 min-h-[calc(100%+1px)]">
          {/* Segmented Tabs */}
          <div className="flex p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setAbaAtiva("ativas")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                abaAtiva === "ativas" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Ativas
            </button>
            <button
              onClick={() => setAbaAtiva("concluidas")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                abaAtiva === "concluidas" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Concluídas
            </button>
          </div>

          {filteredRoutines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-[#A7D3CB] flex items-center justify-center mb-4">
                <Droplets className="text-black" size={28} />
              </div>
              <p className="text-foreground font-semibold mb-1">
                {abaAtiva === "ativas" ? "Nenhuma rotina ativa" : "Nenhum histórico encontrado"}
              </p>
              <p className="text-muted-foreground text-sm">
                {abaAtiva === "ativas"
                  ? "Toque no botão abaixo para adicionar."
                  : "Rotinas concluídas aparecerão aqui."}
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredRoutines.map((r) => {
                const Icon = ROUTINE_ICONS[r.routine_type] || HelpCircle;
                const dateStr = format(parseISO(r.date_performed + "T12:00:00"), "dd MMM yyyy", { locale: ptBR });
                const recurrenceLabel = RECURRENCE_LABELS[(r as any).recurrence] || null;
                const status = (r as any).status || "Agendado";
                const badge = STATUS_BADGE[status] || STATUS_BADGE.Agendado;

                return (
                  <SwipeableActionCard
                    key={r.id}
                    isOpen={openCardId === r.id}
                    onOpenChange={(open) => setOpenCardId(open ? r.id : null)}
                    onDelete={() => handleDelete(r.id)}
                    leadingAction={
                      status !== "Realizado"
                        ? {
                            icon: <Check className="w-5 h-5" />,
                            label: "Realizado",
                            bgColor: "#F2A97F",
                            textColor: "#1a1a1a",
                            onAction: () => handleComplete(r.id),
                          }
                        : undefined
                    }
                  >
                    <div
                      onClick={() => {
                        if (openCardId === r.id) return;
                        setEditRoutine(r);
                      }}
                      className="bg-card rounded-xl border border-border/50 px-4 py-3 flex items-center gap-3 cursor-pointer active:bg-muted/50 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#A7D3CB] flex items-center justify-center flex-shrink-0">
                        <Icon className="text-black" size={18} />
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{r.routine_type}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                        </div>
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
                    </div>
                  </SwipeableActionCard>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* FAB */}
      {!drawerOpen && !editRoutine && (
        <button
          onClick={() => setDrawerOpen(true)}
          className="fixed right-6 bottom-24 z-40 w-14 h-14 rounded-full bg-[#F2A97F] hover:bg-[#ff9b66] text-slate-900 shadow-lg flex items-center justify-center transition-none"
        >
          <Plus size={24} />
        </button>
      )}

      <AddPetRoutineDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        familyMemberId={id!}
      />

      <EditPetRoutineDrawer
        open={!!editRoutine}
        onOpenChange={(open) => { if (!open) setEditRoutine(null); }}
        routine={editRoutine}
      />
    </div>
  );
};

export default PetRotinas;
