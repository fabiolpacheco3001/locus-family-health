import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useFamilyGroup } from "./useFamilyGroup";
import { toast } from "sonner";

export type InstructionItem = {
  id: string;
  text: string;
  completed: boolean;
  alarmEnabled: boolean;
  alarmAt: string | null;
  createdByAi: boolean;
};

export type SurgeryInstruction = {
  id: string;
  surgery_id: string;
  phase: "pre" | "post";
  items: InstructionItem[];
  raw_ocr_text: string | null;
};

export type Surgery = {
  id: string;
  user_id: string;
  group_id: string;
  family_member_id: string;
  surgery_type: string;
  custom_type: string | null;
  scheduled_date: string | null;
  hospital_clinic: string | null;
  surgeon_name: string | null;
  status: "scheduled" | "completed" | "canceled";
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  family_members?: { name: string; member_type: string };
  surgery_instructions?: SurgeryInstruction[];
};

export type CreateSurgeryPayload = {
  family_member_id: string;
  surgery_type: string;
  custom_type?: string;
  scheduled_date?: string;
  hospital_clinic?: string;
  surgeon_name?: string;
  notes?: string;
  pre_instructions?: InstructionItem[];
  post_instructions?: InstructionItem[];
};

export type UpdateSurgeryPayload = {
  id: string;
  surgery_type?: string;
<<<<<<< HEAD
  custom_type?: string | null;
  scheduled_date?: string | null;
  hospital_clinic?: string | null;
  surgeon_name?: string | null;
  status?: "scheduled" | "completed" | "canceled";
  notes?: string | null;
};

=======
  custom_type?: string;
  scheduled_date?: string;
  hospital_clinic?: string;
  surgeon_name?: string;
  status?: "scheduled" | "completed" | "canceled";
  notes?: string;
};

