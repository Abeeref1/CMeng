import type { BoqColumnRole, BoqHeaderMapping } from "./types";

const SYNONYMS: Record<Exclude<BoqColumnRole, "unknown" | "section">, string[]> = {
  item_number: [
    "item", "item no", "item no.", "item number", "no", "no.", "ref",
    "رقم", "رقم البند", "البند",
  ],
  description: [
    "description", "item description", "scope", "work description",
    "الوصف", "وصف البند", "بيان الأعمال", "البيان",
  ],
  unit: ["unit", "uom", "unit of measure", "الوحدة", "وحدة"],
  quantity: ["qty", "quantity", "quant.", "الكمية", "كمية"],
  rate: [
    "rate", "unit rate", "unit price", "price", "السعر", "سعر الوحدة", "سعر",
  ],
  amount: [
    "amount", "total", "total amount", "value", "extended amount",
    "الإجمالي", "القيمة", "المبلغ", "اجمالي", "إجمالي",
  ],
  currency: ["currency", "curr", "العملة"],
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\n\r\t]+/g, " ")
    .replace(/[._:\-\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function roleForHeader(value: string): { role: BoqColumnRole; score: number } {
  const normalized = normalize(value);
  if (!normalized) return { role: "unknown", score: 0 };

  let best: { role: BoqColumnRole; score: number } = {
    role: "unknown",
    score: 0,
  };

  for (const [role, synonyms] of Object.entries(SYNONYMS) as Array<
    [Exclude<BoqColumnRole, "unknown" | "section">, string[]]
  >) {
    for (const synonym of synonyms) {
      const candidate = normalize(synonym);
      let score = 0;
      if (normalized === candidate) score = 1;
      else if (normalized.includes(candidate) || candidate.includes(normalized)) {
        score = Math.min(normalized.length, candidate.length) / Math.max(normalized.length, candidate.length);
      }
      if (score > best.score) best = { role, score };
    }
  }

  return best;
}

export function detectBoqHeader(
  rows: readonly (readonly string[])[],
  maxRows = 40,
): BoqHeaderMapping | null {
  let best: BoqHeaderMapping | null = null;

  const scan = Math.min(rows.length, maxRows);
  for (let i = 0; i < scan; i += 1) {
    const row = rows[i] ?? [];
    const roles: Record<number, BoqColumnRole> = {};
    const seen = new Set<BoqColumnRole>();
    let score = 0;

    row.forEach((cell, columnIndex) => {
      const match = roleForHeader(cell);
      if (match.role !== "unknown" && match.score >= 0.6 && !seen.has(match.role)) {
        roles[columnIndex + 1] = match.role;
        seen.add(match.role);
        score += match.score;
      }
    });

    const hasDescription = seen.has("description");
    const hasCommercial =
      seen.has("quantity") ||
      seen.has("rate") ||
      seen.has("amount");
    const structuralCount = [...seen].filter((r) => r !== "currency").length;

    if (!hasDescription || !hasCommercial || structuralCount < 3) continue;

    const mapping: BoqHeaderMapping = {
      headerRow: i + 1,
      roles,
      score: Number(score.toFixed(4)),
      diagnostics: [],
    };

    if (!best || mapping.score > best.score) best = mapping;
  }

  return best;
}
