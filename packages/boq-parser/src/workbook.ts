import ExcelJS from "exceljs";
import type {
  BoqCell,
  BoqCellKind,
  BoqSheetInventory,
  BoqWorkbookInventory,
} from "./types";

function cellKind(cell: ExcelJS.Cell): BoqCellKind {
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
    case ExcelJS.ValueType.Formula:
      return "formula";
    case ExcelJS.ValueType.Error:
      return "error";
    default:
      return "string";
  }
}

function formulaInfo(cell: ExcelJS.Cell): { formula: string | null; result: unknown } {
  const value = cell.value as any;
  if (value && typeof value === "object" && typeof value.formula === "string") {
    return {
      formula: value.formula,
      result: value.result ?? null,
    };
  }
  if (value && typeof value === "object" && typeof value.sharedFormula === "string") {
    return {
      formula: value.sharedFormula,
      result: value.result ?? null,
    };
  }
  return { formula: null, result: null };
}

export function readBoqCell(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnNumber: number,
): BoqCell {
  const cell = worksheet.getRow(rowNumber).getCell(columnNumber);
  const formula = formulaInfo(cell);
  const master = cell.isMerged ? cell.master : null;
  const mergedRange =
    master && master.address !== cell.address
      ? master.address
      : cell.isMerged
        ? cell.address
        : null;

  return {
    locator: {
      sheet: worksheet.name,
      row: rowNumber,
      column: columnNumber,
      address: cell.address,
    },
    kind: cellKind(cell),
    raw: cell.value,
    text: cell.text ?? "",
    formula: formula.formula,
    formulaResult: formula.result,
    mergedRange,
    hiddenRow: worksheet.getRow(rowNumber).hidden === true,
    hiddenColumn: worksheet.getColumn(columnNumber).hidden === true,
  };
}

export async function loadBoqWorkbook(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as any);
  return workbook;
}

function mergedRanges(worksheet: ExcelJS.Worksheet): string[] {
  const model = worksheet.model as unknown as { merges?: string[] };
  return [...(model.merges ?? [])];
}

export function inventoryBoqWorkbook(workbook: ExcelJS.Workbook): BoqWorkbookInventory {
  const sheets: BoqSheetInventory[] = workbook.worksheets.map((worksheet) => {
    const hiddenRows: number[] = [];
    for (let row = 1; row <= worksheet.rowCount; row += 1) {
      if (worksheet.getRow(row).hidden) hiddenRows.push(row);
    }

    const hiddenColumns: number[] = [];
    for (let column = 1; column <= worksheet.columnCount; column += 1) {
      if (worksheet.getColumn(column).hidden) hiddenColumns.push(column);
    }

    return {
      name: worksheet.name,
      state: worksheet.state ?? "visible",
      rowCount: worksheet.rowCount,
      columnCount: worksheet.columnCount,
      mergedRanges: mergedRanges(worksheet),
      hiddenRows,
      hiddenColumns,
    };
  });

  return {
    sheets,
    totalSheets: sheets.length,
    visibleSheets: sheets.filter((sheet) => sheet.state === "visible").length,
  };
}
