import { PDFParse } from "pdf-parse";
import { detectBoqHeader } from "../../boq-parser/src/headers";
import { parseStrictNumeric } from "../../boq-parser/src/numeric";
import type { BoqColumnRole } from "../../boq-parser/src/types";
import { parsePdfDocument } from "../../pdf-document-parser/src";
import type {
  AiBoqCellEvidence,
  AiBoqTableExtraction,
  BoqPdfLineItem,
  BoqPdfOptions,
  BoqPdfResult,
} from "./types";

function roleColumn(
  roles: Record<number, BoqColumnRole>,
  role: BoqColumnRole,
): number | null {
  const entry = Object.entries(roles).find(([, mapped]) => mapped === role);
  return entry ? Number(entry[0]) : null;
}

function cell(row: readonly string[], column: number | null): string | null {
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

function normalizeEvidence(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s,._:\-\/\\()[\]{}]+/g, "")
    .trim();
}

function validateAiTableEvidence(
  ocrText: string,
  extraction: AiBoqTableExtraction,
): { valid: boolean; rows: string[][]; diagnostics: string[] } {
  const diagnostics: string[] = [];
  const rows: string[][] = [];

  extraction.rows.forEach((row, rowIndex) => {
    const values: string[] = [];
    row.forEach((cell: AiBoqCellEvidence, columnIndex) => {
      values.push(cell.value);

      if (
        !Number.isSafeInteger(cell.sourceStart) ||
        !Number.isSafeInteger(cell.sourceEnd) ||
        cell.sourceStart < 0 ||
        cell.sourceEnd <= cell.sourceStart ||
        cell.sourceEnd > ocrText.length
      ) {
        diagnostics.push(
          "BOQ_AI_SOURCE_SPAN_INVALID:R" +
            (rowIndex + 1) +
            "C" +
            (columnIndex + 1),
        );
        return;
      }

      const exact = ocrText.slice(cell.sourceStart, cell.sourceEnd);
      if (exact !== cell.sourceText) {
        diagnostics.push(
          "BOQ_AI_SOURCE_SPAN_TEXT_MISMATCH:R" +
            (rowIndex + 1) +
            "C" +
            (columnIndex + 1),
        );
        return;
      }

      const normalizedValue = normalizeEvidence(cell.value);
      const normalizedSource = normalizeEvidence(cell.sourceText);
      if (
        normalizedValue &&
        !normalizedSource.includes(normalizedValue) &&
        !normalizedValue.includes(normalizedSource)
      ) {
        diagnostics.push(
          "BOQ_AI_VALUE_NOT_SUPPORTED_BY_SOURCE:R" +
            (rowIndex + 1) +
            "C" +
            (columnIndex + 1),
        );
      }
    });
    rows.push(values);
  });

  return {
    valid: diagnostics.length === 0,
    rows,
    diagnostics,
  };
}

function parseTableRows(
  page: number,
  tableNumber: number,
  rows: readonly (readonly string[])[],
  inheritedDiagnostics: string[] = [],
): { items: BoqPdfLineItem[]; diagnostics: string[] } {
  const diagnostics = [...inheritedDiagnostics];
  const header = detectBoqHeader(rows);
  if (!header) {
    diagnostics.push("BOQ_PDF_TABLE_HEADER_NOT_FOUND");
    return { items: [], diagnostics };
  }

  const items: BoqPdfLineItem[] = [];

  for (let index = header.headerRow; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    if (row.every((value) => !String(value).trim())) continue;

    const itemNumber = cell(row, roleColumn(header.roles, "item_number"));
    const description = cell(row, roleColumn(header.roles, "description")) ?? "";
    const unit = cell(row, roleColumn(header.roles, "unit"));
    const currency = cell(row, roleColumn(header.roles, "currency"));
    const quantityRaw = cell(row, roleColumn(header.roles, "quantity"));
    const rateRaw = cell(row, roleColumn(header.roles, "rate"));
    const amountRaw = cell(row, roleColumn(header.roles, "amount"));

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

    const hasCommercial =
      quantityRaw !== null || rateRaw !== null || amountRaw !== null;
    const rowKind: BoqPdfLineItem["rowKind"] =
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

    const sourceCells: Record<string, {page:number;table:number;row:number;column:number}> = {};
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
        page,
        table: tableNumber,
        row: index + 1,
        column,
      };
    }

    items.push({
      page,
      table: tableNumber,
      row: index + 1,
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
      diagnostics: rowDiagnostics,
    });
  }

  return { items, diagnostics };
}

