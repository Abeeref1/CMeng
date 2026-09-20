import type {
  DelayResponsibility,
  GovernanceState,
} from "../../delay-analysis-core/src";

export type EotDayBasis =
  | "calendar_days"
  | "working_days"
  | "unknown";

export interface EngineerEotDetermination {
  determinationId: string;
  claimId: string | null;
  awardedEotDays: number | null;
  determinationDateIso: string | null;
  status: string | null;
  authority: string | null;
  sourceLetter: string | null;
  governanceState: string | null;
  immutable: boolean;
  sourceRefs: string[];
}

export interface ContractTimeBasis {
  originalContractualCompletionIso?: string | null;
  contractualCompletionIso: string | null;
  contractualCompletionState: GovernanceState;
  controllingAmendmentId?: string | null;
  controllingAmendmentEffectiveAtIso?: string | null;
  incorporatedAmendmentEotDays?: number | null;
  incorporatedAmendmentEotState?: GovernanceState;
  officialApprovedEotDays: number | null;
  officialApprovedEotState: GovernanceState;
  engineerDeterminations?: EngineerEotDetermination[];
  engineerDeterminationCount?: number;
  engineerDeterminationAwardedDaysTotal?: number | null;
  determinationAggregationState?:
    | "not_submitted"
    | "register_established_non_additive"
    | "governed_project_total";
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
  originalContractualCompletionIso?: string | null;
  controllingAmendmentId?: string | null;
  controllingAmendmentEffectiveAtIso?: string | null;
  incorporatedAmendmentEotDays?: number | null;
  engineerDeterminationCount?: number;
  engineerDeterminationAwardedDaysTotal?: number | null;
  determinationAggregationState?: ContractTimeBasis["determinationAggregationState"];

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
