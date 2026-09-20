import type {
  ContractDocumentResult,
  ContractSection,
} from "../../contract-parser/src";
import type {
  NoticeRequirement,
} from "../../delay-analysis-core/src";

export interface ContractNoticeDocumentInput {
  documentId: string;
  role: "main" | "amendment" | "replacement" | "other";
  result: ContractDocumentResult;
}

function refs(
  documentId: string,
  section: ContractSection,
) {
  if (section.sourceSpans.length === 0) {
    return [{
      sourceType: "contract" as const,
      sourceId: documentId,
      locator:
        "section:" +
        section.sectionKey,
    }];
  }
  return section.sourceSpans.map(
    (span) => ({
      sourceType: "contract" as const,
      sourceId: documentId,
      locator:
        span.sourceKind +
        ":" +
        span.sourceIndex,
    }),
  );
}

function candidate(
  document: ContractNoticeDocumentInput,
  kind:
    | "claim_notice"
    | "detailed_claim",
  patterns: RegExp[],
): NoticeRequirement | null {
  for (const section of document.result.sections) {
    const text = [
      section.heading ?? "",
      section.text,
    ].join("\n");
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      const days =
        match?.[1]
          ? Number(match[1])
          : Number.NaN;
      if (!Number.isFinite(days)) {
        continue;
      }
      return {
        requirementId:
          "contract:" +
          kind,
        noticeKind: kind,
        eventCategories: [],
        noticePeriodDays:
          days,
        state: "official",
        clauseIdentifiers:
          section.identifier
            ? [
                section.identifier,
              ]
            : [],
        evidenceRefs:
          refs(
            document.documentId,
            section,
          ),
      };
    }
  }
  return null;
}

function requirementsFromDocument(
  document:
    ContractNoticeDocumentInput,
): NoticeRequirement[] {
  const claimNotice =
    candidate(
      document,
      "claim_notice",
      [
        /\bcurrent\s+initial\s+claim\s+notice\b[^\d]{0,60}(\d+(?:\.\d+)?)\s*days?\b/i,
        /\binitial\s+notice\s+of\s+claim\b[^\d]{0,120}(\d+(?:\.\d+)?)\s*days?\b/i,
        /\binitial\s+notice\s+of\s+claim\s+shall\s+be\s+given\s+within\s+(\d+(?:\.\d+)?)\s*days?\b/i,
        /\bnotice\s+of\s+claim\b[^\d]{0,120}(\d+(?:\.\d+)?)\s*days?\b/i,
      ],
    );
  const detailedClaim =
    candidate(
      document,
      "detailed_claim",
      [
        /\bfully\s+detailed\s+claim\b[^\d]{0,80}(\d+(?:\.\d+)?)\s*days?\b/i,
        /\bdetailed\s+claim\b[^\d]{0,120}(\d+(?:\.\d+)?)\s*days?\b/i,
      ],
    );
  return [
    ...(claimNotice
      ? [claimNotice]
      : []),
    ...(detailedClaim
      ? [detailedClaim]
      : []),
  ];
}

export function extractContractNoticeRequirements(
  input: {
    base:
      ContractNoticeDocumentInput |
      null;
    amendments:
      ContractNoticeDocumentInput[];
  },
): NoticeRequirement[] {
  const map =
    new Map<
      string,
      NoticeRequirement
    >();

  if (input.base) {
    for (
      const requirement of
        requirementsFromDocument(
          input.base,
        )
    ) {
      map.set(
        requirement.noticeKind,
        requirement,
      );
    }
  }

  for (const amendment of input.amendments) {
    for (
      const requirement of
        requirementsFromDocument(
          amendment,
        )
    ) {
      map.set(
        requirement.noticeKind,
        requirement,
      );
    }
  }

  return [
    ...map.values(),
  ];
}
