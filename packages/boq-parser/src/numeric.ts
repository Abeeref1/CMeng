import type { StrictNumeric } from "./types";

function result(
  status: StrictNumeric["status"],
  raw: string,
  value: number | null,
  normalized: string | null,
  reason: string | null,
): StrictNumeric {
  return { status, raw, value, normalized, reason };
}

export function parseStrictNumeric(input: unknown): StrictNumeric {
  if (input === null || input === undefined || input === "") {
    return result("empty", "", null, null, null);
  }

  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      return result("invalid", String(input), null, null, "Non-finite number");
    }
    return result("valid", String(input), input, String(input), null);
  }

  const raw = String(input).trim();
  if (!raw) return result("empty", raw, null, null, null);

  const cleaned = raw
    .replace(/[\u00A0\u202F ]/g, "")
    .replace(/^[A-Z]{3}/i, "")
    .replace(/[A-Z]{3}$/i, "")
    .replace(/^[^\d+\-.,(]+|[^\d).,]+$/g, "");

  if (!cleaned) {
    return result("invalid", raw, null, null, "No numeric token");
  }

  const negativeByParens = /^\(.*\)$/.test(cleaned);
  const token = cleaned.replace(/[()]/g, "");

  if (!/^[+\-]?\d[\d.,]*$/.test(token)) {
    return result("invalid", raw, null, null, "Unsupported numeric syntax");
  }

  const commaCount = (token.match(/,/g) ?? []).length;
  const dotCount = (token.match(/\./g) ?? []).length;

  let normalized: string | null = null;

  if (commaCount === 0 && dotCount === 0) {
    normalized = token;
  } else if (commaCount > 0 && dotCount > 0) {
    const lastComma = token.lastIndexOf(",");
    const lastDot = token.lastIndexOf(".");
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    const decimalDigits = token.length - Math.max(lastComma, lastDot) - 1;

    if (decimalDigits === 0 || decimalDigits > 6) {
      return result("ambiguous", raw, null, null, "Unclear decimal separator");
    }

    normalized = token.split(thousands).join("").replace(decimal, ".");
  } else {
    const separator = commaCount > 0 ? "," : ".";
    const count = commaCount + dotCount;
    const parts = token.replace(/^[+\-]/, "").split(separator);

    if (count > 1) {
      const allGroupsThree = parts.slice(1).every((part) => part.length === 3);
      if (allGroupsThree) {
        normalized = token.split(separator).join("");
      } else {
        const last = parts.at(-1) ?? "";
        if (last.length > 0 && last.length <= 6) {
          const sign = token.startsWith("-") ? "-" : token.startsWith("+") ? "+" : "";
          const unsigned = token.replace(/^[+\-]/, "");
          const lastIndex = unsigned.lastIndexOf(separator);
          normalized =
            sign +
            unsigned.slice(0, lastIndex).split(separator).join("") +
            "." +
            unsigned.slice(lastIndex + 1);
        }
      }
    } else {
      const decimals = parts[1]?.length ?? 0;
      if (decimals === 3) {
        return result(
          "ambiguous",
          raw,
          null,
          null,
          "Single separator with three trailing digits may be decimal or thousands separator",
        );
      }
      if (decimals > 0 && decimals <= 6) {
        normalized = token.replace(separator, ".");
      }
    }
  }

  if (normalized === null) {
    return result("ambiguous", raw, null, null, "Could not determine numeric separators safely");
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) {
    return result("invalid", raw, null, normalized, "Normalized value is not finite");
  }

  const value = negativeByParens ? -Math.abs(numeric) : numeric;
  return result("valid", raw, value, normalized, null);
}


function cleanedNumericToken(input: unknown): {
  raw: string;
  token: string | null;
  negativeByParens: boolean;
} {
  if (input === null || input === undefined || input === "") {
    return { raw: "", token: null, negativeByParens: false };
  }

  const raw = String(input).trim();
  if (!raw) {
    return { raw, token: null, negativeByParens: false };
  }

  const cleaned = raw
    .replace(/[\u00A0\u202F ]/g, "")
    .replace(/^[A-Z]{3}/i, "")
    .replace(/[A-Z]{3}$/i, "")
    .replace(/^[^\d+\-.,(]+|[^\d).,]+$/g, "");

  if (!cleaned) {
    return { raw, token: null, negativeByParens: false };
  }

  return {
    raw,
    token: cleaned.replace(/[()]/g, ""),
    negativeByParens: /^\(.*\)$/.test(cleaned),
  };
}

function distinctNumbers(values: number[]): number[] {
  const out: number[] = [];
  for (const value of values) {
    if (!out.some((candidate) => Object.is(candidate, value))) {
      out.push(value);
    }
  }
  return out;
}

