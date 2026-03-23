import { useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, Pill, Clock, ChevronRight, Stethoscope, CalendarPlus, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMedications, Medication } from "@/hooks/useMedications";
import AddMedicationDrawer from "@/components/AddMedicationDrawer";
import FixedFAB from "@/components/ui/FixedFAB";
import useSmartBack from "@/hooks/useSmartBack";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Medicamentos = () => {
  const { id } = useParams();
  const goBack = useSmartBack();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const { medications, isLoading } = useMedications(id!);

  const handleOpenEdit = (m: Medication) => {
    setEditingMedication(m);
    setDrawerOpen(true);
  };

  const handleDrawerChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) setEditingMedication(null);
  };

  const handleAdd = () => {
    setEditingMedication(null);
    setDrawerOpen(true);
  };

  const handleBack = goBack;

  return (
    <>
      {!drawerOpen && <FixedFAB onClick={handleAdd} />}
      <AddMedicationDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerChange}
        familyMemberId={id!}
        editingMedication={editingMedication}
      />

      <div className="px-4 pt-6 pb-28 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft size={22} />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex-1">Medicamentos</h1>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : medications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-[#A7D3CB] flex items-center justify-center mb-4">
              <Pill className="text-black" size={28} />
            </div>
            <p className="text-foreground font-semibold mb-1">Nenhum medicamento ativo</p>
            <p className="text-muted-foreground text-sm">Toque no botão abaixo para adicionar.</p>
          </div>
        ) : (
          <div className="flex flex-col space-y-3">
            {medications.map((m) => (
              <button
                key={m.id}
                onClick={() => handleOpenEdit(m)}
                className="flex items-start gap-4 p-4 bg-card rounded-xl border border-border/50 shadow-sm text-left active:bg-accent/50 sm:hover:bg-accent/50 transition-colors w-full"
              >
                <div className="w-10 h-10 rounded-xl bg-[#A7D3CB] flex items-center justify-center shrink-0 mt-0.5">
                  <Pill className="text-black" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-foreground truncate">{m.name}</p>
                    <Badge
                      className={`text-[10px] px-1.5 py-0 border-none ${
                        m.status === "Ativo"
                          ? "bg-[#F2A97F] text-black"
                          : "bg-[#A7D3CB] text-black"
                      }`}
                    >
                      {m.status}
                    </Badge>
                  </div>
                  {m.dosage && (
                    <p className="text-xs text-muted-foreground truncate">{m.dosage}</p>
                  )}
                  {m.consultations?.professional_name && (
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                      <Stethoscope size={12} />
                      <span>Solicitado por {m.consultations.professional_name}</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5 mt-2">
                    {m.frequency_hours != null && m.frequency_hours > 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock size={14} className="shrink-0" />
                        <span>{m.frequency_hours === 24 ? "1x ao dia" : `A cada ${m.frequency_hours}h`}</span>
                      </div>
                    )}
                    {m.frequency_hours === 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock size={14} className="shrink-0" />
                        <span>Uso contínuo</span>
                      </div>
                    )}
                    {m.start_date && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarPlus size={14} className="shrink-0" />
                        <span>
                          Início: {format(new Date(m.start_date.slice(0, 10) + "T12:00:00"), "dd/MM/yyyy")}
                          {m.start_time ? ` às ${m.start_time.slice(0, 5)}` : ""}
                        </span>
                      </div>
                    )}
                    {m.end_date && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarCheck size={14} className="shrink-0" />
                        <span>
                          Término: {format(new Date(m.end_date.slice(0, 10) + "T12:00:00"), "dd/MM/yyyy")}
                          {m.start_time ? ` às ${m.start_time.slice(0, 5)}` : ""}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <ChevronRight size={18} className="text-muted-foreground shrink-0 mt-3" />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Medicamentos;
