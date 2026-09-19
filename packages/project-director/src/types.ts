import type {
  ProgressReportProjection,
} from "../../progress-report/src";
import type {
  ScheduleAnalyticsProjection,
} from "../../schedule-analytics/src";
import type {
  IndependentForecastProjection,
} from "../../independent-forecast/src";
import type {
  DelayClaimsProjection,
} from "../../delay-claims/src";
import type {
  NoticesClaimsProjection,
} from "../../notices-claims/src";
import type {
  EotAssessmentProjection,
} from "../../eot-assessment/src";
import type {
  ContractLdTerms,
} from "../../contract-commercial/src";

export interface MoneyValue {
  amount: number;
  currency: string;
  sourceRefs: string[];
}

export interface VariationRecord extends MoneyValue {
  variationId: string;
  state: "pending" | "approved" | "rejected";
}

export interface InvoiceRecord {
  invoiceId: string;
  currency: string;
  certifiedAmount: number | null;
  paidAmount: number | null;
  sourceRefs: string[];
}

export interface RetentionRecord extends MoneyValue {
  retentionId: string;
  state: "held" | "released";
}

export interface BondRecord extends MoneyValue {
  bondId: string;
  kind:
    | "performance"
    | "advance_payment"
    | "retention"
    | "other";
  status: "active" | "expired" | "released";
  expiryIso: string | null;
}

export interface ClaimCommercialRecord {
  claimId: string;
  currency: string;
  claimedAmount: number | null;
  assessedAmount: number | null;
  sourceRefs: string[];
}

export interface HseIncidentRecord {
  incidentId: string;
  severity:
    | "fatality"
    | "lti"
    | "medical"
    | "first_aid"
    | "near_miss";
  status: "open" | "closed";
  sourceRefs: string[];
}

export interface NcrRecord {
  ncrId: string;
  severity: "critical" | "major" | "minor";
  status: "open" | "closed";
  sourceRefs: string[];
}

export interface RfiRecord {
  rfiId: string;
  status: "open" | "answered" | "closed";
  dueIso: string | null;
  sourceRefs: string[];
}

export interface PermitRecord {
  permitId: string;
  status:
    | "required"
    | "submitted"
    | "approved"
    | "expired"
    | "not_required";
  dueIso: string | null;
  sourceRefs: string[];
}

export interface BoardEvidenceRecord {
  reportId: string;
  state: "finalized" | "draft" | "stale";
  sourceManifestId: string | null;
  evidenceReceiptIds: string[];
  finalizedAt: string | null;
}

export type EvidenceCoverageState =
  | "established"
  | "submitted_unparsed"
  | "not_submitted";

export interface DirectorEvidenceAvailability {
  hse?: EvidenceCoverageState;
  quality?: EvidenceCoverageState;
  rfi?: EvidenceCoverageState;
  permits?: EvidenceCoverageState;
  bonds?: EvidenceCoverageState;
  risk?: EvidenceCoverageState;
  claims?: EvidenceCoverageState;
}

export interface DirectorPositionInput {
  generatedAt: string;
  projectId: string;
  scheduleAnalytics: ScheduleAnalyticsProjection;
  progressReport: ProgressReportProjection;
  independentForecast: IndependentForecastProjection;
  delayClaims: DelayClaimsProjection;
  noticesClaims: NoticesClaimsProjection;
  eotAssessment: EotAssessmentProjection;
  ldTerms: ContractLdTerms;
  contractValue?: MoneyValue;
  variations: VariationRecord[];
  invoices: InvoiceRecord[];
  retentions: RetentionRecord[];
  bonds: BondRecord[];
  claimCommercials: ClaimCommercialRecord[];
  hseIncidents: HseIncidentRecord[];
  ncrs: NcrRecord[];
  rfis: RfiRecord[];
  permits: PermitRecord[];
  openRiskCount?: number | null;
  boardEvidence: BoardEvidenceRecord | null;
  evidenceAvailability?:
    DirectorEvidenceAvailability;
}

export interface CurrencyCommercialPosition {
  currency: string;
  pendingVariationAmount: number;
  approvedVariationAmount: number;
  certifiedUnpaidAmount: number;
  retentionHeldAmount: number;
  activeBondAmount: number;
  claimClaimedAmount: number;
  claimAssessedAmount: number;
  ldScenarioAmount: number | null;
}

export interface ProjectDirectorPosition {
  schemaVersion: "1.0";
  generatedAt: string;
  projectId: string;
  schedule: {
    dataDateIso: string | null;
    contractualCompletionIso: string | null;
    officialAdjustedCompletionIso: string | null;
    independentForecastCompletionIso: string | null;
    varianceDaysToOfficialAdjustedCompletion: number | null;
    criticalCount: number;
    nearCriticalCount: number;
    criticalityBasis:
      "source_total_float";
    independentCpmState:
      | "established"
      | "not_established";
    drivingPathState:
      | "independent_cpm_available"
      | "not_established";
    overdueLookAheadCount: number;
    progressBases: ProgressReportProjection["progressBases"];
  };
  claims: {
    evidenceState:
      EvidenceCoverageState;
    eventCount: number | null;
    claimCount: number | null;
    fullyLinkedEventCount: number | null;
    fullyLinkedClaimCount: number | null;
    unlinkedClaimIds: string[];
    observedProgrammeMovementDays:
      number;
    analyticalTimeImpactCandidateDays:
      number;
    attributableCandidateEotDays:
      number | null;
    unattributedTimeImpactDays:
      number;
    candidateAdditionalEotDays: number | null;
    officialApprovedEotDays: number | null;
  };
  ld: {
    delayDays: number | null;
    state: "scenario_candidate" | "unavailable" | "conflicted";
    currency: string | null;
    uncappedAmount: number | null;
    cappedAmount: number | null;
    capApplied: boolean | null;
    sourceRefs: string[];
    diagnostics: string[];
  };
  commercialByCurrency: CurrencyCommercialPosition[];
  controls: {
    hseEvidenceState:
      EvidenceCoverageState;
    qualityEvidenceState:
      EvidenceCoverageState;
    rfiEvidenceState:
      EvidenceCoverageState;
    permitEvidenceState:
      EvidenceCoverageState;
    bondEvidenceState:
      EvidenceCoverageState;
    riskEvidenceState:
      EvidenceCoverageState;
    openRiskCount: number | null;
    openHseIncidentCount: number;
    openLtiOrWorseCount: number;
    openCriticalMajorNcrCount: number;
    openRfiCount: number;
    overdueRfiCount: number;
    openPermitCount: number;
    overduePermitCount: number;
    expiredBondCount: number;
    expiringBondCount30Days: number;
  };
  boardEvidence: BoardEvidenceRecord | null;
  managementActions: string[];
  evidenceRefs: string[];
  diagnostics: string[];
}
