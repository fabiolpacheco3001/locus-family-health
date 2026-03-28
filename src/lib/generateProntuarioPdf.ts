import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ClinicalEvent } from "@/hooks/useClinicalTimeline";

interface ProntuarioData {
  member: {
    name: string;
    birth_date: string | null;
    blood_type: string | null;
    weight: number | null;
    height: number | null;
  };
  allergies: { substance: string; severity: string }[];
  diseases: { name: string; category: string }[];
  timeline: ClinicalEvent[];
  emitterName: string;
  logoBase64?: string;
}

const PRIMARY_COLOR: [number, number, number] = [28, 51, 51];
const ACCENT_COLOR: [number, number, number] = [242, 169, 127];
const MUTED_COLOR: [number, number, number] = [120, 120, 120];

const calculateAge = (birthDate: string | null): number | null => {
  if (!birthDate) return null;
  const birth = new Date(birthDate + "T12:00:00");
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const fmtDate = (iso: string) => {
  try {
    return format(parseISO(iso), "dd MMM yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
};

const fmtMonthYear = (iso: string) => {
  try {
    const d = parseISO(iso);
    const m = format(d, "MMM", { locale: ptBR }).replace(".", "");
    return m.charAt(0).toUpperCase() + m.slice(1) + "/" + format(d, "yy");
  } catch {
    return "";
  }
};

const eventTypeLabel: Record<string, string> = {
  consulta: "Consulta",
  medicamento: "Medicamento",
  exame: "Exame",
};

export const generateProntuarioPdf = (data: ProntuarioData): Blob => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  const headerH = 28;
  const footerH = 12;
  let y = 0;

  const emissionDate = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const drawHeader = () => {
    doc.setFillColor(...PRIMARY_COLOR);
    doc.rect(0, 0, pageW, headerH, "F");

    // Try to draw logo if available
    if (data.logoBase64) {
      try {
        doc.addImage(data.logoBase64, "JPEG", margin, 3, 16, 16);
      } catch {
        // fallback: no logo
      }
    }

    const textX = data.logoBase64 ? margin + 19 : margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text("Locus Vita — Resumo de Saúde", textX, 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Emitido em ${emissionDate} por ${data.emitterName}`, textX, 17);
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setFillColor(245, 243, 239);
    doc.rect(0, pageH - footerH, pageW, footerH, "F");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_COLOR);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageW / 2, pageH - 4, { align: "center" });
    doc.text("Documento confidencial — uso exclusivo do paciente", margin, pageH - 4);
  };

  const sectionTitle = (title: string) => {
    if (y + 14 > pageH - footerH - 10) {
      doc.addPage();
      drawHeader();
      y = headerH + 10;
    }
    doc.setFillColor(...ACCENT_COLOR);
    doc.roundedRect(margin, y, contentW, 8, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 3, y + 5.5);
    y += 12;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - footerH - 5) {
      doc.addPage();
      drawHeader();
      y = headerH + 10;
    }
  };

  // ── Page 1 ──
  drawHeader();
  y = headerH + 10;

  // ── Bloco 1: Identificação em 3 colunas ──
  sectionTitle("Identificação do Paciente");

  const age = calculateAge(data.member.birth_date);
  const w = data.member.weight;
  const h = data.member.height;
  const bmi = w && h && h > 0 ? (w / (h * h)).toFixed(1) : null;




  const bmiLabel = bmi ? `${bmi}` : "—";

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: [
      ["Nome", "Idade", "Tipo Sanguíneo"],
      [data.member.name, age !== null ? `${age} anos` : "—", data.member.blood_type || "—"],
      ["Peso", "Altura", "IMC"],
      [w ? `${w} kg` : "—", h ? `${(h * 100).toFixed(0)} cm` : "—", bmiLabel],
    ],
    theme: "grid",
    styles: { valign: "middle" as const },
    bodyStyles: { fontSize: 9, textColor: PRIMARY_COLOR },
    didParseCell: (hookData: any) => {
      if (hookData.section === "body" && (hookData.row.index === 0 || hookData.row.index === 2)) {
        hookData.cell.styles.fillColor = PRIMARY_COLOR;
        hookData.cell.styles.textColor = [255, 255, 255];
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.fontSize = 9;
      }
    },
    didDrawPage: () => { drawHeader(); },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Bloco 2: Alergias ──
  sectionTitle("Alergias e Restrições");
  if (data.allergies.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED_COLOR);
    doc.text("Nenhuma alergia registrada.", margin + 2, y);
    y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Substância", "Gravidade"]],
      body: data.allergies.map((a) => [a.substance, a.severity]),
      theme: "grid",
      headStyles: { fillColor: PRIMARY_COLOR, fontSize: 9 },
      styles: { valign: "middle" as const },
      bodyStyles: { fontSize: 9, textColor: PRIMARY_COLOR },
      columnStyles: { 0: { cellWidth: contentW * 0.65 }, 1: { cellWidth: contentW * 0.35 } },
      didDrawPage: () => { drawHeader(); },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── Bloco 3: Doenças Crônicas ──
  sectionTitle("Doenças Crônicas");
  if (data.diseases.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED_COLOR);
    doc.text("Nenhuma doença crônica registrada.", margin + 2, y);
    y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Doença", "Categoria"]],
      body: data.diseases.map((d) => [d.name, d.category]),
      theme: "grid",
      headStyles: { fillColor: PRIMARY_COLOR, fontSize: 9 },
      styles: { valign: "middle" as const },
      bodyStyles: { fontSize: 9, textColor: PRIMARY_COLOR },
      didDrawPage: () => { drawHeader(); },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── Bloco 4: Histórico Clínico agrupado por Mês/Ano ──
  sectionTitle("Histórico Clínico");
  if (data.timeline.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED_COLOR);
    doc.text("Nenhum registro clínico encontrado.", margin + 2, y);
    y += 8;
  } else {
    // Group by month/year
    const grouped = new Map<string, ClinicalEvent[]>();
    for (const ev of data.timeline) {
      const key = fmtMonthYear(ev.date);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(ev);
    }

    // Build table body with section rows
    const tableBody: (string[])[] = [];
    for (const [monthYear, events] of grouped) {
      tableBody.push([monthYear, "", "", "", ""]);
      for (const ev of events) {
        tableBody.push([
          fmtDate(ev.date),
          eventTypeLabel[ev.type] || ev.type,
          ev.title,
          [ev.subtitle, ev.details].filter(Boolean).join(" — ") || "—",
          ev.reason || "—",
        ]);
      }
    }

    // Track section header indices
    let rowIdx = 0;
    const sectionRows = new Set<number>();
    for (const [, events] of grouped) {
      sectionRows.add(rowIdx);
      rowIdx += 1 + events.length;
    }

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Data", "Tipo", "Título", "Detalhes", "Motivo"]],
      body: tableBody,
      theme: "grid",
      headStyles: { fillColor: PRIMARY_COLOR, fontSize: 8 },
      styles: { valign: "middle" as const },
      bodyStyles: { fontSize: 8, textColor: PRIMARY_COLOR },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 20 },
        2: { cellWidth: contentW * 0.22 },
        3: { cellWidth: contentW * 0.35 },
        4: { cellWidth: contentW - 22 - 20 - contentW * 0.22 - contentW * 0.35 },
      },
      didParseCell: (hookData: any) => {
        if (hookData.section === "body" && sectionRows.has(hookData.row.index)) {
          hookData.cell.styles.fillColor = [232, 220, 205];
          hookData.cell.styles.fontStyle = "bold";
          hookData.cell.styles.textColor = PRIMARY_COLOR;
          if (hookData.column.index > 0) {
            hookData.cell.text = [];
          }
        }
      },
      didDrawPage: () => { drawHeader(); },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── Draw footers on all pages ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  return doc.output("blob");
};
