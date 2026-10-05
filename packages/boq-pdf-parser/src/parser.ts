import { detectBoqHeader } from "../../boq-parser/src/headers";
import { parseStrictNumeric, resolveBoqCommercialNumerics } from "../../boq-parser/src/numeric";
import type { BoqColumnRole } from "../../boq-parser/src/types";
import { parsePdfDocument } from "../../pdf-document-parser/src";
import {parseNativeBoqText,parseAlignedNativeBoqText} from './native-text';
import {BOQ_NUMERIC_SOURCE_CONFIRMATION_REQUIRED} from '../../boq-parser/src/numeric-evidence';
import {readRasterBoqTable} from './raster-table';
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
    /\b(?:totalcontractcost|totalcost|grandtotal)\b/.test(normalized) ||
    /^approved budget for (?:the )?contract\b/.test(normalized) ||
    /(الإجمالي|اجمالي|المجموع|مرحّل|مرحل)/.test(normalized);
}

/** Native extraction can split the body below a merged description header.
 * Move role coordinates only across explicitly empty leading subdivisions;
 * never remove cells, infer missing numerics, or shift a nonempty item code. */
function nativeRowRoles(rows: readonly (readonly string[])[], headerRow: number,
  roles: Record<number, BoqColumnRole>, row: readonly string[]): Record<number, BoqColumnRole> {
  const width = rows[headerRow - 1]?.length ?? 0;
  const extra = row.length - width;
  if (extra > 0 && roleColumn(roles, "description") === 1 &&
      row.slice(0, extra).every(value => !value.trim()) && cell(row, extra + 1)) {
    return Object.fromEntries(Object.entries(roles).map(([column, role]) => [Number(column) + extra, role]));
  }
  // A labelled total may merge the description and quantity columns. Retain
  // its one explicit final amount at the original coordinate, not as a unit.
  if (row.length < width && looksLikeTotal(row[0] ?? "") &&
      roleColumn(roles, "amount") === width && row.length >= 2 &&
      row.slice(1, -1).every(value => !value.trim()) &&
      parseStrictNumeric(row.at(-1) ?? "").status === "valid") {
    return {1: "description", [row.length]: "amount"};
  }
  return roles;
}

function arithmeticValid(quantity: number, rate: number, amount: number): boolean {
  const expected = quantity * rate;
  const tolerance = Math.max(0.02, Math.abs(amount) * 0.0001);
  return Math.abs(expected - amount) <= tolerance;
}

