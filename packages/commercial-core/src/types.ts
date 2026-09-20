import type {
  CanonicalAuthority,
  CanonicalSourceRef,
  CanonicalValueState,
  TaxBasis,
} from "../../truth-model/src";

export interface CommercialMoney {
  amount: number | null;
  currency: string | null;
  taxBasis: TaxBasis;
  state: CanonicalValueState;
  authority: CanonicalAuthority;
  asOfIso: string | null;
  sourceRefs: CanonicalSourceRef[];
  diagnostics: string[];
}

export interface CommercialPeriod {
  periodId: string;
  startIso: string | null;
  endIso: string | null;
  dataDateIso: string | null;
  state: CanonicalValueState;
  sourceRefs: CanonicalSourceRef[];
}

export interface CommercialAmendmentRecord {
  amendmentId: string;
  amendmentNumber: string | null;
  effectiveDateIso: string | null;
  description: string | null;
  contractValueChange: CommercialMoney | null;
  timeExtensionDays: number | null;
  revisedContractualCompletionIso: string | null;
  precedence: number | null;
  state: CanonicalValueState;
  sourceRefs: CanonicalSourceRef[];
  diagnostics: string[];
}

export interface CommercialContractTerms {
  originalContractValue: CommercialMoney | null;
  currentContractValue: CommercialMoney | null;
  originalCompletionIso: string | null;
  revisedCompletionIso: string | null;
  paymentPeriodDays: number | null;
  retentionPercent: number | null;
  retentionCapPercent: number | null;
  advancePaymentPercent: number | null;
  ldRatePerDay: CommercialMoney | null;
  ldCapPercent: number | null;
  noticePeriodDays: number | null;
  detailedClaimPeriodDays: number | null;
  amendments: CommercialAmendmentRecord[];
  sourceRefs: CanonicalSourceRef[];
  diagnostics: string[];
}

export interface CostEvmSnapshot {
  snapshotId: string;
  asOfIso: string | null;
  vatBasis: string | null;
  currency: string | null;
  originalContractValue: number | null;
  approvedVariations: number | null;
  currentContractValue: number | null;
  bac: number | null;
  pv: number | null;
  ev: number | null;
  ac: number | null;
  spi: number | null;
  cpi: number | null;
  etc: number | null;
  eac: number | null;
  vac: number | null;
  sv: number | null;
  cv: number | null;
  sourceReportedMetrics: Record<string, number | string | null>;
  state: CanonicalValueState;
  authority: CanonicalAuthority;
  sourceRefs: CanonicalSourceRef[];
  diagnostics: string[];
}

export interface CostCodeRecord {
  costCode: string;
  description: string | null;
  parentCostCode: string | null;
  budget: CommercialMoney | null;
  commitment: CommercialMoney | null;
  certified: CommercialMoney | null;
  paid: CommercialMoney | null;
  actual: CommercialMoney | null;
  accrued: CommercialMoney | null;
  etc: CommercialMoney | null;
  eac: CommercialMoney | null;
  vac: CommercialMoney | null;
  owner: string | null;
  sourceRefs: CanonicalSourceRef[];
  diagnostics: string[];
}

export type CommitmentKind =
  | "purchase_order"
  | "subcontract"
  | "service_agreement"
  | "other";

export interface CommitmentRecord {
  commitmentId: string;
  kind: CommitmentKind;
  counterparty: string | null;
  description: string | null;
  costCode: string | null;
  amount: CommercialMoney;
  committedAtIso: string | null;
  status: string | null;
  sourceRefs: CanonicalSourceRef[];
  diagnostics: string[];
}

export interface AccrualRecord {
  accrualId: string;
  periodId: string | null;
  costCode: string | null;
  amount: CommercialMoney;
  matchedInvoiceId: string | null;
  reversalIso: string | null;
  status: string | null;
  sourceRefs: CanonicalSourceRef[];
  diagnostics: string[];
}

