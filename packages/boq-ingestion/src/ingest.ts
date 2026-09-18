import { createHash } from "node:crypto";

import {
  createSourceManifest,
  evidenceReceiptFromUpload,
} from "../../governance-model/src";
import {
  parseBoqOoxmlWorkbook,
} from "../../boq-parser/src";
import {
  parseBoqPdf,
  type BoqPdfOptions,
} from "../../boq-pdf-parser/src";
import type {
  BoqIngestionInput,
  BoqIngestionResult,
  BoqSourceFormat,
  CanonicalBoqCommercialItem,
} from "./types";

const EXCEL_MEDIA_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
]);

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function stableId(prefix: string, hash: string): string {
  return prefix + "_" + hash.slice(0, 24);
}

function startsWith(
  bytes: Uint8Array,
  signature: readonly number[],
): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every(
    (value, index) => bytes[index] === value,
  );
}

function detectedFormat(
  bytes: Uint8Array,
  verifiedMediaType: string,
): BoqSourceFormat {
  if (
    startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])
  ) {
    return "pdf";
  }

  if (
    startsWith(bytes, [0x50, 0x4b]) &&
    EXCEL_MEDIA_TYPES.has(verifiedMediaType)
  ) {
    return "excel_ooxml";
  }

  if (
    verifiedMediaType.toLowerCase().includes("text/csv") ||
    verifiedMediaType.toLowerCase().includes("application/csv")
  ) {
    return "csv";
  }

  throw new Error(
    "BOQ_MEDIA_UNSUPPORTED_OR_SIGNATURE_MISMATCH:" +
      verifiedMediaType,
  );
}

function excelSourceRefs(
  receiptId: string,
  item: {
    sheet: string;
    row: number;
    sourceCells: Record<string, {
      sheet: string;
      row: number;
      column: number;
      address: string;
    }> | Partial<Record<string, {
      sheet: string;
      row: number;
      column: number;
      address: string;
    }>>;
  },
): string[] {
  const refs = ["evidence-receipt:" + receiptId];
  const locators = Object.values(item.sourceCells)
    .filter(
      (
        locator,
      ): locator is {
        sheet: string;
        row: number;
        column: number;
        address: string;
      } => Boolean(locator),
    )
    .map(
      (locator) =>
        "excel:" +
        locator.sheet +
        "!" +
        locator.address,
    );

  return [...new Set([
    ...refs,
    ...locators,
    "excel:" + item.sheet + ":row:" + item.row,
  ])];
}

