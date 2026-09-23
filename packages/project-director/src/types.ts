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
  certificateDateIso?: string | null;
  paymentDateIso?: string | null;
  retentionAmount?: number | null;
  advanceRecoveryAmount?: number | null;
  advanceBalance?: number | null;
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
  severity: "critical" | "major" | "minor" | "unknown";
  status: "open" | "closed" | "unknown";
  raisedIso?: string | null;
  closedIso?: string | null;
  statusAsOfIso?: string | null;
  sourceRefs: string[];
}

export interface RfiRecord {
  rfiId: string;
  status: "open" | "answered" | "closed" | "unknown";
  raisedIso?: string | null;
  closedIso?: string | null;
  statusAsOfIso?: string | null;
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
  | "partial"
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

export interface OperationalControlReporting {
  knownCounts: {openCriticalMajorNcrCount:number;uncertainCriticalMajorNcrCount:number};
  dataDateIso: string | null;
  quality: OperationalRegisterReporting;
  rfi: OperationalRegisterReporting;
  risk: OperationalRegisterReporting;
  counts: {openCriticalMajorNcrCount:number|null;openRfiCount:number|null;overdueRfiCount:number|null;openRiskCount:number|null};
}
export interface OperationalRegisterReporting {
  state: string;
  complete: boolean;
  sourceRecordCount: number;
  currentRecordCount: number;
  futureRecordCount: number;
  undatedRecordCount: number;
  unknownStatusCount: number;
  population: import('../../truth-kernel/src').PopulationContract;
  sourceRows: object[];
  current: object[];
  future: object[];
  undated: object[];
  diagnostics: string[];
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
  contractValueCandidates?:
    MoneyValue[];
  /** Bonds remain an operational-control input for expiry/security counts only. */
  bonds: BondRecord[];
  bondMonitoring?: {expiredCount:number|null;expiring30Count:number|null};
  commercialByCurrency:
    CurrencyCommercialPosition[];
  hseIncidents: HseIncidentRecord[];
  ncrs: NcrRecord[];
  rfis: RfiRecord[];
  permits: PermitRecord[];
  openRiskCount?: number | null;
  operationalReporting?: OperationalControlReporting;
  boardEvidence: BoardEvidenceRecord | null;
  evidenceAvailability?:
    DirectorEvidenceAvailability;
}

export type DirectorCommercialEvidenceState =
  | "established"
  | "candidate"
  | "missing_information"
  | "submitted_unparsed"
  | "not_submitted"
  | "not_applicable";

export interface DirectorCommercialMetric {
  value: number | null;
  state: DirectorCommercialEvidenceState;
  sourceRefs: string[];
  diagnostics: string[];
}

export interface CurrencyCommercialPosition {
  currency: string;
  pendingVariationAmount: DirectorCommercialMetric;
  approvedVariationAmount: DirectorCommercialMetric;
  certifiedUnpaidAmount: DirectorCommercialMetric;
  retentionDeductedAmount: DirectorCommercialMetric;
  retentionHeldAmount: DirectorCommercialMetric;
  activeBondAmount: DirectorCommercialMetric;
  claimClaimedAmount: DirectorCommercialMetric;
  claimAssessedAmount: DirectorCommercialMetric;
  ldScenarioAmount: DirectorCommercialMetric;
}

export interface ProjectDirectorPosition {
  sourceInterpretation?: import("../../runtime-api/src/source-interpretation").SourceInterpretation;
  schemaVersion: "1.0";
  generatedAt: string;
  projectId: string;
  schedule: {
    dataDateIso: string | null;
    contractualCompletionIso: string | null;
    officialAdjustedCompletionIso: string | null;
    submittedProgrammeCompletionIso: string | null;
    independentForecastCompletionIso: string | null;
    independentForecastBasisRevisionId: string;
    independentForecastCoveragePercent: number | null;
    independentForecastAuthority:
      | "deterministic"
      | "scenario"
      | "unresolved";
    varianceDaysToContractualCompletion: number | null;
    varianceDaysToOfficialAdjustedCompletion: number | null;
    varianceDaysToSubmittedProgrammeCompletion: number | null;
    forecastComparisonBasis:
      | "official_adjusted_completion"
      | "contractual_completion"
      | "submitted_programme"
      | "none";
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
      number | null;
    attributableCandidateEotDays:
      number | null;
    unattributedTimeImpactDays:
      number;
    candidateAdditionalEotDays: number | null;
    officialApprovedEotDays: number | null;
  };
  ld: {
    delayDays: number | null;
    delayBasis:
      | "official_adjusted_completion"
      | "unavailable";
    state:
      | "scenario_candidate"
      | "multi_scenario"
      | "unavailable";
    currency: string | null;
    uncappedAmount: number | null;
    cappedAmount: number | null;
    capApplied: boolean | null;
    sourceRefs: string[];
    recommendedScenarioId:
      string | null;
    recommendationRationale:
      string[];
    userDecisionRequired: boolean;
    scenarios: Array<{
      scenarioId: string;
      rateCandidateId: string;
      capCandidateId:
        string | null;
      contractValueAmount:
        number | null;
      contractValueCurrency:
        string | null;
      state:
        | "calculated"
        | "not_calculable";
      currency: string | null;
      uncappedAmount:
        number | null;
      cappedAmount:
        number | null;
      capApplied:
        boolean | null;
      evidenceScore: number;
      recommended: boolean;
      sourceRefs: string[];
      diagnostics: string[];
    }>;
    diagnostics: string[];
  };
  commercialByCurrency: CurrencyCommercialPosition[];
  controls: {
    reporting?: OperationalControlReporting;
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
    openHseIncidentCount: number | null;
    openLtiOrWorseCount: number | null;
    openCriticalMajorNcrCount: number | null;
    openRfiCount: number | null;
    overdueRfiCount: number | null;
    openPermitCount: number | null;
    overduePermitCount: number | null;
    expiredBondCount: number | null;
    expiringBondCount30Days: number | null;
  };
  boardEvidence: BoardEvidenceRecord | null;
  managementActions: string[];
  evidenceRefs: string[];
  diagnostics: string[];
}