export interface CostAllocationRule {
  ruleId: string;
  sourceType: string;
  targetCostCode: string;
  method:
    | "direct"
    | "proportional"
    | "formula"
    | "overhead"
    | "shared"
    | "manual";
  basis: string | null;
  percentage: number | null;
  formula: string | null;
  state: CanonicalValueState;
  sourceRefs: CanonicalSourceRef[];
}

export interface PaymentApplicationRecord {
  applicationId: string;
  certificateNo: string | null;
  submittedAtIso: string | null;
  amount: CommercialMoney;
  sourceRefs: CanonicalSourceRef[];
}

export interface PaymentAssessmentRecord {
  assessmentId: string;
  applicationId: string | null;
  assessedAtIso: string | null;
  amount: CommercialMoney;
  assessor: string | null;
  sourceRefs: CanonicalSourceRef[];
}

export interface PaymentCertificateRecord {
  certificateId: string;
  certificateNo: string;
  periodEndIso: string | null;
  applicationId: string | null;
  assessmentId: string | null;
  grossWork: CommercialMoney | null;
  variations: CommercialMoney | null;
  retentionDeduction: CommercialMoney | null;
  advanceRecovery: CommercialMoney | null;
  otherDeductions: CommercialMoney | null;
  taxAmount: CommercialMoney | null;
  netCertified: CommercialMoney | null;
  submittedAtIso: string | null;
  assessedAtIso: string | null;
  certifiedAtIso: string | null;
  certificationDueIso: string | null;
  paymentDueIso: string | null;
  status: string | null;
  vatBasis: string | null;
  sourceRefs: CanonicalSourceRef[];
  diagnostics: string[];
}

export interface PaymentReceiptRecord {
  receiptId: string;
  certificateId: string;
  paidAtIso: string | null;
  amount: CommercialMoney;
  bankReference: string | null;
  sourceRefs: CanonicalSourceRef[];
}

export interface AdvanceRecoveryRecord {
  recoveryId: string;
  certificateId: string | null;
  amount: CommercialMoney;
  contractualRecoveryPercent: number | null;
  cumulativeRecovered: CommercialMoney | null;
  remainingAdvance: CommercialMoney | null;
  sourceRefs: CanonicalSourceRef[];
}

export interface LatePaymentInterestRecord {
  interestId: string;
  certificateId: string | null;
  triggerIso: string | null;
  paidIso: string | null;
  interestRatePercent: number | null;
  dayBasis: string | null;
  calculatedAmount: CommercialMoney | null;
  claimedAmount: CommercialMoney | null;
  awardedAmount: CommercialMoney | null;
  sourceRefs: CanonicalSourceRef[];
}

export interface CbsNode {
  cbsCode: string;
  parentCbsCode: string | null;
  description: string | null;
  owner: string | null;
  sourceRefs: CanonicalSourceRef[];
}

export interface CommercialMappingRecord {
  mappingId: string;
  sourceDomain: "boq" | "payment" | "wbs" | "commitment" | "actual";
  sourceId: string;
  cbsCode: string;
  allocationPercent: number | null;
  state: CanonicalValueState;
  sourceRefs: CanonicalSourceRef[];
}

export interface CashFlowRecord {
  cashFlowId: string;
  periodId: string;
  currency: string;
  budget: number | null;
  forecast: number | null;
  certifiedIncome: number | null;
  paidIncome: number | null;
  expenditureBudget: number | null;
  actualExpenditure: number | null;
  state: CanonicalValueState;
  sourceRefs: CanonicalSourceRef[];
}

export interface CommercialVariationRecord {
  variationId: string;
  description: string | null;
  instructionId: string | null;
  notificationId: string | null;
  quotationId: string | null;
  approvalDateIso: string | null;
  claimedValue: CommercialMoney | null;
  assessedValue: CommercialMoney | null;
  agreedValue: CommercialMoney | null;
  certifiedValue: CommercialMoney | null;
  approvedContractSumImpact: CommercialMoney | null;
  timeImpactDays: number | null;
  status: string | null;
  authority: string | null;
  amendmentId: string | null;
  sourceRefs: CanonicalSourceRef[];
  diagnostics: string[];
}

