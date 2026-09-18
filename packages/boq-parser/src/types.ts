export type BoqCellKind =
  | "blank"
  | "string"
  | "number"
  | "date"
  | "boolean"
  | "formula"
  | "error";

export type BoqColumnRole =
  | "item_number"
  | "description"
  | "unit"
  | "quantity"
  | "rate"
  | "amount"
  | "currency"
  | "section"
  | "unknown";

export interface BoqCellLocator {
  sheet: string;
  row: number;
  column: number;
  address: string;
}

export interface BoqCell {
  locator: BoqCellLocator;
  kind: BoqCellKind;
  raw: unknown;
  text: string;
  formula: string | null;
  formulaResult: unknown;
  mergedRange: string | null;
  hiddenRow: boolean;
  hiddenColumn: boolean;
}

export interface BoqSheetInventory {
  name: string;
  state: "visible" | "hidden" | "veryHidden";
  rowCount: number;
  columnCount: number;
  mergedRanges: string[];
  hiddenRows: number[];
  hiddenColumns: number[];
}

export interface BoqWorkbookInventory {
  sheets: BoqSheetInventory[];
  totalSheets: number;
  visibleSheets: number;
}

export interface BoqHeaderMapping {
  headerRow: number;
  roles: Record<number, BoqColumnRole>;
  score: number;
  diagnostics: string[];
}

export interface StrictNumeric {
  status: "valid" | "ambiguous" | "invalid" | "empty";
  value: number | null;
  raw: string;
  normalized: string | null;
  reason: string | null;
}

export interface BoqLineItem {
  sheet: string;
  row: number;
  rowKind: "line_item" | "section" | "total_or_summary" | "unclassified";
  itemNumber: string | null;
  section: string | null;
  description: string;
  unit: string | null;
  quantity: number | null;
  rate: number | null;
  amount: number | null;
  currency: string | null;
  sourceCells: Partial<Record<BoqColumnRole, BoqCellLocator>>;
  status: "verified" | "unresolved";
  diagnosticCodes: string[];
}

export interface BoqSheetParseResult {
  sheet: string;
  header: BoqHeaderMapping | null;
  headers: BoqHeaderMapping[];
  candidateRows: number;
  parsedRows: number;
  unresolvedRows: number;
  items: BoqLineItem[];
  diagnostics: string[];
}

export interface BoqSummaryRow {
  row: number;
  section: string | null;
  description: string;
  amount: number | null;
  share: number | null;
}

export interface BoqAuxiliarySheet {
  sheet: string;
  kind: "summary" | "metadata";
  rows: Array<{
    row: number;
    cells: string[];
  }>;
  summaryRows: BoqSummaryRow[];
  totalAmount: number | null;
  totalShare: number | null;
  diagnostics: string[];
}

export interface BoqParseResult {
  inventory: BoqWorkbookInventory;
  sheets: BoqSheetParseResult[];
  auxiliarySheets: BoqAuxiliarySheet[];
  candidateRows: number;
  parsedRows: number;
  unresolvedRows: number;
  coveragePercent: number | null;
  complete: boolean;
  diagnostics: string[];
}
