import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

import { detectAllBoqHeaders } from "./headers";
import {
  parseStrictNumeric,
  resolveBoqCommercialNumerics,
} from "./numeric";
import type {
  BoqAuxiliarySheet,
  BoqCellKind,
  BoqColumnRole,
  BoqHeaderMapping,
  BoqLineItem,
  BoqParseResult,
  BoqSheetInventory,
  BoqSheetParseResult,
  BoqWorkbookInventory,
} from "./types";

interface FastCell {
  row: number;
  column: number;
  address: string;
  kind: BoqCellKind;
  raw: unknown;
  text: string;
  formula: string | null;
  formulaResult: unknown;
}

interface FastSheet {
  name: string;
  state: "visible" | "hidden" | "veryHidden";
  rowCount: number;
  columnCount: number;
  mergeRanges: string[];
  hiddenRows: number[];
  hiddenColumns: number[];
  rows: Map<number, Map<number, FastCell>>;
  rowTexts: string[][];
}

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (name) =>
    name === "sheet" ||
    name === "Relationship" ||
    name === "si" ||
    name === "r" ||
    name === "row" ||
    name === "c" ||
    name === "mergeCell" ||
    name === "col",
});

function array<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function nodeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(nodeText).join("");
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record["#text"] !== undefined) {
      return nodeText(record["#text"]);
    }
    if (record.t !== undefined) {
      return nodeText(record.t);
    }
    if (record.r !== undefined) {
      return array(record.r).map(nodeText).join("");
    }
  }
  return "";
}

function columnNumber(address: string): number {
  const match = /^([A-Z]+)\d+$/i.exec(address);
  if (!match) return 0;
  let value = 0;
  for (const char of match[1]!.toUpperCase()) {
    value = value * 26 + (char.charCodeAt(0) - 64);
  }
  return value;
}

function dimensionCounts(
  ref: string | undefined,
): { rows: number; columns: number } {
  if (!ref) return { rows: 0, columns: 0 };
  const end = ref.includes(":") ? ref.split(":").at(-1)! : ref;
  const match = /^([A-Z]+)(\d+)$/i.exec(end);
  if (!match) return { rows: 0, columns: 0 };
  return {
    rows: Number(match[2]) || 0,
    columns: columnNumber(end),
  };
}