export interface SiteInstructionRecord {
  instructionId: string;
  reference: string | null;
  issuedAtIso: string | null;
  issuer: string | null;
  recipient: string | null;
  description: string | null;
  direction: string | null;
  acknowledgementIso: string | null;
  responseIso: string | null;
  status: string | null;
  variationIds: string[];
  claimIds: string[];
  activityIds: string[];
  paymentIds: string[];
  nonComplianceState: string | null;
  escalationLevel: string | null;
  stopWorkOrder: boolean | null;
  sourceRefs: CanonicalSourceRef[];
}

export interface DayworkRecord {
  dayworkId: string;
  variationId: string | null;
  sheetReference: string | null;
  dateIso: string | null;
  laborAmount: CommercialMoney | null;
  plantAmount: CommercialMoney | null;
  materialAmount: CommercialMoney | null;
  totalAmount: CommercialMoney | null;
  status: string | null;
  sourceRefs: CanonicalSourceRef[];
}

export interface ProvisionalSumRecord {
  provisionalSumId: string;
  description: string | null;
  allowance: CommercialMoney | null;
  actual: CommercialMoney | null;
  adjustment: CommercialMoney | null;
  nominatedSubcontractor: string | null;
  status: string | null;
  sourceRefs: CanonicalSourceRef[];
}

export interface ContractObligationRecord {
  obligationId: string;
  type:
    | "notice"
    | "payment"
    | "insurance"
    | "bond"
    | "submission"
    | "milestone"
    | "reporting"
    | "time_bar"
    | "limitation"
    | "condition_precedent"
    | "other";
  responsibleParty: string | null;
  description: string;
  dueIso: string | null;
  occurrenceIso: string | null;
  clauseReference: string | null;
  status: string | null;
  state: CanonicalValueState;
  sourceRefs: CanonicalSourceRef[];
}

export interface SectionalLdRecord {
  ldId: string;
  sectionId: string | null;
  milestoneId: string | null;
  ratePerDay: CommercialMoney | null;
  capAmount: CommercialMoney | null;
  capPercent: number | null;
  contractualCompletionIso: string | null;
  takingOverIso: string | null;
  sourceRefs: CanonicalSourceRef[];
}

export interface CommercialInstrumentRecord {
  instrumentId: string;
  kind:
    | "performance_bond"
    | "advance_payment_bond"
    | "retention_guarantee"
    | "insurance"
    | "other";
  reference: string | null;
  issuer: string | null;
  beneficiary: string | null;
  requiredAmount: CommercialMoney | null;
  issuedAmount: CommercialMoney | null;
  issueIso: string | null;
  expiryIso: string | null;
  renewalIso: string | null;
  coverageType: string | null;
  status: string | null;
  calledAmount: CommercialMoney | null;
  claimedAmount: CommercialMoney | null;
  recoveredAmount: CommercialMoney | null;
  sourceRefs: CanonicalSourceRef[];
}

export interface RetentionRecord {
  retentionId: string;
  certificateId: string | null;
  withheld: CommercialMoney | null;
  released: CommercialMoney | null;
  remaining: CommercialMoney | null;
  expectedReleaseIso: string | null;
  actualReleaseIso: string | null;
  trigger: string | null;
  stage: string | null;
  capPercent: number | null;
  earlyRelease: boolean | null;
  guaranteeSubstitutionInstrumentId: string | null;
  sourceRefs: CanonicalSourceRef[];
}

