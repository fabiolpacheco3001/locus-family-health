import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, Plus, Loader2, ArrowUpDown, Share2 } from "lucide-react";
import useSmartBack from "@/hooks/useSmartBack";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useFamilyAccessGuard } from "@/hooks/useFamilyAccessGuard";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { useSurgeries } from "@/hooks/useSurgeries";
import { SurgeryCard } from "@/components/SurgeryCard";
import { AddSurgeryDrawer } from "@/components/AddSurgeryDrawer";
import { getSurgeryLabel } from "@/lib/surgeryTypes";
import { format, parseISO, isValid, compareAsc, compareDesc } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Surgery } from "@/hooks/useSurgeries";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Scissors } from "lucide-react";

const Surgeries = () => {
  const { id } = useParams<{ id: string }>();
  const goBack = useSmartBack();
  const { members } = useFamilyMembers();
  const { isAdmin } = useFamilyGroup();
  const { surgeries, isLoading, softDeleteMutation, updateMutation } = useSurgeries(id);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingSurgery, setEditingSurgery] = useState<Surgery | null>(null);
  const [activeTab, setActiveTab] = useState<"scheduled" | "done">("scheduled");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  useFamilyAccessGuard(id);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [id]);

  const member = members.find((m) => m.id === id);

  const scheduled = surgeries.filter((s) => s.status === "scheduled");
  const done = surgeries.filter((s) => s.status !== "scheduled");

  const sortSurgeries = (list: Surgery[]) =>
    [...list].sort((a, b) => {
      const dateA = a.scheduled_date ? new Date(a.scheduled_date) : new Date(0);
      const dateB = b.scheduled_date ? new Date(b.scheduled_date) : new Date(0);
      return sortOrder === "asc" ? compareAsc(dateA, dateB) : compareDesc(dateA, dateB);
    });

  const displayed = sortSurgeries(activeTab === "scheduled" ? scheduled : done);

  const handleOpenEdit = (surgery: Surgery) => {
    setEditingSurgery(surgery);
    setDrawerOpen(true);
  };

  const handleDrawerChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) setEditingSurgery(null);
  };

  const handleAdd = () => {
    setEditingSurgery(null);
    setDrawerOpen(true);
  };

  const handleExportAllPdf = () => {
    const doc = new jsPDF();
    const primaryColor: [number, number, number] = [26, 58, 92];
    const accentColor: [number, number, number] = [120, 194, 173];

    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Locus Vita — Relatório de Cirurgias", 14, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Paciente: ${member?.name ?? "—"} · Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      14,
      20
    );

    const statusMap: Record<string, string> = {
      scheduled: "Agendada",
      completed: "Realizada",
      canceled: "Cancelada",
    };

    let yOffset = 38;

    surgeries.forEach((surgery, idx) => {
      const displayName =
        surgery.surgery_type === "outro" && surgery.custom_type
          ? surgery.custom_type
          : getSurgeryLabel(surgery.surgery_type);

      const scheduledDate = surgery.scheduled_date ? parseISO(surgery.scheduled_date) : null;
      const formattedDate =
        scheduledDate && isValid(scheduledDate)
          ? format(scheduledDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
          : "Não definida";

      if (idx > 0) yOffset += 6;

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`${idx + 1}. ${displayName}`, 14, yOffset);
      doc.setDrawColor(...accentColor);
      doc.line(14, yOffset + 2, 196, yOffset + 2);

      autoTable(doc, {
        startY: yOffset + 6,
        theme: "plain",
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 } },
        body: [
          ["Status", statusMap[surgery.status] ?? surgery.status],
          ["Data / Hora", formattedDate],
          ["Hospital / Clínica", surgery.hospital_clinic ?? "—"],
          ["Profissional", surgery.surgeon_name ?? "—"],
          ["Observações", surgery.notes ?? "—"],
        ],
      });

      yOffset = (doc as any).lastAutoTable.finalY + 8;
    });

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Locus Vita — Saúde Familiar Simplificada · locustech.com.br", 14, 285);

    const memberSlug = member?.name?.toLowerCase().replace(/\s+/g, "-") ?? "membro";
    doc.save(`cirurgias-${memberSlug}-${format(new Date(), "ddMMyyyy")}.pdf`);
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
      {/* Header */}
      <div className="flex-none bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={goBack} className="p-1 -ml-1" aria-label="Voltar">
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground flex-1">Cirurgias</h1>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-[#78C2AD]"
          onClick={handleExportAllPdf}
          disabled={surgeries.length === 0}
          aria-label="Exportar PDF"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs pill + sort — padrão Consultas */}
      <div className="flex-none bg-background px-4 py-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-slate-100 rounded-xl flex-1">
            <button
              onClick={() => setActiveTab("scheduled")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === "scheduled"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Agendadas ({scheduled.length})
            </button>
            <button
              onClick={() => setActiveTab("done")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === "done"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Concluídas ({done.length})
            </button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setSortOrder("asc")}
                className={sortOrder === "asc" ? "font-semibold" : ""}
              >
                Mais próximas primeiro
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortOrder("desc")}
                className={sortOrder === "desc" ? "font-semibold" : ""}
              >
                Mais recentes primeiro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-3">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        )}

        {!isLoading && displayed.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-[#A7D3CB] flex items-center justify-center mb-4">
              <Scissors className="text-black" size={28} />
            </div>
            <p className="text-foreground font-semibold mb-1">
              {activeTab === "scheduled"
                ? "Nenhuma cirurgia agendada"
                : "Nenhuma cirurgia concluída"}
            </p>
            <p className="text-muted-foreground text-sm">
              {activeTab === "scheduled"
                ? "Toque em '+' para registrar."
                : "Cirurgias realizadas ou canceladas aparecerão aqui."}
            </p>
          </div>
        )}

        {!isLoading &&
          displayed.map((surgery) => (
            <SurgeryCard
              key={surgery.id}
              surgery={surgery}
              onEdit={() => handleOpenEdit(surgery)}
              onDelete={() => softDeleteMutation.mutate(surgery.id)}
              onComplete={() =>
                updateMutation.mutate({ id: surgery.id, status: "completed" })
              }
              isAdmin={isAdmin}
              isOpen={openCardId === surgery.id}
              onOpenChange={(open) => setOpenCardId(open ? surgery.id : null)}
            />
          ))}

        <div className="h-20" />
      </div>

      {/* FAB — cor preta */}
      <button
        onClick={handleAdd}
        className="absolute bottom-6 right-4 w-14 h-14 bg-foreground hover:bg-foreground/90 active:bg-foreground/80 text-background rounded-full shadow-lg flex items-center justify-center transition-colors z-10"
        aria-label="Adicionar cirurgia"
      >
        <Plus size={28} />
      </button>

      {id && (
        <AddSurgeryDrawer
          open={drawerOpen}
          onOpenChange={handleDrawerChange}
          familyMemberId={id}
          editingSurgery={editingSurgery}
        />
      )}
    </div>
  );
};

export default Surgeries;
