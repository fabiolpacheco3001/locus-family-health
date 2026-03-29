import * as pdfjsLib from "pdfjs-dist";
import type { ImportedVaccine } from "@/components/VaccineImportReviewDrawer";

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

interface ParsedSusResult {
  cpf: string | null;
  allCpfCandidates: string[];
  vaccines: ImportedVaccine[];
}

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

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

function extractCpf(text: string): string | null {
  const contextualMatch = text.match(/CPF[\s\S]{0,30}?(\d{3}\.\d{3}\.\d{3}-\d{2})/i);
  if (contextualMatch) return contextualMatch[1];
  const strictGeneric = text.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
  return strictGeneric ? strictGeneric[1] : null;
}

const SKIP_PATTERNS = [
  /^data\b/i, /^dose\b/i, /^lote\b/i, /^fabricante/i, /^unidade/i,
  /^vacinador/i, /^grupo\b/i, /^estrat[eé]gia/i, /^cnes\b/i,
  /^vacinas?\s+soros/i, /^diluentes/i, /^imunobiol[oó]gico/i,
  /^situa[çc][aã]o/i, /^cart(eira|ão)/i, /^nacional/i,
  /^minist[eé]rio/i, /^sistema/i, /^cpf/i, /^cns\b/i,
  /^nome\b/i, /^p[aá]gina/i, /^vacina\/profilaxia/i, /^imuniza[çc]/i,
];

const GARBAGE_TERMS = ["carteira", "digital", "nacional", "data de nascimento", "cpf/cns", "vacinação digital"];

function isValidVaccineName(line: string): boolean {
  if (!line || line.length < 3) return false;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(line)) return false;
  if (/^\d+$/.test(line)) return false;
  if (SKIP_PATTERNS.some((p) => p.test(line))) return false;
  const lower = line.toLowerCase();
  if (GARBAGE_TERMS.some((t) => lower.includes(t))) return false;
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
    .replace(/.*(?:UF\b|Munic[ií]pio|Sexo|MASCULINO|FEMININO|BRASILEIRO|BRASILEIRA|VACINAÇÃO COVID-19|VACINAS\s*SOROS|DILUENTES ADMINISTRADOS|Naturalidade|Nome da M[ãa]e|Data de Nascimento|Nome Completo)\s*/ig, '')
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

// ── Smart Mapping ──────────────────────────────────────────────────────────

const VACCINE_MAP: { pattern: RegExp; standardName: string }[] = [
  { pattern: /covid|pfizer|comirnaty|janssen|coronavac|astrazeneca|oxford/i, standardName: "Covid-19" },
  { pattern: /difteria\s*e\s*t[eé]tano|^dt\b/i, standardName: "DT - Difteria e Tétano" },
  { pattern: /hepatite\s*b/i, standardName: "Hepatite B" },
  { pattern: /hepatite\s*a/i, standardName: "Hepatite A" },
  { pattern: /febre\s*amarela/i, standardName: "Febre Amarela" },
  { pattern: /bcg/i, standardName: "BCG" },
  { pattern: /hpv|papilomav[ií]rus/i, standardName: "HPV" },
  { pattern: /tr[ií]plice\s*viral|scr\b|sarampo.*caxumba.*rub[eé]ola/i, standardName: "Tríplice Viral (SCR)" },
  { pattern: /polio|vip|vop|salk|sabin/i, standardName: "Poliomielite (VIP/VOP)" },
  { pattern: /rotav[ií]rus/i, standardName: "Rotavírus" },
  { pattern: /pneumo|prevenar/i, standardName: "Pneumocócica" },
  { pattern: /mening/i, standardName: "Meningocócica" },
  { pattern: /influenza|gripe/i, standardName: "Gripe (Influenza)" },
  { pattern: /dengue/i, standardName: "Dengue" },
  { pattern: /antirr[aá]bica|raiva/i, standardName: "Antirrábica" },
  { pattern: /v8|v10|polivalente/i, standardName: "V8 / V10 (Polivalente)" },
  { pattern: /giard[ií]/i, standardName: "Giardíase" },
  { pattern: /leishman/i, standardName: "Leishmaniose" },
  { pattern: /tr[ií]plice\s*felina|v3/i, standardName: "Tríplice Felina (V3)" },
  { pattern: /qu[aá]drupla\s*felina|v4/i, standardName: "Quádrupla Felina (V4)" },
  { pattern: /felv|leucemia\s*felina/i, standardName: "FeLV (Leucemia Felina)" },
  { pattern: /tosse.*canis|gripe\s*canina/i, standardName: "Gripe Canina (Tosse dos Canis)" },
];

