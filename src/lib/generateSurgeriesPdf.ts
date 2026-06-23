/**
 * generateSurgeriesPdf.ts
 *
 * Exporta cirurgias de um membro com cabeçalho, rodapé e instruções
 * Pré e Pós-operatórias estruturadas.
 *
 * Segue o padrão de generateConsultationsPdf.ts
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getSurgeryLabel } from "./surgeryTypes";

interface InstructionItem {
  text: string;
  completed?: boolean;
}

interface SurgeryInstruction {
  phase: "pre" | "post";
  items: InstructionItem[];
}

export interface SurgeryPdfData {
  surgery_type: string;
  custom_type?: string | null;
  scheduled_date?: string | null;
  surgeon_name?: string | null;
  hospital_clinic?: string | null;
  status: string;
  notes?: string | null;
  surgery_instructions?: SurgeryInstruction[];
}

export interface SurgeriesPdfInput {
  memberName: string;
  surgeries: SurgeryPdfData[];
  emitterName: string;
  logoBase64?: string;
}

// ── Palette ────────────────────────────────────────────────────────────────────
const PRIMARY: [number, number, number] = [28, 51, 51];
const ACCENT: [number, number, number] = [120, 194, 173];
const MUTED: [number, number, number] = [120, 120, 120];
const WHITE: [number, number, number] = [255, 255, 255];

const STATUS_MAP: Record<string, string> = {
  scheduled: "Agendada",
  completed: "Realizada",
  canceled: "Cancelada",
};

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  try {
    const d = parseISO(iso);
    return isValid(d) ? format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—";
  } catch { return "—"; }
};

export const generateSurgeriesPdf = (input: SurgeriesPdfInput): Blob => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const headerH = 24;
  const footerH = 12;

  const emissionDate = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const drawHeader = () => {
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 0, pageW, headerH, "F");
    if (input.logoBase64) {
      try {
        doc.setFillColor(...WHITE);
        doc.roundedRect(margin, 5, 14, 14, 2, 2, "F");
        doc.addImage(input.logoBase64, "PNG", margin, 5, 14, 14);
      } catch { /* logo opcional */ }
    }
    const tx = input.logoBase64 ? margin + 17 : margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...WHITE);
    doc.text("Locus Vita — Saúde Familiar Simplificada", tx, 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Relatório de Cirurgias", tx, 15.5);
    doc.setFontSize(7);
    doc.setTextColor(200, 215, 210);
    doc.text(`Emitido em ${emissionDate} por ${input.emitterName}`, tx, 21);
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setFillColor(245, 243, 239);
    doc.rect(0, pageH - footerH, pageW, footerH, "F");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageW / 2, pageH - 4, { align: "center" });
    doc.text("Documento confidencial — uso exclusivo do paciente", margin, pageH - 4);
  };

  // ── Primeira página ──────────────────────────────────────────────────────────
  drawHeader();
  let y = headerH + 8;

  // Cabeçalho do membro
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PRIMARY);
  doc.text(`Paciente: ${input.memberName}`, margin, y);
  y += 8;

  if (input.surgeries.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Nenhuma cirurgia registrada.", margin, y);
  }

  for (let idx = 0; idx < input.surgeries.length; idx++) {
    const surgery = input.surgeries[idx];
    if (idx > 0) y += 4;

    if (y + 20 > pageH - footerH - 10) {
      doc.addPage(); drawHeader(); y = headerH + 8;
    }

    const displayName =
      surgery.surgery_type === "outro" && surgery.custom_type
        ? surgery.custom_type
        : getSurgeryLabel(surgery.surgery_type);

    // Barra de título da cirurgia
    doc.setFillColor(...ACCENT);
    doc.roundedRect(margin, y, contentW, 8, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...PRIMARY);
    doc.text(`${idx + 1}. ${displayName}`, margin + 3, y + 5.5);
    const statusLabel = STATUS_MAP[surgery.status] ?? surgery.status;
    doc.text(statusLabel, pageW - margin - 3, y + 5.5, { align: "right" });
    y += 12;

    // Tabela de campos principais
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 40, textColor: [60, 60, 60] as [number, number, number] } },
      body: [
        ["Profissional", surgery.surgeon_name ?? "—"],
        ["Data / Hora", fmtDate(surgery.scheduled_date)],
        ["Hospital / Clínica", surgery.hospital_clinic ?? "—"],
        ...(surgery.notes ? [["Observações", surgery.notes]] : []),
      ],
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    // ── Instruções Pré-Op ──────────────────────────────────────────────────────
    const preInstr = surgery.surgery_instructions?.find((i) => i.phase === "pre");
    if (preInstr && preInstr.items.length > 0) {
      if (y + 14 > pageH - footerH - 10) {
        doc.addPage(); drawHeader(); y = headerH + 8;
      }
      doc.setFillColor(240, 248, 245);
      doc.roundedRect(margin, y, contentW, 6, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...PRIMARY);
      doc.text("Instruções Pré-Operatórias", margin + 3, y + 4);
      y += 9;

      preInstr.items.forEach((item, i) => {
        if (y + 8 > pageH - footerH - 6) {
          doc.addPage(); drawHeader(); y = headerH + 8;
        }
        const lines = doc.splitTextToSize(`${i + 1}. ${item.text}`, contentW - 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(40, 40, 40);
        doc.text(lines, margin + 3, y);
        y += lines.length * 4.5;
      });
      y += 3;
    }

    // ── Instruções Pós-Op ──────────────────────────────────────────────────────
    const postInstr = surgery.surgery_instructions?.find((i) => i.phase === "post");
    if (postInstr && postInstr.items.length > 0) {
      if (y + 14 > pageH - footerH - 10) {
        doc.addPage(); drawHeader(); y = headerH + 8;
      }
      doc.setFillColor(240, 248, 245);
      doc.roundedRect(margin, y, contentW, 6, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...PRIMARY);
      doc.text("Instruções Pós-Operatórias", margin + 3, y + 4);
      y += 9;

      postInstr.items.forEach((item, i) => {
        if (y + 8 > pageH - footerH - 6) {
          doc.addPage(); drawHeader(); y = headerH + 8;
        }
        const lines = doc.splitTextToSize(`${i + 1}. ${item.text}`, contentW - 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(40, 40, 40);
        doc.text(lines, margin + 3, y);
        y += lines.length * 4.5;
      });
      y += 3;
    }
  }

  // Rodapés em todas as páginas
  const totalPages = (doc.internal as any).pages.length - 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(p, totalPages);
  }

  return doc.output("blob");
};
