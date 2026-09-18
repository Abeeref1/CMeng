import { parseCsv } from "../../tabular-parser/src";
import { detectBoqHeader } from "../../boq-parser/src/headers";
import { parseStrictNumeric } from "../../boq-parser/src/numeric";
import type { BoqColumnRole, BoqLineItem } from "../../boq-parser/src/types";
import type { BoqCsvResult } from "./types";

function roleColumn(
  roles: Record<number, BoqColumnRole>,
  role: BoqColumnRole,
): number | null {
  const entry = Object.entries(roles).find(([, mapped]) => mapped === role);
  return entry ? Number(entry[0]) : null;
}

function valueAt(row: readonly string[], column: number | null): string | null {
  if (column === null) return null;
  const value = (row[column - 1] ?? "").trim();
  return value || null;
}

function looksLikeTotal(description: string): boolean {
  const normalized = description.toLowerCase().replace(/\s+/g, " ").trim();
  return /\b(total|subtotal|sub total|carried|brought forward|summary)\b/.test(normalized) ||
    /(الإجمالي|اجمالي|المجموع|مرحّل|مرحل)/.test(normalized);
}

function arithmeticValid(quantity: number, rate: number, amount: number): boolean {
  const expected = quantity * rate;
  const tolerance = Math.max(0.02, Math.abs(amount) * 0.0001);
  return Math.abs(expected - amount) <= tolerance;
}

export function parseBoqCsv(bytes: Uint8Array): BoqCsvResult {
  const csv = parseCsv(bytes);
  const diagnostics = [...csv.diagnostics];
  const rows = csv.rows.map((row) => row.cells);
  const header = detectBoqHeader(rows);

  if (!header) {
    diagnostics.push("BOQ_CSV_HEADER_NOT_FOUND");
    return {
      rowsSeen: csv.rowCount,
      candidateRows: 0,
      verifiedRows: 0,
      unresolvedRows: csv.rowCount > 0 ? 1 : 0,
      coveragePercent: null,
      items: [],
      complete: false,
      diagnostics,
    };
  }

  const items: BoqLineItem[] = [];

  for (let index = header.headerRow; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    if (row.every((value) => !value.trim())) continue;

    const rowNumber = index + 1;
    const itemNumber = valueAt(row, roleColumn(header.roles, "item_number"));
    const description = valueAt(row, roleColumn(header.roles, "description")) ?? "";
    const unit = valueAt(row, roleColumn(header.roles, "unit"));
    const currency = valueAt(row, roleColumn(header.roles, "currency"));
    const quantityRaw = valueAt(row, roleColumn(header.roles, "quantity"));
    const rateRaw = valueAt(row, roleColumn(header.roles, "rate"));
    const amountRaw = valueAt(row, roleColumn(header.roles, "amount"));

    if (
      !itemNumber &&
      !description &&
      !unit &&
      !quantityRaw &&
      !rateRaw &&
      !amountRaw &&
      !currency
    ) {
      continue;
    }

    const rowDiagnostics: string[] = [];
    if (!description) rowDiagnostics.push("BOQ_DESCRIPTION_MISSING");

    const quantity = parseStrictNumeric(quantityRaw);
    const rate = parseStrictNumeric(rateRaw);
    const amount = parseStrictNumeric(amountRaw);

    for (const [name, raw, parsed] of [
      ["QUANTITY", quantityRaw, quantity],
      ["RATE", rateRaw, rate],
      ["AMOUNT", amountRaw, amount],
    ] as const) {
      if (raw === null) continue;
      if (parsed.status === "ambiguous") {
        rowDiagnostics.push("BOQ_" + name + "_AMBIGUOUS");
      }
      if (parsed.status === "invalid") {
        rowDiagnostics.push("BOQ_" + name + "_INVALID");
      }
    }

    const hasCommercial = quantityRaw !== null || rateRaw !== null || amountRaw !== null;
    const rowKind: BoqLineItem["rowKind"] =
      !description
        ? "unclassified"
        : looksLikeTotal(description)
          ? "total_or_summary"
          : !hasCommercial
            ? "section"
            : "line_item";

    if (
      rowKind === "line_item" &&
      quantity.status === "valid" &&
      rate.status === "valid" &&
      amount.status === "valid" &&
      quantity.value !== null &&
      rate.value !== null &&
      amount.value !== null &&
      !arithmeticValid(quantity.value, rate.value, amount.value)
    ) {
      rowDiagnostics.push("BOQ_AMOUNT_ARITHMETIC_MISMATCH");
    }

    const sourceCells: BoqLineItem["sourceCells"] = {};
    for (const role of [
      "item_number",
      "description",
      "unit",
      "quantity",
      "rate",
      "amount",
      "currency",
    ] as BoqColumnRole[]) {
      const column = roleColumn(header.roles, role);
      if (column === null) continue;
      sourceCells[role] = {
        sheet: "CSV",
        row: rowNumber,
        column,
        address: "R" + rowNumber + "C" + column,
      };
    }

    items.push({
      sheet: "CSV",
      row: rowNumber,
      rowKind,
      itemNumber,
      description,
      unit,
      quantity: quantity.status === "valid" ? quantity.value : null,
      rate: rate.status === "valid" ? rate.value : null,
      amount: amount.status === "valid" ? amount.value : null,
      currency,
      sourceCells,
      status: rowDiagnostics.length === 0 ? "verified" : "unresolved",
      diagnosticCodes: rowDiagnostics,
    });
  }

  const unresolvedRows = items.filter((item) => item.status === "unresolved").length;
  const verifiedRows = items.length - unresolvedRows;

  return {
    rowsSeen: csv.rowCount,
    candidateRows: items.length,
    verifiedRows,
    unresolvedRows,
    coveragePercent:
      items.length === 0
        ? null
        : Number(((verifiedRows / items.length) * 100).toFixed(4)),
    items,
    complete:
      items.length > 0 &&
      unresolvedRows === 0 &&
      diagnostics.length === 0,
    diagnostics,
  };
}
