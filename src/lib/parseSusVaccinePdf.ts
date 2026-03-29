import * as pdfjsLib from "pdfjs-dist";
import type { ImportedVaccine } from "@/components/VaccineImportReviewDrawer";

// Use local worker bundled with the package
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface ParsedSusResult {
  cpf: string | null;
  allCpfCandidates: string[];
  vaccines: ImportedVaccine[];
}

// ── Cell / Row types ───────────────────────────────────────────────────────
interface TextCell {
  x: number;
  text: string;
}

interface TableRow {
  y: number;
  cells: TextCell[];
}

// ── Column definitions (matched by header text) ───────────────────────────
const HEADER_LABELS: { key: string; patterns: RegExp[] }[] = [
  { key: "vaccine", patterns: [/vacina\/profilaxia/i, /imunobiol[oó]gico/i] },
  { key: "date", patterns: [/^data$/i] },
  { key: "dose", patterns: [/^dose$/i] },
  { key: "batch", patterns: [/^lote$/i] },
  { key: "strategy", patterns: [/estrat[eé]gia/i] },
  /\*\*?\s*cnes\s*[–\-]/i,
  { key: "facility", patterns: [/estabelecimento/i] },
  { key: "city", patterns: [/munic[ií]pio/i] },
  { key: "state", patterns: [/^uf$/i] },
];

type ColumnBounds = Record<string, { start: number; end: number }>;

// ── Single-pass extraction: flat text + tabular rows ──────────────────────
async function extractAll(buffer: ArrayBuffer): Promise<{ flatText: string; tableRows: TableRow[] }> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const textPages: string[] = [];
  const allRows: TableRow[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // ── Flat text (for CPF detection) ──
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
    const sortedFlatYs = [...rows.keys()].sort((a, b) => b - a);
    const lines: string[] = [];
    for (const y of sortedFlatYs) {
      const row = rows.get(y)!;
      row.sort((a, b) => a.x - b.x);
      lines.push(row.map((r) => r.text).join(" "));
    }
    textPages.push(lines.join("\n"));

    // ── Tabular rows (for column-based extraction) ──
    const rowMap = new Map<number, TextCell[]>();
    for (const item of content.items) {
      if (!("str" in item) || !("transform" in item)) continue;
      const textItem = item as { str: string; transform: number[] };
      if (!textItem.str.trim()) continue;
      const y = Math.round(textItem.transform[5] / 4) * 4;
      const x = textItem.transform[4];
      if (!rowMap.has(y)) rowMap.set(y, []);
      rowMap.get(y)!.push({ x, text: textItem.str.trim() });
    }
    const sortedYs = [...rowMap.keys()].sort((a, b) => b - a);
    for (const y of sortedYs) {
      const cells = rowMap.get(y)!;
      cells.sort((a, b) => a.x - b.x);
      allRows.push({ y, cells });
    }
  }

  return { flatText: textPages.join("\n\n"), tableRows: allRows };
}

// ── Detect column boundaries from header rows ─────────────────────────────
function detectColumns(rows: TableRow[]): ColumnBounds {
  const bounds: ColumnBounds = {};

  for (const row of rows) {
    const rowText = row.cells.map((c) => c.text).join(" ");
    // Header row contains "Vacina/Profilaxia" or similar
    if (!/vacina\/profilaxia/i.test(rowText) && !/imunobiol[oó]gico/i.test(rowText)) continue;

    // Found a header row — map each cell to a column key
    for (const cell of row.cells) {
      for (const hdr of HEADER_LABELS) {
        if (hdr.patterns.some((p) => p.test(cell.text))) {
          bounds[hdr.key] = { start: cell.x, end: cell.x }; // end will be refined
          break;
        }
      }
    }

    if (Object.keys(bounds).length > 0) break; // use first header row found
  }

  // Refine end boundaries: each column ends where the next one starts
  const keys = HEADER_LABELS.map((h) => h.key).filter((k) => k in bounds);
  const sorted = keys.sort((a, b) => bounds[a].start - bounds[b].start);
  for (let i = 0; i < sorted.length; i++) {
    if (i + 1 < sorted.length) {
      bounds[sorted[i]].end = bounds[sorted[i + 1]].start - 1;
    } else {
      bounds[sorted[i]].end = 9999; // last column extends to the right
    }
  }

  return bounds;
}