export function numericCandidates(input: unknown): number[] {
  const strict = parseStrictNumeric(input);
  if (strict.status === "valid" && strict.value !== null) {
    return [strict.value];
  }

  if (strict.status !== "ambiguous") {
    return [];
  }

  const cleaned = cleanedNumericToken(input);
  const token = cleaned.token;
  if (!token || !/^[+\-]?\d[\d.,]*$/.test(token)) {
    return [];
  }

  const commaCount = (token.match(/,/g) ?? []).length;
  const dotCount = (token.match(/\./g) ?? []).length;

  // The deliberately ambiguous case CMeng refuses to guess by itself:
  // one separator with exactly three trailing digits. Preserve both
  // decimal and thousands interpretations for deterministic BOQ
  // arithmetic reconciliation.
  if (commaCount + dotCount !== 1) {
    return [];
  }

  const separator = commaCount === 1 ? "," : ".";
  const unsigned = token.replace(/^[+\-]/, "");
  const parts = unsigned.split(separator);
  if (parts.length !== 2 || parts[1]!.length !== 3) {
    return [];
  }

  const sign = token.startsWith("-") ? -1 : 1;
  const decimal = Number(parts[0]! + "." + parts[1]!);
  const thousands = Number(parts[0]! + parts[1]!);

  const values = [decimal, thousands]
    .filter((value) => Number.isFinite(value))
    .map((value) => {
      const signed = sign * value;
      return cleaned.negativeByParens ? -Math.abs(signed) : signed;
    });

  return distinctNumbers(values);
}

export interface BoqCommercialNumericResolution {
  quantity: StrictNumeric;
  rate: StrictNumeric;
  amount: StrictNumeric;
  resolvedByArithmetic: boolean;
}

function resolvedNumeric(
  input: unknown,
  value: number,
): StrictNumeric {
  const raw =
    input === null || input === undefined ? "" : String(input).trim();
  return {
    status: "valid",
    raw,
    value,
    normalized: String(value),
    reason:
      "Resolved uniquely by BOQ arithmetic: quantity × rate ≈ amount",
  };
}

function arithmeticTolerance(amount: number): number {
  return Math.max(0.02, Math.abs(amount) * 0.0001);
}

export function resolveBoqCommercialNumerics(
  quantityInput: unknown,
  rateInput: unknown,
  amountInput: unknown,
): BoqCommercialNumericResolution {
  const quantity = parseStrictNumeric(quantityInput);
  const rate = parseStrictNumeric(rateInput);
  const amount = parseStrictNumeric(amountInput);

  if (
    quantity.status !== "ambiguous" &&
    rate.status !== "ambiguous" &&
    amount.status !== "ambiguous"
  ) {
    return {
      quantity,
      rate,
      amount,
      resolvedByArithmetic: false,
    };
  }

  const quantityCandidates = numericCandidates(quantityInput);
  const rateCandidates = numericCandidates(rateInput);
  const amountCandidates = numericCandidates(amountInput);

  if (
    quantityCandidates.length === 0 ||
    rateCandidates.length === 0 ||
    amountCandidates.length === 0
  ) {
    return {
      quantity,
      rate,
      amount,
      resolvedByArithmetic: false,
    };
  }

  const matches: Array<{
    quantity: number;
    rate: number;
    amount: number;
  }> = [];

  for (const q of quantityCandidates) {
    for (const r of rateCandidates) {
      for (const a of amountCandidates) {
        if (
          Math.abs(q * r - a) <= arithmeticTolerance(a)
        ) {
          matches.push({
            quantity: q,
            rate: r,
            amount: a,
          });
        }
      }
    }
  }

  const uniqueMatches = matches.filter(
    (match, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.quantity === match.quantity &&
          candidate.rate === match.rate &&
          candidate.amount === match.amount,
      ) === index,
  );

  if (uniqueMatches.length !== 1) {
    return {
      quantity,
      rate,
      amount,
      resolvedByArithmetic: false,
    };
  }

  const match = uniqueMatches[0]!;
  return {
    quantity:
      quantity.status === "ambiguous"
        ? resolvedNumeric(quantityInput, match.quantity)
        : quantity,
    rate:
      rate.status === "ambiguous"
        ? resolvedNumeric(rateInput, match.rate)
        : rate,
    amount:
      amount.status === "ambiguous"
        ? resolvedNumeric(amountInput, match.amount)
        : amount,
    resolvedByArithmetic:
      quantity.status === "ambiguous" ||
      rate.status === "ambiguous" ||
      amount.status === "ambiguous",
  };
}
