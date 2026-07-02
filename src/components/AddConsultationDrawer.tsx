import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SpecialtyCombobox from "@/components/SpecialtyCombobox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useConsultations, Consultation, NewConsultation } from "@/hooks/useConsultations";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { Activity } from "lucide-react";
import {
  consultationSchema,
  consultationDefaultValues,
  type ConsultationFormInput,
} from "@/lib/schemas/consultation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMemberId: string;
  editingConsultation?: Consultation | null;
  memberType?: string;
}

const AddConsultationDrawer = ({ open, onOpenChange, familyMemberId, editingConsultation, memberType }: Props) => {
  const { user } = useAuth();
  const { groupId } = useFamilyGroup();
  const { addConsultation, updateConsultation } = useConsultations(familyMemberId);
  const [showCancelAlert, setShowCancelAlert] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // [ID-016] Validação centralizada via Zod — src/lib/schemas/consultation.ts
  const form = useForm<ConsultationFormInput>({
    resolver: zodResolver(consultationSchema),
    defaultValues: consultationDefaultValues,
  });

  const isEditing = !!editingConsultation;
  const isCancelled = editingConsultation?.status === "Cancelada";

  useEffect(() => {
    if (editingConsultation) {
      const cd = editingConsultation.consultation_date;
      let consultationDate = "";
      if (cd) {
        const d = new Date(cd);
        consultationDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
      form.reset({
        specialty: editingConsultation.specialty,
        professional_name: editingConsultation.professional_name ?? "",
        consultation_date: consultationDate,
        type: (editingConsultation.type as ConsultationFormInput["type"]) ?? "Rotina",
        symptoms: editingConsultation.symptoms ?? "",
        questions: editingConsultation.questions ?? "",
        location: editingConsultation.location ?? "",
        systolic: "",
        diastolic: "",
      });

      // Fetch existing BP for this consultation
      supabase
        .from("blood_pressure_history")
        .select("systolic, diastolic")
        .eq("consultation_id", editingConsultation.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            form.setValue("systolic", String(data.systolic));
            form.setValue("diastolic", String(data.diastolic));
          } else {
            form.setValue("systolic", "");
            form.setValue("diastolic", "");
          }
        });
    } else {
      form.reset({
        ...consultationDefaultValues,
        specialty: memberType === "pet" ? "Veterinário" : "",
      });
      setCancelReason("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingConsultation, open, memberType]);

  const saveBP = async (consultationId: string, systolic: string, diastolic: string) => {
    const sys = parseInt(systolic, 10);
    const dia = parseInt(diastolic, 10);
    if (!systolic || !diastolic || isNaN(sys) || isNaN(dia) || sys <= 0 || dia <= 0) return;

    // Upsert: delete existing then insert new
    await supabase
      .from("blood_pressure_history")
      .delete()
      .eq("consultation_id", consultationId);

    await supabase.from("blood_pressure_history").insert({
      user_id: user!.id,
      familiar_id: familyMemberId,
      consultation_id: consultationId,
      systolic: sys,
      diastolic: dia,
      source: "consultation",
      group_id: groupId ?? undefined,
    });
  };

  const handleSave = async (data: ConsultationFormInput) => {
    try {
      if (isEditing && editingConsultation) {
        await updateConsultation.mutateAsync({
          id: editingConsultation.id,
          specialty: data.specialty,
          professional_name: data.professional_name || null,
          consultation_date: data.consultation_date ? new Date(data.consultation_date).toISOString() : null,
          type: data.type,
          symptoms: data.symptoms || null,
          questions: data.questions || null,
          status: editingConsultation.status,
          location: data.location || null,
        });
        await saveBP(editingConsultation.id, data.systolic ?? "", data.diastolic ?? "");
        toast.success("Consulta atualizada!");
      } else {
        const consultation: NewConsultation = {
          family_member_id: familyMemberId,
          specialty: data.specialty,
          professional_name: data.professional_name || null,
          consultation_date: data.consultation_date ? new Date(data.consultation_date).toISOString() : null,
          type: data.type,
          symptoms: data.symptoms || null,
          questions: data.questions || null,
          location: data.location || null,
        };
        const result = await addConsultation.mutateAsync(consultation);
        await saveBP(result.id, data.systolic ?? "", data.diastolic ?? "");
        toast.success("Consulta agendada com sucesso!");
      }
      form.reset(consultationDefaultValues);
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }
  };

  const handleCancel = async () => {
    if (!editingConsultation) return;
    try {
      await updateConsultation.mutateAsync({
        id: editingConsultation.id,
        status: "Cancelada",
        cancel_reason: cancelReason.trim() || null,
      });
      toast.success("Consulta cancelada.");
      form.reset(consultationDefaultValues);
      onOpenChange(false);
    } catch {
      toast.error("Erro ao cancelar. Tente novamente.");
    }
    setShowCancelAlert(false);
  };

  const isPending = addConsultation.isPending || updateConsultation.isPending;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false} disablePreventScroll={false}>
        <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-background outline-hidden">
          <DrawerHeader>
            <DrawerTitle className="text-primary">
              {isEditing ? "Editar Consulta" : "Nova Consulta"}
            </DrawerTitle>
            <DrawerDescription>
              {isEditing ? "Altere os dados da consulta." : "Preencha os dados da consulta e pré-consulta."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-24 space-y-4 no-scrollbar">
            <div className="space-y-1.5">
              <Label>Especialidade *</Label>
              <Controller
                control={form.control}
                name="specialty"
                render={({ field }) => (
                  <SpecialtyCombobox value={field.value} onValueChange={field.onChange} />
                )}
              />
              {form.formState.errors.specialty && (
                <p className="text-sm text-destructive">{form.formState.errors.specialty.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Nome do Profissional</Label>
              <Input
                placeholder="Ex: Dr. Carlos Silva"
                className="text-[16px] scroll-m-20"
                {...form.register("professional_name")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Local (Hospital / Clínica / Laboratório)</Label>
              <Input
                placeholder="Ex: Hospital das Clínicas"
                className="text-[16px] scroll-m-20"
                {...form.register("location")}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Data e Hora</Label>
                <Controller
                  control={form.control}
                  name="consultation_date"
                  render={({ field }) => (
                    <DatePickerField value={field.value ?? ""} onChange={field.onChange} mode="datetime" />
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Classificação</Label>
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="text-[16px] scroll-m-20">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Rotina">Rotina</SelectItem>
                        <SelectItem value="Emergência">Emergência</SelectItem>
                        <SelectItem value="Retorno">Retorno</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Motivo da Visita</Label>
              <Textarea
                placeholder="Ex: Dores no estômago após as refeições"
                rows={3}
                className="text-[16px] scroll-m-20 resize-none"
                {...form.register("symptoms")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Dúvidas para o Médico</Label>
              <Textarea
                placeholder="Ex: Posso tomar com outros remédios?"
                rows={3}
                className="text-[16px] scroll-m-20 resize-none"
                {...form.register("questions")}
              />
            </div>

            {/* Medições Clínicas - apenas para humanos */}
            {memberType !== 'pet' && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <Label className="text-sm font-semibold text-foreground">Medições Clínicas</Label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Sistólica (mmHg)</Label>
                    <Controller
                      control={form.control}
                      name="systolic"
                      render={({ field }) => (
                        <Input
                          type="number"
                          inputMode="numeric"
                          placeholder="Ex: 120"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value.replace(/[^0-9]/g, ''))}
                          min={1}
                          max={300}
                          className="text-[16px] scroll-m-20"
                        />
                      )}
                    />
                    {form.formState.errors.systolic && (
                      <p className="text-sm text-destructive">{form.formState.errors.systolic.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Diastólica (mmHg)</Label>
                    <Controller
                      control={form.control}
                      name="diastolic"
                      render={({ field }) => (
                        <Input
                          type="number"
                          inputMode="numeric"
                          placeholder="Ex: 80"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value.replace(/[^0-9]/g, ''))}
                          min={1}
                          max={300}
                          className="text-[16px] scroll-m-20"
                        />
                      )}
                    />
                    {form.formState.errors.diastolic && (
                      <p className="text-sm text-destructive">{form.formState.errors.diastolic.message}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            {isEditing && !isCancelled && (
              <div className="pt-4 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => { setCancelReason(""); setShowCancelAlert(true); }}
                >
                  <Ban size={16} className="mr-2" />
                  Cancelar Consulta
                </Button>
              </div>
            )}
          </div>

          <DrawerFooter className="flex-row gap-3">
            <DrawerClose asChild>
              <Button variant="ghost" className="flex-1">Cancelar</Button>
            </DrawerClose>
            {!isCancelled && (
              <Button
                onClick={form.handleSubmit(handleSave)}
                disabled={isPending}
                className="flex-1"
              >
                {isPending ? <Loader2 className="animate-spin" size={18} /> : isEditing ? "Salvar Alterações" : "Agendar Consulta"}
              </Button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={showCancelAlert} onOpenChange={setShowCancelAlert}>
        <AlertDialogContent className="max-w-[320px] w-[90vw] rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Compromisso</AlertDialogTitle>
          <AlertDialogDescription className="mb-4">
              Essa ação mudará o status da consulta para cancelada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6">
            <Textarea
              placeholder="Ex: Conflito de horário, remarcação..."
              maxLength={200}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="text-[16px] resize-none min-h-[120px] border border-[hsl(var(--primary)/0.2)] focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-offset-0"
              rows={5}
              autoFocus
            />
            <p className="text-xs text-muted-foreground/60 text-right mt-2">{cancelReason.length}/200</p>
          </div>
          <AlertDialogFooter className="px-6 pb-6">
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={updateConsultation.isPending}
            >
              {updateConsultation.isPending ? <Loader2 className="animate-spin" size={16} /> : "Confirmar Cancelamento"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AddConsultationDrawer;
