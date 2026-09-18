import { parsePdfDocument } from "../../pdf-document-parser/src";
import {
  contractBlocksFromPdf,
  segmentContractTextBlocks,
} from "./segmenter";
import {
  contractBlocksFromDocx,
  parseContractDocxSource,
} from "./docx";
import { collectAiHeadingOverrides } from "./ai";
import type {
  ContractDocumentResult,
  ContractParseOptions,
} from "./types";

export async function parseContractPdf(
  bytes: Uint8Array,
  options: ContractParseOptions = {},
): Promise<ContractDocumentResult> {
  const pdf = await parsePdfDocument(bytes, {
    ...(options.ocrProvider
      ? { ocrProvider: options.ocrProvider }
      : {}),
    ...(options.aiPageVerifier
      ? { aiVerifier: options.aiPageVerifier }
      : {}),
  });

  const blocks = contractBlocksFromPdf(pdf);
  let headingOverrides:
    | Map<string, import("./numbering").ContractHeading>
    | undefined;
  const diagnostics = [...pdf.diagnostics];

  if (options.aiResolver) {
    const ai = await collectAiHeadingOverrides(
      blocks,
      options.aiResolver,
    );
    headingOverrides = ai.overrides;
    diagnostics.push(...ai.diagnostics);
  }

  const result = segmentContractTextBlocks(blocks, {
    sourceType: "pdf",
    physicalComplete: pdf.complete,
    sourceDiagnostics: diagnostics,
    ...(headingOverrides
      ? { headingOverrides }
      : {}),
  });
  result.pdf = pdf;
  return result;
}

export async function parseContractDocx(
  bytes: Uint8Array,
  options: ContractParseOptions = {},
): Promise<ContractDocumentResult> {
  const docx = await parseContractDocxSource(bytes);
  const blocks = contractBlocksFromDocx(docx);
  let headingOverrides:
    | Map<string, import("./numbering").ContractHeading>
    | undefined;
  const diagnostics = [...docx.diagnostics];

  if (options.aiResolver) {
    const ai = await collectAiHeadingOverrides(
      blocks,
      options.aiResolver,
    );
    headingOverrides = ai.overrides;
    diagnostics.push(...ai.diagnostics);
  }

  const result = segmentContractTextBlocks(blocks, {
    sourceType: "docx",
    physicalComplete: docx.complete,
    sourceDiagnostics: diagnostics,
    ...(headingOverrides
      ? { headingOverrides }
      : {}),
  });
  result.docx = docx;
  return result;
}
