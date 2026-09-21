export type DelayResponsibility =
  | "employer"
  | "contractor"
  | "neutral"
  | "concurrent"
  | "unknown";

export type GovernanceState =
  | "official"
  | "provisional"
  | "candidate"
  | "missing";

export type DelayEventCategory =
  | "change"
  | "late_information"
  | "late_access"
  | "suspension"
  | "variation"
  | "authority"
  | "weather"
  | "procurement"
  | "contractor_performance"
  | "design"
  | "payment"
  | "other";

export interface DelayEvidenceRef {
  sourceType:
    | "contract"
    | "schedule"
    | "notice"
    | "claim"
    | "correspondence"
    | "meeting"
    | "instruction"
    | "other";
  sourceId: string;
  locator: string | null;
}

export type DelayActivityCorrespondenceClassification =
  | "accepted_explicit"
  | "accepted_deterministic"
  | "accepted_ai_corroborated"
  | "candidate"
  | "ambiguous"
  | "unresolved";

export type DelayActivityCorrespondenceAuthority =
  | "governed_explicit"
  | "deterministically_confirmed"
  | "ai_corroborated_candidate"
  | "candidate_only"
  | "unresolved";

export interface DelayActivityCorrespondenceSignal {
  key:
    | "explicit_activity_id"
    | "exact_activity_name"
    | "name_similarity"
    | "wbs_similarity"
    | "location"
    | "discipline"
    | "trade"
    | "code_token"
    | "narrative_token";
  score: number;
  detail: string;
}

export interface DelayActivityCorrespondenceCandidate {
  activityId: string;
  activityName: string | null;
  wbsId: string | null;
  prefilterScore: number;
  aiScore: number | null;
  finalScore: number;
  marginToNext: number | null;
  classification:
    | "accepted"
    | "candidate"
    | "ambiguous"
    | "rejected";
  authority: DelayActivityCorrespondenceAuthority;
  signals: DelayActivityCorrespondenceSignal[];
  activitySourceRefs: string[];
  diagnostics: string[];
}

export interface DelayActivityCorrespondence {
  resolverVersion: "claim-activity-correspondence-v1";
  extraction: {
    nouns: string[];
    locations: string[];
    disciplines: string[];
    trades: string[];
    codes: string[];
  };
  preFilterCandidateCount: number;
  boundedCandidateCount: number;
  aiStage:
    | "not_configured"
    | "not_required"
    | "scored"
    | "invalid_scores";
  classification:
    DelayActivityCorrespondenceClassification;
  acceptedActivityIds: string[];
  candidateActivityIds: string[];
  candidates:
    DelayActivityCorrespondenceCandidate[];
  scheduleRevisionId: string;
  claimEvidenceRefs: DelayEvidenceRef[];
  diagnostics: string[];
}

export interface CanonicalDelayEvent {
  eventId: string;
  title: string;
  category: DelayEventCategory;
  startIso: string | null;
  endIso: string | null;
  responsibility: DelayResponsibility;
  responsibilityState: GovernanceState;
  describedImpactDays: number | null;
  describedImpactState: GovernanceState;
  relatedActivityIds: string[];
  activityCorrespondence?: DelayActivityCorrespondence;
  /**
   * Explicit source window references only. These remain distinct from
   * calculated date-overlap links and are resolved against canonical windows
   * by the windows-analysis projection.
   */
  relatedWindowReferences?: string[];
  relatedClauseIdentifiers: string[];
  evidenceRefs: DelayEvidenceRef[];
  diagnostics: string[];
}

export type NoticeKind =
  | "notice"
  | "early_warning"
  | "eot_notice"
  | "claim_notice"
  | "detailed_claim"
  | "response"
  | "determination";

export interface CanonicalNoticeRecord {
  noticeId: string;
  kind: NoticeKind;
  eventId: string | null;
  claimId: string | null;
  actualIssuedAt: string | null;
  actualReceivedAt: string | null;
  plannedAt: string | null;
  subject: string | null;
  clauseIdentifiers: string[];
  evidenceRefs: DelayEvidenceRef[];
  diagnostics: string[];
}

export type ClaimState =
  | "draft"
  | "submitted"
  | "under_review"
  | "determined"
  | "rejected"
  | "withdrawn"
  | "unknown";

export interface CanonicalClaimRecord {
  claimId: string;
  title: string;
  state: ClaimState;
  eventIds: string[];
  submittedAt: string | null;
  claimedDays: number | null;
  claimedAmount: number | null;
  assessedDays: number | null;
  assessedDaysState: GovernanceState;
  assessedAmount: number | null;
  assessedAmountState: GovernanceState;
  clauseIdentifiers: string[];
  evidenceRefs: DelayEvidenceRef[];
  diagnostics: string[];
}

export interface NoticeRequirement {
  requirementId: string;
  noticeKind: NoticeKind;
  eventCategories: DelayEventCategory[];
  noticePeriodDays: number;
  state: GovernanceState;
  clauseIdentifiers: string[];
  evidenceRefs: DelayEvidenceRef[];
}

export interface DelayClaimsModel {
  projectId: string;
  evidenceRevisionId: string;
  events: CanonicalDelayEvent[];
  notices: CanonicalNoticeRecord[];
  claims: CanonicalClaimRecord[];
  noticeRequirements: NoticeRequirement[];
  diagnostics: string[];
}

export type NoticeTimeliness =
  | "timely"
  | "late"
  | "not_issued"
  | "requirement_missing"
  | "event_date_missing"
  | "notice_date_missing";

export interface EventNoticeAssessment {
  eventId: string;
  requirementId: string | null;
  requiredNoticeDays: number | null;
  eventStartIso: string | null;
  noticeId: string | null;
  noticeIssuedAt: string | null;
  elapsedDays: number | null;
  timeliness: NoticeTimeliness;
  requirementState: GovernanceState | null;
}
