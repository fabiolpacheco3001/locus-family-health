/**
 * generateAdherencePdf.ts
 *
 * Gera o PDF de Adesão Medicamentosa refletindo fielmente o visual do
 * AdherenceHistoryDrawer: donut de taxa, streak, insight, gráfico semanal,
 * calendário heatmap 14 dias, breakdown por medicamento e histórico detalhado.
 *
 * Recebe dados já calculados pelo useAdherenceDashboard + período selecionado.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toSPTime } from "@/lib/dateUtils";
import type {
  DoseEntry,
  MedStat,
  HeatmapDay,
  WeeklyEntry,
  InsightData,
} from "@/hooks/useAdherenceDashboard";

// ── Brand palette ─────────────────────────────────────────────────────────────
const PRIMARY: [number, number, number] = [28, 51, 51];
const ACCENT: [number, number, number] = [120, 194, 173];   // #78C2AD Verde Menta
const ACCENT_DARK: [number, number, number] = [85, 155, 135];
const MUTED: [number, number, number] = [120, 120, 120];
const BG_CARD: [number, number, number] = [248, 248, 246];
const YELLOW: [number, number, number] = [245, 192, 78];    // #f5c04e parcial
const RED: [number, number, number] = [240, 149, 149];      // #f09595 esquecido
const GRAY_CELL: [number, number, number] = [232, 229, 224]; // sem doses

const PERIOD_LABELS: Record<string, string> = {
  "7d": "últimos 7 dias",
  "30d": "últimos 30 dias",
  "90d": "últimos 90 dias",
  "all": "todo o período",
};

export interface AdherencePdfInput {
  memberName: string;
  emitterName: string;
  period: string;
  // Summary
  taxa: number;
  tomadas: number;
  total: number;
  streak: number;
  // Rich data
  insight: InsightData;
  weeklyData: WeeklyEntry[];
  heatmapData: HeatmapDay[];
  medBreakdown: MedStat[];
  // Detailed doses (already filtered by period from the drawer)
  doses: DoseEntry[];
  logoBase64?: string;
}

export const generateAdherencePdf = (data: AdherencePdfInput): Blob => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const headerH = 24;
  const footerH = 12;
  let y = 0;

  const emissionDate = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const periodLabel = PERIOD_LABELS[data.period] ?? data.period;

  // ── Header ──────────────────────────────────────────────────────────────────
  const drawHeader = () => {
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 0, pageW, headerH, "F");

    if (data.logoBase64) {
      try {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin, 5, 14, 14, 2, 2, "F");
        doc.addImage(data.logoBase64, "PNG", margin, 5, 14, 14);
      } catch { /* no logo */ }
    }

    const textX = data.logoBase64 ? margin + 17 : margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("Locus Vita — Saúde Familiar Simplificada", textX, 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Relatório de Adesão Medicamentosa", textX, 15.5);
    doc.setFontSize(7);
    doc.setTextColor(200, 215, 210);
    doc.text(`Emitido em ${emissionDate} por ${data.emitterName}`, textX, 21);
  };

  // ── Footer ──────────────────────────────────────────────────────────────────
  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setFillColor(245, 243, 239);
    doc.rect(0, pageH - footerH, pageW, footerH, "F");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageW / 2, pageH - 4, { align: "center" });
    doc.text("Documento confidencial — uso exclusivo do paciente", margin, pageH - 4);
  };

  // ── Section title bar ────────────────────────────────────────────────────────
  const sectionTitle = (title: string) => {
    if (y + 14 > pageH - footerH - 10) newPage();
    doc.setFillColor(...ACCENT);
    doc.roundedRect(margin, y, contentW, 7.5, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 3, y + 5.2);
    y += 11;
  };

  const newPage = () => {
    doc.addPage();
    drawHeader();
    y = headerH + 8;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - footerH - 5) newPage();
  };

  // ── Draw donut arc ───────────────────────────────────────────────────────────
  const drawDonut = (cx: number, cy: number, r: number, taxa: number) => {
    const PI2 = 2 * Math.PI;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + PI2 * (taxa / 100);
    const steps = 60;

    // Background circle
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(3.5);
    doc.circle(cx, cy, r, "S");

    // Filled arc (green)
    if (taxa > 0) {
      doc.setDrawColor(...ACCENT);
      doc.setLineWidth(3.5);
      const pts: [number, number][] = [];
      for (let i = 0; i <= steps; i++) {
        const angle = startAngle + (endAngle - startAngle) * (i / steps);
        pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
      }
      for (let i = 1; i < pts.length; i++) {
        doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
      }
    }

    // Center text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...ACCENT_DARK);
    doc.text(`${taxa}%`, cx, cy + 1.5, { align: "center" });
  };

  // ── Draw mini bar chart ──────────────────────────────────────────────────────
  const drawBarChart = (x: number, y0: number, w: number, h: number, bars: WeeklyEntry[]) => {
    if (bars.length === 0) return;
    const barW = Math.max(2, (w - 4) / bars.length - 1);
    const gap = (w - 4 - barW * bars.length) / (bars.length - 1 || 1);

    // Y-axis reference lines
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    [0, 25, 50, 75, 100].forEach((pct) => {
      const barY = y0 + h - (h * pct) / 100;
      doc.line(x, barY, x + w, barY);
    });

    bars.forEach((b, i) => {
      const barH = Math.max(0.5, (h * b.taxa) / 100);
      const bx = x + i * (barW + gap);
      const by = y0 + h - barH;

      let fillR: number, fillG: number, fillB: number;
      if (b.taxa >= 70) { fillR = 120; fillG = 194; fillB = 173; }
      else if (b.taxa >= 40) { fillR = 245; fillG = 192; fillB = 78; }
      else if (b.taxa > 0) { fillR = 240; fillG = 149; fillB = 149; }
      else { fillR = 224; fillG = 221; fillB = 216; }

      doc.setFillColor(fillR, fillG, fillB);
      doc.roundedRect(bx, by, barW, barH, 0.5, 0.5, "F");

      // Label below
      doc.setFontSize(5.5);
      doc.setTextColor(...MUTED);
      doc.text(b.label, bx + barW / 2, y0 + h + 4, { align: "center" });
    });
  };

  // ── Draw heatmap calendar ────────────────────────────────────────────────────
  const drawHeatmap = (x: number, y0: number, w: number, days: HeatmapDay[]) => {
    const cellSize = (w - 6 * 1.5) / 7;
    days.forEach((day, i) => {
      const col = i % 7;
      const row = Math.floor(i / 7);
      const cx = x + col * (cellSize + 1.5);
      const cy = y0 + row * (cellSize + 1.5);

      const hex = day.color;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      doc.setFillColor(r, g, b);
      doc.roundedRect(cx, cy, cellSize, cellSize, 0.8, 0.8, "F");

      doc.setFontSize(6);
      doc.setTextColor(0, 0, 0, 0.4);
      doc.setTextColor(80, 80, 80);
      doc.text(day.label, cx + cellSize / 2, cy + cellSize / 2 + 1.5, { align: "center" });
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // Page 1
  // ════════════════════════════════════════════════════════════════════════════
  drawHeader();
  y = headerH + 8;

  // ── Sub-header: paciente + período ──────────────────────────────────────────
  doc.setFillColor(...BG_CARD);
  doc.roundedRect(margin, y, contentW, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY);
  doc.text(data.memberName, margin + 5, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(`Período: ${periodLabel}`, margin + 5, y + 11.5);
  y += 19;

  // ── Taxa de Adesão (donut + números + streak) ────────────────────────────────
  sectionTitle("Taxa de Adesão");

  const cardH = 34;
  doc.setFillColor(...BG_CARD);
  doc.roundedRect(margin, y, contentW, cardH, 2, 2, "F");

  // Left side: % + tomadas/total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...PRIMARY);
  doc.text(`${data.taxa}%`, margin + 7, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`${data.tomadas} de ${data.total} doses tomadas`, margin + 7, y + 25);

  // Streak
  if (data.streak > 0) {
    doc.setDrawColor(240, 240, 240);
    doc.setLineWidth(0.3);
    doc.line(margin + 5, y + 27.5, margin + contentW * 0.55, y + 27.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(230, 120, 50);
    doc.text(`🔥 ${data.streak} dia${data.streak === 1 ? "" : "s"} seguidos`, margin + 7, y + 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text("sequência atual", margin + 7 + (data.streak.toString().length * 2.5) + 26, y + 32);
  }

  // Right side: donut
  const donutCx = margin + contentW - 22;
  const donutCy = y + cardH / 2;
  drawDonut(donutCx, donutCy, 12, data.taxa);

  y += cardH + 5;

  // ── Insight ──────────────────────────────────────────────────────────────────
  ensureSpace(16);
  const insightColors: Record<string, [number, number, number]> = {
    success: [236, 253, 245],
    warning: [255, 251, 235],
    info: [239, 246, 255],
    danger: [254, 242, 242],
  };
  const insightTextColors: Record<string, [number, number, number]> = {
    success: [6, 78, 59],
    warning: [92, 58, 0],
    info: [30, 58, 138],
    danger: [127, 29, 29],
  };
  const iBg = insightColors[data.insight.type] ?? insightColors.info;
  const iText = insightTextColors[data.insight.type] ?? insightTextColors.info;
  doc.setFillColor(...iBg);
  doc.roundedRect(margin, y, contentW, 13, 2, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...iText);
  const insightLines = doc.splitTextToSize(data.insight.text, contentW - 10);
  doc.text(insightLines, margin + 5, y + 5);
  y += 18;

  // ── Evolução Semanal ─────────────────────────────────────────────────────────
  sectionTitle("Evolução Semanal");
  ensureSpace(52);
  doc.setFillColor(...BG_CARD);
  doc.roundedRect(margin, y, contentW, 48, 2, 2, "F");
  drawBarChart(margin + 4, y + 4, contentW - 8, 36, data.weeklyData);
  y += 52;

  // ── Calendário Heatmap — últimos 14 dias ─────────────────────────────────────
  sectionTitle("Últimos 14 Dias");
  ensureSpace(40);
  doc.setFillColor(...BG_CARD);
  doc.roundedRect(margin, y, contentW, 36, 2, 2, "F");

  // month label
  if (data.heatmapData.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    const monthLabel = format(data.heatmapData[0].date, "MMM yyyy", { locale: ptBR });
    doc.text(monthLabel, margin + contentW - 5, y + 5, { align: "right" });
  }

  drawHeatmap(margin + 4, y + 7, contentW - 8, data.heatmapData);

  // legend
  const legendY = y + 30;
  const legendItems = [
    { color: "#78C2AD", label: "Completo" },
    { color: "#f5c04e", label: "Parcial" },
    { color: "#f09595", label: "Esquecido" },
    { color: "#e8e5e0", label: "Sem doses" },
  ];
  let lx = margin + 5;
  legendItems.forEach(({ color, label }) => {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    doc.setFillColor(r, g, b);
    doc.roundedRect(lx, legendY, 4, 4, 0.5, 0.5, "F");
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text(label, lx + 5.5, legendY + 3.2);
    lx += label.length * 2 + 12;
  });

  y += 40;

  // ── Por Medicamento ──────────────────────────────────────────────────────────
  if (data.medBreakdown.length > 0) {
    sectionTitle("Por Medicamento");
    const rowH = 10;
    const medCardH = data.medBreakdown.length * rowH + 6;
    ensureSpace(medCardH + 4);
    doc.setFillColor(...BG_CARD);
    doc.roundedRect(margin, y, contentW, medCardH, 2, 2, "F");

    let my = y + 5;
    data.medBreakdown.forEach((med) => {
      // Name + count
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...PRIMARY);
      doc.text(med.name, margin + 4, my + 3);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(`${med.taken}/${med.total}`, margin + contentW - 6, my + 3, { align: "right" });

      // Progress bar
      const barY = my + 5;
      const barW = contentW - 20;
      doc.setFillColor(220, 218, 214);
      doc.roundedRect(margin + 4, barY, barW, 2, 0.8, 0.8, "F");
      if (med.taxa > 0) {
        let fillR: number, fillG: number, fillB: number;
        if (med.taxa >= 70) { fillR = 120; fillG = 194; fillB = 173; }
        else if (med.taxa >= 40) { fillR = 245; fillG = 192; fillB = 78; }
        else { fillR = 240; fillG = 149; fillB = 149; }
        doc.setFillColor(fillR, fillG, fillB);
        doc.roundedRect(margin + 4, barY, barW * (med.taxa / 100), 2, 0.8, 0.8, "F");
      }
      // Taxa %
      let tcR: number, tcG: number, tcB: number;
      if (med.taxa >= 70) { tcR = 6; tcG = 120; tcB = 90; }
      else if (med.taxa >= 40) { tcR = 160; tcG = 100; tcB = 0; }
      else if (med.taxa > 0) { tcR = 180; tcG = 40; tcB = 40; }
      else { tcR = 120; tcG = 120; tcB = 120; }
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(tcR, tcG, tcB);
      doc.text(`${med.taxa}%`, margin + contentW - 5, barY + 1.5, { align: "right" });

      my += rowH;
    });
    y += medCardH + 7;
  }

  // ── Histórico Detalhado ───────────────────────────────────────────────────────
  if (data.doses.length > 0) {
    sectionTitle("Histórico Detalhado");

    const timelineBody = data.doses.map((d) => {
      const dateStr = format(
        toSPTime(new Date(d.scheduled_for)),
        "dd/MM/yyyy HH:mm",
        { locale: ptBR }
      );
      const statusLabel =
        d.status === "taken" ? "Tomado" :
        d.status === "skipped" ? "Pulado" : "Esquecido";
      return [dateStr, d.medication_name, statusLabel];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, top: headerH + 6 },
      head: [["Data/Hora", "Medicamento", "Status"]],
      body: timelineBody,
      theme: "grid",
      headStyles: { fillColor: PRIMARY, fontSize: 8, textColor: [255, 255, 255] },
      styles: { valign: "middle" as const, fontSize: 8 },
      bodyStyles: { textColor: PRIMARY },
      columnStyles: {
        0: { cellWidth: 32 },
        2: { cellWidth: 24 },
      },
      didParseCell: (hookData) => {
        if (hookData.section === "body" && hookData.column.index === 2) {
          const val = String(hookData.cell.raw);
          if (val === "Tomado") hookData.cell.styles.textColor = [6, 120, 90];
          else if (val === "Pulado") hookData.cell.styles.textColor = [180, 40, 40];
          else hookData.cell.styles.textColor = [120, 120, 120];
          hookData.cell.styles.fontStyle = "bold";
        }
      },
      didDrawPage: () => { drawHeader(); },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }

  // ── Footers em todas as páginas ──────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  return doc.output("blob");
};
