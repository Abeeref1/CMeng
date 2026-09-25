import {readableXlsx} from '../../shared/src/xlsx';
import ExcelJS from "exceljs";
import { performance } from "node:perf_hooks";
import { detectAllBoqHeaders } from "./headers";
import { parseStrictNumeric, resolveBoqCommercialNumerics } from "./numeric";
import { inventoryBoqWorkbook } from "./workbook";
import type {
  BoqAuxiliarySheet,
  BoqCell,
  BoqColumnRole,
  BoqLineItem,
  BoqParseResult,
  BoqSheetParseResult,
} from "./types";

function rowTexts(
  worksheet: ExcelJS.Worksheet,
  maxRows = worksheet.rowCount,
): string[][] {
  const rows: string[][] = [];
  const limit = Math.min(worksheet.rowCount, maxRows);
  for (let r = 1; r <= limit; r += 1) {
    const values: string[] = [];
    const row = worksheet.getRow(r);
    for (let c = 1; c <= worksheet.columnCount; c += 1) {
      values.push(row.getCell(c).text ?? "");
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

const roleColumnCache = new WeakMap<
  Record<number, BoqColumnRole>,
  Map<BoqColumnRole, number>
>();

type ParseCell = Pick<
  BoqCell,
  "locator" | "kind" | "raw" | "text" | "formulaResult"
>;

function roleColumns(
  roles: Record<number, BoqColumnRole>,
): Map<BoqColumnRole, number> {
  let columns = roleColumnCache.get(roles);
  if (!columns) {
    columns = new Map<BoqColumnRole, number>();
    for (const [column, mapped] of Object.entries(roles)) {
      columns.set(mapped, Number(column));
    }
    roleColumnCache.set(roles, columns);
  }
  return columns;
}

function parseCellKind(cell: ExcelJS.Cell): BoqCell["kind"] {
  if (cell.type === ExcelJS.ValueType.Formula) return "formula";
  if (cell.value === null || cell.value === undefined) return "blank";

  switch (cell.type) {
    case ExcelJS.ValueType.Number:
      return "number";
    case ExcelJS.ValueType.String:
    case ExcelJS.ValueType.RichText:
      return "string";
    case ExcelJS.ValueType.Date:
      return "date";
    case ExcelJS.ValueType.Boolean:
      return "boolean";
    case ExcelJS.ValueType.Error:
      return "error";
    default:
      return "string";
  }
}

function parseCellForRole(
  worksheet: ExcelJS.Worksheet,
  row: ExcelJS.Row,
  columns: Map<BoqColumnRole, number>,
  role: BoqColumnRole,
): ParseCell | null {
  const column = columns.get(role);
  if (column === undefined) return null;

  const cell = row.getCell(column);
  const raw = cell.value as unknown;
  let formulaResult: unknown = null;

  if (
    cell.type === ExcelJS.ValueType.Formula &&
    raw &&
    typeof raw === "object"
  ) {
    formulaResult =
      (raw as { result?: unknown }).result ?? null;
  }

  return {
    locator: {
      sheet: worksheet.name,
      row: row.number,
      column,
      address: cell.address,
    },
    kind: parseCellKind(cell),
    raw,
    text: cell.text ?? "",
    formulaResult,
  };
}

function text(cell: ParseCell | null): string | null {
  const value = cell?.text.trim() ?? "";
  return value ? value : null;
}

function numericSource(cell: ParseCell | null): unknown {
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
  rowNumber: number,
  roles: Record<number, BoqColumnRole>,
): BoqLineItem | null {
  const row = worksheet.getRow(rowNumber);
  const columns = roleColumns(roles);

  const itemCell = parseCellForRole(worksheet, row, columns, "item_number");
  const sectionCell = parseCellForRole(worksheet, row, columns, "section");
  const descriptionCell = parseCellForRole(worksheet, row, columns, "description");
  const unitCell = parseCellForRole(worksheet, row, columns, "unit");
  const quantityCell = parseCellForRole(worksheet, row, columns, "quantity");
  const rateCell = parseCellForRole(worksheet, row, columns, "rate");
  const amountCell = parseCellForRole(worksheet, row, columns, "amount");
  const currencyCell = parseCellForRole(worksheet, row, columns, "currency");

  const mappedCells = [
    itemCell,
    sectionCell,
    descriptionCell,
    unitCell,
    quantityCell,
    rateCell,
    amountCell,
    currencyCell,
  ];
  const hasAnyMappedValue = mappedCells.some(
    (cell) => cell && cell.text.trim() !== "",
  );
  if (!hasAnyMappedValue) return null;

  const description = text(descriptionCell) ?? "";
  const hasCommercialValue = [quantityCell, rateCell, amountCell].some(
    (cell) => cell && cell.text.trim() !== "",
  );

  const rowKind: BoqLineItem["rowKind"] =
    !description
      ? "unclassified"
      : looksLikeTotal(description)
        ? "total_or_summary"
        : !hasCommercialValue
          ? "section"
          : "line_item";

  const resolvedNumerics = resolveBoqCommercialNumerics(
    numericSource(quantityCell),
    numericSource(rateCell),
    numericSource(amountCell),
  );
  const quantity = resolvedNumerics.quantity;
  const rate = resolvedNumerics.rate;
  const amount = resolvedNumerics.amount;
  const diagnosticCodes: string[] = [];

  if (!description) {
    diagnosticCodes.push("BOQ_DESCRIPTION_MISSING");
  }

  for (const [name, parsed, cell] of [
    ["QUANTITY", quantity, quantityCell],
    ["RATE", rate, rateCell],
    ["AMOUNT", amount, amountCell],
  ] as const) {
    if (!cell) continue;
    if (cell.kind === "formula" && cell.formulaResult === null) {
      diagnosticCodes.push(`BOQ_${name}_FORMULA_RESULT_MISSING`);
    }
    if (cell.text.trim() === "" && cell.kind !== "formula") continue;
    if (parsed.status === "ambiguous") {
      diagnosticCodes.push(`BOQ_${name}_AMBIGUOUS`);
    }
    if (parsed.status === "invalid") {
      diagnosticCodes.push(`BOQ_${name}_INVALID`);
    }
  }

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
    diagnosticCodes.push("BOQ_AMOUNT_ARITHMETIC_MISMATCH");
  }

  const sourceCells: BoqLineItem["sourceCells"] = {};
  for (const [role, cell] of [
    ["item_number", itemCell],
    ["section", sectionCell],
    ["description", descriptionCell],
    ["unit", unitCell],
    ["quantity", quantityCell],
    ["rate", rateCell],
    ["amount", amountCell],
    ["currency", currencyCell],
  ] as Array<[BoqColumnRole, ParseCell | null]>) {
    if (cell) sourceCells[role] = cell.locator;
  }

  return {
    sheet: worksheet.name,
    row: rowNumber,
    rowKind,
    itemNumber: text(itemCell),
    section: text(sectionCell),
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
  const rowTextStarted = performance.now();
  const rows = rowTexts(worksheet);
  const rowTextMs = performance.now() - rowTextStarted;

  const headerStarted = performance.now();
  const headers = detectAllBoqHeaders(rows);
  const headerMs = performance.now() - headerStarted;

  console.info(
    "[boq-profile] sheet=" +
      worksheet.name +
      " rowTextsMs=" +
      rowTextMs.toFixed(2) +
      " headerDetectionMs=" +
      headerMs.toFixed(2) +
      " rows=" +
      worksheet.rowCount +
      " cols=" +
      worksheet.columnCount +
      " headers=" +
      headers.length,
  );

  const diagnostics: string[] = [];
  const items: BoqLineItem[] = [];

  if (headers.length === 0) {
    return {
      sheet: worksheet.name,
      header: null,
      headers: [],
      candidateRows: 0,
      parsedRows: 0,
      unresolvedRows: 0,
      items,
      diagnostics,
    };
  }

  const itemStarted = performance.now();
  for (let headerIndex = 0; headerIndex < headers.length; headerIndex += 1) {
    const header = headers[headerIndex]!;
    const nextHeader = headers[headerIndex + 1];
    const endRow = nextHeader ? nextHeader.headerRow - 1 : worksheet.rowCount;

    for (let row = header.headerRow + 1; row <= endRow; row += 1) {
      const item = parseLineItem(worksheet, row, header.roles);
      if (item) {
        items.push(item);
      }

      if (
        row % 5_000 === 0 ||
        row === endRow
      ) {
        console.info(
          "[boq-profile] sheet=" +
            worksheet.name +
            " parsedThroughRow=" +
            row +
            " elapsedMs=" +
            (performance.now() - itemStarted).toFixed(2) +
            " items=" +
            items.length,
        );
      }
    }
  }

  console.info(
    "[boq-profile] sheet=" +
      worksheet.name +
      " itemParseMs=" +
      (performance.now() - itemStarted).toFixed(2) +
      " items=" +
      items.length,
  );

  const unresolvedRows = items.filter(
    (item) => item.status === "unresolved",
  ).length;

  if (items.length === 0) {
    diagnostics.push("BOQ_HEADER_FOUND_BUT_NO_LINE_ITEMS");
  }

  return {
    sheet: worksheet.name,
    header: headers[0] ?? null,
    headers,
    candidateRows: items.length,
    parsedRows: items.length - unresolvedRows,
    unresolvedRows,
    items,
    diagnostics,
  };
}

function normalizeAuxHeader(value: string): string {
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

function parseSummarySheet(
  worksheet: ExcelJS.Worksheet,
): BoqAuxiliarySheet | null {
  const scanRows = rowTexts(worksheet, 40);
  let headerRow = -1;
  let sectionColumn = -1;
  let descriptionColumn = -1;
  let amountColumn = -1;
  let shareColumn = -1;

  for (let row = 0; row < scanRows.length; row += 1) {
    const normalized = (scanRows[row] ?? []).map(normalizeAuxHeader);
    const section = normalized.findIndex(
      (value) => value === "section",
    );
    const description = normalized.findIndex(
      (value) => value === "description",
    );
    const amount = normalized.findIndex((value) =>
      /(^| )amount($| )/.test(value),
    );
    const share = normalized.findIndex((value) =>
      /(^| )share($| )/.test(value),
    );

    if (section >= 0 && description >= 0 && amount >= 0) {
      headerRow = row;
      sectionColumn = section;
      descriptionColumn = description;
      amountColumn = amount;
      shareColumn = share;
      break;
    }
  }

  if (headerRow < 0) return null;

  const rows = rowTexts(worksheet);
  const diagnostics: string[] = [];
  const summaryRows: BoqAuxiliarySheet["summaryRows"] = [];
  let declaredTotalAmount: number | null = null;
  let declaredTotalShare: number | null = null;

  for (let row = headerRow + 1; row < rows.length; row += 1) {
    const source = rows[row] ?? [];
    if (source.every((value) => !value.trim())) continue;

    const section = source[sectionColumn]?.trim() || null;
    const description =
      source[descriptionColumn]?.trim() ?? "";
    const amount = parseStrictNumeric(
      source[amountColumn] ?? null,
    );
    const share =
      shareColumn >= 0
        ? parseStrictNumeric(source[shareColumn] ?? null)
        : null;

    if (!description) {
      diagnostics.push(
        "BOQ_SUMMARY_DESCRIPTION_MISSING:" + (row + 1),
      );
      continue;
    }

    if (amount.status !== "valid" || amount.value === null) {
      diagnostics.push(
        "BOQ_SUMMARY_AMOUNT_INVALID:" + (row + 1),
      );
      continue;
    }

    if (looksLikeTotal(description)) {
      declaredTotalAmount = amount.value;
      if (
        share &&
        share.status === "valid" &&
        share.value !== null
      ) {
        declaredTotalShare = share.value;
      }
      continue;
    }

    let shareValue: number | null = null;
    if (share) {
      if (share.status === "valid") {
        shareValue = share.value;
      } else if (share.status !== "empty") {
        diagnostics.push(
          "BOQ_SUMMARY_SHARE_INVALID:" + (row + 1),
        );
      }
    }

    summaryRows.push({
      row: row + 1,
      section,
      description,
      amount: amount.value,
      share: shareValue,
    });
  }

  const calculatedAmount = summaryRows.reduce(
    (sum, row) => sum + (row.amount ?? 0),
    0,
  );
  const calculatedShare = summaryRows.reduce(
    (sum, row) => sum + (row.share ?? 0),
    0,
  );

  if (
    declaredTotalAmount !== null &&
    Math.abs(declaredTotalAmount - calculatedAmount) >
      Math.max(0.02, Math.abs(declaredTotalAmount) * 0.000001)
  ) {
    diagnostics.push(
      "BOQ_SUMMARY_INTERNAL_TOTAL_MISMATCH",
    );
  }

  if (
    declaredTotalShare !== null &&
    Math.abs(declaredTotalShare - calculatedShare) > 0.000001
  ) {
    diagnostics.push(
      "BOQ_SUMMARY_SHARE_TOTAL_MISMATCH",
    );
  }

  return {
    sheet: worksheet.name,
    kind: "summary",
    rows: rows
      .map((cells, index) => ({
        row: index + 1,
        cells,
      }))
      .filter((row) =>
        row.cells.some((value) => value.trim()),
      ),
    summaryRows,
    totalAmount: declaredTotalAmount,
    totalShare: declaredTotalShare,
    diagnostics,
  };
}

export function parseLoadedBoqWorkbook(
  workbook: ExcelJS.Workbook,
): BoqParseResult {
  const inventoryStarted = performance.now();
  const inventory = inventoryBoqWorkbook(workbook);
  console.info(
    "[boq-profile] inventoryMs=" +
      (performance.now() - inventoryStarted).toFixed(2) +
      " sheets=" +
      workbook.worksheets.length,
  );

  const sheets: BoqSheetParseResult[] = [];
  const auxiliarySheets: BoqAuxiliarySheet[] = [];

  for (const worksheet of workbook.worksheets) {
    const summaryStarted = performance.now();
    const summary = parseSummarySheet(worksheet);
    console.info(
      "[boq-profile] sheet=" +
        worksheet.name +
        " summaryDetectionMs=" +
        (performance.now() - summaryStarted).toFixed(2) +
        " summary=" +
        String(summary !== null),
    );

    const summaryIsAuthoritativeShape =
      summary !== null &&
      (
        /summary|recap|abstract/i.test(worksheet.name) ||
        summary.totalShare !== null ||
        summary.summaryRows.some((row) => row.share !== null)
      );

    if (summaryIsAuthoritativeShape && summary) {
      auxiliarySheets.push(summary);
      continue;
    }

    const parsed = parseWorksheet(worksheet);
    if (parsed.headers.length > 0) {
      sheets.push(parsed);
      continue;
    }

    if (summary) {
      auxiliarySheets.push(summary);
      continue;
    }

    if (nonEmptyCellCount(worksheet) >= 6) {
      parsed.diagnostics.push(
        "BOQ_POPULATED_SHEET_UNCLASSIFIED",
      );
      parsed.unresolvedRows = 1;
    }
    sheets.push(parsed);
  }

  const candidateRows = sheets.reduce((sum, sheet) => sum + sheet.candidateRows, 0);
  const parsedRows = sheets.reduce((sum, sheet) => sum + sheet.parsedRows, 0);
  const unresolvedRows = sheets.reduce((sum, sheet) => sum + sheet.unresolvedRows, 0);
  const diagnostics = [
    ...sheets.flatMap((sheet) =>
      sheet.diagnostics.map((code) => `${sheet.sheet}:${code}`),
    ),
    ...auxiliarySheets.flatMap((sheet) =>
      sheet.diagnostics.map((code) => `${sheet.sheet}:${code}`),
    ),
  ];

  const lineItemAmount = sheets
    .flatMap((sheet) => sheet.items)
    .filter(
      (item) =>
        item.rowKind === "line_item" &&
        item.amount !== null,
    )
    .reduce((sum, item) => sum + (item.amount ?? 0), 0);

  for (const summary of auxiliarySheets) {
    if (
      summary.kind === "summary" &&
      summary.totalAmount !== null &&
      Math.abs(summary.totalAmount - lineItemAmount) >
        Math.max(
          0.02,
          Math.abs(summary.totalAmount) * 0.000001,
        )
    ) {
      diagnostics.push(
        `${summary.sheet}:BOQ_SUMMARY_TO_LINE_ITEMS_MISMATCH`,
      );
    }
  }

  const denominatorUnknown = diagnostics.some((diagnostic) =>
    diagnostic.endsWith(":BOQ_POPULATED_SHEET_UNCLASSIFIED"),
  );

  const coveragePercent =
    denominatorUnknown || candidateRows === 0
      ? null
      : Number(((parsedRows / candidateRows) * 100).toFixed(4));

  const complete =
    candidateRows > 0 &&
    unresolvedRows === 0 &&
    diagnostics.length === 0;

  return {
    inventory,
    sheets,
    auxiliarySheets,
    candidateRows,
    parsedRows,
    unresolvedRows,
    coveragePercent,
    complete,
    diagnostics,
  };
}

export async function parseBoqWorkbook(
  bytes: Uint8Array,
): Promise<BoqParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await readableXlsx(bytes) as any);
  return parseLoadedBoqWorkbook(workbook);
}