// ── Assign cell to column ─────────────────────────────────────────────────
function getCellForColumn(cells: TextCell[], col: { start: number; end: number } | undefined): string {
  if (!col) return "";
  // Find cells whose X falls within the column range (with tolerance)
  const tolerance = 15;
  const matches = cells.filter(
    (c) => c.x >= col.start - tolerance && c.x <= col.end + tolerance
  );
  return matches.map((m) => m.text).join(" ").trim();
}

// ── CPF extraction (unchanged) ────────────────────────────────────────────
function extractCpf(text: string): string | null {
  const contextualMatch = text.match(/CPF[\s\S]{0,30}?(\d{3}\.\d{3}\.\d{3}-\d{2})/i);
  if (contextualMatch) return contextualMatch[1];
  const strictGeneric = text.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
  return strictGeneric ? strictGeneric[1] : null;
}

// ── Dose translation (De/Para) ────────────────────────────────────────────
function translateDose(raw: string): string | null {
  if (!raw) return null;
  if (/1\/2/i.test(raw)) return "1ª Dose";
  if (/2\/2/i.test(raw)) return "2ª Dose";
  if (/[Úú]nica/i.test(raw)) return "Única";
  if (/[Rr]efor[çc]o/i.test(raw)) return "Reforço";
  const num = raw.match(/(\d)/);
  if (num) {
    const n = parseInt(num[1], 10);
    if (n >= 1 && n <= 3) return `${n}ª Dose`;
  }
  return raw.trim() || null;
}

// ── Smart Mapping ─────────────────────────────────────────────────────────
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
      const cleanDetails = rawTrimmed
        .replace(new RegExp(entry.standardName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "")
        .replace(/^[\s\-–,]+|[\s\-–,]+$/g, "")
        .trim();
      return { standardName: entry.standardName, details: cleanDetails || rawTrimmed };
    }
  }
  return { standardName: "Outra (especificar)", details: rawTrimmed };
}

// ── Sanitization helpers ──────────────────────────────────────────────────
const GARBAGE_TERMS = ["carteira", "digital", "nacional", "data de nascimento", "cpf/cns", "vacinação digital"];