function normalizeEvidence(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
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
      // Evidence spans must support the whole cell, including decimals, signs,
      // units and identifiers. Substring/punctuation-insensitive matching can
      // certify 3.00 as 300, -3 as 3, or 100 as 10 even if arithmetic balances.
      if (normalizedValue !== normalizedSource) {
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
  native = false,
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
    // Repeated headings between tables/sections are structure, never priced rows.
    if (detectBoqHeader([row])) continue;
    const roles = native ? nativeRowRoles(rows, header.headerRow, header.roles, row) : header.roles;

    const itemNumber = cell(row, roleColumn(roles, "item_number"));
    const section = cell(row, roleColumn(roles, "section"));
    const description = cell(row, roleColumn(roles, "description")) ?? "";
    const unit = cell(row, roleColumn(roles, "unit"));
    const currency = cell(row, roleColumn(roles, "currency"));
    const quantityRaw = cell(row, roleColumn(roles, "quantity"));
    const rateRaw = cell(row, roleColumn(roles, "rate"));
    const amountRaw = cell(row, roleColumn(roles, "amount"));

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
    if (!description) rowDiagnostics.push("BOQ_DESCRIPTION_MISSING");

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
      "section",
      "description",
      "unit",
      "quantity",
      "rate",
      "amount",
      "currency",
    ] as BoqColumnRole[]) {
      const column = roleColumn(roles, role);
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
      section,
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

async function parseBoqPdfWithOpenProvider(
  bytes: Uint8Array,
  options: BoqPdfOptions = {},
): Promise<BoqPdfResult> {
  const pageResult = await parsePdfDocument(bytes, {
    // This parser owns the provider through structured cell extraction too.
    ...(options.ocrProvider ? { ocrProvider: {name:options.ocrProvider.name,recognize:options.ocrProvider.recognize.bind(options.ocrProvider)} } : {}),
    ...(options.aiPageVerifier ? { aiVerifier: options.aiPageVerifier } : {}),
    ...(options.onProgress?{onPageRead:(page,total)=>options.onProgress!(page.pageNumber,total,'page_read')}:{}),
  });

  const parser = new (await import('pdf-parse')).PDFParse({ data: Buffer.from(bytes) as any });
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
      const nativeTables:string[][][]=tablePageByNumber.get(page.pageNumber)?.tables??[];
      if(page.method==='native'&&nativeTables.length===0){
        const aligned=parseAlignedNativeBoqText(page.pageNumber,page.text);
        if(aligned.length){
          items.push(...aligned);nativeTablePages++;
          unresolvedPages.add(page.pageNumber);
          diagnostics.push('BOQ_NATIVE_ALIGNED_TABLE_RECOVERED:'+page.pageNumber,'BOQ_NATIVE_PAGE_COVERAGE_REVIEW_REQUIRED:'+page.pageNumber);
          continue;
        }
      }
      if(options.ocrProvider&&nativeTables.length===0){
        try{
          const screenshot=await parser.getScreenshot({partial:[page.pageNumber],scale:3,imageBuffer:true,imageDataUrl:false});
          const image=screenshot.pages[0]?.data;
          // A large restored BOQ can spend longer in cell extraction than in
          // page OCR. Report actual successful cell work so the project worker
          // retains its progress/startup watchdog through both reading phases.
          const provider=options.ocrProvider;
          const cellProvider:import('../../pdf-document-parser/src').OcrProvider={name:provider.name,async recognize(image,number,readOptions){
            const result=await provider.recognize(image,number,readOptions);
            options.onProgress?.(page.pageNumber,pageResult.totalPages,'table_read');
            return result;
          }};
          const raster=image?await readRasterBoqTable(image,cellProvider,page.pageNumber):null;
          if(raster){
            const parsed=parseTableRows(page.pageNumber,1,raster.rows);
            for(const item of parsed.items){
              const evidence=raster.cells[item.row-1]??{};
              const issues=raster.diagnostics[item.row-1]??[];
              item.rasterEvidence={rotation:raster.rotation,imageWidth:raster.imageWidth,imageHeight:raster.imageHeight,cells:evidence};
              item.diagnostics.push('BOQ_OFFLINE_RASTER_CELL_EVIDENCE',BOQ_NUMERIC_SOURCE_CONFIRMATION_REQUIRED,...issues);
              item.status='unresolved';
              // A withheld numeric reading is not a section or an empty row.
              // A low-confidence hallucination over an empty ruled cell must
              // not turn a section heading into a new quantity-review item.
              if(item.rowKind==='section'&&(item.unit!==null||['quantity','rate','amount'].some(role=>(evidence[role]??[]).some(c=>c.hasText||[c,c.confirmation,...(c.additionalReadings??[])].some(reading=>reading&&(reading.confidence??0)>=.70&&/^[+\-]?[\d.,\s]+$/.test(reading.text)&&parseStrictNumeric(reading.text).status==='valid')))))item.rowKind='line_item';
              if(issues.length){item.status='unresolved';unresolvedPages.add(page.pageNumber);}
            }
            items.push(...parsed.items);ocrTablePages++;
            diagnostics.push('BOQ_OFFLINE_RASTER_TABLE:'+page.pageNumber,...parsed.diagnostics);
            // Finding one ruled table does not establish complete page coverage.
            // Keep that distinction until every page region has been reconciled.
            unresolvedPages.add(page.pageNumber);
            diagnostics.push('BOQ_RASTER_PAGE_COVERAGE_REVIEW_REQUIRED:'+page.pageNumber);
            continue;
          }
        }catch(error){diagnostics.push('BOQ_RASTER_READING_FAILED:'+page.pageNumber+':'+String(error));}
      }
      if (page.method === "failed") {
        unresolvedPages.add(page.pageNumber);
        continue;
      }

      if (page.method === "native") {
        const tablePage = tablePageByNumber.get(page.pageNumber);
        const tables: string[][][] = tablePage?.tables ?? [];

        if (tables.length === 0) {
          items.push(...parseNativeBoqText(page.pageNumber,page.text));
          unresolvedPages.add(page.pageNumber);
          diagnostics.push(
            "BOQ_PDF_NATIVE_PAGE_WITHOUT_STRUCTURED_TABLE:" +
              page.pageNumber,
          );
          continue;
        }

        nativeTablePages += 1;
        const pageStart=items.length;
        tables.forEach((rows, index) => {
          const parsed = parseTableRows(
            page.pageNumber,
            index + 1,
            rows,
            [],
            true,
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
        if(!items.slice(pageStart).some(item=>item.rowKind==='line_item'))items.push(...parseNativeBoqText(page.pageNumber,page.text));
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
        for(const item of parsed.items){item.status='unresolved';item.diagnostics.push(BOQ_NUMERIC_SOURCE_CONFIRMATION_REQUIRED);}
        unresolvedPages.add(page.pageNumber);
        diagnostics.push(BOQ_NUMERIC_SOURCE_CONFIRMATION_REQUIRED);
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
    pageRead:pageResult,
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

export async function parseBoqPdf(bytes:Uint8Array,options:BoqPdfOptions={}):Promise<BoqPdfResult>{
  try{return await parseBoqPdfWithOpenProvider(bytes,options);}
  finally{await options.ocrProvider?.close?.();}
}
