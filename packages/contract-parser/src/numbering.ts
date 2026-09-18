export interface ContractHeading {
  kind: "clause" | "appendix" | "annex" | "schedule";
  identifier: string;
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

  const explicit = line.match(
    /^(?:clause|article|section)\s+([0-9]+(?:\.[0-9]+){0,8})\s*(.*)$/i,
  );
  if (explicit) {
    return {
      kind: "clause",
      identifier: explicit[1]!,
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
      heading: cleanHeading(arabicExplicit[2] ?? ""),
    };
  }

  const numbered = line.match(
    /^([0-9]+(?:\.[0-9]+){0,8})[.)]?\s+(.+)$/,
  );
  if (numbered) {
    const rest = numbered[2]!.trim();

    // Avoid common dates, currencies, decimal quantities and bare values.
    if (
      /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(rest) ||
      /^[0-9,.%]+$/.test(rest)
    ) {
      return null;
    }

    return {
      kind: "clause",
      identifier: numbered[1]!,
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
      heading: cleanHeading(arabicAppendix[3] ?? ""),
    };
  }

  return null;
}
