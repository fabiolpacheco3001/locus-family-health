import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toSPTime } from "@/lib/dateUtils";

interface AdherenceDose {
  medication_name: string;
  scheduled_for: string;
  status: string;
}

interface AdherencePdfData {
  memberName: string;
  doses: AdherenceDose[];
  adherenceRate: number;
  takenCount: number;
  totalCount: number;
  logoBase64?: string;
  emitterName: string;
}

const PRIMARY: [number, number, number] = [28, 51, 51];
const ACCENT: [number, number, number] = [242, 169, 127];
const MUTED: [number, number, number] = [120, 120, 120];

export const generateAdherencePdf = (data: AdherencePdfData): Blob => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  const headerH = 23;
  const footerH = 12;
  let y = 0;

  const emissionDate = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const drawHeader = () => {
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 0, pageW, headerH, "F");

    if (data.logoBase64) {
      try {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin, 4, 14, 14, 2, 2, "F");
        doc.addImage(data.logoBase64, "PNG", margin, 4, 14, 14);
      } catch { /* no logo */ }
    }

    const textX = data.logoBase64 ? margin + 17 : margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text("Locus Vita - Saúde Familiar Simplificada", textX, 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Relatório de Adesão Medicamentosa", textX, 14);
    doc.setFontSize(7);
    doc.setTextColor(200, 210, 210);
    doc.text(`Emitido em ${emissionDate} por ${data.emitterName}`, textX, 19);
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setFillColor(245, 243, 239);
    doc.rect(0, pageH - footerH, pageW, footerH, "F");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageW / 2, pageH - 4, { align: "center" });
    doc.text("Documento confidencial — uso exclusivo do paciente", margin, pageH - 4);
  };

  const sectionTitle = (title: string) => {
    if (y + 14 > pageH - footerH - 10) {
      doc.addPage();
      drawHeader();
      y = headerH + 10;
    }
    doc.setFillColor(...ACCENT);
    doc.roundedRect(margin, y, contentW, 8, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 3, y + 5.5);
    y += 12;
  };

  // ── Page 1 ──
  drawHeader();
  y = headerH + 10;

  // Patient & Summary
  sectionTitle("Resumo de Adesão");

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top: headerH + 6 },
    body: [
      ["Paciente", "Taxa de Adesão", "Total de Doses"],
      [data.memberName, `${data.adherenceRate}%`, `${data.takenCount} / ${data.totalCount}`],
    ],
    theme: "grid",
    styles: { valign: "middle" as const },
    bodyStyles: { fontSize: 10, textColor: PRIMARY },
    didParseCell: (hookData: any) => {
      if (hookData.section === "body" && hookData.row.index === 0) {
        hookData.cell.styles.fillColor = PRIMARY;
        hookData.cell.styles.textColor = [255, 255, 255];
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.fontSize = 9;
      }
    },
    didDrawPage: () => { drawHeader(); },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Per-medication breakdown
  const medGroups: Record<string, { taken: number; skipped: number; total: number }> = {};
  for (const d of data.doses) {
    if (!medGroups[d.medication_name]) medGroups[d.medication_name] = { taken: 0, skipped: 0, total: 0 };
    medGroups[d.medication_name].total++;
    if (d.status === "taken") medGroups[d.medication_name].taken++;
    if (d.status === "skipped") medGroups[d.medication_name].skipped++;
  }

  sectionTitle("Adesão por Medicamento");
  const medBody = Object.entries(medGroups).map(([name, s]) => {
    const forgotten = s.total - s.taken - (s.skipped ?? 0);
    return [
      name,
      `${s.taken}`,
      `${s.skipped ?? 0}`,
      `${forgotten > 0 ? forgotten : 0}`,
      `${s.total > 0 ? Math.round((s.taken / s.total) * 100) : 0}%`,
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top: headerH + 6 },
    head: [["Medicamento", "Tomadas", "Puladas", "Taxa"]],
    body: medBody,
    theme: "grid",
    headStyles: { fillColor: PRIMARY, fontSize: 9 },
    styles: { valign: "middle" as const },
    bodyStyles: { fontSize: 9, textColor: PRIMARY },
    didDrawPage: () => { drawHeader(); },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Detailed timeline
  sectionTitle("Histórico Detalhado");
  const timelineBody = data.doses.map((d) => {
    const dateStr = format(toSPTime(new Date(d.scheduled_for)), "dd/MM/yyyy HH:mm", { locale: ptBR });
    return [dateStr, d.medication_name, d.status === "taken" ? "Tomado" : "Pulado"];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top: headerH + 6 },
    head: [["Data/Hora", "Medicamento", "Status"]],
    body: timelineBody,
    theme: "grid",
    headStyles: { fillColor: PRIMARY, fontSize: 9 },
    styles: { valign: "middle" as const },
    bodyStyles: { fontSize: 8, textColor: PRIMARY },
    columnStyles: {
      0: { cellWidth: 35 },
      2: { cellWidth: 22 },
    },
    didParseCell: (hookData: any) => {
      if (hookData.section === "body" && hookData.column.index === 2) {
        const val = hookData.cell.raw;
        if (val === "Pulado") {
          hookData.cell.styles.textColor = [220, 50, 50];
        } else {
          hookData.cell.styles.textColor = [16, 130, 90];
        }
      }
    },
    didDrawPage: () => { drawHeader(); },
  });

  // Footers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  return doc.output("blob");
};
