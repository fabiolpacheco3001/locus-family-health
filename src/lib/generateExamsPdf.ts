/**
 * generateExamsPdf.ts
 *
 * Exporta exames de um único membro ou de toda a família.
 * Seções por membro com tabela: nome, data, local, data resultado, status.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type Exam = {
  name: string;
  exam_date: string | null;
  location: string | null;
  result_date: string | null;
  status: string;
};

export interface ExamsMemberData {
  memberName: string;
  exams: Exam[];
}

export interface ExamsPdfInput {
  members: ExamsMemberData[];   // 1 = individual; N = família
  emitterName: string;
  logoBase64?: string;
}

// ── Palette ──────────────────────────────────────────────────────────────────
const PRIMARY: [number, number, number] = [28, 51, 51];
const ACCENT: [number, number, number] = [120, 194, 173];
const MUTED: [number, number, number] = [120, 120, 120];

const STATUS_COLORS: Record<string, [number, number, number]> = {
  Solicitado: [120, 194, 173],
  Agendado:   [245, 192, 78],
  Realizado:  [242, 169, 127],
  Cancelado:  [248, 113, 113],
};

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  try { return format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return iso; }
};

export const generateExamsPdf = (data: ExamsPdfInput): Blob => {
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
    doc.text(isFamily ? "Relatório de Exames — Família" : "Relatório de Exames", tx, 15.5);
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
    doc.text(`${count} exame${count !== 1 ? "s" : ""}`, margin + contentW - 3, y + 5.5, { align: "right" });
    y += 11;
  };

  // ── Build ────────────────────────────────────────────────────────────────────
  drawHeader();
  y = headerH + 8;

  for (const member of data.members) {
    memberHeader(member.memberName, member.exams.length);

    if (member.exams.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text("Nenhum exame registrado.", margin + 3, y + 4);
      y += 10;
      continue;
    }

    const body = member.exams.map((e) => [
      e.name,
      fmtDate(e.exam_date),
      e.location || "—",
      fmtDate(e.result_date),
      e.status,
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, top: headerH + 6 },
      head: [["Exame", "Data", "Local", "Resultado em", "Status"]],
      body,
      theme: "grid",
      headStyles: { fillColor: PRIMARY, fontSize: 7.5, textColor: [255, 255, 255] },
      styles: { valign: "middle" as const, fontSize: 7.5 },
      bodyStyles: { textColor: PRIMARY },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 22 },
        2: { cellWidth: 40 },
        3: { cellWidth: 22 },
        4: { cellWidth: 24 },
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
