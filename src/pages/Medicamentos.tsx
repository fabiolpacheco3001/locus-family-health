import { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft, Pill, Clock, ChevronRight, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMedications, Medication } from "@/hooks/useMedications";
import AddMedicationDrawer from "@/components/AddMedicationDrawer";
import FixedFAB from "@/components/ui/FixedFAB";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Medicamentos = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
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

  const handleBack = () => {
    if (location.state?.from === '/agenda') {
      navigate('/agenda', { replace: true });
    } else {
      navigate(`/familiar/${id}`, { replace: true });
    }
  };

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
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft size={22} />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex-1">Medicamentos</h1>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : medications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Pill className="text-primary" size={28} />
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
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Pill className="text-primary" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-foreground truncate">{m.name}</p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${
                        m.status === "Ativo"
                          ? "bg-secondary/10 text-secondary border-secondary/20"
                          : "bg-muted/50 text-muted-foreground border-border"
                      }`}
                    >
                      {m.status}
                    </Badge>
                  </div>
                  {m.dosage && (
                    <p className="text-xs text-muted-foreground truncate">{m.dosage}</p>
                  )}
                  {m.frequency && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Clock size={12} />
                      <span>{m.frequency}</span>
                    </div>
                  )}
                  {m.duration && (
                    <p className="text-xs text-muted-foreground mt-0.5">Duração: {m.duration}</p>
                  )}
                  {m.start_date && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Início: {format(new Date(m.start_date), "dd MMM yyyy", { locale: ptBR })}
                    </p>
                  )}
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
