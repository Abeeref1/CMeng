import { parsePdfDocument } from "../../pdf-document-parser/src";
import { segmentContractPages } from "./segmenter";
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

  return segmentContractPages(pdf);
}
