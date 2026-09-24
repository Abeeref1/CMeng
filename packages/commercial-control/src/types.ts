import type { CanonicalCommercialModel } from "../../runtime-api/src/commercial-canonical";
import type { CommercialFoundationProjection } from "../../commercial-foundation/src";
import type { CommercialPerformanceProjection } from "../../commercial-performance/src";
import type { ContractControlsProjection } from "../../commercial-contract-controls/src";
import type {
  BondRecord,
  ClaimCommercialRecord,
  InvoiceRecord,
  MoneyValue,
  RetentionRecord,
  VariationRecord,
} from "../../project-director/src";
import type {
  ContractTimeBasis,
} from "../../eot-assessment/src";
import type {
  ClaimState,
  DelayClaimsModel,
  GovernanceState,
  NoticeKind,
  NoticeTimeliness,
} from "../../delay-analysis-core/src";

export type CommercialEvidenceState =
  | "established"
  | "candidate"
  | "missing_information"
  | "submitted_unparsed"
  | "not_submitted"
  | "not_applicable";

export interface CommercialMetric<T> {
  value: T | null;
  state: CommercialEvidenceState;
  sourceRefs: string[];
  diagnostics: string[];
  consequence?: string;
  action?: string;
}

export interface CommercialMoneyPosition {
  sourceCertificatePeriodCount?: CommercialMetric<number>;
  currency: string;
  netCertifiedAmount?: CommercialMetric<number>;
  originalContractValue:
    CommercialMetric<number>;
  approvedVariationAmount:
    CommercialMetric<number>;
  pendingVariationAmount:
    CommercialMetric<number>;
  currentContractValue:
    CommercialMetric<number>;
  interimCertificateCount:
    CommercialMetric<number>;
  grossCertifiedAmount:
    CommercialMetric<number>;
  paidAmount:
    CommercialMetric<number>;
  certifiedUnpaidAmount:
    CommercialMetric<number>;
  retentionDeductedAmount:
    CommercialMetric<number>;
  retentionHeldAmount:
    CommercialMetric<number>;
  advanceBalance:
    CommercialMetric<number>;
  activeBondAmount:
    CommercialMetric<number>;
  claimedAmount:
    CommercialMetric<number>;
  assessedClaimAmount:
    CommercialMetric<number>;
}

export interface CommercialClaimsNoticesPosition {
  sourceNoticeCount: number;
  asOfNoticeCount: number;
  futureNoticeCount: number;
  undatedNoticeCount: number;
  dimensionalEvidenceGaps: {requirementMissing:number;eventDateMissing:number;noticeDateMissing:number};
  state: CommercialEvidenceState;
  evidenceRevisionId: string | null;
  eventCount: number;
  noticeCount: number;
  lifecycleClaimCount: number;
  commercialClaimCount: number;
  commercialLifecycleLinkCoveragePercent:
    number | null;
  claimStateCounts: Record<ClaimState, number>;
  noticeKindCounts: Record<NoticeKind, number>;
  noticeTimelinessCounts:
    Record<NoticeTimeliness, number>;
  claims: Array<{
    sourceRegister?: import("../../delay-analysis-core/src").ClaimRegisterSnapshot;
    claimId: string;
    title: string;
    state: ClaimState;
    submittedAt: string | null;
    claimedDays: number | null;
    claimedAmount: number | null;
    assessedDays: number | null;
    assessedDaysState: GovernanceState;
    assessedAmount: number | null;
    assessedAmountState: GovernanceState;
    eventIds: string[];
    clauseIdentifiers: string[];
    sourceRefs: string[];
  }>;
  notices: Array<{
    noticeId: string;
    kind: NoticeKind;
    eventId: string | null;
    claimId: string | null;
    actualIssuedAt: string | null;
    actualReceivedAt: string | null;
    subject: string | null;
    clauseIdentifiers: string[];
    sourceRefs: string[];
  }>;
  noticeAssessments: Array<{
    eventId: string;
    eventTitle: string | null;
    requirementId: string | null;
    requiredNoticeDays: number | null;
    eventStartIso: string | null;
    noticeId: string | null;
    noticeIssuedAt: string | null;
    elapsedDays: number | null;
    timeliness: NoticeTimeliness;
    requirementState:
      GovernanceState | null;
  }>;
  diagnostics: string[];
}

