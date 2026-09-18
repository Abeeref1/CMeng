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

  if (sourceFormat === "excel_ooxml") {
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
