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

  /**
   * Official EOT determinations evidenced by the current register.
   * These days are NOT automatically added to contractualCompletionIso.
   * contractualCompletionIso may already include an amendment/EOT.
   */
  officialApprovedEotDays: number | null;
  officialApprovedEotState: GovernanceState;

  incorporatedAmendmentEotDays?: number | null;
  incorporatedAmendmentEotState?: GovernanceState;
  determinationCount?: number | null;
  determinationAwardedDaysTotal?: number | null;
  determinationAwardedDaysToDataDate?: number | null;
  determinationDataDateIso?: string | null;

  /**
   * Only true where evidence explicitly establishes that officialApprovedEotDays
   * are additional to the current contractualCompletionIso.
   */
  approvedEotAdditionalToContractBasis?: boolean | null;

  eotDayBasis: EotDayBasis;
  eotDayBasisState: GovernanceState;
  sourceRefs: string[];
  determinationSourceRefs?: string[];
  diagnostics?: string[];
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
