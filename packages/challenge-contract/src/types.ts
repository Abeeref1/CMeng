export type ContractChallengeCategory =
  | "notice_time_bar"
  | "extension_of_time"
  | "concurrency"
  | "variation_change"
  | "payment"
  | "suspension"
  | "termination"
  | "delay_damages"
  | "claims_disputes"
  | "records_substantiation"
  | "document_precedence"
  | "discretion";

export interface ContractChallengeSignal {
  signalId: string;
  category: ContractChallengeCategory;
  sectionKey: string;
  clauseIdentifier: string | null;
  heading: string | null;
  sourceMode:
    | "deterministic"
    | "ai_grounded";
  matchedTerms: string[];
  textSnippet: string;
  sourceRefs: string[];
}

export interface ContractNoticeRequirementCandidate {
  candidateId: string;
  clauseIdentifier: string | null;
  noticePeriodDays: number;
  dayBasis:
    | "calendar_days"
    | "working_days"
    | "unspecified_days";
  candidateState: "candidate";
  sourceRefs: string[];
  textSnippet: string;
}

export interface ChallengeContractProjection {
  schemaVersion: "1.0";
  projectionKey: "challenge_contract";
  generatedAt: string;
  producerVersion: string;
  sourceType: "pdf" | "docx";
  physicalComplete: boolean;
  semanticComplete: boolean;
  sectionCount: number;
  clauseCount: number;
  signalCount: number;
  uniqueWordingSignalCount?: number;
  repeatedSignalOccurrenceCount?: number;
  wordingGroups?: Array<{groupId:string;category:ContractChallengeCategory;occurrenceCount:number;clauseIdentifiers:Array<string|null>;sourceRefs:string[];textSnippet:string}>;
  categoriesPresent: ContractChallengeCategory[];
  signals: ContractChallengeSignal[];
  noticeRequirementCandidates: ContractNoticeRequirementCandidate[];
  diagnostics: string[];
}
