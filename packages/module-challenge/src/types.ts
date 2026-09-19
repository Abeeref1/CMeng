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
}

export type ChallengeValueState =
  | "submitted"
  | "not_submitted"
  | "conflicted"
  | "calculated"
  | "derived"
  | "scenario"
  | "not_derivable";

export interface ChallengeValue {
  state: ChallengeValueState;
  value: number | string | null;
  unit: string | null;
  sourceRefs: string[];
  note: string | null;
}

export interface ModuleChallengeItem {
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
  notSubmittedCount: number;
  scenarioCount: number;
  items: ModuleChallengeItem[];
  diagnostics: string[];
}
