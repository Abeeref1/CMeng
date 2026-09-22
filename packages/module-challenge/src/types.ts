export type AssertionValueType =
  | "number"
  | "percent"
  | "days"
  | "date"
  | "count"
  | "currency"
  | "text";

export interface DocumentAssertion {
  assertionId: string;
  metric: string;
  label: string;
  value: number | string;
  valueType: AssertionValueType;
  unit: string | null;
  sourceRef: string;
  sourceText: string;
  confidence: number;
  documentId?: string | null;
  evidenceBasisState?:
    | "active"
    | "superseded"
    | "additive"
    | "scenario"
    | "candidate"
    | "historical"
    | null;
  uploadedAt?: string | null;
  basisRevisionId?: string | null;
  sourceAuthority?:
    ChallengeValueAuthority | null;
}

export type ChallengeValueState =
  | "submitted"
  | "not_submitted"
  | "conflicted"
  | "calculated"
  | "derived"
  | "scenario"
  | "not_derivable";

export type ChallengeValueAuthority =
  | "submitted"
  | "official"
  | "governed"
  | "deterministic"
  | "derived"
  | "scenario"
  | "candidate"
  | "missing";

export type ValueResolutionState =
  | "single"
  | "corroborated"
  | "authority_resolved"
  | "chronology_resolved"
  | "unresolved_conflict"
  | "incomparable"
  | "missing";

export interface ChallengeValueAlternative {
  value: number | string;
  unit: string | null;
  authority:
    ChallengeValueAuthority;
  sourceRefs: string[];
  basisRevisionId:
    string | null;
  asOfIso: string | null;
  confidence: number | null;
  supportCount?: number;
  evidenceScore?: number;
  reasons?: string[];
}

export interface ChallengeValue {
  state: ChallengeValueState;
  value: number | string | null;
  unit: string | null;
  authority:
    ChallengeValueAuthority;
  sourceRefs: string[];
  basisRevisionId:
    string | null;
  coveragePercent:
    number | null;
  asOfIso: string | null;
  confidence: number | null;
  diagnostics: string[];
  note: string | null;
  resolution?:
    ValueResolutionState;
  alternatives?:
    ChallengeValueAlternative[];
}

export interface SharedFindingContract {
  findingId: string;
  topic: string;
  state:
    | "supported"
    | "challenged"
    | "missing_evidence"
    | "scenario";
  submitted: ChallengeValue;
  independent: ChallengeValue;
  gap: ChallengeValue;
  evidenceRefs: string[];
  consequence: string | null;
  action: string | null;
  diagnostics: string[];
}

export interface ConflictCandidateAssessment {
  value: number | string;
  unit: string | null;
  sourceRefs: string[];
  supportCount: number;
  evidenceScore: number;
  recommendationScore: number;
  independentGap:
    number | string | null;
  gapUnit: string | null;
  reasons: string[];
  recommended: boolean;
}

export interface ConflictRecommendation {
  state:
    | "not_applicable"
    | "recommendation_only";
  recommendedValue:
    number | string | null;
  recommendedUnit:
    string | null;
  rationale: string[];
  userDecisionRequired: boolean;
  candidates:
    ConflictCandidateAssessment[];
}

export interface CandidateGapComparison {
  submittedValue:
    number | string;
  submittedUnit:
    string | null;
  sourceRefs: string[];
  comparable: boolean;
  gapValue:
    number | string | null;
  gapUnit:
    string | null;
  note: string;
}

export type ReconciliationState = "within_tolerance" | "material_difference" | "submitted_missing" | "independent_unavailable" | "conflicting_evidence" | "incomparable" | "scenario" | "comparison_pending";

export interface ModuleChallengeItem {
  reconciliationState: ReconciliationState;
  materialDifference: boolean;
  tolerance: number;
  itemId: string;
  metric: string;
  label: string;
  submitted: ChallengeValue;
  independent: ChallengeValue;
  gap: ChallengeValue;
  evidenceState:
    | "verified"
    | "derived"
    | "scenario"
    | "partial"
    | "conflicted";
  consequence: string;
  action: string;
  candidateComparisons:
    CandidateGapComparison[];
  conflictRecommendation:
    ConflictRecommendation;
  diagnostics: string[];
}

export interface ModuleChallengeEnvelope {
  schemaVersion: "1.0";
  moduleKey: string;
  generatedAt: string;
  submittedEvidenceState:
    | "available"
    | "partial"
    | "not_submitted"
    | "conflicted";
  independentState:
    | "calculated"
    | "derived"
    | "scenario"
    | "partial";
  itemCount: number;
  challengedCount: number;
  materialDifferenceCount: number;
  unavailableCheckCount: number;
  reconciledCount: number;
  reconciliationState: ReconciliationState;
  notSubmittedCount: number;
  scenarioCount: number;
  items: ModuleChallengeItem[];
  diagnostics: string[];
}
