import {
  stableFingerprint,
} from "../../analysis-runtime/src";
import type {
  ContractDocumentResult,
  ContractSection,
} from "../../contract-parser/src";
import type {
  ChallengeContractProjection,
  ContractChallengeCategory,
  ContractChallengeSignal,
  ContractNoticeRequirementCandidate,
} from "./types";

interface CategoryRule {
  category: ContractChallengeCategory;
  patterns: RegExp[];
  terms: string[];
}

const RULES: CategoryRule[] = [
  {
    category: "notice_time_bar",
    patterns: [
      /\bnotice\b/i,
      /\btime[- ]?bar/i,
      /\bcondition precedent\b/i,
      /\bno entitlement\b/i,
      /\bbarred\b/i,
    ],
    terms: [
      "notice",
      "time bar",
      "condition precedent",
      "no entitlement",
      "barred",
    ],
  },
  {
    category: "extension_of_time",
    patterns: [
      /\bextension of time\b/i,
      /\bEOT\b/i,
      /\btime extension\b/i,
    ],
    terms: [
      "extension of time",
      "EOT",
      "time extension",
    ],
  },
  {
    category: "concurrency",
    patterns: [
      /\bconcurrent delay\b/i,
      /\bconcurrency\b/i,
    ],
    terms: [
      "concurrent delay",
      "concurrency",
    ],
  },
  {
    category: "variation_change",
    patterns: [
      /\bvariation\b/i,
      /\bchange order\b/i,
      /\bchange to the works\b/i,
    ],
    terms: [
      "variation",
      "change order",
      "change to the works",
    ],
  },
  {
    category: "payment",
    patterns: [
      /\bpayment\b/i,
      /\bpayment certificate\b/i,
      /\binterim certificate\b/i,
    ],
    terms: [
      "payment",
      "payment certificate",
      "interim certificate",
    ],
  },
  {
    category: "suspension",
    patterns: [
      /\bsuspend(?:ed|sion)?\b/i,
    ],
    terms: ["suspend", "suspension"],
  },
  {
    category: "termination",
    patterns: [
      /\btermination\b/i,
      /\bterminate\b/i,
    ],
    terms: ["termination", "terminate"],
  },
  {
    category: "delay_damages",
    patterns: [
      /\bliquidated damages\b/i,
      /\bdelay damages\b/i,
    ],
    terms: [
      "liquidated damages",
      "delay damages",
    ],
  },
  {
    category: "claims_disputes",
    patterns: [
      /\bclaim\b/i,
      /\bdispute\b/i,
      /\barbitration\b/i,
      /\badjudication\b/i,
    ],
    terms: [
      "claim",
      "dispute",
      "arbitration",
      "adjudication",
    ],
  },
  {
    category: "records_substantiation",
    patterns: [
      /\brecords?\b/i,
      /\bsubstantiat(?:e|ion)\b/i,
      /\bcontemporary records\b/i,
    ],
    terms: [
      "records",
      "substantiation",
      "contemporary records",
    ],
  },
  {
    category: "document_precedence",
    patterns: [
      /\border of precedence\b/i,
      /\bpriority of documents\b/i,
      /\bconflict between documents\b/i,
    ],
    terms: [
      "order of precedence",
      "priority of documents",
      "conflict between documents",
    ],
  },
  {
    category: "discretion",
    patterns: [
      /\bsole discretion\b/i,
      /\bat its discretion\b/i,
      /\bmay determine\b/i,
    ],
    terms: [
      "sole discretion",
      "at its discretion",
      "may determine",
    ],
  },
];

