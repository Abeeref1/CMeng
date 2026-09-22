export type CommercialFindingState =
  | "established"
  | "candidate"
  | "partial"
  | "missing"
  | "conflicted";

export type CommercialFindingAuthority =
  | "source"
  | "calculated"
  | "approved"
  | "candidate"
  | "mixed"
  | "missing";

export interface CommercialFindingBasis {
  asOfDate: string | null;
  method: string;
  sourceRefs: string[];
}

export interface CommercialFindingCoverage {
  known: number;
  total: number;
  percent: number | null;
}

export interface CommercialFinding<T> {
  value: T | null;
  basis: CommercialFindingBasis;
  coverage: CommercialFindingCoverage;
  authority: CommercialFindingAuthority;
  submitted: T | null;
  independent: T | null;
  gap: number | string | null;
  consequence: string | null;
  action: string | null;
  state: CommercialFindingState;
  diagnostics: string[];
}

export interface ContractSectionInput {
  documentId: string;
  documentRole:
    | "main"
    | "amendment"
    | "appendix"
    | "tender"
    | "replacement"
    | "other";
  basisState: string;
  revision: string;
  sourceHash: string;
  sectionKey: string;
  identifier: string | null;
  parentIdentifier: string | null;
  heading: string | null;
  text: string;
  startPage: number | null;
  sourceMode: "deterministic" | "ai_grounded";
  sectionStatus: "verified" | "unresolved";
}

export interface ContractAmendmentInput {
  documentId: string;
  effectiveDate: string | null;
  completionIso: string | null;
  incorporatedEotDays: number | null;
  state: "official" | "candidate";
  sourceRefs: string[];
  actions: Array<{
    targetIdentifier: string;
    action:
      | "amend"
      | "replace"
      | "delete"
      | "supplement"
      | "confirm"
      | "unknown";
    status: "resolved" | "external" | "ambiguous";
  }>;
}

export interface LdTermInput {
  rateState: "candidate" | "missing" | "conflicted";
  capState: "candidate" | "missing" | "conflicted";
  rate: {
    basis: string;
    amount: number | null;
    currency: string | null;
    percent: number | null;
    sourceRefs: string[];
  } | null;
  cap: {
    basis: string;
    amount: number | null;
    currency: string | null;
    percent: number | null;
    sourceRefs: string[];
  } | null;
  diagnostics: string[];
}

export interface ContractValueInput {
  amount: number;
  currency: string;
  sourceRefs: string[];
  authority: "approved" | "candidate";
}

export interface VariationInput {
  variationId: string;
  state: "pending" | "approved" | "rejected";
  amount: number;
  currency: string;
  sourceRefs: string[];
}

export interface FoundationMoneyInput {
  value: number | null;
  currency: string | null;
  taxBasis: "exclusive" | "inclusive" | "unknown";
  amountBasis: string;
  state:
    | "official"
    | "candidate"
    | "missing"
    | "partial"
    | "conflicted";
  asOf: string | null;
  sourceRefs: string[];
}

export interface FoundationCostMetricInput {
  metric: string;
  amount: FoundationMoneyInput;
  sourceStatus: string;
  cbsId: string | null;
  cbsDescription: string | null;
  parentCbsId: string | null;
  wbsId: string | null;
  counterparty: string | null;
  boqItemId: string | null;
  paymentId: string | null;
}

export type FoundationPaymentSeriesBasis =
  | "incremental"
  | "project_cumulative"
  | "certificate_cumulative"
  | "unknown";

export interface FoundationPaymentInput {
  paymentId: string;
  paymentType: string | null;
  periodEnd: string | null;
  sourceStatus: string;
  certifiedAmountBasis: FoundationPaymentSeriesBasis;
  paidAmountBasis: FoundationPaymentSeriesBasis;
  applicationDate: string | null;
  assessmentDate: string | null;
  certificationDate: string | null;
  certificationDueDate: string | null;
  paymentDueDate: string | null;
  paymentDate: string | null;
  paymentTimestamp: string | null;
  retentionReleaseDate: string | null;
  finalReceiptDate: string | null;
  paymentReference: string | null;
  amounts: Record<string, FoundationMoneyInput>;
  calculatedOutstandingAmount: FoundationMoneyInput;
  reconciliation: "matched" | "conflicted" | "unresolved";
  diagnostics: string[];
  sourceRefs: string[];
}

export interface CommercialFoundationInput {
  projectId: string;
  generatedAt: string;
  dataDateIso: string | null;
  contractValue: ContractValueInput | null;
  contractValueCandidates: ContractValueInput[];
  variations: VariationInput[];
  contractTimeBasis: {
    contractualCompletionIso: string | null;
    contractualCompletionState: string;
    sourceRefs: string[];
  } | null;
  ldTerms: LdTermInput | null;
  contractSections: ContractSectionInput[];
  amendments: ContractAmendmentInput[];
  costMetrics: FoundationCostMetricInput[];
  payments: FoundationPaymentInput[];
}

export interface CommercialClauseRecord {
  clauseKey: string;
  documentId: string;
  documentRole: ContractSectionInput["documentRole"];
  identifier: string | null;
  parentIdentifier: string | null;
  heading: string | null;
  startPage: number | null;
  governanceState: "effective" | "provisional" | "unresolved";
  sourceMode: ContractSectionInput["sourceMode"];
  sourceRef: string;
  textPreview: string;
}

