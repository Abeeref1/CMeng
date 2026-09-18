import { parseCsv } from "../../tabular-parser/src";
import { detectAllBoqHeaders } from "../../boq-parser/src/headers";
import { resolveBoqCommercialNumerics } from "../../boq-parser/src/numeric";
import type {
  BoqColumnRole,
  BoqHeaderMapping,
  BoqLineItem,
} from "../../boq-parser/src/types";
import type { BoqCsvResult } from "./types";

function roleColumn(
  roles: Record<number, BoqColumnRole>,
  role: BoqColumnRole,
): number | null {
  const entry = Object.entries(roles).find(([, mapped]) => mapped === role);
  return entry ? Number(entry[0]) : null;
}

function valueAt(
  row: readonly string[],
  column: number | null,
): string | null {
  if (column === null) return null;
  const value = (row[column - 1] ?? "").trim();
  return value || null;
}

function looksLikeTotal(description: string): boolean {
  const normalized = description.toLowerCase().replace(/\s+/g, " ").trim();
  return /\b(total|subtotal|sub total|carried|brought forward|summary)\b/.test(normalized) ||
    /(الإجمالي|اجمالي|المجموع|مرحّل|مرحل)/.test(normalized);
}

function arithmeticValid(
  quantity: number,
  rate: number,
  amount: number,
): boolean {
  const expected = quantity * rate;
  const tolerance = Math.max(0.02, Math.abs(amount) * 0.0001);
  return Math.abs(expected - amount) <= tolerance;
}

function parseSegment(
  rows: readonly (readonly string[])[],
  header: BoqHeaderMapping,
  endIndexExclusive: number,
): BoqLineItem[] {
  const items: BoqLineItem[] = [];

  for (
    let index = header.headerRow;
    index < Math.min(endIndexExclusive, rows.length);
    index += 1
  ) {
    const row = rows[index] ?? [];
    if (row.every((value) => !value.trim())) continue;

    const rowNumber = index + 1;
    const itemNumber = valueAt(
      row,
      roleColumn(header.roles, "item_number"),
    );
    const section = valueAt(
      row,
      roleColumn(header.roles, "section"),
    );
    const description =
      valueAt(row, roleColumn(header.roles, "description")) ?? "";
    const unit = valueAt(row, roleColumn(header.roles, "unit"));
    const currency = valueAt(
      row,
      roleColumn(header.roles, "currency"),
    );
    const quantityRaw = valueAt(
      row,
      roleColumn(header.roles, "quantity"),
    );
    const rateRaw = valueAt(row, roleColumn(header.roles, "rate"));
    const amountRaw = valueAt(
      row,
      roleColumn(header.roles, "amount"),
    );

    if (
      !itemNumber &&
      !section &&
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
    if (!description) {
      rowDiagnostics.push("BOQ_DESCRIPTION_MISSING");
    }

    const resolvedNumerics = resolveBoqCommercialNumerics(
      quantityRaw,
      rateRaw,
      amountRaw,
    );
    const quantity = resolvedNumerics.quantity;
    const rate = resolvedNumerics.rate;
    const amount = resolvedNumerics.amount;

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

    const hasCommercial =
      quantityRaw !== null ||
      rateRaw !== null ||
      amountRaw !== null;

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
      !arithmeticValid(
        quantity.value,
        rate.value,
        amount.value,
      )
    ) {
      rowDiagnostics.push("BOQ_AMOUNT_ARITHMETIC_MISMATCH");
    }

    const sourceCells: BoqLineItem["sourceCells"] = {};
    for (const role of [
      "item_number",
      "section",
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
      section,
      description,
      unit,
      quantity:
        quantity.status === "valid" ? quantity.value : null,
      rate: rate.status === "valid" ? rate.value : null,
      amount: amount.status === "valid" ? amount.value : null,
      currency,
      sourceCells,
      status:
        rowDiagnostics.length === 0 ? "verified" : "unresolved",
      diagnosticCodes: rowDiagnostics,
    });
  }

  return items;
}

export function parseBoqCsv(bytes: Uint8Array): BoqCsvResult {
  const csv = parseCsv(bytes);
  const diagnostics = [...csv.diagnostics];
  const rows = csv.rows.map((row) => row.cells);
  const headers = detectAllBoqHeaders(rows);

  if (headers.length === 0) {
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

  const prefixRows = rows.slice(0, headers[0]!.headerRow - 1);
  const populatedPrefixRows = prefixRows.filter((row) =>
    row.some((value) => value.trim()),
  ).length;

  if (populatedPrefixRows > 0) {
    diagnostics.push(
      "BOQ_CSV_POPULATED_PREFIX_ROWS_UNCLASSIFIED:" +
        populatedPrefixRows,
    );
  }

  const items: BoqLineItem[] = [];

  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index]!;
    const nextHeader = headers[index + 1];
    const endIndexExclusive = nextHeader
      ? nextHeader.headerRow - 1
      : rows.length;

    items.push(
      ...parseSegment(
        rows,
        header,
        endIndexExclusive,
      ),
    );
  }

  const unresolvedRows = items.filter(
    (item) => item.status === "unresolved",
  ).length;
  const verifiedRows = items.length - unresolvedRows;
  const denominatorUnknown = populatedPrefixRows > 0;

  return {
    rowsSeen: csv.rowCount,
    candidateRows: items.length,
    verifiedRows,
    unresolvedRows,
    coveragePercent:
      denominatorUnknown || items.length === 0
        ? null
        : Number(
            ((verifiedRows / items.length) * 100).toFixed(4),
          ),
    items,
    complete:
      items.length > 0 &&
      unresolvedRows === 0 &&
      diagnostics.length === 0,
    diagnostics,
  };
}
