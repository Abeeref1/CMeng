export type DelayResponsibility =
  | "employer"
  | "contractor"
  | "neutral"
  | "concurrent"
  | "unknown";

export type GovernanceState =
  | "conflicted"
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
  activityPoolCount: number;
  claimSignalTokenCount: number;
  claimSignalCodeCount: number;
  prefilterRawCandidateCount: number;
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
  /** An awareness trigger is not inferred from a notice date or event start. */
  awarenessIso?: string | null;
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
  /**
   * Where this event identity comes from. "claims_register_row" means a claim
   * row that cites an event: a claim is not an event, so such a row never
   * establishes the event population, the event count or event dates.
   */
  identitySource?: "event_register" | "notice" | "user_recorded" | "claims_register_row";
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
  correspondenceEvidence?: {
    sourceLetter: string;
    identityFound: boolean;
    mentionedOnly: boolean;
    noticeContentLinked: boolean;
    evidenceRefs: DelayEvidenceRef[];
  };
  /**
   * Additive (F06): a notice read from a notice register or notice document,
   * labelled with its source. The event it states (id or exact title) is kept as
   * written; eventId is set only when that event is in the event population and
   * the notice states its date. A notice that names no event stays unlinked.
   */
  noticeSource?: {
    kind: "notice_register" | "notice_document";
    documentId: string;
    sourceFilename: string | null;
    locator: string | null;
    statedEventId: string | null;
    /** A notice document naming more than one event id is never linked to one of them. */
    statedEventIds?: string[];
    statedEventTitle: string | null;
    linkBasis: "event_id" | "exact_event_title" | "not_linked";
    unlinkedReason: string | null;
  };
}

/**
 * Additive (F06): the same claim, event or notice identity stated with different
 * values in two current source files. The later dated file's value is used and
 * the difference is listed as a query; nothing is dropped silently.
 */
export interface SourceRecordQuery {
  queryId: string;
  kind: "claim" | "event" | "notice";
  recordId: string;
  field: string;
  values: Array<{ documentId: string; sourceFilename: string | null; value: string }>;
  usedValue: string;
  usedDocumentId: string;
  orderBasis: "report_date" | "upload_order";
  question: string;
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
  /** The register's own Notice Date and Submitted Date, each only when that column is stated. */
  noticeDate?: string | null;
  submittedDate?: string | null;
  /** Dated professional assessment; final register status alone is not authority. */
  assessedAt?: string | null;
  claimedDays: number | null;
  claimedAmount: number | null;
  assessedDays: number | null;
  assessedDaysState: GovernanceState;
  assessedAmount: number | null;
  assessedAmountState: GovernanceState;
  clauseIdentifiers: string[];
  evidenceRefs: DelayEvidenceRef[];
  diagnostics: string[];
  /** What the register reports; distinct from a dated, authorised decision. */
  sourceRegister?: ClaimRegisterSnapshot;
}

export interface ClaimRegisterSnapshot {
  registerGrantedDays?: number | null;
  state: ClaimState;
  sourceStatus: string;
  claimedDays: number | null;
  assessedDays: number | null;
  claimedAmount: number | null;
  assessedAmount: number | null;
  employerDelayDays: number | null;
  contractorDelayDays: number | null;
  evidenceRefs: DelayEvidenceRef[];
  diagnostics: string[];
  /** Additive (F13): the register's own responsibility, awareness and determination columns. */
  responsibility?: "employer" | "contractor" | "concurrent" | "neutral" | "unknown";
  responsibilitySourceText?: string | null;
  awarenessIso?: string | null;
  eventStartIso?: string | null;
  detailedClaimSubmittedIso?: string | null;
  registerDetermination?: { text: string | null; dateIso: string | null; days: number | null; reference: string | null } | null;
  /** Additive (F47): detailed-claim submission against the contract period. */
  detailedClaimTimeBar?: DetailedClaimTimeBar;
}

export interface DetailedClaimTimeBar {
  status: "on_time" | "late" | "not_established";
  sourceState: string;
  triggerBasis: "awareness" | "event_start" | null;
  triggerDateIso: string | null;
  submittedIso: string | null;
  dueDateIso: string | null;
  /** Latest possible due date when only the claim notice date bounds awareness (additive). */
  latestDueDateIso?: string | null;
  allowedDays: number | null;
  daysToSubmission: number | null;
  daysAfterDue: number | null;
  ruleReference: string | null;
  basis: string;
  sourceRefs: string[];
}

export interface NoticeRequirement {
  requirementId: string;
  sourceFilename?: string;
  noticeKind: NoticeKind;
  eventCategories: DelayEventCategory[];
  noticePeriodDays: number;
  effectiveFromIso?: string | null;
  effectiveToIso?: string | null;
  triggerBasis?: "event_start" | "awareness" | "not_stated";
  applicabilityNote?: string;
  applicabilityState?: "established" | "unresolved";
  sourceDayBasis?: "working";
  reviewReference?: string;
  state: GovernanceState;
  clauseIdentifiers: string[];
  evidenceRefs: DelayEvidenceRef[];
  /** T04: read from a contract source that is not formally adopted. */
  sourceAnalyticalUse?: "qualified_source_read";
  sourceAnalyticalNote?: string;
  /** Unadopted sources stating a different period than the adopted rules. */
  sourceConflicts?: string[];
}

export interface DelayClaimsModel {
  dataDateIso?: string | null;
  projectId: string;
  evidenceRevisionId: string;
  events: CanonicalDelayEvent[];
  notices: CanonicalNoticeRecord[];
  claims: CanonicalClaimRecord[];
  noticeRequirements: NoticeRequirement[];
  diagnostics: string[];
  /** Additive (F06): differing values for one identity across current source files. */
  sourceRecordQueries?: SourceRecordQuery[];
  /**
   * Source-population integrity is separate from claim merits. A quarantined
   * population remains retained for audit but must not feed management counts,
   * causation, entitlement, portfolio summaries or Ask CMeng as established facts.
   */
  integrity?: {
    state: "accepted" | "quarantined";
    sourceClaimCount: number;
    quarantinedClaimCount: number;
    linkedActivityEventCount: number;
    genericClaimEventPairCount: number;
    genericNoticePairCount: number;
    arithmeticClaimedDaysPrefixLength: number;
    sourceFilenames: string[];
    reasons: string[];
  };
}

export type NoticeTimeliness =
  | "timely"
  | "late"
  | "not_issued"
  | "requirement_missing"
  | "requirement_conflicted"
  | "event_date_missing"
  | "notice_date_missing";

export interface EventNoticeAssessment {
  evidenceGaps: {requirementMissing: boolean; eventDateMissing: boolean; noticeDateMissing: boolean};
  eventId: string;
  requirementId: string | null;
  requiredNoticeDays: number | null;
  eventStartIso: string | null;
  noticeId: string | null;
  noticeIssuedAt: string | null;
  elapsedDays: number | null;
  /** F27: the dated trigger the elapsed days are counted from (additive). */
  elapsedFromIso?: string | null;
  elapsedFromBasis?: 'awareness' | 'event_start' | null;
  timeliness: NoticeTimeliness;
  requirementState: GovernanceState | null;
  applicabilityNote?: string;
}