export interface ContingencyRecord {
  reserveId: string;
  kind: "contingency" | "management_reserve";
  originalAmount: CommercialMoney | null;
  drawnAmount: CommercialMoney | null;
  releasedAmount: CommercialMoney | null;
  remainingAmount: CommercialMoney | null;
  linkedRiskIds: string[];
  approvalReference: string | null;
  sourceRefs: CanonicalSourceRef[];
}

export interface PriceAdjustmentRecord {
  adjustmentId: string;
  periodId: string | null;
  formula: string | null;
  baseDateIso: string | null;
  indexName: string | null;
  baseIndex: number | null;
  currentIndex: number | null;
  adjustmentAmount: CommercialMoney | null;
  sourceRefs: CanonicalSourceRef[];
}

export interface TaxRecord {
  taxId: string;
  relatedRecordId: string | null;
  jurisdiction: string | null;
  taxType: "vat" | "withholding" | "reverse_charge" | "other";
  ratePercent: number | null;
  taxableBase: CommercialMoney | null;
  taxAmount: CommercialMoney | null;
  invoiceReference: string | null;
  sourceRefs: CanonicalSourceRef[];
}

export interface FxRecord {
  fxId: string;
  dateIso: string | null;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  source: string | null;
  hedged: boolean | null;
  gainLoss: CommercialMoney | null;
  sourceRefs: CanonicalSourceRef[];
}

export interface CostAuditRecord {
  auditId: string;
  entityType: string;
  entityId: string;
  changedAtIso: string;
  actor: string | null;
  reason: string | null;
  before: unknown;
  after: unknown;
  sourceRefs: CanonicalSourceRef[];
}

export interface FinalAccountRecord {
  finalAccountId: string;
  originalContractSum: CommercialMoney | null;
  approvedVariations: CommercialMoney | null;
  approvedClaimAwards: CommercialMoney | null;
  revisedContractSum: CommercialMoney | null;
  certified: CommercialMoney | null;
  paid: CommercialMoney | null;
  settlement: CommercialMoney | null;
  balance: CommercialMoney | null;
  defectsLiabilityEndIso: string | null;
  performanceCertificateIso: string | null;
  state: "draft" | "review" | "approved" | "frozen";
  frozenAtIso: string | null;
  sourceRefs: CanonicalSourceRef[];
  diagnostics: string[];
}

export interface CommercialRiskRecord {
  riskId: string;
  description: string | null;
  probabilityRating: number | null;
  impactRating: number | null;
  probabilityPercent: number | null;
  score: number | null;
  owner: string | null;
  mitigation: string | null;
  trend: string | null;
  residualScore: number | null;
  costImpact: CommercialMoney | null;
  scheduleImpactDays: number | null;
  dependencyRiskIds: string[];
  sourceRefs: CanonicalSourceRef[];
}

export interface MonteCarloCommercialResult {
  resultId: string;
  revisionId: string | null;
  p10CompletionIso: string | null;
  p50CompletionIso: string | null;
  p80CompletionIso: string | null;
  p90CompletionIso: string | null;
  p10Cost: CommercialMoney | null;
  p50Cost: CommercialMoney | null;
  p80Cost: CommercialMoney | null;
  p90Cost: CommercialMoney | null;
  method: string;
  qraReady: boolean;
  driverIds: string[];
  sourceRefs: CanonicalSourceRef[];
}

export interface ContractRiskRecord {
  contractRiskId: string;
  clauseReference: string | null;
  severity: string | null;
  description: string | null;
  noticeDeadlineIso: string | null;
  recommendation: string | null;
  state: CanonicalValueState;
  sourceRefs: CanonicalSourceRef[];
}

export interface TenderClarificationRecord {
  clarificationId: string;
  query: string | null;
  issuedIso: string | null;
  response: string | null;
  responseIso: string | null;
  amendmentReference: string | null;
  sourceRefs: CanonicalSourceRef[];
}

