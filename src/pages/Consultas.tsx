import { useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, Stethoscope, Calendar, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useConsultations, Consultation } from "@/hooks/useConsultations";
import AddConsultationDrawer from "@/components/AddConsultationDrawer";
import FixedFAB from "@/components/ui/FixedFAB";
import useSmartBack from "@/hooks/useSmartBack";
import { format, parseISO, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusColors: Record<string, string> = {
  Agendada: "bg-[#A0C4D7] text-black border-none",
  Realizada: "bg-[#F2A97F] text-black border-none",
  Cancelada: "bg-[#F87171] text-black border-none",
};

// Add "Realizada" status option - handled in AddConsultationDrawer

const Consultas = () => {
  const { id } = useParams();
  const goBack = useSmartBack();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingConsultation, setEditingConsultation] = useState<Consultation | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'proximas' | 'historico'>('proximas');
  const { consultations, isLoading } = useConsultations(id!);

  const consultasFiltradas = consultations.filter(c => {
    if (abaAtiva === 'proximas') return c.status === 'Agendada';
    return c.status === 'Realizada' || c.status === 'Cancelada';
  });

  const handleOpenEdit = (c: Consultation) => {
    setEditingConsultation(c);
    setDrawerOpen(true);
  };

  const handleDrawerChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) setEditingConsultation(null);
  };

  const handleAdd = () => {
    setEditingConsultation(null);
    setDrawerOpen(true);
  };

  return (
    <>
      {!drawerOpen && <FixedFAB onClick={handleAdd} />}
      <AddConsultationDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerChange}
        familyMemberId={id!}
        editingConsultation={editingConsultation}
      />

      <div className="px-4 pt-6 pb-28 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft size={22} />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex-1">Consultas</h1>
        </div>

        <div className="mb-4">
          <div className="flex p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setAbaAtiva('proximas')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                abaAtiva === 'proximas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Próximas
            </button>
            <button
              onClick={() => setAbaAtiva('historico')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                abaAtiva === 'historico' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Histórico
            </button>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : consultasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-[#A7D3CB] flex items-center justify-center mb-4">
              <Stethoscope className="text-black" size={28} />
            </div>
            <p className="text-foreground font-semibold mb-1">
              {abaAtiva === 'proximas' ? 'Nenhuma consulta agendada' : 'Nenhum histórico encontrado'}
            </p>
            <p className="text-muted-foreground text-sm">
              {abaAtiva === 'proximas' ? 'Toque no botão abaixo para adicionar.' : 'Consultas realizadas ou canceladas aparecerão aqui.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col space-y-3">
            {consultasFiltradas.map((c) => (
              <button
                key={c.id}
                onClick={() => handleOpenEdit(c)}
                className="flex items-start gap-4 p-4 bg-card rounded-xl border border-border/50 shadow-sm text-left active:bg-accent/50 sm:hover:bg-accent/50 transition-colors w-full"
              >
                <div className="w-10 h-10 rounded-xl bg-[#A7D3CB] flex items-center justify-center shrink-0 mt-0.5">
                  <Stethoscope className="text-black" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-bold text-foreground truncate">{c.specialty}</p>
                    {c.status === "Agendada" && c.consultation_date && isBefore(parseISO(c.consultation_date), new Date()) && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Atrasado
                      </Badge>
                    )}
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
                        {(() => {
                          const hasTime = c.consultation_date!.length > 10;
                          const parsed = hasTime ? parseISO(c.consultation_date!) : new Date(c.consultation_date + 'T12:00:00');
                          const datePart = format(parsed, "dd MMM yyyy", { locale: ptBR });
                          const dayName = format(parsed, "EEEEEE", { locale: ptBR });
                          const dayAbbr = dayName.substring(0, 3);
                          const dayCapitalized = dayAbbr.charAt(0).toUpperCase() + dayAbbr.slice(1);
                          const timePart = hasTime ? ` às ${format(parsed, "HH:mm")}` : "";
                          return `${datePart} - ${dayCapitalized}${timePart}`;
                        })()}
                      </span>
                    </div>
                  )}
                  {c.symptoms && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">Sintomas: {c.symptoms}</p>
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

export default Consultas;
