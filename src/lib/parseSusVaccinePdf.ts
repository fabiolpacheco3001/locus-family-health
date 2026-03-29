import * as pdfjsLib from "pdfjs-dist";
import type { ImportedVaccine } from "@/components/VaccineImportReviewDrawer";

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

interface ParsedSusResult {
  cpf: string | null;
  allCpfCandidates: string[];
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
 * Noise patterns — lines matching these are headers/metadata, not vaccine names.
 */
const SKIP_PATTERNS = [
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
  /^vacina\/profilaxia/i,
  /^imuniza[çc]/i,
];

function isValidVaccineName(line: string): boolean {
  if (!line || line.length < 3) return false;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(line)) return false;
  if (/^\d+$/.test(line)) return false;
  if (SKIP_PATTERNS.some((p) => p.test(line))) return false;
  return true;
}

function extractDoseLabel(line: string): string | null {
  const doseMatch = line.match(/(\d+ª\s*Dose|Dose\s*\d+|Dose\s*[Úú]nica|Refor[çc]o|\d\/\d|D[1-5])/i);
  if (!doseMatch) return null;

  const raw = doseMatch[1].trim();
  if (/^[1-9]\/\d$/i.test(raw)) return raw;
  if (/[Úú]nica/i.test(raw)) return "Dose Única";
  if (/[Rr]efor[çc]o/i.test(raw)) return "Reforço";
  if (/\d+ª\s*Dose/i.test(raw)) return raw.replace(/\s+/g, " ");

  const num = raw.match(/\d/);
  return num ? `Dose ${num[0]}` : null;
}

const FOOTER_PATTERNS = [
  /^carteira de vacina[çc][aã]o emitida/i,
  /^esta carteira/i,
  /^sua autenticidade/i,
  /^\*\*?\s*cnes/i,
  /^obs\./i,
];

function isFooterLine(line: string): boolean {
  return FOOTER_PATTERNS.some((pattern) => pattern.test(line));
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeVaccineName(value: string): string {
  let cleaned = value
    // Guilhotina: corta tudo antes e incluindo palavras-chave demográficas/headers
    .replace(/.*(?:UF\b|Munic[ií]pio|Sexo|MASCULINO|FEMININO|BRASILEIRO|BRASILEIRA|VACINAÇÃO COVID-19|VACINAS\s*SOROS|DILUENTES ADMINISTRADOS|Naturalidade|Nome da M[ãa]e|Data de Nascimento|Nome Completo)\s*/ig, '')
    // Remove dose labels do nome
    .replace(/\bRefor[çc]o\b/gi, "")
    .replace(/\bDose\s*[Úú]nica\b/gi, "")
    .replace(/\b\d+ª\s*Dose\b/gi, "")
    .replace(/\bDose\s*\d+\b/gi, "")
    .replace(/\b\d\/\d\b/g, "")
    .replace(/\b\d+º\b/g, "");
  return normalizeSpaces(cleaned);
}

function extractNameSuffix(line: string): string | null {
  const normalized = normalizeSpaces(line);
  if (!normalized || isFooterLine(normalized) || SKIP_PATTERNS.some((p) => p.test(normalized))) {
    return null;
  }

  const doseMatch = normalized.match(/(\d+ª\s*Dose|Dose\s*\d+|Dose\s*[Úú]nica|Refor[çc]o|\d\/\d|D[1-5])/i);
  if (doseMatch && typeof doseMatch.index === "number") {
    const prefix = sanitizeVaccineName(normalized.slice(0, doseMatch.index));
    return prefix && prefix.length <= 24 ? prefix : null;
  }

  if (/^[A-ZÀ-Ý0-9 .-]{1,24}$/u.test(normalized) && normalized.split(" ").length <= 3) {
    return normalized;
  }

  return null;
}

/**
 * Parses vaccine records using a structural state-machine approach.
 * Handles both strict date-only rows and hybrid rows where name/date/dose share the same line.
 */
function extractVaccines(text: string): ImportedVaccine[] {
  const lowerText = text.toLowerCase();
  const startIdx = lowerText.indexOf("vacina/profilaxia");

  const tableText = startIdx !== -1 ? text.slice(startIdx) : text;
  const lines = tableText
    .split("\n")
    .map((line) => normalizeSpaces(line))
    .filter(Boolean);

  const vaccines: ImportedVaccine[] = [];
  const dateRegex = /\b\d{2}\/\d{2}\/\d{4}\b/;
  let pendingNameParts: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isFooterLine(line)) break;
    if (SKIP_PATTERNS.some((pattern) => pattern.test(line))) continue;

    const dateMatch = line.match(dateRegex);
    if (!dateMatch || typeof dateMatch.index !== "number") {
      pendingNameParts.push(line);
      continue;
    }

    const dateStr = dateMatch[0];
    const isoDate = convertDateToISO(dateStr);
    if (!isoDate) {
      pendingNameParts = [];
      continue;
    }

    const beforeDate = sanitizeVaccineName(line.slice(0, dateMatch.index));
    const afterDate = normalizeSpaces(line.slice(dateMatch.index + dateStr.length));

    let name = sanitizeVaccineName([...pendingNameParts, beforeDate].filter(Boolean).join(" "));
    if (!isValidVaccineName(name)) {
      pendingNameParts = [];
      continue;
    }

    let doseLabel = extractDoseLabel(afterDate);
    const nextLine = lines[i + 1];
    let consumedNextLine = false;

    if (nextLine && !isFooterLine(nextLine) && !nextLine.match(dateRegex) && !SKIP_PATTERNS.some((pattern) => pattern.test(nextLine))) {
      const suffix = extractNameSuffix(nextLine);
      if (suffix) {
        name = sanitizeVaccineName(`${name} ${suffix}`);
        consumedNextLine = true;
      }

      if (!doseLabel) {
        const nextDose = extractDoseLabel(nextLine);
        if (nextDose) {
          doseLabel = nextDose;
          consumedNextLine = true;
        }
      }
    }

    vaccines.push({
      name: name.toUpperCase().trim(),
      dose_label: doseLabel || undefined,
      applied_date: isoDate,
    });

    pendingNameParts = [];
    if (consumedNextLine) i += 1;
  }

  const seen = new Set<string>();
  return vaccines.filter((v) => {
    const key = `${v.name}|${v.applied_date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

  console.log("FULL PDF TEXT:", text);

  const cpf = extractCpf(text);
  const vaccines = extractVaccines(text);

  // 1. Candidatos formatados estritamente (inequivocamente um CPF do SUS)
  const formatted = text.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/g) || [];
  // 2. Candidatos não-formatados com Boundaries (Exatamente 11 dígitos, nem mais, nem menos)
  const unformatted = text.match(/(?<!\d)\d{11}(?!\d)/g) || [];
  // 3. Unir, limpar e deduplicar
  const allCpfCandidates = [...new Set(
    [...formatted, ...unformatted].map(c => c.replace(/\D/g, ""))
  )];

  return { cpf, allCpfCandidates, vaccines };
}
