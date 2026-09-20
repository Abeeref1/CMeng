import type {
  ContractDocumentResult,
  ContractSection,
} from "../../contract-parser/src";
import type {
  ContractTimeBasis,
} from "../../eot-assessment/src";

export interface ContractTimeDocumentInput {
  documentId: string;
  role: "main" | "amendment" | "replacement" | "other";
  result: ContractDocumentResult;
}

function sourceRefs(
  documentId: string,
  section: ContractSection,
): string[] {
  if (section.sourceSpans.length === 0) {
    return ["contract-document:" + documentId + ":section:" + section.sectionKey];
  }
  return section.sourceSpans.map(
    (span) =>
      "contract-document:" +
      documentId +
      ":" +
      span.sourceKind +
      ":" +
      span.sourceIndex,
  );
}

function parseDate(raw: string): string | null {
  const parsed = Date.parse(raw.trim());
  return Number.isFinite(parsed)
    ? new Date(parsed).toISOString()
    : null;
}

function findDate(
  document: ContractTimeDocumentInput,
  patterns: RegExp[],
): {
  value: string | null;
  sourceRefs: string[];
} {
  for (const section of document.result.sections) {
    const text = [section.heading ?? "", section.text].join("\n");
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (!match?.[1]) continue;
      const value = parseDate(match[1]);
      if (value) {
        return {
          value,
          sourceRefs: sourceRefs(document.documentId, section),
        };
      }
    }
  }
  return { value: null, sourceRefs: [] };
}

function findDays(
  document: ContractTimeDocumentInput,
  patterns: RegExp[],
): {
  value: number | null;
  sourceRefs: string[];
} {
  for (const section of document.result.sections) {
    const text = [section.heading ?? "", section.text].join("\n");
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      const value = match?.[1] ? Number(match[1].replace(/,/g, "")) : Number.NaN;
      if (Number.isFinite(value)) {
        return {
          value,
          sourceRefs: sourceRefs(document.documentId, section),
        };
      }
    }
  }
  return { value: null, sourceRefs: [] };
}

export function extractContractTimeBasis(
  input: {
    base: ContractTimeDocumentInput | null;
    amendments: ContractTimeDocumentInput[];
  },
): ContractTimeBasis {
  const original = input.base
    ? findDate(input.base, [
        /\boriginal\s+(?:contractual\s+)?completion\b[^\n\r\d]{0,80}([0-3]?\d\s+[A-Za-z]+\s+20\d{2})/i,
        /\btime\s+for\s+completion\b[^\n\r\d]{0,120}([0-3]?\d\s+[A-Za-z]+\s+20\d{2})/i,
      ])
    : { value: null, sourceRefs: [] };

  const amendmentCandidates = input.amendments.map((amendment) => {
    const effective = findDate(amendment, [
      /\beffective\s+date\b[^\n\r\d]{0,80}([0-3]?\d\s+[A-Za-z]+\s+20\d{2})/i,
    ]);
    const completion = findDate(amendment, [
      /\brevised\s+contractual\s+completion\b[^\n\r\d]{0,80}([0-3]?\d\s+[A-Za-z]+\s+20\d{2})/i,
      /\brevised\s+(?:contract\s+)?completion\b[^\n\r\d]{0,80}([0-3]?\d\s+[A-Za-z]+\s+20\d{2})/i,
      /\brevised\s+contractual\s+completion\s+date\s+is\s+([0-3]?\d\s+[A-Za-z]+\s+20\d{2})/i,
    ]);
    const granted = findDays(amendment, [
      /\bEOT\s+Granted\b[^\n\r\d]{0,50}(\d+(?:\.\d+)?)\s*(?:calendar\s+days?|days?)?/i,
      /\bextended\s+by\s+(\d+(?:\.\d+)?)\s+calendar\s+days?\b/i,
    ]);
    return {
      amendment,
      effective,
      completion,
      granted,
    };
  });

  amendmentCandidates.sort((a, b) =>
    (a.effective.value ?? "").localeCompare(b.effective.value ?? ""),
  );
  const controlling = amendmentCandidates
    .filter((item) => item.completion.value !== null || item.granted.value !== null)
    .at(-1) ?? null;

  const contractualCompletionIso =
    controlling?.completion.value ??
    original.value;

  const refs = new Set<string>([
    ...original.sourceRefs,
    ...(controlling?.effective.sourceRefs ?? []),
    ...(controlling?.completion.sourceRefs ?? []),
    ...(controlling?.granted.sourceRefs ?? []),
  ]);

  return {
    originalContractualCompletionIso: original.value,
    contractualCompletionIso,
    contractualCompletionState:
      contractualCompletionIso ? "official" : "missing",
    controllingAmendmentId:
      controlling?.amendment.documentId ?? null,
    controllingAmendmentEffectiveAtIso:
      controlling?.effective.value ?? null,
    incorporatedAmendmentEotDays:
      controlling?.granted.value ?? null,
    incorporatedAmendmentEotState:
      controlling?.granted.value !== null ? "official" : "missing",
    officialApprovedEotDays: null,
    officialApprovedEotState: "missing",
    engineerDeterminations: [],
    engineerDeterminationCount: 0,
    engineerDeterminationAwardedDaysTotal: null,
    determinationAggregationState: "not_submitted",
    eotDayBasis: "calendar_days",
    eotDayBasisState:
      controlling?.granted.value !== null ? "official" : "provisional",
    sourceRefs: [...refs],
  };
}
