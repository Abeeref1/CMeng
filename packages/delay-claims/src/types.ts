import type {
  DelayResponsibility,
  GovernanceState,
  NoticeTimeliness,
} from "../../delay-analysis-core/src";

export type DelayCandidateClass =
  | "employer_or_neutral_time_candidate"
  | "contractor_risk"
  | "concurrency_review"
  | "insufficient_evidence";

export interface DelayClaimEventAssessmentRow {
  eventId: string;
  title: string;
  responsibility: DelayResponsibility;
  responsibilityState: GovernanceState;
  noticeTimeliness: NoticeTimeliness;
  linkedClaimIds: string[];
  relatedActivityIds: string[];
  overlappingWindowIds: string[];
  noticeIds: string[];
  determinationIds: string[];
  evidenceChainState:
    | "full_determination_chain"
    | "notice_chain"
    | "schedule_chain"
    | "claim_event_only";
  observedNetIndependentMovementDays: number;
  observedPositiveIndependentMovementDays: number;
  observedNetProgrammeMovementDays: number;
  observedPositiveProgrammeMovementDays: number;
  programmeMovementBasis:
    | "independent_cpm"
    | "source_forecast"
    | "source_schedule_boundary"
    | "mixed"
    | "unavailable";
  concurrencyCandidate: boolean;
  candidateClass: DelayCandidateClass;
  scheduleAttribution:
    "not_causally_attributed";
  describedImpactDays: number | null;
  describedImpactState: GovernanceState;
  diagnostics: string[];
}

export interface DelayClaimsProjection {
  schemaVersion: "1.0";
  projectionKey: "delay_claims";
  generatedAt: string;
  producerVersion: string;
  projectId: string;
  evidenceRevisionId: string;

  eventCount: number;
  claimCount: number;
  windowCount: number;

  observedPositiveIndependentMovementDays: number;
  /** Gross positive analytical movement summed across windows. Not project delay or EOT. */
  observedPositiveProgrammeMovementDays: number;
  /** Net submitted Project Completion movement from first to latest controlled revision. */
  projectCompletionMovementDays: number | null;
  projectCompletionMovementBasis:
    | "source_forecast"
    | "source_schedule_boundary"
    | "unavailable";
  unattributedProgrammeMovementDays: number;
  employerOrNeutralCandidateWindowMovementDays: number;
  contractorRiskWindowMovementDays: number;
  concurrentReviewWindowMovementDays: number;

  events: DelayClaimEventAssessmentRow[];
  diagnostics: string[];
}
