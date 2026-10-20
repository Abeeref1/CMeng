import { parsePdfDocument } from "../../pdf-document-parser/src";
import {
  contractBlocksFromPdf,
  segmentContractTextBlocks,
} from "./segmenter";
import {
  contractBlocksFromDocx,
  parseContractDocxSource,
} from "./docx";
import {
  contractBlocksFromText,
  parseContractTextSource,
} from "./text";
import { collectAiHeadingOverrides } from "./ai";
import type {
  ContractDocumentResult,
  ContractParseOptions,
  ContractSourceType,
  ContractTextBlock,
  ContractTextSource,
} from "./types";

const refreshed=new WeakMap<ContractDocumentResult,ContractDocumentResult>();
/** Recompute derived segmentation from retained source text. Source bytes and
 * authority are unchanged; legal body repetition is never treated as a header. */
export function refreshContractSegmentation(contract:ContractDocumentResult):ContractDocumentResult {
  if(contract.segmentationVersion==='contract-data-rows-v6')return contract;
  const cached=refreshed.get(contract);if(cached)return cached;
  const blocks=contract.pdf?contractBlocksFromPdf(contract.pdf):contract.docx?contractBlocksFromDocx(contract.docx):contract.text?contractBlocksFromText(contract.text):null;
  if(!blocks)return contract;
  const result=segmentContractTextBlocks(blocks,{sourceType:contract.sourceType,physicalComplete:contract.physicalComplete,
    sourceDiagnostics:contract.pdf?.diagnostics??contract.docx?.diagnostics??contract.text?.diagnostics??[]});
  result.pdf=contract.pdf;result.docx=contract.docx;if(contract.text)result.text=contract.text;
  // A retained, earlier deterministic reading is still source evidence.
  // Native/PDF refresh may have only part of the document (for example its
  // later scanned pages), and previously this resegmentation silently erased
  // the extracted contract completion or EOT clause. Never discard source
  // sections just because the second pass has incomplete native text.
  const represented=(text:string)=>result.sections.some(section=>
    section.text.trim().includes(text.trim())||text.trim().includes(section.text.trim())&&section.text.trim().length>=text.trim().length*0.9);
  const missing=(contract.sections??[]).filter(section=>
    section.sourceMode==='deterministic'&&section.text.trim()&&!represented(section.text));
  if(missing.length){
    result.sections=[...result.sections,...missing];
    result.clauses=[...result.clauses,...missing.filter(s=>s.kind==='clause')];
    result.appendices=[...result.appendices,...missing.filter(s=>s.kind==='appendix')];
    result.semanticComplete=false;result.complete=false;
    result.diagnostics=[...result.diagnostics,'RETAINED_DETERMINISTIC_SECTIONS_NOT_PRESENT_IN_SECOND_PASS:'+missing.length];
  }
  refreshed.set(contract,result);return result;
}

/** The one contract text reader. Every source format reaches it after its own
 * text extraction (PDF pages, Word paragraphs and table cells, plain-text or
 * Markdown pages): optional AI heading reading on the exact source spans, then
 * the shared clause segmentation. */
async function readContractTextBlocks(
  blocks: readonly ContractTextBlock[],
  source: {
    sourceType: ContractSourceType;
    physicalComplete: boolean;
    diagnostics: readonly string[];
  },
  options: ContractParseOptions,
): Promise<ContractDocumentResult> {
  let headingOverrides:
    | Map<string, import("./numbering").ContractHeading>
    | undefined;
  const diagnostics = [...source.diagnostics];

  if (options.aiResolver) {
    const ai = await collectAiHeadingOverrides(
      blocks,
      options.aiResolver,
      {
        ...(options.aiMaxCalls !== undefined
          ? { maxCalls: options.aiMaxCalls }
          : {}),
        ...(options.onAiStep
          ? { onStep: options.onAiStep }
          : {}),
      },
    );
    headingOverrides = ai.overrides;
    diagnostics.push(...ai.diagnostics);
  }

  return segmentContractTextBlocks(blocks, {
    sourceType: source.sourceType,
    physicalComplete: source.physicalComplete,
    sourceDiagnostics: diagnostics,
    ...(headingOverrides
      ? { headingOverrides }
      : {}),
  });
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
  const result = await readContractTextBlocks(
    contractBlocksFromPdf(pdf),
    { sourceType: "pdf", physicalComplete: pdf.complete, diagnostics: pdf.diagnostics },
    options,
  );
  result.pdf = pdf;
  return result;
}

export async function parseContractDocx(
  bytes: Uint8Array,
  options: ContractParseOptions = {},
): Promise<ContractDocumentResult> {
  const docx = await parseContractDocxSource(bytes);
  const result = await readContractTextBlocks(
    contractBlocksFromDocx(docx),
    { sourceType: "docx", physicalComplete: docx.complete, diagnostics: docx.diagnostics },
    options,
  );
  result.docx = docx;
  return result;
}

/** A plain-text or Markdown contract: its decoded text goes through the same
 * reader as PDF page text. Physically complete only when the whole text was
 * decoded. Reading never adopts a contract or any of its terms. */
export async function parseContractText(
  bytes: Uint8Array,
  options: ContractParseOptions & { format?: ContractTextSource["format"] } = {},
): Promise<ContractDocumentResult> {
  const text = parseContractTextSource(bytes, options.format ?? "plain");
  const result = await readContractTextBlocks(
    contractBlocksFromText(text),
    { sourceType: "text", physicalComplete: text.complete, diagnostics: text.diagnostics },
    options,
  );
  result.text = text;
  return result;
}

/** The same text contract reading without the optional AI heading step, as one
 * synchronous call: used to read a stored text contract again from its
 * unchanged source bytes. It gives the same result as parseContractText
 * without an AI resolver. */
export function readContractText(
  bytes: Uint8Array,
  format: ContractTextSource["format"] = "plain",
): ContractDocumentResult {
  const text = parseContractTextSource(bytes, format);
  const result = segmentContractTextBlocks(contractBlocksFromText(text), {
    sourceType: "text",
    physicalComplete: text.complete,
    sourceDiagnostics: [...text.diagnostics],
  });
  result.text = text;
  return result;
}
