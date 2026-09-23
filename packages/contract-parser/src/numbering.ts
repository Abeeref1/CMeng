export interface ContractHeading {
  kind: "clause" | "appendix" | "annex" | "schedule";
  identifier: string;
  contextIdentifier: string | null;
  heading: string | null;
}

const ARABIC_DIGITS: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
};

export function normalizeContractDigits(value: string): string {
  return [...value]
    .map((char) => ARABIC_DIGITS[char] ?? char)
    .join("");
}

function cleanHeading(value: string): string | null {
  const cleaned = value
    .replace(/^[\s:.)\-–—]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

export function detectContractHeading(
  rawLine: string,
): ContractHeading | null {
  const line = normalizeContractDigits(rawLine)
    .replace(/\u00A0/g, " ")
    .trim();

  if (!line || line.length > 220) return null;
  // An amendment sentence is body evidence referring to a clause, not a new
  // clause heading. Repeated instructions must not become deduplicated headers.
  if(/^clause\s+[\d.]+\s+(?:is|shall\s+be)\s+(?:amended|deleted|replaced|supplemented)/i.test(line))return null;

  // Table-of-contents entries often look like clause headings but end
  // with dot leaders and a page number. Preserve them as source text,
  // but do not create semantic clause boundaries from them.
  if (
    /\.{3,}\s*\d+\s*$/.test(line) ||
    /…{2,}\s*\d+\s*$/.test(line)
  ) {
    return null;
  }

  const sectionClause = line.match(
    /^section\s+([0-9]+)\s*[-–—:]\s*clause\s+([0-9]+)\s*:?\s*(.*)$/i,
  );
  if (sectionClause) {
    const section = String(Number(sectionClause[1]!));
    const clause = String(Number(sectionClause[2]!));
    return {
      kind: "clause",
      identifier: section + "." + clause,
      contextIdentifier: section,
      heading: cleanHeading(sectionClause[3] ?? ""),
    };
  }

  const amendmentProvision = line.match(
    /^amendment\s+provision\s+([0-9]+(?:\.[0-9]+){0,8})\s*(.*)$/i,
  );
  if (amendmentProvision) {
    return {
      kind: "clause",
      identifier: amendmentProvision[1]!,
      contextIdentifier: "amendment",
      heading:
        cleanHeading(amendmentProvision[2] ?? "") ??
        "Amendment Provision",
    };
  }

  const explicit = line.match(
    /^(?:clause|article|section)\s+([0-9]+(?:\.[0-9]+){0,8})\s*(.*)$/i,
  );
  if (explicit) {
    return {
      kind: "clause",
      identifier: explicit[1]!,
      contextIdentifier: null,
      heading: cleanHeading(explicit[2] ?? ""),
    };
  }

  const arabicExplicit = line.match(
    /^(?:المادة|البند|القسم)\s*([0-9]+(?:\.[0-9]+){0,8})\s*(.*)$/i,
  );
  if (arabicExplicit) {
    return {
      kind: "clause",
      identifier: arabicExplicit[1]!,
      contextIdentifier: null,
      heading: cleanHeading(arabicExplicit[2] ?? ""),
    };
  }

  const numbered = line.match(
    /^([0-9]+(?:\.[0-9]+){0,8})[.)]?\s+(.+)$/,
  );
  if (numbered) {
    const rest = numbered[2]!.trim();

    // Avoid common dates, durations, quantities and metadata values
    // that begin with a number but are not legal section headings.
    if (
      /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(rest) ||
      /^(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/i.test(rest) ||
      /^(?:calendar\s+)?(?:day|days|week|weeks|month|months|year|years)\b/i.test(rest) ||
      /^[0-9,.%]+$/.test(rest)
    ) {
      return null;
    }

    return {
      kind: "clause",
      identifier: numbered[1]!,
      contextIdentifier: null,
      heading: cleanHeading(rest),
    };
  }

  const appendix = line.match(
    /^(appendix|annex|schedule)\s+([A-Z0-9][A-Z0-9.\-]*)\s*(.*)$/i,
  );
  if (appendix) {
    const kind = appendix[1]!.toLowerCase() as
      | "appendix"
      | "annex"
      | "schedule";
    return {
      kind,
      identifier: appendix[2]!.toUpperCase(),
      contextIdentifier: null,
      heading: cleanHeading(appendix[3] ?? ""),
    };
  }

  const arabicAppendix = line.match(
    /^(ملحق|المرفق|جدول)\s*([A-Za-z0-9]+)?\s*(.*)$/,
  );
  if (arabicAppendix) {
    return {
      kind:
        arabicAppendix[1] === "جدول"
          ? "schedule"
          : "appendix",
      identifier: (
        arabicAppendix[2] ?? arabicAppendix[1]!
      ).toUpperCase(),
      contextIdentifier: null,
      heading: cleanHeading(arabicAppendix[3] ?? ""),
    };
  }

  return null;
}
