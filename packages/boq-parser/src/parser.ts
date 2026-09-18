import ExcelJS from "exceljs";
import { detectBoqHeader } from "./headers";
import { parseStrictNumeric } from "./numeric";
import { inventoryBoqWorkbook, readBoqCell } from "./workbook";
import type {
  BoqCell,
  BoqColumnRole,
  BoqLineItem,
  BoqParseResult,
  BoqSheetParseResult,
} from "./types";

function rowTexts(worksheet: ExcelJS.Worksheet): string[][] {
  const rows: string[][] = [];
  for (let r = 1; r <= worksheet.rowCount; r += 1) {
    const values: string[] = [];
    for (let c = 1; c <= worksheet.columnCount; c += 1) {
      values.push(readBoqCell(worksheet, r, c).text);
    }
    rows.push(values);
  }
  return rows;
}

function nonEmptyCellCount(worksheet: ExcelJS.Worksheet): number {
  let count = 0;
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.text.trim()) count += 1;
    });
  });
  return count;
}

function cellForRole(
  worksheet: ExcelJS.Worksheet,
  row: number,
  roles: Record<number, BoqColumnRole>,
  role: BoqColumnRole,
): BoqCell | null {
  const entry = Object.entries(roles).find(([, mapped]) => mapped === role);
  if (!entry) return null;
  return readBoqCell(worksheet, row, Number(entry[0]));
}

function text(cell: BoqCell | null): string | null {
  const value = cell?.text.trim() ?? "";
  return value ? value : null;
}

function numericSource(cell: BoqCell | null): unknown {
  if (!cell) return null;
  if (cell.kind === "formula") return cell.formulaResult;
  return cell.raw;
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

function parseLineItem(
  worksheet: ExcelJS.Worksheet,
  row: number,
  roles: Record<number, BoqColumnRole>,
): BoqLineItem | null {
  const itemCell = cellForRole(worksheet, row, roles, "item_number");
  const descriptionCell = cellForRole(worksheet, row, roles, "description");
  const unitCell = cellForRole(worksheet, row, roles, "unit");
  const quantityCell = cellForRole(worksheet, row, roles, "quantity");
  const rateCell = cellForRole(worksheet, row, roles, "rate");
  const amountCell = cellForRole(worksheet, row, roles, "amount");
  const currencyCell = cellForRole(worksheet, row, roles, "currency");

  const description = text(descriptionCell);
  if (!description) return null;

  const hasCommercialValue = [quantityCell, rateCell, amountCell].some(
    (cell) => cell && cell.text.trim() !== "",
  );

  if (!hasCommercialValue) return null;

  const quantity = parseStrictNumeric(numericSource(quantityCell));
  const rate = parseStrictNumeric(numericSource(rateCell));
  const amount = parseStrictNumeric(numericSource(amountCell));
  const diagnosticCodes: string[] = [];

  for (const [name, parsed, cell] of [
    ["QUANTITY", quantity, quantityCell],
    ["RATE", rate, rateCell],
    ["AMOUNT", amount, amountCell],
  ] as const) {
    if (cell?.kind === "formula" && cell.formulaResult === null) {
      diagnosticCodes.push(`BOQ_${name}_FORMULA_RESULT_MISSING`);
    }
    if (parsed.status === "ambiguous") {
      diagnosticCodes.push(`BOQ_${name}_AMBIGUOUS`);
    }
    if (parsed.status === "invalid") {
      diagnosticCodes.push(`BOQ_${name}_INVALID`);
    }
  }

  if (
    quantity.status === "valid" &&
    rate.status === "valid" &&
    amount.status === "valid" &&
    quantity.value !== null &&
    rate.value !== null &&
    amount.value !== null &&
    !arithmeticValid(quantity.value, rate.value, amount.value)
  ) {
    diagnosticCodes.push("BOQ_AMOUNT_ARITHMETIC_MISMATCH");
  }

  if (looksLikeTotal(description)) {
    diagnosticCodes.push("BOQ_TOTAL_OR_SUMMARY_ROW");
  }

  const sourceCells: BoqLineItem["sourceCells"] = {};
  for (const [role, cell] of [
    ["item_number", itemCell],
    ["description", descriptionCell],
    ["unit", unitCell],
    ["quantity", quantityCell],
    ["rate", rateCell],
    ["amount", amountCell],
    ["currency", currencyCell],
  ] as Array<[BoqColumnRole, BoqCell | null]>) {
    if (cell) sourceCells[role] = cell.locator;
  }

  return {
    sheet: worksheet.name,
    row,
    itemNumber: text(itemCell),
    description,
    unit: text(unitCell),
    quantity: quantity.status === "valid" ? quantity.value : null,
    rate: rate.status === "valid" ? rate.value : null,
    amount: amount.status === "valid" ? amount.value : null,
    currency: text(currencyCell),
    sourceCells,
    status: diagnosticCodes.length === 0 ? "verified" : "unresolved",
    diagnosticCodes,
  };
}

function parseWorksheet(worksheet: ExcelJS.Worksheet): BoqSheetParseResult {
  const rows = rowTexts(worksheet);
  const header = detectBoqHeader(rows);
  const diagnostics: string[] = [];
  const items: BoqLineItem[] = [];

  if (!header) {
    if (nonEmptyCellCount(worksheet) >= 6) {
      diagnostics.push("BOQ_POPULATED_SHEET_UNCLASSIFIED");
    }
    return {
      sheet: worksheet.name,
      header: null,
      candidateRows: 0,
      parsedRows: 0,
      unresolvedRows: diagnostics.length > 0 ? 1 : 0,
      items,
      diagnostics,
    };
  }

  for (let row = header.headerRow + 1; row <= worksheet.rowCount; row += 1) {
    const item = parseLineItem(worksheet, row, header.roles);
    if (!item) continue;
    items.push(item);
  }

  const unresolvedRows = items.filter((item) => item.status === "unresolved").length;

  if (items.length === 0) {
    diagnostics.push("BOQ_HEADER_FOUND_BUT_NO_LINE_ITEMS");
  }

  return {
    sheet: worksheet.name,
    header,
    candidateRows: items.length,
    parsedRows: items.length - unresolvedRows,
    unresolvedRows,
    items,
    diagnostics,
  };
}

export async function parseBoqWorkbook(bytes: Uint8Array): Promise<BoqParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as any);

  const inventory = inventoryBoqWorkbook(workbook);
  const sheets = workbook.worksheets.map(parseWorksheet);

  const candidateRows = sheets.reduce((sum, sheet) => sum + sheet.candidateRows, 0);
  const parsedRows = sheets.reduce((sum, sheet) => sum + sheet.parsedRows, 0);
  const unresolvedRows = sheets.reduce((sum, sheet) => sum + sheet.unresolvedRows, 0);
  const diagnostics = sheets.flatMap((sheet) =>
    sheet.diagnostics.map((code) => `${sheet.sheet}:${code}`),
  );

  const coveragePercent =
    candidateRows === 0
      ? 0
      : Number(((parsedRows / candidateRows) * 100).toFixed(4));

  const complete =
    candidateRows > 0 &&
    unresolvedRows === 0 &&
    diagnostics.length === 0;

  return {
    inventory,
    sheets,
    candidateRows,
    parsedRows,
    unresolvedRows,
    coveragePercent,
    complete,
    diagnostics,
  };
}
