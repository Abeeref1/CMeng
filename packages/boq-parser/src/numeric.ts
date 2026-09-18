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
