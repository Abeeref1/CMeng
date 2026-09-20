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
  registeredEventIdentityCount: number;
  datedEventCount: number;
  activityLinkedEventCount: number;
  claimLinkedEventCount: number;
  windowLinkedEventCount: number;
  fullyLinkedEventCount: number;
  claimCount: number;
  windowCount: number;

  observedPositiveIndependentMovementDays: number;
  observedPositiveProgrammeMovementDays: number;
  unattributedProgrammeMovementDays: number;
  employerOrNeutralCandidateWindowMovementDays: number;
  contractorRiskWindowMovementDays: number;
  concurrentReviewWindowMovementDays: number;

  events: DelayClaimEventAssessmentRow[];
  diagnostics: string[];
}