function sanitizeVaccineName(value: string): string {
  let cleaned = value
    .replace(/.*(?:UF\b|Munic[ií]pio|Sexo|MASCULINO|FEMININO|BRASILEIRO|BRASILEIRA|VACINAÇÃO COVID-19|VACINAS\s*SOROS|DILUENTES ADMINISTRADOS|Naturalidade|Nome da M[ãa]e|Data de Nascimento|Nome Completo)\s*/ig, "")
    .replace(/\bRefor[çc]o\b/gi, "")
    .replace(/\bDose\s*[Úú]nica\b/gi, "")
    .replace(/\b\d+ª\s*Dose\b/gi, "")
    .replace(/\bDose\s*\d+\b/gi, "")
    .replace(/\b\d\/\d\b/g, "")
    .replace(/\b\d+º\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

function isValidVaccineName(name: string): boolean {
  if (!name || name.length < 3) return false;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(name)) return false;
  if (/^\d+$/.test(name)) return false;
  const lower = name.toLowerCase();
  if (GARBAGE_TERMS.some((t) => lower.includes(t))) return false;
  return true;
}

// ── Date helpers ──────────────────────────────────────────────────────────
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

const DATE_REGEX = /\b\d{2}\/\d{2}\/\d{4}\b/;

// ── FOOTER detection ──────────────────────────────────────────────────────
const FOOTER_PATTERNS = [
  /carteira de vacina[çc][aã]o emitida/i,
  /esta carteira/i,
  /sua autenticidade/i,
  /^\*\*?\s*cnes\s*[–\-]/i,
  /^obs\./i,
];

function isFooterRow(cells: TextCell[]): boolean {
  const text = cells.map((c) => c.text).join(" ");
  return FOOTER_PATTERNS.some((p) => p.test(text));
}

// ── SKIP patterns (header rows to ignore) ─────────────────────────────────
function isHeaderOrSkipRow(cells: TextCell[]): boolean {
  const text = cells.map((c) => c.text).join(" ");
  if (/vacina\/profilaxia/i.test(text)) return true;
  if (/imunobiol[oó]gico/i.test(text)) return true;
  if (/vacinas?\s*\|\s*soros/i.test(text)) return true;
  if (/diluentes administrados/i.test(text)) return true;
  if (/vacinação covid/i.test(text)) return true;
  if (/minist[eé]rio da sa[uú]de/i.test(text)) return true;
  if (/carteira nacional/i.test(text)) return true;
  return false;
}

// ── Main vaccine extraction using column-based approach ───────────────────
function extractVaccinesFromTable(rows: TableRow[], columns: ColumnBounds): ImportedVaccine[] {
  const vaccines: ImportedVaccine[] = [];
  const hasColumns = Object.keys(columns).length >= 3; // at least vaccine, date, dose

  // Track multi-line vaccine names: some vaccines span 2+ Y-rows
  // Strategy: accumulate name parts until we find a row with a date
  let pendingNameParts: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (isHeaderOrSkipRow(row.cells)) {
      pendingNameParts = [];
      continue;
    }
    if (isFooterRow(row.cells)) break;

    // Check if this row has a date
    let dateStr = "";
    let rawName = "";
    let rawDose = "";
    let batch = "";
    let facility = "";
    let city = "";
    let state = "";

    if (hasColumns) {
      dateStr = getCellForColumn(row.cells, columns.date);
      rawName = getCellForColumn(row.cells, columns.vaccine);
      rawDose = getCellForColumn(row.cells, columns.dose);
      batch = getCellForColumn(row.cells, columns.batch);
      facility = getCellForColumn(row.cells, columns.facility);
      city = getCellForColumn(row.cells, columns.city);
      state = getCellForColumn(row.cells, columns.state);
    } else {
      // Fallback: use full row text
      const fullText = row.cells.map((c) => c.text).join(" ");
      const dateMatch = fullText.match(DATE_REGEX);
      if (dateMatch) {
        dateStr = dateMatch[0];
      }
      rawName = fullText;
    }

    // Does this row have a valid date?
    const dateMatch = dateStr.match(DATE_REGEX);
    if (!dateMatch) {
      // No date → this may be a continuation of a vaccine name
      if (rawName && hasColumns) {
        // Only accumulate from the vaccine column
        const cleaned = sanitizeVaccineName(rawName);
        if (cleaned && isValidVaccineName(cleaned)) {
          pendingNameParts.push(cleaned);
        }
      }
      continue;
    }

    const isoDate = convertDateToISO(dateMatch[0]);
    if (!isoDate) {
      pendingNameParts = [];
      continue;
    }

    // Build the vaccine name from pending parts + current row
    const currentName = sanitizeVaccineName(rawName);
    const fullName = [...pendingNameParts, currentName].filter(Boolean).join(" ").trim();

    if (!isValidVaccineName(fullName)) {
      pendingNameParts = [];
      continue;
    }

    // Translate dose
    const doseLabel = translateDose(rawDose);

    // Clean up state (should be 2 uppercase chars)
    const cleanState = state && /^[A-Z]{2}$/.test(state.trim()) ? state.trim() : undefined;

    // Clean city
    const cleanCity = city.trim() || undefined;

    // Clean facility
    const cleanFacility = facility.trim() || undefined;

    // Clean batch
    const cleanBatch = batch.trim() || undefined;

    // Apply Smart Mapping
    const mapped = mapVaccineToStandard(fullName);

    vaccines.push({
      name: mapped.standardName,
      details: mapped.details.toUpperCase().trim(),
      dose_label: doseLabel || undefined,
      applied_date: isoDate,
      batch: cleanBatch,
      facility: cleanFacility,
      city: cleanCity,
      state: cleanState,
    });

    pendingNameParts = [];
  }

  // Deduplicate by name + date
  const seen = new Set<string>();
  return vaccines.filter((v) => {
    const key = `${v.name}|${v.applied_date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Public API ────────────────────────────────────────────────────────────
export async function parseSusVaccinePdf(file: File): Promise<ParsedSusResult> {
  const buffer = await file.arrayBuffer();

  // Single-pass extraction: avoids detached ArrayBuffer issues
  const { flatText, tableRows } = await extractAll(buffer);

  console.log("FULL PDF TEXT:", flatText);

  // CPF from flat text (unchanged logic)
  const cpf = extractCpf(flatText);
  const formatted = flatText.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/g) || [];
  const unformatted = flatText.match(/(?<!\d)\d{11}(?!\d)/g) || [];
  const allCpfCandidates = [
    ...new Set([...formatted, ...unformatted].map((c) => c.replace(/\D/g, ""))),
  ];

  // Detect column layout from header rows
  const columns = detectColumns(tableRows);
  console.log("DETECTED COLUMNS:", JSON.stringify(columns));

  // Extract vaccines using column-based approach
  const vaccines = extractVaccinesFromTable(tableRows, columns);
  console.log("EXTRACTED VACCINES:", JSON.stringify(vaccines, null, 2));

  return { cpf, allCpfCandidates, vaccines };
}