export async function parseBoqPdf(
  bytes: Uint8Array,
  options: BoqPdfOptions = {},
): Promise<BoqPdfResult> {
  const pageResult = await parsePdfDocument(bytes, {
    ...(options.ocrProvider ? { ocrProvider: options.ocrProvider } : {}),
    ...(options.aiPageVerifier ? { aiVerifier: options.aiPageVerifier } : {}),
  });

  const parser = new PDFParse({ data: Buffer.from(bytes) as any });
  const diagnostics: string[] = [...pageResult.diagnostics];
  const items: BoqPdfLineItem[] = [];
  const unresolvedPages = new Set<number>();
  let nativeTablePages = 0;
  let ocrTablePages = 0;

  try {
    let tableResult: any = null;
    try {
      tableResult = await parser.getTable();
    } catch (error) {
      diagnostics.push(
        "BOQ_PDF_NATIVE_TABLE_EXTRACTION_ERROR:" +
          (error instanceof Error ? error.message : String(error)),
      );
    }

    const tablePageByNumber = new Map<number, any>();
    for (const page of tableResult?.pages ?? []) {
      tablePageByNumber.set(page.num, page);
    }

    for (const page of pageResult.pages) {
      if (page.method === "failed") {
        unresolvedPages.add(page.pageNumber);
        continue;
      }

      if (page.method === "native") {
        const tablePage = tablePageByNumber.get(page.pageNumber);
        const tables: string[][][] = tablePage?.tables ?? [];

        if (tables.length === 0) {
          unresolvedPages.add(page.pageNumber);
          diagnostics.push(
            "BOQ_PDF_NATIVE_PAGE_WITHOUT_STRUCTURED_TABLE:" +
              page.pageNumber,
          );
          continue;
        }

        nativeTablePages += 1;
        tables.forEach((rows, index) => {
          const parsed = parseTableRows(
            page.pageNumber,
            index + 1,
            rows,
          );
          items.push(...parsed.items);
          diagnostics.push(
            ...parsed.diagnostics.map(
              (code) =>
                "P" +
                page.pageNumber +
                "T" +
                (index + 1) +
                ":" +
                code,
            ),
          );
          if (parsed.items.length === 0) {
            unresolvedPages.add(page.pageNumber);
          }
        });
        continue;
      }

      if (page.method === "ocr") {
        if (!options.aiTableExtractor) {
          unresolvedPages.add(page.pageNumber);
          diagnostics.push(
            "BOQ_PDF_OCR_PAGE_REQUIRES_STRUCTURED_TABLE_EXTRACTOR:" +
              page.pageNumber,
          );
          continue;
        }

        let extraction: AiBoqTableExtraction;
        try {
          extraction = await options.aiTableExtractor.extract({
            pageNumber: page.pageNumber,
            ocrText: page.text,
          });
        } catch (error) {
          unresolvedPages.add(page.pageNumber);
          diagnostics.push(
            "BOQ_PDF_AI_TABLE_EXTRACTION_ERROR:" +
              page.pageNumber +
              ":" +
              (error instanceof Error ? error.message : String(error)),
          );
          continue;
        }

        const evidence = validateAiTableEvidence(
          page.text,
          extraction,
        );

        if (!evidence.valid) {
          unresolvedPages.add(page.pageNumber);
          diagnostics.push(
            ...evidence.diagnostics.map(
              (code) =>
                "P" + page.pageNumber + ":" + code,
            ),
          );
          continue;
        }

        const parsed = parseTableRows(
          page.pageNumber,
          1,
          evidence.rows,
          extraction.diagnostics,
        );
        items.push(...parsed.items);
        ocrTablePages += 1;

        if (
          extraction.confidence === null ||
          extraction.confidence < 0.95 ||
          parsed.items.length === 0
        ) {
          unresolvedPages.add(page.pageNumber);
          diagnostics.push(
            "BOQ_PDF_AI_TABLE_REVIEW_REQUIRED:" + page.pageNumber,
          );
        }
      }
    }
  } finally {
    await parser.destroy();
  }

  const unresolvedRows = items.filter(
    (item) => item.status === "unresolved",
  ).length;
  const verifiedRows = items.length - unresolvedRows;

  return {
    totalPages: pageResult.totalPages,
    nativeTablePages,
    ocrTablePages,
    items,
    candidateRows: items.length,
    verifiedRows,
    unresolvedRows,
    unresolvedPages: [...unresolvedPages].sort((a, b) => a - b),
    coveragePercent:
      pageResult.totalPages === 0
        ? null
        : Number(
            (
              ((pageResult.totalPages - unresolvedPages.size) /
                pageResult.totalPages) *
              100
            ).toFixed(4),
          ),
    complete:
      pageResult.complete &&
      items.length > 0 &&
      unresolvedRows === 0 &&
      unresolvedPages.size === 0,
    diagnostics,
  };
}
