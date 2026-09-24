import type {
  ClaimState,
  GovernanceState,
  NoticeTimeliness,
  ClaimRegisterSnapshot,
} from "../../delay-analysis-core/src";

export interface NoticeClaimEventRow {
  eventId: string;
  title: string;
  responsibility: string;
  responsibilityState: GovernanceState;
  eventStartIso: string | null;
  eventEndIso: string | null;
  noticeId: string | null;
  noticeIssuedAt: string | null;
  requirementId: string | null;
  requiredNoticeDays: number | null;
  elapsedNoticeDays: number | null;
  noticeTimeliness: NoticeTimeliness;
  requirementState: GovernanceState | null;
  linkedClaimIds: string[];
}

export interface NoticeClaimRecordRow {
  claimId: string;
  title: string;
  state: ClaimState;
  submittedAt: string | null;
  eventIds: string[];
  claimedDays: number | null;
  assessedDays: number | null;
  assessedDaysState: GovernanceState;
  claimedAmount: number | null;
  assessedAmount: number | null;
  assessedAmountState: GovernanceState;
  noticeIds: string[];
  sourceRegister?: ClaimRegisterSnapshot;
}

export interface NoticesClaimsProjection {
  schemaVersion: "1.0";
  projectionKey: "notices_claims";
  generatedAt: string;
  producerVersion: string;
  projectId: string;
  evidenceRevisionId: string;

  eventCount: number;
  claimCount: number;
  noticeCount: number;

  timelyNoticeCount: number;
  lateNoticeCount: number;
  missingNoticeCount: number;
  noticeRequirementMissingCount: number;
  noticeEventDateMissingCount: number;
  noticeRequirementConflictCount: number;

  officialAssessedDaysTotal: number | null;
  provisionalOrCandidateAssessedDaysTotal: number | null;
  officialAssessedAmountTotal: number | null;
  provisionalOrCandidateAssessedAmountTotal: number | null;

  events: NoticeClaimEventRow[];
  claims: NoticeClaimRecordRow[];
  diagnostics: string[];
}
