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
  boardEvidence: BoardEvidenceRecord | null;
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
    overdueLookAheadCount: number;
    progressBases: ProgressReportProjection["progressBases"];
  };
  claims: {
    eventCount: number;
    claimCount: number;
    fullyLinkedEventCount: number;
    fullyLinkedClaimCount: number;
    unlinkedClaimIds: string[];
    candidateAdditionalEotDays: number;
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
