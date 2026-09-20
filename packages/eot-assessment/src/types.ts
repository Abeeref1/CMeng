import type {
  DelayResponsibility,
  GovernanceState,
} from "../../delay-analysis-core/src";

export type EotDayBasis =
  | "calendar_days"
  | "working_days"
  | "unknown";

export interface ContractTimeBasis {
  incorporatedEotDays?: number | null;
  additionalApprovedEotDays?: number | null;
  overlapResolution?: "resolved" | "unresolved";
  registerDeterminationDays?: number | null;
  dataDateIso?: string | null;
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
  positiveProgrammeMovementDays: number;
  programmeMovementBasis:
    | "independent_cpm"
    | "source_forecast"
    | "source_schedule_boundary"
    | "unavailable";
  analyticalTimeImpactCandidateDays: number | null;
  state: EotWindowCandidateState;
  eligibleEventIds: string[];
  contractorEventIds: string[];
  reasons: string[];
  assumptions: string[];
  includedCandidateDays: number;
}

export interface EotAssessmentProjection {
  timeBasisReconciliation?: {
    incorporatedEotDays: number | null;
    registerDeterminationDays: number | null;
    additionalApprovedEotDays: number | null;
    overlapResolution: "resolved" | "unresolved";
    dataDateIso: string | null;
  };
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

  observedProgrammeMovementDays: number;
  analyticalTimeImpactCandidateDays: number | null;
  attributableCandidateEotDays: number | null;
  unattributedTimeImpactDays: number;

  candidateAdditionalEotDays: number | null;
  scenarioAdjustedCompletionIso: string | null;
  timeImpactScenarioAdjustedCompletionIso:
    string | null;

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
