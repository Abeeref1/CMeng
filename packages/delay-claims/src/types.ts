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
  /** M7.3: the governance state of the notice rule the timeliness was judged against. */
  noticeRequirementState?: string | null;
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

  /** Event and claim population counts are null when no contractor delay-claim population is established (none submitted, or quarantined); 0 only means an established empty register. */
  eventCount: number | null;
  claimCount: number | null;
  windowCount: number;
  claimLinkedEventCount: number | null;
  activityLinkedEventCount: number | null;
  windowLinkedEventCount: number | null;
  noticeLinkedEventCount: number | null;
  determinationLinkedEventCount: number | null;
  fullDeterminationChainEventCount: number | null;
  determinationChainIncompleteEventCount: number | null;
  activityEvidenceInsufficientEventCount: number | null;
  activityCorrespondenceAcceptedCount: number | null;
  activityCorrespondenceCandidateCount: number | null;
  activityCorrespondenceAmbiguousCount: number | null;
  activityCorrespondenceUnresolvedCount: number | null;
  activityCorrespondenceNoCandidateCount?: number | null;
  activityCorrespondenceAiNotConfiguredCount?: number | null;

  observedPositiveIndependentMovementDays: number | null;
  /** Positive submitted completion shifts summed across windows; recoveries remain separate. Not causal delay or EOT. */
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

  /** "not_established" when no event source exists (claims register rows only): event counts are then null, claims are still counted. */
  eventPopulationState: "established" | "not_established";
  eventPopulationReason: string | null;
  events: DelayClaimEventAssessmentRow[];
  diagnostics: string[];
}
