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