function genId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
export function useSurgeries(familyMemberId?: string) {
  const { user } = useAuth();
  const { groupId, isAdmin, linkedMemberId, managedProfiles } = useFamilyGroup();
  const queryClient = useQueryClient();

  const { data: surgeries = [], isLoading } = useQuery({
<<<<<<< HEAD
    queryKey: ["surgeries", familyMemberId, groupId, isAdmin, linkedMemberId, managedProfiles],
    queryFn: async () => {
      // Cast `from` to any: tabelas recém-criadas podem não estar nos tipos gerados ainda
      let query = (supabase.from("surgeries" as any) as any)
        .select(
          `id, user_id, group_id, family_member_id, surgery_type, custom_type,
           scheduled_date, hospital_clinic, surgeon_name, status, notes,
           deleted_at, created_at, updated_at,
           family_members!inner(name, member_type, deleted_at),
           surgery_instructions(id, surgery_id, phase, items, raw_ocr_text)`
=======
    queryKey: ["surgeries", familyMemberId, groupId],
    queryFn: async () => {
      let query = supabase
        .from("surgeries")
        .select(
          "id, user_id, group_id, family_member_id, surgery_type, custom_type, " +
          "scheduled_date, hospital_clinic, surgeon_name, status, notes, " +
          "deleted_at, created_at, updated_at, " +
          "family_members!inner(name, member_type, deleted_at), " +
          "surgery_instructions(id, surgery_id, phase, items, raw_ocr_text)"
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
        )
        .is("deleted_at", null)
        .is("family_members.deleted_at", null)
        .order("scheduled_date", { ascending: false });

      if (familyMemberId) {
        query = query.eq("family_member_id", familyMemberId);
      } else if (!isAdmin && linkedMemberId) {
        const allowedIds = [linkedMemberId, ...(managedProfiles ?? [])];
        query = query.in("family_member_id", allowedIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Surgery[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["surgeries"] });
    queryClient.invalidateQueries({ queryKey: ["upcoming-appointments"] });
    queryClient.invalidateQueries({ queryKey: ["agenda"] });
  };

<<<<<<< HEAD
  const newId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `item-${Date.now()}-${Math.random().toString(36).slice(2)}`;

=======
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
  const createMutation = useMutation({
    mutationFn: async (payload: CreateSurgeryPayload) => {
      if (!user || !groupId) throw new Error("Usuário não autenticado");

<<<<<<< HEAD
      const { data: surgery, error: surgeryError } = await (supabase
        .from("surgeries" as any) as any)
=======
      const { data: surgery, error: surgeryError } = await supabase
        .from("surgeries")
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
        .insert({
          user_id: user.id,
          group_id: groupId,
          family_member_id: payload.family_member_id,
          surgery_type: payload.surgery_type,
          custom_type: payload.custom_type ?? null,
          scheduled_date: payload.scheduled_date ?? null,
          hospital_clinic: payload.hospital_clinic ?? null,
          surgeon_name: payload.surgeon_name ?? null,
          notes: payload.notes ?? null,
          status: "scheduled",
        })
        .select("id")
        .single();

<<<<<<< HEAD
      if (surgeryError || !surgery) throw surgeryError;

      const instructionRows: any[] = [];
      if (payload.pre_instructions && payload.pre_instructions.length > 0) {
        instructionRows.push({
          surgery_id: surgery.id,
          phase: "pre",
          items: payload.pre_instructions.map((item) => ({ ...item, id: item.id || newId() })),
        });
      }
      if (payload.post_instructions && payload.post_instructions.length > 0) {
        instructionRows.push({
          surgery_id: surgery.id,
          phase: "post",
          items: payload.post_instructions.map((item) => ({ ...item, id: item.id || newId() })),
        });
      }

      if (instructionRows.length > 0) {
        const { error: instrError } = await (supabase
          .from("surgery_instructions" as any) as any)
          .insert(instructionRows);
        if (instrError) throw instrError;
      }

      return surgery.id as string;
=======
      if (surgeryError || !surgery) throw surgeryError ?? new Error("Erro ao criar cirurgia");

      const instructionInserts: Array<{
        surgery_id: string;
        phase: "pre" | "post";
        items: InstructionItem[];
      }> = [];

      if (payload.pre_instructions && payload.pre_instructions.length > 0) {
        instructionInserts.push({
          surgery_id: surgery.id,
          phase: "pre",
          items: payload.pre_instructions.map((item) => ({ ...item, id: item.id || genId() })),
        });
      }
      if (payload.post_instructions && payload.post_instructions.length > 0) {
        instructionInserts.push({
          surgery_id: surgery.id,
          phase: "post",
          items: payload.post_instructions.map((item) => ({ ...item, id: item.id || genId() })),
        });
      }

      if (instructionInserts.length > 0) {
        const { error: instrError } = await supabase
          .from("surgery_instructions")
          .insert(instructionInserts);
        if (instrError) throw instrError;
      }

      return surgery.id;
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
    },
    onSuccess: () => {
      invalidate();
      toast.success("Cirurgia salva com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao salvar cirurgia. Tente novamente.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateSurgeryPayload) => {
      const { id, ...updates } = payload;
<<<<<<< HEAD
      const { error } = await (supabase.from("surgeries" as any) as any)
=======
      const { error } = await supabase
        .from("surgeries")
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Cirurgia atualizada!");
    },
    onError: () => {
      toast.error("Erro ao atualizar cirurgia.");
    },
  });

  const updateInstructionsMutation = useMutation({
    mutationFn: async ({
      surgeryId,
      phase,
      items,
      rawOcrText,
    }: {
      surgeryId: string;
      phase: "pre" | "post";
      items: InstructionItem[];
      rawOcrText?: string;
    }) => {
<<<<<<< HEAD
      const { error } = await (supabase
        .from("surgery_instructions" as any) as any)
=======
      const { error } = await supabase
        .from("surgery_instructions")
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
        .upsert(
          {
            surgery_id: surgeryId,
            phase,
            items,
            raw_ocr_text: rawOcrText ?? null,
          },
          { onConflict: "surgery_id,phase" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
    },
    onError: () => {
      toast.error("Erro ao salvar instruções.");
    },
  });

<<<<<<< HEAD
  const deleteMutation = useMutation({
    mutationFn: async (surgeryId: string) => {
      const { error } = await (supabase.from("surgeries" as any) as any)
=======
  const softDeleteMutation = useMutation({
    mutationFn: async (surgeryId: string) => {
      const { error } = await supabase
        .from("surgeries")
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", surgeryId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Cirurgia removida.");
    },
    onError: () => {
      toast.error("Erro ao remover cirurgia.");
    },
  });

  return {
    surgeries,
    isLoading,
    createMutation,
    updateMutation,
    updateInstructionsMutation,
<<<<<<< HEAD
    deleteMutation,
=======
    softDeleteMutation,
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
  };
}
