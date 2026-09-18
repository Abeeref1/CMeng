import type { BoqColumnRole, BoqHeaderMapping } from "./types";

const SYNONYMS: Record<
  Exclude<BoqColumnRole, "unknown">,
  string[]
> = {
  item_number: [
    "item",
    "item no",
    "item no.",
    "item number",
    "no",
    "no.",
    "ref",
    "رقم",
    "رقم البند",
    "البند",
  ],
  section: [
    "section",
    "bill",
    "trade",
    "work section",
    "القسم",
  ],
  description: [
    "description",
    "item description",
    "scope",
    "work description",
    "الوصف",
    "وصف البند",
    "بيان الأعمال",
    "البيان",
  ],
  unit: ["unit", "uom", "unit of measure", "الوحدة", "وحدة"],
  quantity: ["qty", "quantity", "quant.", "الكمية", "كمية"],
  rate: [
    "rate",
    "unit rate",
    "unit price",
    "price",
    "السعر",
    "سعر الوحدة",
    "سعر",
  ],
  amount: [
    "amount",
    "total",
    "total amount",
    "value",
    "extended amount",
    "الإجمالي",
    "القيمة",
    "المبلغ",
    "اجمالي",
    "إجمالي",
  ],
  currency: ["currency", "curr", "العملة"],
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\n\r\t]+/g, " ")
    .replace(/[._:\-\/()[\]{}]+/g, " ")
    .replace(
      /\b(?:sar|aed|usd|eur|gbp|jod|qar|omr|bhd|kwd)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

const NORMALIZED_SYNONYMS = (
  Object.entries(SYNONYMS) as Array<
    [
      Exclude<BoqColumnRole, "unknown">,
      string[],
    ]
  >
).map(([role, synonyms]) => [
  role,
  synonyms.map(normalize),
] as const);

const EXACT_ROLE_BY_HEADER = new Map<
  string,
  Exclude<BoqColumnRole, "unknown">
>();

for (const [role, synonyms] of NORMALIZED_SYNONYMS) {
  for (const synonym of synonyms) {
    if (!EXACT_ROLE_BY_HEADER.has(synonym)) {
      EXACT_ROLE_BY_HEADER.set(synonym, role);
    }
  }
}

function roleForHeader(
  value: string,
): { role: BoqColumnRole; score: number } {
  const normalized = normalize(value);
  if (!normalized) return { role: "unknown", score: 0 };

  if (!/[A-Za-z\u0600-\u06FF]/.test(normalized)) {
    return { role: "unknown", score: 0 };
  }

  const exact = EXACT_ROLE_BY_HEADER.get(normalized);
  if (exact) {
    return { role: exact, score: 1 };
  }

  let best: { role: BoqColumnRole; score: number } = {
    role: "unknown",
    score: 0,
  };

  for (const [role, synonyms] of NORMALIZED_SYNONYMS) {
    for (const candidate of synonyms) {
      let score = 0;
      if (
        normalized.includes(candidate) ||
        candidate.includes(normalized)
      ) {
        score =
          Math.min(normalized.length, candidate.length) /
          Math.max(normalized.length, candidate.length);
      }
      if (score > best.score) best = { role, score };
    }
  }

  return best;
}

function mappingForRow(
  row: readonly string[],
  rowNumber: number,
): BoqHeaderMapping | null {
  const roles: Record<number, BoqColumnRole> = {};
  const seen = new Set<BoqColumnRole>();
  let score = 0;

  row.forEach((cell, columnIndex) => {
    const match = roleForHeader(cell);
    if (
      match.role !== "unknown" &&
      match.score >= 0.6 &&
      !seen.has(match.role)
    ) {
      roles[columnIndex + 1] = match.role;
      seen.add(match.role);
      score += match.score;
    }
  });

  const hasDescription = seen.has("description");
  const hasCommercial =
    seen.has("quantity") || seen.has("rate") || seen.has("amount");
  const structuralCount = [...seen].filter(
    (role) => role !== "currency",
  ).length;

  if (!hasDescription || !hasCommercial || structuralCount < 3) {
    return null;
  }

  return {
    headerRow: rowNumber,
    roles,
    score: Number(score.toFixed(4)),
    diagnostics: [],
  };
}

export function detectAllBoqHeaders(
  rows: readonly (readonly string[])[],
): BoqHeaderMapping[] {
  const headers: BoqHeaderMapping[] = [];

  rows.forEach((row, index) => {
    const mapping = mappingForRow(row, index + 1);
    if (mapping) headers.push(mapping);
  });

  return headers;
}

export function detectBoqHeader(
  rows: readonly (readonly string[])[],
  maxRows = 40,
): BoqHeaderMapping | null {
  let best: BoqHeaderMapping | null = null;

  const scan = Math.min(rows.length, maxRows);
  for (let index = 0; index < scan; index += 1) {
    const mapping = mappingForRow(rows[index] ?? [], index + 1);
    if (!mapping) continue;
    if (!best || mapping.score > best.score) best = mapping;
  }

  return best;
}
