<<<<<<< HEAD
import { useState } from "react";
=======
import { useState, useEffect } from "react";
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
import { useParams } from "react-router-dom";
import { ArrowLeft, Scissors, Plus, Loader2 } from "lucide-react";
import useSmartBack from "@/hooks/useSmartBack";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useFamilyAccessGuard } from "@/hooks/useFamilyAccessGuard";
import { useSurgeries } from "@/hooks/useSurgeries";
import { SurgeryCard } from "@/components/SurgeryCard";
import { AddSurgeryDrawer } from "@/components/AddSurgeryDrawer";
import { getSurgeryLabel } from "@/lib/surgeryTypes";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Surgery } from "@/hooks/useSurgeries";

const Surgeries = () => {
  const { id } = useParams<{ id: string }>();
  const goBack = useSmartBack();
  const { members } = useFamilyMembers();
  const { surgeries, isLoading } = useSurgeries(id);
  const [drawerOpen, setDrawerOpen] = useState(false);
<<<<<<< HEAD
  const [activeTab, setActiveTab] = useState<"scheduled" | "completed">("scheduled");

  useFamilyAccessGuard(id);

  const member = members.find((m) => m.id === id);

  const scheduled = surgeries.filter((s) => s.status === "scheduled");
  const completed = surgeries.filter((s) => s.status !== "scheduled");
  const displayed = activeTab === "scheduled" ? scheduled : completed;
=======
  const [activeTab, setActiveTab] = useState<"scheduled" | "done">("scheduled");

  useFamilyAccessGuard(id);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [id]);

  const member = members.find((m) => m.id === id);

  const scheduled = surgeries.filter((s) => s.status === "scheduled");
  const done = surgeries.filter((s) => s.status !== "scheduled");
  const displayed = activeTab === "scheduled" ? scheduled : done;
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))

  const handleExportPdf = (surgery: Surgery) => {
    const doc = new jsPDF();
    const primaryColor: [number, number, number] = [26, 58, 92];
    const accentColor: [number, number, number] = [120, 194, 173];

<<<<<<< HEAD
=======
    // Cabeçalho
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Locus Vita — Relatório de Cirurgia", 14, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      14,
      20
    );

    const displayName =
      surgery.surgery_type === "outro" && surgery.custom_type
        ? surgery.custom_type
        : getSurgeryLabel(surgery.surgery_type);

    const scheduledDate = surgery.scheduled_date ? parseISO(surgery.scheduled_date) : null;
    const formattedDate =
      scheduledDate && isValid(scheduledDate)
        ? format(scheduledDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
        : "Não definida";

    const statusMap: Record<string, string> = {
      scheduled: "Agendada",
      completed: "Realizada",
      canceled: "Cancelada",
    };

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Dados do Procedimento", 14, 38);
    doc.setDrawColor(...accentColor);
    doc.line(14, 40, 196, 40);

    autoTable(doc, {
      startY: 44,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
      body: [
        ["Procedimento", displayName],
<<<<<<< HEAD
        ["Membro", member?.name ?? "—"],
=======
        ["Paciente", member?.name ?? "—"],
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
        ["Status", statusMap[surgery.status] ?? surgery.status],
        ["Data / Hora", formattedDate],
        ["Hospital / Clínica", surgery.hospital_clinic ?? "—"],
        ["Cirurgião(ã)", surgery.surgeon_name ?? "—"],
        ["Observações", surgery.notes ?? "—"],
      ],
    });

    const preInstr = surgery.surgery_instructions?.find((i) => i.phase === "pre");
    if (preInstr && preInstr.items.length > 0) {
      const y = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Instruções Pré-Operatórias", 14, y);
      doc.setDrawColor(...accentColor);
      doc.line(14, y + 2, 196, y + 2);
<<<<<<< HEAD

=======
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
      autoTable(doc, {
        startY: y + 6,
        theme: "striped",
        styles: { fontSize: 9, cellPadding: 3 },
        head: [["#", "Instrução", "Status"]],
        headStyles: { fillColor: primaryColor, textColor: 255 },
        body: preInstr.items.map((item, i) => [
          i + 1,
          item.text,
          item.completed ? "✓ Concluído" : "Pendente",
        ]),
      });
    }

    const postInstr = surgery.surgery_instructions?.find((i) => i.phase === "post");
    if (postInstr && postInstr.items.length > 0) {
      const y = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Instruções Pós-Operatórias", 14, y);
      doc.setDrawColor(...accentColor);
      doc.line(14, y + 2, 196, y + 2);
<<<<<<< HEAD

=======
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
      autoTable(doc, {
        startY: y + 6,
        theme: "striped",
        styles: { fontSize: 9, cellPadding: 3 },
        head: [["#", "Instrução", "Status"]],
        headStyles: { fillColor: primaryColor, textColor: 255 },
        body: postInstr.items.map((item, i) => [
          i + 1,
          item.text,
          item.completed ? "✓ Concluído" : "Pendente",
        ]),
      });
    }

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Locus Vita — Saúde Familiar Simplificada · locustech.com.br", 14, 285);

<<<<<<< HEAD
    const fileName = `cirurgia-${displayName
      .toLowerCase()
      .replace(/\s+/g, "-")}-${format(new Date(), "ddMMyyyy")}.pdf`;
    doc.save(fileName);
=======
    const safeName = displayName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    doc.save(`cirurgia-${safeName}-${format(new Date(), "ddMMyyyy")}.pdf`);
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
<<<<<<< HEAD
=======
      {/* Header */}
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
      <div className="flex-none bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={goBack} className="p-1 -ml-1" aria-label="Voltar">
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <Scissors className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">
            Cirurgias{member ? ` — ${member.name}` : ""}
          </h1>
        </div>
      </div>

<<<<<<< HEAD
      <div className="flex-none bg-background border-b border-border/40">
        <div className="flex">
          {(["scheduled", "completed"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-base font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              {tab === "scheduled"
                ? `Agendadas (${scheduled.length})`
                : `Concluídas (${completed.length})`}
            </button>
          ))}
        </div>
      </div>

=======
      {/* Tabs */}
      <div className="flex-none bg-background border-b border-border/40">
        <div className="flex">
          <button
            onClick={() => setActiveTab("scheduled")}
            className={`flex-1 py-3 text-base font-medium border-b-2 transition-colors ${
              activeTab === "scheduled"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            Agendadas ({scheduled.length})
          </button>
          <button
            onClick={() => setActiveTab("done")}
            className={`flex-1 py-3 text-base font-medium border-b-2 transition-colors ${
              activeTab === "done"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            Concluídas ({done.length})
          </button>
        </div>
      </div>

      {/* Lista */}
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-3">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        )}

        {!isLoading && displayed.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Scissors size={48} className="text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              {activeTab === "scheduled"
                ? "Nenhuma cirurgia agendada. Toque em '+' para registrar."
                : "Nenhuma cirurgia concluída ou cancelada."}
            </p>
          </div>
        )}

        {!isLoading &&
          displayed.map((surgery) => (
            <SurgeryCard
              key={surgery.id}
              surgery={surgery}
              onExportPdf={() => handleExportPdf(surgery)}
            />
          ))}

        <div className="h-20" />
      </div>

<<<<<<< HEAD
=======
      {/* FAB */}
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
      <button
        onClick={() => setDrawerOpen(true)}
        className="absolute bottom-6 right-4 w-14 h-14 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-10"
        aria-label="Adicionar cirurgia"
      >
        <Plus size={28} />
      </button>

<<<<<<< HEAD
=======
      {/* Drawer */}
>>>>>>> 6553987 (feat: módulo Cirurgias (SPEC v1.2))
      {id && (
        <AddSurgeryDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          familyMemberId={id}
        />
      )}
    </div>
  );
};

export default Surgeries;