export interface CommercialControlInput {
  /** Read status before currency, date and value filtering. An empty eligible
   * subset does not mean the supplied document was never read. */
  sourceRead?: Partial<Record<"commercial" | "payments" | "variations" | "bonds" | "claims", boolean>>;
  sourceLedger?: CanonicalCommercialModel;
  foundation?: CommercialFoundationProjection;
  performance?: CommercialPerformanceProjection;
  contractControls?: ContractControlsProjection;
  generatedAt: string;
  projectId: string;
  contractValue: MoneyValue | null;
  contractValueCandidates?: MoneyValue[];
  variations: VariationRecord[];
  invoices: InvoiceRecord[];
  retentions: RetentionRecord[];
  bonds: BondRecord[];
  claimCommercials: ClaimCommercialRecord[];
  delayClaims?: DelayClaimsModel | null;
  sourceDelayClaims?: DelayClaimsModel | null;
  contractTimeBasis: ContractTimeBasis | null;
  commercialEvidenceSubmitted: boolean;
  paymentEvidenceSubmitted: boolean;
  variationEvidenceSubmitted: boolean;
  bondEvidenceSubmitted: boolean;
  claimEvidenceSubmitted: boolean;
}

export interface CommercialControlPosition {
  certificateProfile?: import("../../runtime-api/src/certificate-profile").ReturnCertificateProfile;
  variationBasisReview?: ReturnType<typeof import("../../runtime-api/src/commercial-basis-review").variationBasisReview>;
  costBasisReview?: ReturnType<typeof import("../../runtime-api/src/commercial-basis-review").costBasisReview>;
  contractNoticeRules?: import("../../delay-analysis-core/src").NoticeRequirement[];
  sourceLedger?: CanonicalCommercialModel;
  foundation: CommercialFoundationProjection;
  performance: CommercialPerformanceProjection;
  contractControls?: ContractControlsProjection;
  schemaVersion: "1.0";
  projectionKey: "commercial_control_position";
  generatedAt: string;
  projectId: string;
  timeExposure: {
    contractualCompletion:
      CommercialMetric<string>;
    approvedEotDays:
      CommercialMetric<number>;
    officialAdjustedCompletion:
      CommercialMetric<string>;
  };
  currencies: CommercialMoneyPosition[];
  variationCount: number | null;
  invoiceCount: number | null;
  retentionRecordCount: number | null;
  bondCount: number | null;
  claimCommercialCount: number | null;
  claimsNotices:
    CommercialClaimsNoticesPosition;
  registers: {
    variations: VariationRecord[];
    invoices: InvoiceRecord[];
    retentions: RetentionRecord[];
    bonds: BondRecord[];
    claims: ClaimCommercialRecord[];
  };
  evidence: {
    commercial:
      CommercialEvidenceState;
    payments:
      CommercialEvidenceState;
    variations:
      CommercialEvidenceState;
    bonds:
      CommercialEvidenceState;
    claims:
      CommercialEvidenceState;
  };
  sourceRefs: string[];
  diagnostics: string[];
}

export interface CommercialModuleProjection {
  schemaVersion: "1.0";
  projectionKey:
    | "commercial_overview"
    | "cost_forecast"
    | "variations_change"
    | "payments"
    | "cash_flow"
    | "commercial_claims_notices"
    | "contract_particulars_bonds";
  generatedAt: string;
  projectId: string;
  position: CommercialControlPosition;
  focus: unknown;
  diagnostics: string[];
}
