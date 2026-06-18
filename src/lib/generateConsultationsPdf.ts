/**
 * generateConsultationsPdf.ts
 *
 * Exporta consultas de um único membro ou de toda a família.
 * Seções por membro com tabela: especialidade, profissional, data, tipo, status.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type Consultation = {
  specialty: string;
  professional_name: string | null;
  consultation_date: string | null;
  type: string | null;
  symptoms: string | null;
  status: string;
};

export interface ConsultationsMemberData {
  memberName: string;
  consultations: Consultation[];
}

export interface ConsultationsPdfInput {
  members: ConsultationsMemberData[];   // 1 item = individual; N = família
  emitterName: string;
  logoBase64?: string;
}

// ── Palette ──────────────────────────────────────────────────────────────────
const PRIMARY: [number, number, number] = [28, 51, 51];
const ACCENT: [number, number, number] = [120, 194, 173];
const MUTED: [number, number, number] = [120, 120, 120];

const STATUS_COLORS: Record<string, [number, number, number]> = {
  Agendada: [120, 194, 173],
  Realizada: [242, 169, 127],
  Cancelada: [248, 113, 113],
};

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  try { return format(parseISO(iso), "dd/MM/yyyy HH:mm", { locale: ptBR }); }
  catch { return iso; }
};

export const generateConsultationsPdf = (data: ConsultationsPdfInput): Blob => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const headerH = 24;
  const footerH = 12;
  let y = 0;

  const emissionDate = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const isFamily = data.members.length > 1;

  const drawHeader = () => {
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 0, pageW, headerH, "F");
    if (data.logoBase64) {
      try {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin, 5, 14, 14, 2, 2, "F");
        doc.addImage(data.logoBase64, "PNG", margin, 5, 14, 14);
      } catch { /* skip */ }
    }
    const tx = data.logoBase64 ? margin + 17 : margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("Locus Vita — Saúde Familiar Simplificada", tx, 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(isFamily ? "Relatório de Consultas — Família" : "Relatório de Consultas", tx, 15.5);
    doc.setFontSize(7);
    doc.setTextColor(200, 215, 210);
    doc.text(`Emitido em ${emissionDate} por ${data.emitterName}`, tx, 21);
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setFillColor(245, 243, 239);
    doc.rect(0, pageH - footerH, pageW, footerH, "F");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageW / 2, pageH - 4, { align: "center" });
    doc.text("Documento confidencial — uso exclusivo do paciente", margin, pageH - 4);
  };

  const memberHeader = (name: string, count: number) => {
    if (y + 12 > pageH - footerH - 10) {
      doc.addPage(); drawHeader(); y = headerH + 8;
    }
    doc.setFillColor(...ACCENT);
    doc.roundedRect(margin, y, contentW, 8, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(name, margin + 3, y + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${count} consulta${count !== 1 ? "s" : ""}`, margin + contentW - 3, y + 5.5, { align: "right" });
    y += 11;
  };

  // ── Build ────────────────────────────────────────────────────────────────────
  drawHeader();
  y = headerH + 8;

  for (const member of data.members) {
    memberHeader(member.memberName, member.consultations.length);

    if (member.consultations.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text("Nenhuma consulta registrada.", margin + 3, y + 4);
      y += 10;
      continue;
    }

    const body = member.consultations.map((c) => [
      c.specialty,
      c.professional_name || "—",
      fmtDate(c.consultation_date),
      c.type || "—",
      c.status,
      c.symptoms || "—",
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, top: headerH + 6 },
      head: [["Especialidade", "Profissional", "Data", "Tipo", "Status", "Sintomas / Obs"]],
      body,
      theme: "grid",
      headStyles: { fillColor: PRIMARY, fontSize: 7.5, textColor: [255, 255, 255] },
      styles: { valign: "middle" as const, fontSize: 7.5 },
      bodyStyles: { textColor: PRIMARY },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 28 },
        2: { cellWidth: 26 },
        3: { cellWidth: 18 },
        4: { cellWidth: 18 },
      },
      didParseCell: (hookData) => {
        if (hookData.section === "body" && hookData.column.index === 4) {
          const status = String(hookData.cell.raw);
          const color = STATUS_COLORS[status];
          if (color) hookData.cell.styles.textColor = color;
          hookData.cell.styles.fontStyle = "bold";
        }
      },
      didDrawPage: () => { drawHeader(); },
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  return doc.output("blob");
};
