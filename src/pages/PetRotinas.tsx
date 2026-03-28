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
import { format, parseISO } from "date-fns";
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
      // Find the routine to check for next_due_date
      const routine = routines.find((r) => r.id === routineId);
      const { error } = await supabase
        .from("pet_routines")
        .update({ status: "Realizado" } as any)
        .eq("id", routineId);
      if (error) throw error;

      // Auto-recurrence: if next_due_date exists, create a new "Agendado" routine
      if (routine?.next_due_date) {
        await supabase.from("pet_routines").insert({
          family_member_id: routine.family_member_id,
          user_id: routine.user_id,
          routine_type: routine.routine_type,
          date_performed: routine.next_due_date,
          next_due_date: null,
          notes: routine.notes,
          status: "Agendado",
        } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pet_routines", id] });
    },
    onError: () => toast.error("Erro ao atualizar registro."),
  });

  const handleDelete = (routineId: string) => {
    // Optimistic removal via cache
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
          {routines.length === 0 ? (
            <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-5">
              <p className="text-sm text-muted-foreground text-center">
                Nenhum registro de rotina ainda. Adicione banhos, tosas e vermífugos.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {routines.map((r) => {
                const Icon = ROUTINE_ICONS[r.routine_type] || HelpCircle;
                const dateStr = format(parseISO(r.date_performed + "T12:00:00"), "dd MMM yyyy", { locale: ptBR });
                const nextStr = r.next_due_date
                  ? format(parseISO(r.next_due_date + "T12:00:00"), "dd MMM yyyy", { locale: ptBR })
                  : null;
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
                            icon: <Check className="w-6 h-6" />,
                            label: "Realizado",
                            bgColor: "#F2A97F",
                            textColor: "#1e293b",
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
                        {nextStr && (
                          <p className="text-[10px] text-muted-foreground">
                            Próximo: <span className="capitalize">{nextStr}</span>
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
