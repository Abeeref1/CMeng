import type {
  DelayResponsibility,
  GovernanceState,
} from "../../delay-analysis-core/src";

export type EotDayBasis =
  | "calendar_days"
  | "working_days"
  | "unknown";

export interface ContractTimeBasis {
  contractualCompletionIso: string | null;
  contractualCompletionState: GovernanceState;
  officialApprovedEotDays: number | null;
  officialApprovedEotState: GovernanceState;
  eotDayBasis: EotDayBasis;
  eotDayBasisState: GovernanceState;
  sourceRefs: string[];
}

export interface EotScenarioPolicy {
  eligibleResponsibilities: DelayResponsibility[];
  requireTimelyNoticeWhenOfficialRequirementExists: boolean;
  excludeConcurrentWindows: boolean;
}

export const DEFAULT_EOT_SCENARIO_POLICY: EotScenarioPolicy = {
  eligibleResponsibilities: [
    "employer",
    "neutral",
  ],
  requireTimelyNoticeWhenOfficialRequirementExists: true,
  excludeConcurrentWindows: true,
};

export type EotWindowCandidateState =
  | "included"
  | "excluded"
  | "review";

export interface EotWindowCandidate {
  windowId: string;
  positiveIndependentMovementDays: number;
  state: EotWindowCandidateState;
  eligibleEventIds: string[];
  contractorEventIds: string[];
  reasons: string[];
  assumptions: string[];
  includedCandidateDays: number;
}

export interface EotAssessmentProjection {
  schemaVersion: "1.0";
  projectionKey: "eot_assessment";
  generatedAt: string;
  producerVersion: string;
  projectId: string;

  contractualCompletionIso: string | null;
  contractualCompletionState: GovernanceState;

  officialApprovedEotDays: number | null;
  officialApprovedEotState: GovernanceState;
  officialAdjustedCompletionIso: string | null;

  candidateAdditionalEotDays: number;
  scenarioAdjustedCompletionIso: string | null;

  eotDayBasis: EotDayBasis;
  eotDayBasisState: GovernanceState;

  includedWindowCount: number;
  excludedWindowCount: number;
  reviewWindowCount: number;

  windowCandidates: EotWindowCandidate[];

  basis:
    "analytical_candidate_not_contractual_determination";
  assumptions: string[];
  diagnostics: string[];
}
