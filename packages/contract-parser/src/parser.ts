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

const refreshed=new WeakMap<ContractDocumentResult,ContractDocumentResult>();
/** Recompute derived segmentation from retained source text. Source bytes and
 * authority are unchanged; legal body repetition is never treated as a header. */
export function refreshContractSegmentation(contract:ContractDocumentResult):ContractDocumentResult {
  if(contract.segmentationVersion==='contract-data-rows-v4')return contract;
  const cached=refreshed.get(contract);if(cached)return cached;
  const blocks=contract.pdf?contractBlocksFromPdf(contract.pdf):contract.docx?contractBlocksFromDocx(contract.docx):null;
  if(!blocks)return contract;
  const result=segmentContractTextBlocks(blocks,{sourceType:contract.sourceType,physicalComplete:contract.physicalComplete,
    sourceDiagnostics:contract.pdf?.diagnostics??contract.docx?.diagnostics??[]});
  result.pdf=contract.pdf;result.docx=contract.docx;
  refreshed.set(contract,result);return result;
}

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
