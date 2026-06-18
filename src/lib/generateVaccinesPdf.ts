/**
 * generateVaccinesPdf.ts
 *
 * Cartão de Vacinas — individual ou família.
 * Seções por membro com tabela: vacina, data aplicação, dose, lote,
 * estabelecimento, reforço previsto.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type Vaccine = {
  name: string;
  applied_date: string | null;
  dose_type: string | null;
  batch: string | null;
  facility: string | null;
  booster_date: string | null;
  side_effects?: string | null;
};

export interface VaccinesMemberData {
  memberName: string;
  vaccines: Vaccine[];
}

export interface VaccinesPdfInput {
  members: VaccinesMemberData[];   // 1 = individual; N = família
  emitterName: string;
  logoBase64?: string;
}

// ── Palette ──────────────────────────────────────────────────────────────────
const PRIMARY: [number, number, number] = [28, 51, 51];
const ACCENT: [number, number, number] = [120, 194, 173];
const MUTED: [number, number, number] = [120, 120, 120];

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  try { return format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return iso; }
};

export const generateVaccinesPdf = (data: VaccinesPdfInput): Blob => {
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
    doc.text(isFamily ? "Cartão de Vacinas — Família" : "Cartão de Vacinas", tx, 15.5);
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
    doc.text("Documento meramente informativo — não substitui carteirinha oficial", margin, pageH - 4);
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
    doc.text(`${count} vacina${count !== 1 ? "s" : ""}`, margin + contentW - 3, y + 5.5, { align: "right" });
    y += 11;
  };

  // ── Build ────────────────────────────────────────────────────────────────────
  drawHeader();
  y = headerH + 8;

  for (const member of data.members) {
    memberHeader(member.memberName, member.vaccines.length);

    if (member.vaccines.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text("Nenhuma vacina registrada.", margin + 3, y + 4);
      y += 10;
      continue;
    }

    // Sort by applied_date desc
    const sorted = [...member.vaccines].sort((a, b) => {
      if (!a.applied_date) return 1;
      if (!b.applied_date) return -1;
      return b.applied_date.localeCompare(a.applied_date);
    });

    const body = sorted.map((v) => [
      v.name,
      fmtDate(v.applied_date),
      v.dose_type || "—",
      v.batch || "—",
      v.facility || "—",
      fmtDate(v.booster_date),
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, top: headerH + 6 },
      head: [["Vacina", "Aplicação", "Dose", "Lote", "Estabelecimento", "Reforço"]],
      body,
      theme: "grid",
      headStyles: { fillColor: PRIMARY, fontSize: 7.5, textColor: [255, 255, 255] },
      styles: { valign: "middle" as const, fontSize: 7.5 },
      bodyStyles: { textColor: PRIMARY },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 22 },
        2: { cellWidth: 16 },
        3: { cellWidth: 18 },
        4: { cellWidth: 40 },
        5: { cellWidth: 22 },
      },
      didParseCell: (hookData) => {
        // highlight future boosters in accent green
        if (hookData.section === "body" && hookData.column.index === 5) {
          const val = String(hookData.cell.raw);
          if (val !== "—") {
            hookData.cell.styles.textColor = ACCENT;
            hookData.cell.styles.fontStyle = "bold";
          }
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