function relationshipPath(target: string): string {
  const clean = target.replace(/^\//, "");
  if (clean.startsWith("xl/")) return clean;
  return "xl/" + clean.replace(/^\.\//, "");
}

async function xmlFile(
  zip: JSZip,
  path: string,
): Promise<Record<string, any>> {
  const entry = zip.file(path);
  if (!entry) {
    throw new Error("BOQ_OOXML_PART_MISSING:" + path);
  }
  return xml.parse(await entry.async("string")) as Record<string, any>;
}

async function sharedStrings(zip: JSZip): Promise<string[]> {
  const entry = zip.file("xl/sharedStrings.xml");
  if (!entry) return [];
  const parsed = xml.parse(await entry.async("string")) as any;
  return array(parsed?.sst?.si).map((item) => nodeText(item));
}

function formulaResult(
  cell: Record<string, any>,
  type: string | undefined,
  shared: readonly string[],
): unknown {
  const raw = cell.v;
  if (raw === undefined || raw === null || raw === "") return null;
  const text = nodeText(raw);

  if (type === "s") {
    const index = Number(text);
    return Number.isSafeInteger(index) ? shared[index] ?? null : null;
  }
  if (type === "b") return text === "1";
  if (type === "str" || type === "inlineStr" || type === "e") return text;

  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : text;
}

function parseCell(
  raw: Record<string, any>,
  shared: readonly string[],
  fallbackRow: number,
): FastCell | null {
  const address = String(raw["@_r"] ?? "");
  const column = columnNumber(address);
  if (column <= 0) return null;

  const rowMatch = /\d+$/.exec(address);
  const row = rowMatch ? Number(rowMatch[0]) : fallbackRow;
  const type = raw["@_t"] ? String(raw["@_t"]) : undefined;
  const formula = raw.f !== undefined ? nodeText(raw.f) : null;
  const isFormula = formula !== null;
  let value: unknown = null;
  let text = "";
  let kind: BoqCellKind = "blank";

  if (type === "inlineStr") {
    value = nodeText(raw.is);
    text = String(value ?? "");
    kind = isFormula ? "formula" : "string";
  } else if (type === "s") {
    const index = Number(nodeText(raw.v));
    value = Number.isSafeInteger(index) ? shared[index] ?? "" : "";
    text = String(value ?? "");
    kind = isFormula ? "formula" : "string";
  } else if (type === "b") {
    value = nodeText(raw.v) === "1";
    text = value ? "TRUE" : "FALSE";
    kind = isFormula ? "formula" : "boolean";
  } else if (type === "e") {
    value = nodeText(raw.v);
    text = String(value ?? "");
    kind = isFormula ? "formula" : "error";
  } else if (type === "str") {
    value = nodeText(raw.v);
    text = String(value ?? "");
    kind = isFormula ? "formula" : "string";
  } else {
    const rawText = nodeText(raw.v);
    if (rawText !== "") {
      const numeric = Number(rawText);
      value = Number.isFinite(numeric) ? numeric : rawText;
      text = rawText;
      kind = isFormula
        ? "formula"
        : typeof value === "number"
          ? "number"
          : "string";
    } else if (isFormula) {
      kind = "formula";
    }
  }

  return {
    row,
    column,
    address,
    kind,
    raw: isFormula ? raw.v ?? null : value,
    text,
    formula,
    formulaResult: isFormula
      ? formulaResult(raw, type, shared)
      : null,
  };
}

function cellText(
  rows: Map<number, Map<number, FastCell>>,
  row: number,
  column: number | null,
): string | null {
  if (column === null) return null;
  const value = rows.get(row)?.get(column)?.text.trim() ?? "";
  return value || null;
}

function cellValue(
  rows: Map<number, Map<number, FastCell>>,
  row: number,
  column: number | null,
): unknown {
  if (column === null) return null;
  const cell = rows.get(row)?.get(column);
  if (!cell) return null;
  return cell.kind === "formula" ? cell.formulaResult : cell.raw;
}

function roleColumn(
  roles: Record<number, BoqColumnRole>,
  role: BoqColumnRole,
): number | null {
  for (const [column, mapped] of Object.entries(roles)) {
    if (mapped === role) return Number(column);
  }
  return null;
}

function looksLikeTotal(description: string): boolean {
  const normalized = description.toLowerCase().replace(/\s+/g, " ").trim();
  return (
    /\b(total|subtotal|sub total|carried|brought forward|summary)\b/.test(
      normalized,
    ) || /(الإجمالي|اجمالي|المجموع|مرحّل|مرحل)/.test(normalized)
  );
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

function sourceLocator(
  sheet: FastSheet,
  row: number,
  column: number | null,
) {
  if (column === null) return null;
  const cell = sheet.rows.get(row)?.get(column);
  if (!cell) return null;
  return {
    sheet: sheet.name,
    row,
    column,
    address: cell.address,
  };
}

function parseSegment(
  sheet: FastSheet,
  header: BoqHeaderMapping,
  endRow: number,
): BoqLineItem[] {
  const items: BoqLineItem[] = [];

  for (let row = header.headerRow + 1; row <= endRow; row += 1) {
    const itemNumber = cellText(
      sheet.rows,
      row,
      roleColumn(header.roles, "item_number"),
    );
    const section = cellText(
      sheet.rows,
      row,
      roleColumn(header.roles, "section"),
    );
    const description =
      cellText(
        sheet.rows,
        row,
        roleColumn(header.roles, "description"),
      ) ?? "";
    const unit = cellText(
      sheet.rows,
      row,
      roleColumn(header.roles, "unit"),
    );
    const currency = cellText(
      sheet.rows,
      row,
      roleColumn(header.roles, "currency"),
    );
    const quantityColumn = roleColumn(header.roles, "quantity");
    const rateColumn = roleColumn(header.roles, "rate");
    const amountColumn = roleColumn(header.roles, "amount");

    const quantityRaw = cellValue(sheet.rows, row, quantityColumn);
    const rateRaw = cellValue(sheet.rows, row, rateColumn);
    const amountRaw = cellValue(sheet.rows, row, amountColumn);

    const quantityText = cellText(sheet.rows, row, quantityColumn);
    const rateText = cellText(sheet.rows, row, rateColumn);
    const amountText = cellText(sheet.rows, row, amountColumn);

    if (
      !itemNumber &&
      !section &&
      !description &&
      !unit &&
      quantityText === null &&
      rateText === null &&
      amountText === null &&
      !currency
    ) {
      continue;
    }

    const resolved = resolveBoqCommercialNumerics(
      quantityRaw,
      rateRaw,
      amountRaw,
    );
    const quantity = resolved.quantity;
    const rate = resolved.rate;
    const amount = resolved.amount;
    const diagnostics: string[] = [];

    if (!description) {
      diagnostics.push("BOQ_DESCRIPTION_MISSING");
    }

    for (const [name, column, parsed] of [
      ["QUANTITY", quantityColumn, quantity],
      ["RATE", rateColumn, rate],
      ["AMOUNT", amountColumn, amount],
    ] as const) {
      const source = column === null ? null : sheet.rows.get(row)?.get(column);
      if (!source) continue;
      if (source.kind === "formula" && source.formulaResult === null) {
        diagnostics.push("BOQ_" + name + "_FORMULA_RESULT_MISSING");
      }
      if (parsed.status === "ambiguous") {
        diagnostics.push("BOQ_" + name + "_AMBIGUOUS");
      }
      if (parsed.status === "invalid") {
        diagnostics.push("BOQ_" + name + "_INVALID");
      }
    }

    const hasCommercial =
      quantityText !== null || rateText !== null || amountText !== null;
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
      diagnostics.push("BOQ_AMOUNT_ARITHMETIC_MISMATCH");
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
      const locator = sourceLocator(
        sheet,
        row,
        roleColumn(header.roles, role),
      );
      if (locator) sourceCells[role] = locator;
    }

    items.push({
      sheet: sheet.name,
      row,
      rowKind,
      itemNumber,
      section,
      description,
      unit,
      quantity: quantity.status === "valid" ? quantity.value : null,
      rate: rate.status === "valid" ? rate.value : null,
      amount: amount.status === "valid" ? amount.value : null,
      currency,
      sourceCells,
      status: diagnostics.length === 0 ? "verified" : "unresolved",
      diagnosticCodes: diagnostics,
    });
  }

  return items;
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

function parseSummarySheet(sheet: FastSheet): BoqAuxiliarySheet | null {
  let headerIndex = -1;
  let sectionColumn = -1;
  let descriptionColumn = -1;
  let amountColumn = -1;
  let shareColumn = -1;

  for (
    let index = 0;
    index < Math.min(sheet.rowTexts.length, 40);
    index += 1
  ) {
    const normalized = (sheet.rowTexts[index] ?? []).map(normalizeAuxHeader);
    const section = normalized.findIndex((value) => value === "section");
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
      headerIndex = index;
      sectionColumn = section;
      descriptionColumn = description;
      amountColumn = amount;
      shareColumn = share;
      break;
    }
  }

  if (headerIndex < 0) return null;

  const diagnostics: string[] = [];
  const summaryRows: BoqAuxiliarySheet["summaryRows"] = [];
  let declaredTotalAmount: number | null = null;
  let declaredTotalShare: number | null = null;

  for (let index = headerIndex + 1; index < sheet.rowTexts.length; index += 1) {
    const row = sheet.rowTexts[index] ?? [];
    if (row.every((value) => !value.trim())) continue;

    const section = row[sectionColumn]?.trim() || null;
    const description = row[descriptionColumn]?.trim() ?? "";
    const amount = parseStrictNumeric(row[amountColumn] ?? null);
    const share =
      shareColumn >= 0
        ? parseStrictNumeric(row[shareColumn] ?? null)
        : null;

    if (!description) {
      diagnostics.push(
        "BOQ_SUMMARY_DESCRIPTION_MISSING:" + (index + 1),
      );
      continue;
    }

    if (amount.status !== "valid" || amount.value === null) {
      diagnostics.push(
        "BOQ_SUMMARY_AMOUNT_INVALID:" + (index + 1),
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
          "BOQ_SUMMARY_SHARE_INVALID:" + (index + 1),
        );
      }
    }

    summaryRows.push({
      row: index + 1,
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
    diagnostics.push("BOQ_SUMMARY_INTERNAL_TOTAL_MISMATCH");
  }

  if (
    declaredTotalShare !== null &&
    Math.abs(declaredTotalShare - calculatedShare) > 0.000001
  ) {
    diagnostics.push("BOQ_SUMMARY_SHARE_TOTAL_MISMATCH");
  }

  return {
    sheet: sheet.name,
    kind: "summary",
    rows: sheet.rowTexts
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

function parseSheet(sheet: FastSheet): BoqSheetParseResult {
  const headers = detectAllBoqHeaders(sheet.rowTexts);
  const items: BoqLineItem[] = [];
  const diagnostics: string[] = [];

  if (headers.length === 0) {
    return {
      sheet: sheet.name,
      header: null,
      headers: [],
      candidateRows: 0,
      parsedRows: 0,
      unresolvedRows: 0,
      items,
      diagnostics,
    };
  }

  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index]!;
    const next = headers[index + 1];
    const endRow = next ? next.headerRow - 1 : sheet.rowCount;
    items.push(...parseSegment(sheet, header, endRow));
  }

  const unresolvedRows = items.filter(
    (item) => item.status === "unresolved",
  ).length;

  return {
    sheet: sheet.name,
    header: headers[0] ?? null,
    headers,
    candidateRows: items.length,
    parsedRows: items.length - unresolvedRows,
    unresolvedRows,
    items,
    diagnostics,
  };
}

async function parseFastSheet(
  zip: JSZip,
  path: string,
  name: string,
  state: FastSheet["state"],
  shared: readonly string[],
): Promise<FastSheet> {
  const parsed = await xmlFile(zip, path);
  const worksheet = parsed.worksheet ?? {};
  const dimensions = dimensionCounts(
    worksheet.dimension?.["@_ref"]
      ? String(worksheet.dimension["@_ref"])
      : undefined,
  );
  const rows = new Map<number, Map<number, FastCell>>();
  const hiddenRows: number[] = [];
  let maxRow = dimensions.rows;
  let maxColumn = dimensions.columns;

  for (const rawRow of array<Record<string, any>>(
    worksheet.sheetData?.row,
  )) {
    const rowNumber = Number(rawRow["@_r"] ?? 0);
    if (!Number.isSafeInteger(rowNumber) || rowNumber <= 0) continue;

    if (String(rawRow["@_hidden"] ?? "") === "1") {
      hiddenRows.push(rowNumber);
    }

    const cells = new Map<number, FastCell>();
    for (const rawCell of array<Record<string, any>>(rawRow.c)) {
      const parsedCell = parseCell(rawCell, shared, rowNumber);
      if (!parsedCell) continue;
      cells.set(parsedCell.column, parsedCell);
      maxColumn = Math.max(maxColumn, parsedCell.column);
    }

    rows.set(rowNumber, cells);
    maxRow = Math.max(maxRow, rowNumber);
  }

  const hiddenColumns = new Set<number>();
  for (const col of array<Record<string, any>>(worksheet.cols?.col)) {
    if (String(col["@_hidden"] ?? "") !== "1") continue;
    const min = Number(col["@_min"] ?? 0);
    const max = Number(col["@_max"] ?? min);
    if (!Number.isSafeInteger(min) || min <= 0) continue;
    for (let column = min; column <= max; column += 1) {
      hiddenColumns.add(column);
    }
  }

  const mergeRanges = array<Record<string, any>>(
    worksheet.mergeCells?.mergeCell,
  )
    .map((entry) => String(entry["@_ref"] ?? ""))
    .filter(Boolean);

  const rowTexts: string[][] = new Array(maxRow);
  for (let row = 1; row <= maxRow; row += 1) {
    const values = new Array<string>(maxColumn).fill("");
    const source = rows.get(row);
    if (source) {
      for (const [column, cell] of source) {
        values[column - 1] = cell.text;
      }
    }
    rowTexts[row - 1] = values;
  }

  return {
    name,
    state,
    rowCount: maxRow,
    columnCount: maxColumn,
    mergeRanges,
    hiddenRows,
    hiddenColumns: [...hiddenColumns].sort((a, b) => a - b),
    rows,
    rowTexts,
  };
}

export async function parseBoqOoxmlWorkbook(
  bytes: Uint8Array,
): Promise<BoqParseResult> {
  const zip = await JSZip.loadAsync(bytes);
  const workbookXml = await xmlFile(zip, "xl/workbook.xml");
  const relsXml = await xmlFile(zip, "xl/_rels/workbook.xml.rels");
  const shared = await sharedStrings(zip);

  const relationshipTargets = new Map<string, string>();
  for (const rel of array<Record<string, any>>(
    relsXml.Relationships?.Relationship,
  )) {
    const id = String(rel["@_Id"] ?? "");
    const target = String(rel["@_Target"] ?? "");
    if (id && target) {
      relationshipTargets.set(id, relationshipPath(target));
    }
  }

  const sheets: FastSheet[] = [];
  for (const sheet of array<Record<string, any>>(
    workbookXml.workbook?.sheets?.sheet,
  )) {
    const name = String(sheet["@_name"] ?? "");
    const relId = String(
      sheet["@_r:id"] ??
        sheet["@_id"] ??
        "",
    );
    const path = relationshipTargets.get(relId);
    if (!name || !path) {
      throw new Error(
        "BOQ_OOXML_SHEET_RELATIONSHIP_MISSING:" + name,
      );
    }

    const rawState = String(sheet["@_state"] ?? "visible");
    const state: FastSheet["state"] =
      rawState === "hidden" || rawState === "veryHidden"
        ? rawState
        : "visible";

    sheets.push(
      await parseFastSheet(
        zip,
        path,
        name,
        state,
        shared,
      ),
    );
  }

  const inventorySheets: BoqSheetInventory[] = sheets.map((sheet) => ({
    name: sheet.name,
    state: sheet.state,
    rowCount: sheet.rowCount,
    columnCount: sheet.columnCount,
    mergedRanges: sheet.mergeRanges,
    hiddenRows: sheet.hiddenRows,
    hiddenColumns: sheet.hiddenColumns,
  }));

  const inventory: BoqWorkbookInventory = {
    sheets: inventorySheets,
    totalSheets: inventorySheets.length,
    visibleSheets: inventorySheets.filter(
      (sheet) => sheet.state === "visible",
    ).length,
  };

  const parsedSheets: BoqSheetParseResult[] = [];
  const auxiliarySheets: BoqAuxiliarySheet[] = [];

  for (const sheet of sheets) {
    const summary = parseSummarySheet(sheet);
    const summaryIsAuthoritativeShape =
      summary !== null &&
      (
        /summary|recap|abstract/i.test(sheet.name) ||
        summary.totalShare !== null ||
        summary.summaryRows.some((row) => row.share !== null)
      );

    if (summaryIsAuthoritativeShape && summary) {
      auxiliarySheets.push(summary);
      continue;
    }

    const parsed = parseSheet(sheet);
    if (parsed.headers.length > 0) {
      parsedSheets.push(parsed);
      continue;
    }

    if (summary) {
      auxiliarySheets.push(summary);
      continue;
    }

    let nonEmptyCells = 0;
    for (const row of sheet.rowTexts) {
      for (const value of row) {
        if (value.trim()) nonEmptyCells += 1;
        if (nonEmptyCells >= 6) break;
      }
      if (nonEmptyCells >= 6) break;
    }

    if (nonEmptyCells >= 6) {
      parsed.diagnostics.push("BOQ_POPULATED_SHEET_UNCLASSIFIED");
      parsed.unresolvedRows = 1;
    }
    parsedSheets.push(parsed);
  }

  const candidateRows = parsedSheets.reduce(
    (sum, sheet) => sum + sheet.candidateRows,
    0,
  );
  const parsedRows = parsedSheets.reduce(
    (sum, sheet) => sum + sheet.parsedRows,
    0,
  );
  const unresolvedRows = parsedSheets.reduce(
    (sum, sheet) => sum + sheet.unresolvedRows,
    0,
  );

  const diagnostics = [
    ...parsedSheets.flatMap((sheet) =>
      sheet.diagnostics.map(
        (code) => sheet.sheet + ":" + code,
      ),
    ),
    ...auxiliarySheets.flatMap((sheet) =>
      sheet.diagnostics.map(
        (code) => sheet.sheet + ":" + code,
      ),
    ),
  ];

  const lineItemAmount = parsedSheets
    .flatMap((sheet) => sheet.items)
    .filter(
      (item) =>
        item.rowKind === "line_item" &&
        item.amount !== null,
    )
    .reduce((sum, item) => sum + (item.amount ?? 0), 0);

  for (const summary of auxiliarySheets) {
    if (
      summary.totalAmount !== null &&
      Math.abs(summary.totalAmount - lineItemAmount) >
        Math.max(
          0.02,
          Math.abs(summary.totalAmount) * 0.000001,
        )
    ) {
      diagnostics.push(
        summary.sheet + ":BOQ_SUMMARY_TO_LINE_ITEMS_MISMATCH",
      );
    }
  }

  const denominatorUnknown = diagnostics.some((diagnostic) =>
    diagnostic.endsWith(":BOQ_POPULATED_SHEET_UNCLASSIFIED"),
  );

  const coveragePercent =
    denominatorUnknown || candidateRows === 0
      ? null
      : Number(
          ((parsedRows / candidateRows) * 100).toFixed(4),
        );

  return {
    inventory,
    sheets: parsedSheets,
    auxiliarySheets,
    candidateRows,
    parsedRows,
    unresolvedRows,
    coveragePercent,
    complete:
      candidateRows > 0 &&
      unresolvedRows === 0 &&
      diagnostics.length === 0,
    diagnostics,
  };
}