export interface BidEvaluationRecord {
  bidId: string;
  bidder: string | null;
  technicalScore: number | null;
  commercialScore: number | null;
  totalScore: number | null;
  recommendation: string | null;
  state: CanonicalValueState;
  sourceRefs: CanonicalSourceRef[];
}

export interface TenderReadinessRecord {
  packageId: string;
  readinessState: "ready" | "incomplete" | "missing" | "not_applicable";
  returnableCount: number | null;
  missingReturnableCount: number | null;
  evidenceCutoffIso: string | null;
  reasons: string[];
  sourceRefs: CanonicalSourceRef[];
}

export interface CommercialRuntimeState {
  contractTerms: CommercialContractTerms;
  costEvmSnapshots: CostEvmSnapshot[];
  costCodes: CostCodeRecord[];
  commitments: CommitmentRecord[];
  accruals: AccrualRecord[];
  costAllocationRules: CostAllocationRule[];
  paymentApplications: PaymentApplicationRecord[];
  paymentAssessments: PaymentAssessmentRecord[];
  paymentCertificates: PaymentCertificateRecord[];
  paymentReceipts: PaymentReceiptRecord[];
  advanceRecoveries: AdvanceRecoveryRecord[];
  latePaymentInterest: LatePaymentInterestRecord[];
  cbsNodes: CbsNode[];
  mappings: CommercialMappingRecord[];
  cashFlow: CashFlowRecord[];
  variations: CommercialVariationRecord[];
  siteInstructions: SiteInstructionRecord[];
  dayworks: DayworkRecord[];
  provisionalSums: ProvisionalSumRecord[];
  obligations: ContractObligationRecord[];
  sectionalLd: SectionalLdRecord[];
  instruments: CommercialInstrumentRecord[];
  retentions: RetentionRecord[];
  contingency: ContingencyRecord[];
  priceAdjustments: PriceAdjustmentRecord[];
  taxes: TaxRecord[];
  fxRates: FxRecord[];
  costAuditTrail: CostAuditRecord[];
  finalAccounts: FinalAccountRecord[];
  risks: CommercialRiskRecord[];
  monteCarloResults: MonteCarloCommercialResult[];
  contractRisks: ContractRiskRecord[];
  tenderClarifications: TenderClarificationRecord[];
  bidEvaluations: BidEvaluationRecord[];
  tenderReadiness: TenderReadinessRecord[];
  sourceDocumentIds: string[];
  diagnostics: string[];
}

export function emptyCommercialRuntimeState(): CommercialRuntimeState {
  return {
    contractTerms: {
      originalContractValue: null,
      currentContractValue: null,
      originalCompletionIso: null,
      revisedCompletionIso: null,
      paymentPeriodDays: null,
      retentionPercent: null,
      retentionCapPercent: null,
      advancePaymentPercent: null,
      ldRatePerDay: null,
      ldCapPercent: null,
      noticePeriodDays: null,
      detailedClaimPeriodDays: null,
      amendments: [],
      sourceRefs: [],
      diagnostics: [],
    },
    costEvmSnapshots: [],
    costCodes: [],
    commitments: [],
    accruals: [],
    costAllocationRules: [],
    paymentApplications: [],
    paymentAssessments: [],
    paymentCertificates: [],
    paymentReceipts: [],
    advanceRecoveries: [],
    latePaymentInterest: [],
    cbsNodes: [],
    mappings: [],
    cashFlow: [],
    variations: [],
    siteInstructions: [],
    dayworks: [],
    provisionalSums: [],
    obligations: [],
    sectionalLd: [],
    instruments: [],
    retentions: [],
    contingency: [],
    priceAdjustments: [],
    taxes: [],
    fxRates: [],
    costAuditTrail: [],
    finalAccounts: [],
    risks: [],
    monteCarloResults: [],
    contractRisks: [],
    tenderClarifications: [],
    bidEvaluations: [],
    tenderReadiness: [],
    sourceDocumentIds: [],
    diagnostics: [],
  };
}