function pdfSourceRefs(
  receiptId: string,
  item: {
    page: number;
    table: number;
    row: number;
    sourceCells: Record<string, {
      page: number;
      table: number;
      row: number;
      column: number;
    }>;
  },
): string[] {
  const refs = [
    "evidence-receipt:" + receiptId,
    "pdf:page:" +
      item.page +
      ":table:" +
      item.table +
      ":row:" +
      item.row,
  ];

  for (const locator of Object.values(item.sourceCells)) {
    refs.push(
      "pdf:page:" +
        locator.page +
        ":table:" +
        locator.table +
        ":row:" +
        locator.row +
        ":column:" +
        locator.column,
    );
  }

  return [...new Set(refs)];
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const value = text[index]!;
    if (quoted) {
      if (value === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += value;
      }
      continue;
    }

    if (value === '"') quoted = true;
    else if (value === ",") {
      row.push(field);
      field = "";
    } else if (value === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += value;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function headerKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function csvNumber(value: string | undefined): number | null {
  const normalized = (value ?? "")
    .trim()
    .replace(/,/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function csvColumn(
  headers: string[],
  candidates: readonly string[],
): number {
  const wanted = new Set(candidates.map(headerKey));
  return headers.findIndex((header) =>
    wanted.has(headerKey(header)),
  );
}

function currencyFromHeaders(headers: string[]): string | null {
  for (const header of headers) {
    const match = /^(?:rate|amount)\s+([a-z]{3})$/i.exec(header.trim());
    if (match) return match[1]!.toUpperCase();
  }
  return null;
}

function itemId(
  hash: string,
  sourceFormat: BoqSourceFormat,
  sourceKey: string,
): string {
  return stableId(
    "boqitem",
    createHash("sha256")
      .update(hash)
      .update("|")
      .update(sourceFormat)
      .update("|")
      .update(sourceKey)
      .digest("hex"),
  );
}

export async function ingestBoq(
  input: BoqIngestionInput,
  options: {
    pdf?: BoqPdfOptions;
  } = {},
): Promise<BoqIngestionResult> {
  if (!input.projectId.trim()) {
    throw new Error("BOQ_PROJECT_ID_REQUIRED");
  }
  if (input.bytes.length === 0) {
    throw new Error("BOQ_UPLOAD_EMPTY");
  }

  const hash = sha256(input.bytes);
  const sourceFormat = detectedFormat(
    input.bytes,
    input.verifiedMediaType,
  );
  const documentId =
    input.documentId?.trim() ||
    stableId("doc", hash);
  const revisionId =
    input.revisionId?.trim() ||
    stableId("rev", hash);
  const objectId =
    input.objectId?.trim() ||
    stableId("obj", hash);

  const sourceManifest = createSourceManifest(
    input.projectId,
    [{
      documentId,
      revisionId,
      objectId,
      sha256: hash,
      role: "boq",
    }],
    input.receivedAt,
  );

  const evidenceReceipt = evidenceReceiptFromUpload(
    {
      projectId: input.projectId,
      documentId,
      revisionId,
      objectId,
      sha256: hash,
      role: "boq",
      receivedAt: input.receivedAt,
    },
    sourceManifest,
  );

  let candidateRows = 0;
  let verifiedRows = 0;
  let unresolvedRows = 0;
  let coveragePercent: number | null = null;
  let complete = false;
  let diagnostics: string[] = [];
  let canonicalItems: CanonicalBoqCommercialItem[] = [];

  if (sourceFormat === "csv") {
    const text = Buffer.from(input.bytes)
      .toString("utf8")
      .replace(/^\uFEFF/, "");
    const rows = parseCsv(text);
    const headers = rows[0] ?? [];
    const itemIndex = csvColumn(headers, [
      "item no",
      "item number",
      "item",
      "boq item",
    ]);
    const sectionIndex = csvColumn(headers, ["section"]);
    const descriptionIndex = csvColumn(headers, [
      "description",
      "item description",
      "scope description",
    ]);
    const unitIndex = csvColumn(headers, ["unit", "uom"]);
    const quantityIndex = csvColumn(headers, ["quantity", "qty"]);
    const rateIndex = headers.findIndex((value) =>
      /^rate(?:\s+[a-z]{3})?$/i.test(value.trim()),
    );
    const amountIndex = headers.findIndex((value) =>
      /^amount(?:\s+[a-z]{3})?$/i.test(value.trim()),
    );
    const currencyIndex = csvColumn(headers, ["currency"]);
    const headerCurrency = currencyFromHeaders(headers);

    const dataRows = rows.slice(1).filter((row) =>
      row.some((value) => value.trim() !== ""),
    );
    candidateRows = dataRows.length;

    canonicalItems = dataRows.flatMap((row, offset) => {
      const description =
        descriptionIndex >= 0
          ? (row[descriptionIndex] ?? "").trim()
          : "";
      if (!description) {
        unresolvedRows += 1;
        return [];
      }
      const rowNumber = offset + 2;
      const itemNumber =
        itemIndex >= 0
          ? (row[itemIndex] ?? "").trim() || null
          : null;
      const currency =
        currencyIndex >= 0
          ? (row[currencyIndex] ?? "").trim().toUpperCase() || headerCurrency
          : headerCurrency;
      verifiedRows += 1;
      return [{
        itemId: itemId(
          hash,
          sourceFormat,
          "row:" + rowNumber,
        ),
        itemNumber,
        section:
          sectionIndex >= 0
            ? (row[sectionIndex] ?? "").trim() || null
            : null,
        description,
        unit:
          unitIndex >= 0
            ? (row[unitIndex] ?? "").trim() || null
            : null,
        quantity:
          quantityIndex >= 0
            ? csvNumber(row[quantityIndex])
            : null,
        rate:
          rateIndex >= 0
            ? csvNumber(row[rateIndex])
            : null,
        amount:
          amountIndex >= 0
            ? csvNumber(row[amountIndex])
            : null,
        currency,
        sourceFormat,
        sourceRefs: [
          "evidence-receipt:" + evidenceReceipt.receiptId,
          "csv:row:" + rowNumber,
        ],
        status: "verified" as const,
        diagnostics: [],
      }];
    });

    coveragePercent =
      candidateRows === 0
        ? null
        : (verifiedRows / candidateRows) * 100;
    complete =
      candidateRows > 0 &&
      unresolvedRows === 0 &&
      canonicalItems.length === candidateRows;
    diagnostics = [
      ...(headers.length === 0
        ? ["BOQ_CSV_HEADER_MISSING"]
        : []),
      ...(descriptionIndex < 0
        ? ["BOQ_CSV_DESCRIPTION_COLUMN_MISSING"]
        : []),
    ];
  } else if (sourceFormat === "excel_ooxml") {
    const parsed = await parseBoqOoxmlWorkbook(
      input.bytes,
    );
    candidateRows = parsed.candidateRows;
    verifiedRows = parsed.parsedRows;
    unresolvedRows = parsed.unresolvedRows;
    coveragePercent = parsed.coveragePercent;
    complete = parsed.complete;
    diagnostics = [...parsed.diagnostics];

    canonicalItems = parsed.sheets.flatMap((sheet) =>
      sheet.items
        .filter((item) => item.rowKind === "line_item")
        .map((item) => ({
          itemId: itemId(
            hash,
            sourceFormat,
            item.sheet + ":" + item.row,
          ),
          itemNumber: item.itemNumber,
          section: item.section ?? null,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
          currency: item.currency,
          sourceFormat,
          sourceRefs: excelSourceRefs(
            evidenceReceipt.receiptId,
            item,
          ),
          status: item.status,
          diagnostics: [...item.diagnosticCodes],
        })),
    );
  } else {
    const parsed = await parseBoqPdf(
      input.bytes,
      options.pdf ?? {},
    );
    candidateRows = parsed.candidateRows;
    verifiedRows = parsed.verifiedRows;
    unresolvedRows = parsed.unresolvedRows;
    coveragePercent = parsed.coveragePercent;
    complete = parsed.complete;
    diagnostics = [...parsed.diagnostics];

    canonicalItems = parsed.items
      .filter((item) => item.rowKind === "line_item")
      .map((item) => ({
        itemId: itemId(
          hash,
          sourceFormat,
          "p" +
            item.page +
            ":t" +
            item.table +
            ":r" +
            item.row,
        ),
        itemNumber: item.itemNumber,
        section: item.section,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
        currency: item.currency,
        sourceFormat,
        sourceRefs: pdfSourceRefs(
          evidenceReceipt.receiptId,
          item,
        ),
        status: item.status,
        diagnostics: [...item.diagnostics],
      }));
  }

  const state =
    complete
      ? "verified_candidate"
      : candidateRows > 0 || canonicalItems.length > 0
        ? "partial_candidate"
        : "unavailable";

  return {
    ingestionId: stableId(
      "boqingest",
      createHash("sha256")
        .update(input.projectId)
        .update("|")
        .update(hash)
        .digest("hex"),
    ),
    projectId: input.projectId,
    sourceFormat,
    mediaType: input.verifiedMediaType,
    sourceFilename:
      input.sourceFilename?.trim() || null,
    sourceHashSha256: hash,
    sourceManifest,
    evidenceReceipt,
    authority: "candidate_only",
    persistence: "runtime_local",
    state,
    candidateRows,
    verifiedRows,
    unresolvedRows,
    coveragePercent,
    complete,
    canonicalItems,
    diagnostics,
    receivedAt: input.receivedAt,
  };
}