export function mapVaccineToStandard(rawName: string): { standardName: string; details: string } {
  const rawTrimmed = rawName.trim();
  for (const entry of VACCINE_MAP) {
    if (entry.pattern.test(rawTrimmed)) {
      // Remove the standard name from details to avoid redundancy
      const cleanDetails = rawTrimmed
        .replace(new RegExp(entry.standardName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
        .replace(/^[\s\-–,]+|[\s\-–,]+$/g, '')
        .trim();
      return { standardName: entry.standardName, details: cleanDetails || rawTrimmed };
    }
  }
  return { standardName: "Outra (especificar)", details: rawTrimmed };
}

// ── Expanded extraction (batch, facility, city, state) ─────────────────────

function isMetadataLine(line: string): boolean {
  return /^\d+$/.test(line) || /^[\d./-]+$/.test(line) || SKIP_PATTERNS.some((p) => p.test(line));
}

function extractVaccines(text: string): ImportedVaccine[] {
  const lowerText = text.toLowerCase();
  const startIdx = lowerText.indexOf("vacina/profilaxia");
  const tableText = startIdx !== -1 ? text.slice(startIdx) : text;
  const lines = tableText.split("\n").map((line) => normalizeSpaces(line)).filter(Boolean);

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
    let consumedLines = 0;

    // Try to get dose from next line
    const nextLine = lines[i + 1];
    if (nextLine && !isFooterLine(nextLine) && !nextLine.match(dateRegex) && !SKIP_PATTERNS.some((p) => p.test(nextLine))) {
      const suffix = extractNameSuffix(nextLine);
      if (suffix) {
        name = sanitizeVaccineName(`${name} ${suffix}`);
        consumedLines = 1;
      }
      if (!doseLabel) {
        const nextDose = extractDoseLabel(nextLine);
        if (nextDose) {
          doseLabel = nextDose;
          consumedLines = Math.max(consumedLines, 1);
        }
      }
    }

    // Try to capture batch from subsequent lines (i+1+consumedLines or i+2)
    let batch: string | undefined;
    let facility: string | undefined;
    let city: string | undefined;
    let state: string | undefined;

    const batchIdx = i + 1 + consumedLines;
    if (batchIdx < lines.length) {
      const batchCandidate = normalizeSpaces(lines[batchIdx]);
      // Batch is typically alphanumeric like "FA123/2026" or "210038" — not a date, not a skip pattern
      if (batchCandidate && !dateRegex.test(batchCandidate) && !isFooterLine(batchCandidate) && !SKIP_PATTERNS.some((p) => p.test(batchCandidate))) {
        // Batch lines are usually short alphanumeric codes
        if (/^[A-Za-z0-9\-\/. ]{2,30}$/.test(batchCandidate) && !isMetadataLine(batchCandidate)) {
          batch = batchCandidate;
        }
      }
    }

    // Try to capture facility, city, state from further lines
    // In SUS PDF, typical order after date line: dose, batch, fabricante, estrategia, UF, municipality, facility
    // We scan next ~6 lines for UF (2 uppercase letters) and facility-like strings
    for (let offset = 1; offset <= 6; offset++) {
      const scanIdx = i + offset;
      if (scanIdx >= lines.length) break;
      const scanLine = normalizeSpaces(lines[scanIdx]);
      if (!scanLine || isFooterLine(scanLine) || dateRegex.test(scanLine)) break;

      // UF detection: exactly 2 uppercase letters (state abbreviation)
      if (!state && /^[A-Z]{2}$/.test(scanLine)) {
        state = scanLine;
        continue;
      }

      // Facility: longer strings that look like establishment names
      if (!facility && scanLine.length > 10 && /[A-ZÀ-Ý]/.test(scanLine) && !isMetadataLine(scanLine) && !SKIP_PATTERNS.some((p) => p.test(scanLine))) {
        // Could be facility or city — if it contains common facility keywords
        if (/UBS|hospital|cl[ií]nica|posto|sa[uú]de|unidade|centro|secret[aá]ria|munic[ií]p/i.test(scanLine)) {
          facility = scanLine;
        } else if (!city && scanLine.length > 3) {
          city = scanLine;
        }
      }
    }

    const mapped = mapVaccineToStandard(name);

    vaccines.push({
      name: mapped.standardName,
      details: mapped.details.toUpperCase().trim(),
      dose_label: doseLabel || undefined,
      applied_date: isoDate,
      batch,
      facility,
      city,
      state,
    });

    pendingNameParts = [];
    if (consumedLines > 0) i += consumedLines;
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

export async function parseSusVaccinePdf(file: File): Promise<ParsedSusResult> {
  const buffer = await file.arrayBuffer();
  const text = await extractTextFromPdf(buffer);

  console.log("FULL PDF TEXT:", text);

  const cpf = extractCpf(text);
  const vaccines = extractVaccines(text);

  const formatted = text.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/g) || [];
  const unformatted = text.match(/(?<!\d)\d{11}(?!\d)/g) || [];
  const allCpfCandidates = [...new Set(
    [...formatted, ...unformatted].map(c => c.replace(/\D/g, ""))
  )];

  return { cpf, allCpfCandidates, vaccines };
}
