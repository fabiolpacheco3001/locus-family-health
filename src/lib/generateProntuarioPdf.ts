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
}

const PRIMARY_COLOR: [number, number, number] = [28, 51, 51]; // #1C3333
const ACCENT_COLOR: [number, number, number] = [242, 169, 127]; // #F2A97F
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
    const d = parseISO(iso);
    return format(d, "dd MMM yyyy", { locale: ptBR });
  } catch {
    return iso;
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
  const headerH = 22;
  const footerH = 12;
  let y = 0;

  const emissionDate = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  // ---- Header / Footer helpers ----
  const drawHeader = () => {
    doc.setFillColor(...PRIMARY_COLOR);
    doc.rect(0, 0, pageW, headerH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text("♥  Locus Vita — Resumo de Saúde", margin, 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Emitido em ${emissionDate} por ${data.emitterName}`, margin, 17);
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setFillColor(245, 243, 239);
    doc.rect(0, pageH - footerH, pageW, footerH, "F");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_COLOR);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageW / 2, pageH - 4, { align: "center" });
    doc.text("Documento confidencial — uso exclusivo do paciente", margin, pageH - 4);
  };

  // ---- Section title helper ----
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

  // ---- Page 1 ----
  drawHeader();
  y = headerH + 10;

  // Bloco 1 — Identificação
  sectionTitle("Identificação do Paciente");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...PRIMARY_COLOR);

  const age = calculateAge(data.member.birth_date);
  const idLines = [
    `Nome: ${data.member.name}`,
    age !== null ? `Idade: ${age} anos` : null,
    data.member.blood_type ? `Tipo Sanguíneo: ${data.member.blood_type}` : null,
    data.member.weight ? `Peso: ${data.member.weight} kg` : null,
    data.member.height ? `Altura: ${(data.member.height * 100).toFixed(0)} cm` : null,
  ].filter(Boolean) as string[];

  idLines.forEach((line) => {
    ensureSpace(6);
    doc.text(line, margin + 2, y);
    y += 5.5;
  });
  y += 4;

  // Bloco 2 — Alergias
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
      bodyStyles: { fontSize: 9, textColor: PRIMARY_COLOR },
      columnStyles: { 0: { cellWidth: contentW * 0.65 }, 1: { cellWidth: contentW * 0.35 } },
      didDrawPage: () => {
        drawHeader();
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Bloco 3 — Doenças crônicas
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
      bodyStyles: { fontSize: 9, textColor: PRIMARY_COLOR },
      didDrawPage: () => {
        drawHeader();
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Bloco 4 — Timeline Clínica
  sectionTitle("Histórico Clínico");
  if (data.timeline.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED_COLOR);
    doc.text("Nenhum registro clínico encontrado.", margin + 2, y);
    y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Data", "Tipo", "Título", "Detalhes"]],
      body: data.timeline.map((ev) => [
        fmtDate(ev.date),
        eventTypeLabel[ev.type] || ev.type,
        ev.title,
        [ev.subtitle, ev.details].filter(Boolean).join(" — ") || "—",
      ]),
      theme: "grid",
      headStyles: { fillColor: PRIMARY_COLOR, fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: PRIMARY_COLOR },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 22 },
        2: { cellWidth: contentW * 0.35 },
        3: { cellWidth: contentW - 24 - 22 - contentW * 0.35 },
      },
      didDrawPage: () => {
        drawHeader();
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ---- Draw footers on all pages ----
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  return doc.output("blob");
};