function normalizedText(
  section: ContractSection,
): string {
  return [
    section.heading ?? "",
    section.text,
  ]
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

function snippet(
  value: string,
  max = 500,
): string {
  if (value.length <= max) {
    return value;
  }
  return value.slice(0, max) + "…";
}

function sourceRefs(
  section: ContractSection,
): string[] {
  return section.sourceSpans.map((span) =>
    [
      span.sourceKind,
      span.sourceIndex,
      span.start,
      span.end,
    ].join(":"),
  );
}

function matchedTerms(
  text: string,
  rule: CategoryRule,
): string[] {
  const matched: string[] = [];

  for (
    let index = 0;
    index < rule.patterns.length;
    index += 1
  ) {
    if (rule.patterns[index]!.test(text)) {
      matched.push(rule.terms[index]!);
    }
  }

  return matched;
}

function signalsForSection(
  section: ContractSection,
): ContractChallengeSignal[] {
  const text = normalizedText(section);

  return RULES.flatMap((rule) => {
    const terms = matchedTerms(
      text,
      rule,
    );

    if (terms.length === 0) {
      return [];
    }

    return [
      {
        signalId:
          "contract-signal-" +
          stableFingerprint({
            sectionKey: section.sectionKey,
            category: rule.category,
            terms,
          }).slice(0, 20),
        category: rule.category,
        sectionKey: section.sectionKey,
        clauseIdentifier:
          section.identifier,
        heading: section.heading,
        sourceMode:
          section.sourceMode,
        matchedTerms: terms,
        textSnippet: snippet(text),
        sourceRefs:
          sourceRefs(section),
      },
    ];
  });
}

function noticeCandidates(
  section: ContractSection,
): ContractNoticeRequirementCandidate[] {
  const text = normalizedText(section);
  const regex =
    /\bwithin\s+(\d{1,3})\s+(calendar\s+days?|working\s+days?|days?)\b/gi;
  const candidates:
    ContractNoticeRequirementCandidate[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const days = Number(match[1]);
    if (
      !Number.isSafeInteger(days) ||
      days < 0 ||
      days > 365
    ) {
      continue;
    }

    const phrase =
      match[2]!.toLowerCase();
    const dayBasis:
      ContractNoticeRequirementCandidate["dayBasis"] =
      phrase.startsWith("calendar")
        ? "calendar_days"
        : phrase.startsWith("working")
          ? "working_days"
          : "unspecified_days";

    candidates.push({
      candidateId:
        "notice-candidate-" +
        stableFingerprint({
          sectionKey: section.sectionKey,
          match: match[0],
          offset: match.index,
        }).slice(0, 20),
      clauseIdentifier:
        section.identifier,
      noticePeriodDays: days,
      dayBasis,
      candidateState: "candidate",
      sourceRefs:
        sourceRefs(section),
      textSnippet: snippet(
        text.slice(
          Math.max(0, match.index - 120),
          Math.min(
            text.length,
            match.index +
              match[0].length +
              220,
          ),
        ),
      ),
    });
  }

  return candidates;
}

export function buildChallengeContractProjection(
  contract: ContractDocumentResult,
  input: {
    generatedAt: string;
    producerVersion: string;
  },
): ChallengeContractProjection {
  const eligibleSections =
    contract.sections.filter(
      (section) =>
        section.kind !== "preamble",
    );

  const signals =
    eligibleSections.flatMap(
      signalsForSection,
    );
  // Group identical clause wording for analysis while retaining every clause and
  // source occurrence. Different clause identities are not silently merged.
  const wordingBySection=new Map(eligibleSections.map(section=>{
    const lines=section.text.split(/\r?\n/);
    if(section.identifier&&['section','clause','article'].some(label=>lines[0]?.trim().toLowerCase()===label+' '+section.identifier!.toLowerCase()))lines.shift();
    return [section.sectionKey,lines.join('\n').normalize('NFKC').replace(/\s+/g,' ').trim()];
  }));
  const grouped=new Map<string,ContractChallengeSignal[]>();
  for(const signal of signals){const key=stableFingerprint({category:signal.category,wording:wordingBySection.get(signal.sectionKey)});const rows=grouped.get(key)??[];rows.push(signal);grouped.set(key,rows);}
  const wordingGroups=[...grouped].map(([groupId,rows])=>({groupId,category:rows[0]!.category,occurrenceCount:rows.length,
    clauseIdentifiers:rows.map(r=>r.clauseIdentifier),sourceRefs:[...new Set(rows.flatMap(r=>r.sourceRefs))],textSnippet:rows[0]!.textSnippet}));

  const noticeRequirementCandidates =
    eligibleSections.flatMap(
      (section) => {
        const text =
          normalizedText(section);

        if (
          !/\bnotice\b/i.test(text) &&
          !/\bclaim\b/i.test(text)
        ) {
          return [];
        }

        return noticeCandidates(section);
      },
    );

  const categoriesPresent = [
    ...new Set(
      signals.map(
        (signal) =>
          signal.category,
      ),
    ),
  ].sort();

  return {
    schemaVersion: "1.0",
    projectionKey: "challenge_contract",
    generatedAt: input.generatedAt,
    producerVersion:
      input.producerVersion,
    sourceType: contract.sourceType,
    physicalComplete:
      contract.physicalComplete,
    semanticComplete:
      contract.semanticComplete,
    sectionCount:
      contract.sections.length,
    clauseCount:
      contract.clauses.length,
    signalCount:
      signals.length,
    uniqueWordingSignalCount:wordingGroups.length,
    repeatedSignalOccurrenceCount:signals.length-wordingGroups.length,
    wordingGroups,
    categoriesPresent,
    signals,
    noticeRequirementCandidates,
    diagnostics: [
      ...contract.diagnostics,
      ...(contract.semanticComplete
        ? []
        : [
            "CONTRACT_CHALLENGE_ANALYSIS_BASED_ON_PARTIAL_SEMANTIC_CONTRACT_MODEL",
          ]),
      "CONTRACT_NOTICE_REQUIREMENTS_ARE_CANDIDATES_UNTIL_GOVERNED_PROMOTION",
    ],
  };
}