export interface CommercialAmendmentRecord {
  documentId: string;
  effectiveDate: string | null;
  completionIso: string | null;
  incorporatedEotDays: number | null;
  state: "official" | "candidate";
  actions: ContractAmendmentInput["actions"];
  sourceRefs: string[];
}

export interface CommercialTermsProjection {
  capabilityKey: "commercial-terms";
  state: CommercialFindingState;
  originalContractValueByCurrency: Array<{
    currency: string;
    original: CommercialFinding<number>;
    approvedVariations: CommercialFinding<number>;
    current: CommercialFinding<number>;
  }>;
  contractCurrency: CommercialFinding<string>;
  contractualCompletionDate: CommercialFinding<string>;
  ldRate: CommercialFinding<string>;
  ldCap: CommercialFinding<string>;
  retentionPercent: CommercialFinding<number>;
  retentionCapPercent: CommercialFinding<number>;
  certificationPeriodDays: CommercialFinding<number>;
  paymentPeriodDays: CommercialFinding<number>;
  noticePeriodDays: CommercialFinding<number>;
  performanceBondRequirement: CommercialFinding<string>;
  advancePaymentBondRequirement: CommercialFinding<string>;
  insuranceRequirements: CommercialClauseRecord[];
  hierarchyAndPrecedenceClauses: CommercialClauseRecord[];
  clauses: CommercialClauseRecord[];
  amendments: CommercialAmendmentRecord[];
  diagnostics: string[];
}

export interface CostRegisterRecord {
  recordId: string;
  costCode: string | null;
  description: string | null;
  parentCostCode: string | null;
  wbsId: string | null;
  counterparty: string | null;
  currency: string;
  taxBasis: "exclusive" | "inclusive" | "unknown";
  metrics: Record<string, CommercialFinding<number>>;
  boqItemIds: string[];
  paymentIds: string[];
  sourceRefs: string[];
  state: CommercialFindingState;
  diagnostics: string[];
}

export interface CostRegisterProjection {
  capabilityKey: "cost-register";
  state: CommercialFindingState;
  recordCount: number;
  mappedCbsRecordCount: number;
  unmappedCbsRecordCount: number;
  mappingCoveragePercent: number | null;
  rows: CostRegisterRecord[];
  diagnostics: string[];
}

export interface PaymentRegisterRecord {
  paymentId: string;
  paymentType: string | null;
  certifiedAmountBasis: FoundationPaymentSeriesBasis;
  paidAmountBasis: FoundationPaymentSeriesBasis;
  periodEnd: string | null;
  sourceStatus: string;
  lifecycle: {
    applicationDate: string | null;
    assessmentDate: string | null;
    certificationDate: string | null;
    certificationDueDate: CommercialFinding<string>;
    paymentDueDate: CommercialFinding<string>;
    paymentDate: string | null;
    paymentTimestamp: string | null;
    retentionReleaseDate: string | null;
    finalReceiptDate: string | null;
    slaState:
      | "on_time"
      | "late"
      | "open"
      | "not_established";
  };
  amounts: Record<string, CommercialFinding<number>>;
  calculatedOutstandingAmount: CommercialFinding<number>;
  reconciliation: "matched" | "conflicted" | "unresolved";
  sourceRefs: string[];
  diagnostics: string[];
}

export interface PaymentRegisterProjection {
  capabilityKey: "payment-register";
  state: CommercialFindingState;
  recordCount: number;
  stageCoveragePercent: number | null;
  lifecycleCounts: {
    applied: number;
    assessed: number;
    certified: number;
    paid: number;
  };
  slaAssessmentState:
    | "established"
    | "partial"
    | "not_assessable";
  slaCounts: {
    paidOnTime: number | null;
    paidLate: number | null;
    overdueUnpaid: number | null;
    openUnpaid: number | null;
    notEstablished: number;
  };
  rows: PaymentRegisterRecord[];
  diagnostics: string[];
}

export interface CbsNode {
  costCode: string;
  description: string | null;
  parentCostCode: string | null;
  currencies: Array<{
    currency: string;
    taxBasis: "exclusive" | "inclusive" | "unknown";
    metrics: Record<string, CommercialFinding<number>>;
  }>;
  childCostCodes: string[];
  wbsIds: string[];
  boqItemIds: string[];
  paymentIds: string[];
  sourceRefs: string[];
}

export interface CbsBreakdownProjection {
  capabilityKey: "cbs-breakdown";
  state: CommercialFindingState;
  nodeCount: number;
  rootCostCodes: string[];
  unmappedCostMetricCount: number;
  mappingCoveragePercent: number | null;
  nodes: CbsNode[];
  diagnostics: string[];
}

export interface CommercialFoundationProjection {
  schemaVersion: "1.0";
  projectionKey: "commercial_foundation";
  producerVersion: "commercial-foundation-v1";
  generatedAt: string;
  projectId: string;
  dataDateIso: string | null;
  commercialTerms: CommercialTermsProjection;
  costRegister: CostRegisterProjection;
  paymentRegister: PaymentRegisterProjection;
  cbsBreakdown: CbsBreakdownProjection;
  diagnostics: string[];
}
