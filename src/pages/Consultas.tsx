import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Stethoscope, Calendar, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useConsultations } from "@/hooks/useConsultations";
import AddConsultationDrawer from "@/components/AddConsultationDrawer";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusColors: Record<string, string> = {
  Agendada: "bg-primary/10 text-primary border-primary/20",
  Realizada: "bg-secondary/10 text-secondary border-secondary/20",
  Cancelada: "bg-destructive/10 text-destructive border-destructive/20",
};

const Consultas = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { consultations, isLoading } = useConsultations(id!);

  if (isLoading) {
    return (
      <div className="px-4 pt-6 space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-6 w-32" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-28 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/familiar/${id}`)}>
          <ArrowLeft size={22} />
        </Button>
        <h1 className="text-lg font-bold text-foreground flex-1">Consultas</h1>
      </div>

      {/* List */}
      {consultations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Stethoscope className="text-primary" size={28} />
          </div>
          <p className="text-foreground font-semibold mb-1">Nenhuma consulta agendada</p>
          <p className="text-muted-foreground text-sm">Toque no + para adicionar.</p>
        </div>
      ) : (
        <div className="flex flex-col space-y-3">
          {consultations.map((c) => (
            <div
              key={c.id}
              className="flex items-start gap-4 p-4 bg-card rounded-xl border border-border/50 shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Stethoscope className="text-primary" size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-bold text-foreground truncate">{c.specialty}</p>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[c.status] ?? ""}`}>
                    {c.status}
                  </Badge>
                </div>
                {c.professional_name && (
                  <p className="text-xs text-muted-foreground truncate">{c.professional_name}</p>
                )}
                {c.consultation_date && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Calendar size={12} />
                    <span>
                      {format(new Date(c.consultation_date), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                )}
                {c.symptoms && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">Sintomas: {c.symptoms}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <Button
        onClick={() => setDrawerOpen(true)}
        className="fixed right-6 bottom-24 z-[100] w-14 h-14 rounded-full shadow-lg"
      >
        <Plus size={28} />
      </Button>

      {/* Drawer */}
      <AddConsultationDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        familyMemberId={id!}
      />
    </div>
  );
};

export default Consultas;
