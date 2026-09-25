import type {
  DelayResponsibility,
  GovernanceState,
  NoticeTimeliness,
  DelayActivityCorrespondence,
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
  activityCorrespondence: DelayActivityCorrespondence | null;
  overlappingWindowIds: string[];
  noticeIds: string[];
  determinationIds: string[];
  evidenceChainState:
    | "full_determination_chain"
    | "determination_chain_incomplete"
    | "notice_chain"
    | "schedule_chain"
    | "claim_event_only";
  evidenceChainMissingLinks: Array<
    | "claim"
    | "activity"
    | "window"
    | "notice"
    | "determination"
  >;
  observedNetIndependentMovementDays: number | null;
  observedPositiveIndependentMovementDays: number | null;
  observedNetProgrammeMovementDays: number | null;
  observedPositiveProgrammeMovementDays: number | null;
  programmeMovementBasis:
    | "matched_activity_finish_shift"
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
  claimLinkedEventCount: number;
  activityLinkedEventCount: number;
  windowLinkedEventCount: number;
  noticeLinkedEventCount: number;
  determinationLinkedEventCount: number;
  fullDeterminationChainEventCount: number;
  determinationChainIncompleteEventCount: number;
  activityEvidenceInsufficientEventCount: number;
  activityCorrespondenceAcceptedCount: number;
  activityCorrespondenceCandidateCount: number;
  activityCorrespondenceAmbiguousCount: number;
  activityCorrespondenceUnresolvedCount: number;

  observedPositiveIndependentMovementDays: number | null;
  /** Gross positive analytical movement summed across windows. Not project delay or EOT. */
  observedPositiveProgrammeMovementDays: number | null;
  /** Net submitted Project Completion movement from first to latest controlled revision. */
  projectCompletionMovementDays: number | null;
  projectCompletionMovementBasis:
    | "source_forecast"
    | "source_schedule_boundary"
    | "unavailable";
  unattributedProgrammeMovementDays: number | null;
  employerOrNeutralCandidateWindowMovementDays: number | null;
  contractorRiskWindowMovementDays: number | null;
  concurrentReviewWindowMovementDays: number | null;

  events: DelayClaimEventAssessmentRow[];
  diagnostics: string[];
}
