import {
  detectContractHeading,
  type ContractHeading,
} from "./numbering";
import type {
  ContractAiHeadingInput,
  ContractAiHeadingProposal,
  ContractAiResolver,
  ContractSourceSpan,
  ContractTextBlock,
} from "./types";
import { contractBlocksFromPdf } from "./segmenter";
import type { PdfDocumentResult } from "../../pdf-document-parser/src";

export interface ContractAiHeadingAssessment {
  accepted: boolean;
  heading: ContractHeading | null;
  diagnostics: string[];
}

export function assessContractAiHeadingProposal(
  input: ContractAiHeadingInput,
  proposal: ContractAiHeadingProposal | null,
): ContractAiHeadingAssessment {
  if (!proposal) {
    return {
      accepted: false,
      heading: null,
      diagnostics: ["CONTRACT_AI_NO_PROPOSAL"],
    };
  }

  const diagnostics: string[] = [];
  const span = input.sourceSpan;

  if (
    !Number.isFinite(proposal.confidence) ||
    proposal.confidence < 0 ||
    proposal.confidence > 1
  ) {
    diagnostics.push("CONTRACT_AI_CONFIDENCE_INVALID");
  } else if (proposal.confidence < 0.9) {
    diagnostics.push("CONTRACT_AI_CONFIDENCE_TOO_LOW");
  }

  if (
    proposal.sourceStart !== span.start ||
    proposal.sourceEnd !== span.end ||
    proposal.sourceText !== span.text
  ) {
    diagnostics.push("CONTRACT_AI_SOURCE_SPAN_MISMATCH");
  }

  if (!proposal.identifier.trim()) {
    diagnostics.push("CONTRACT_AI_IDENTIFIER_MISSING");
  }

  // If deterministic parsing now recognizes the same line, AI cannot
  // override it with a conflicting identity.
  const deterministic = detectContractHeading(span.text);
  if (
    deterministic &&
    (
      deterministic.kind !== proposal.kind ||
      deterministic.identifier !== proposal.identifier
    )
  ) {
    diagnostics.push(
      "CONTRACT_AI_CONFLICTS_WITH_DETERMINISTIC_HEADING",
    );
  }

  if (diagnostics.length > 0) {
    return {
      accepted: false,
      heading: null,
      diagnostics,
    };
  }

  return {
    accepted: true,
    heading: {
      kind: proposal.kind,
      identifier: proposal.identifier.trim(),
      contextIdentifier:
        proposal.contextIdentifier?.trim() || null,
      heading: proposal.heading?.trim() || null,
    },
    diagnostics: [],
  };
}

function linesFromBlock(
  block: ContractTextBlock,
): ContractSourceSpan[] {
  const spans: ContractSourceSpan[] = [];
  let cursor = 0;

  for (const line of block.text.split(/\r\n|\n|\r/)) {
    const start = cursor;
    const end = start + line.length;
    spans.push({
      sourceKind: block.sourceKind,
      sourceIndex: block.sourceIndex,
      page: block.page,
      block: block.block,
      start,
      end,
      text: line,
    });
    cursor = end + 1;
  }

  return spans;
}

function lineKey(span: ContractSourceSpan): string {
  return [
    span.sourceKind,
    span.sourceIndex,
    span.start,
    span.end,
  ].join(":");
}

function looksAmbiguousHeading(value: string): boolean {
  const text = value.trim();
  if (!text || text.length > 220) return false;
  if (detectContractHeading(text)) return false;

  return (
    /^(?:clause|article|section|appendix|annex|schedule|amendment|part|chapter|المادة|البند|القسم|ملحق|المرفق|جدول)\b/i.test(
      text,
    ) ||
    /^[0-9]+(?:\.[0-9]+){0,8}\s*[-–—:]\s*[^0-9]/.test(
      text,
    )
  );
}

export async function collectAiHeadingOverrides(
  blocks: readonly ContractTextBlock[],
  resolver: ContractAiResolver,
): Promise<{
  overrides: Map<string, ContractHeading>;
  diagnostics: string[];
}> {
  const overrides = new Map<string, ContractHeading>();
  const diagnostics: string[] = [];
  let previousSection: ContractAiHeadingInput["previousSection"] =
    null;

  const spans = blocks.flatMap(linesFromBlock);

  for (let index = 0; index < spans.length; index += 1) {
    const span = spans[index]!;
    if (!looksAmbiguousHeading(span.text)) continue;

    const nextText =
      spans
        .slice(index + 1, index + 4)
        .find((candidate) => candidate.text.trim())
        ?.text ?? null;

    let proposal: ContractAiHeadingProposal | null = null;
    try {
      proposal = await resolver.resolveHeading({
        sourceSpan: span,
        previousSection,
        nextText,
      });
    } catch (error) {
      diagnostics.push(
        "CONTRACT_AI_RESOLVER_ERROR:" +
          (error instanceof Error
            ? error.message
            : String(error)),
      );
      continue;
    }

    const assessment = assessContractAiHeadingProposal(
      {
        sourceSpan: span,
        previousSection,
        nextText,
      },
      proposal,
    );

    if (!assessment.accepted || !assessment.heading) {
      diagnostics.push(
        ...assessment.diagnostics.map(
          (code) =>
            code +
            ":" +
            span.sourceKind +
            ":" +
            span.sourceIndex +
            ":" +
            span.start,
        ),
      );
      continue;
    }

    overrides.set(lineKey(span), assessment.heading);
    previousSection = {
      kind: assessment.heading.kind,
      identifier: assessment.heading.identifier,
      contextKey:
        assessment.heading.contextIdentifier ?? "ai",
      heading: assessment.heading.heading,
    };
  }

  return { overrides, diagnostics };
}

export async function collectPdfAiHeadingOverrides(
  pdf: PdfDocumentResult,
  resolver: ContractAiResolver,
) {
  return collectAiHeadingOverrides(
    contractBlocksFromPdf(pdf),
    resolver,
  );
}
