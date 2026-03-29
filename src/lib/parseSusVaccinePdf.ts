import * as pdfjsLib from "pdfjs-dist";
import type { ImportedVaccine } from "@/components/VaccineImportReviewDrawer";

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

interface ParsedSusResult {
  cpf: string | null;
  vaccines: ImportedVaccine[];
}

/**
 * Extracts text from all pages of a PDF file buffer.
 */
async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Group text items by Y coordinate to reconstruct lines
    // Group by Y (rounded to 2px tolerance)
    const rows = new Map<number, { x: number; text: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || !("transform" in item)) continue;
      const textItem = item as { str: string; transform: number[] };
      if (!textItem.str.trim()) continue;
      const y = Math.round(textItem.transform[5] / 2) * 2;
      const x = textItem.transform[4];
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x, text: textItem.str });
    }

    // Sort rows by Y descending (PDF coords: bottom-up), items by X ascending
    const sortedYs = [...rows.keys()].sort((a, b) => b - a);
    const lines: string[] = [];
    for (const y of sortedYs) {
      const row = rows.get(y)!;
      row.sort((a, b) => a.x - b.x);
      lines.push(row.map((r) => r.text).join(" "));
    }

    pages.push(lines.join("\n"));
  }

  return pages.join("\n\n");
}

/**
 * Extracts CPF from the raw PDF text.
 * Looks for patterns like 123.456.789-00 near "CPF" or "CNS" markers.
 */
function extractCpf(text: string): string | null {
  // 1. Busca estrita contextual: "CPF" seguido de até 30 chars, depois formato XXX.XXX.XXX-XX
  const contextualMatch = text.match(/CPF[\s\S]{0,30}?(\d{3}\.\d{3}\.\d{3}-\d{2})/i);
  if (contextualMatch) return contextualMatch[1];

  // 2. Fallback estrito: exige pontuação padrão do SUS (evita capturar CNS/CNES)
  const strictGeneric = text.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
  return strictGeneric ? strictGeneric[1] : null;
}

/**
 * Parses vaccine records from the extracted text.
 * Handles multiple vaccine blocks in the SUS PDF format.
 */
function extractVaccines(text: string): ImportedVaccine[] {
  const vaccines: ImportedVaccine[] = [];

  // Date pattern DD/MM/YYYY
  const datePattern = /(\d{2}\/\d{2}\/\d{4})/g;

  // Split text into lines
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dates = line.match(datePattern);
    if (!dates || dates.length === 0) continue;

    // Try to extract vaccine name from the same line or surrounding lines
    // The SUS PDF typically has: Vaccine Name | Dose | Date | Lot | Location
    // or variations thereof

    // Remove dates and common noise words to isolate vaccine name
    let vaccineName = extractVaccineNameFromLine(line, lines, i);
    if (!vaccineName) continue;

    // Extract dose label if present
    const doseLabel = extractDoseLabel(line);

    for (const dateStr of dates) {
      const isoDate = convertDateToISO(dateStr);
      if (!isoDate) continue;

      vaccines.push({
        name: vaccineName.toUpperCase().trim(),
        dose_label: doseLabel || undefined,
        applied_date: isoDate,
      });
    }
  }

  // Deduplicate by name+date
  const seen = new Set<string>();
  return vaccines.filter((v) => {
    const key = `${v.name}|${v.applied_date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractVaccineNameFromLine(line: string, allLines: string[], index: number): string | null {
  // Common SUS PDF noise / headers to skip
  const skipPatterns = [
    /^data\b/i,
    /^dose\b/i,
    /^lote\b/i,
    /^fabricante/i,
    /^unidade/i,
    /^vacinador/i,
    /^grupo\b/i,
    /^estrat[eé]gia/i,
    /^cnes\b/i,
    /^vacinas?\s+soros/i,
    /^diluentes/i,
    /^imunobiol[oó]gico/i,
    /^situa[çc][aã]o/i,
    /^cart(eira|ão)/i,
    /^nacional/i,
    /^minist[eé]rio/i,
    /^sistema/i,
    /^cpf/i,
    /^cns\b/i,
    /^nome\b/i,
    /^p[aá]gina/i,
  ];

  // Clean the line: remove dates, lot numbers, UF codes
  let cleaned = line
    .replace(/\d{2}\/\d{2}\/\d{4}/g, "")
    .replace(/\b[A-Z]{2}\d{6,}\b/g, "") // lot numbers
    .replace(/\b\d{7,}\b/g, "") // CNES and other long numbers
    .replace(/\b(Dose\s*\d*|[12345]ª?\s*Dose|Dose\s*[Úú]nica|Refor[çc]o|D\d)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (cleaned.length < 3) {
    // Try the previous line for the vaccine name
    if (index > 0) {
      const prev = allLines[index - 1].trim();
      if (prev.length >= 3 && !skipPatterns.some((p) => p.test(prev)) && !/\d{2}\/\d{2}\/\d{4}/.test(prev)) {
        return prev;
      }
    }
    return null;
  }

  if (skipPatterns.some((p) => p.test(cleaned))) return null;

  // Truncate very long strings (likely multiple columns merged)
  // Take only the first meaningful segment
  const segments = cleaned.split(/\s{3,}/);
  const candidate = segments[0].trim();

  if (candidate.length < 3) return null;

  return candidate;
}

function extractDoseLabel(line: string): string | null {
  const doseMatch = line.match(/(\d+ª?\s*Dose|Dose\s*\d+|Dose\s*[Úú]nica|Refor[çc]o|D[1-5])/i);
  if (doseMatch) {
    const raw = doseMatch[1];
    if (/[Úú]nica/i.test(raw)) return "Dose Única";
    if (/[Rr]efor[çc]o/i.test(raw)) return "Reforço";
    const num = raw.match(/\d/);
    if (num) return `Dose ${num[0]}`;
  }
  return null;
}

function convertDateToISO(dateStr: string): string | null {
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (y < 1900 || y > 2099 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Main entry: parse a SUS vaccination PDF file and return CPF + vaccines.
 */
export async function parseSusVaccinePdf(file: File): Promise<ParsedSusResult> {
  const buffer = await file.arrayBuffer();
  const text = await extractTextFromPdf(buffer);

  const cpf = extractCpf(text);
  const vaccines = extractVaccines(text);

  return { cpf, vaccines };
}
