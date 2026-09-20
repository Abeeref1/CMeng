export type CommercialAuthority =
  | "official"
  | "approved"
  | "certified"
  | "paid"
  | "governed_source"
  | "calculated"
  | "provisional"
  | "candidate"
  | "missing"
  | "conflicted";

export type CommercialValueState =
  | "established"
  | "missing"
  | "not_applicable"
  | "not_assessable"
  | "conflicted";

export interface CommercialSourceRef {
  sourceId: string;
  locator: string | null;
  revisionId: string | null;
}

export interface CommercialFact<T> {
  value: T | null;
  unit: string | null;
  state: CommercialValueState;
  authority: CommercialAuthority;
  effectiveAt: string | null;
  sourceRefs: CommercialSourceRef[];
  method: string;
  diagnostics: string[];
}

export interface MoneyAmount {
  amount: number;
  currency: string;
  vatBasis:
    | "exclusive"
    | "inclusive"
    | "not_stated";
}

export interface ContractAmendmentRecord {
  amendmentId: string;
  number: string | null;
  title: string;
  effectiveDateIso: string | null;
  precedence:
    | "amends_contract"
    | "supplemental"
    | "replacement"
    | "unknown";
  amendmentValue: CommercialFact<MoneyAmount>;
  revisedContractValue: CommercialFact<MoneyAmount>;
  eotDays: CommercialFact<number>;
  revisedCompletionIso: CommercialFact<string>;
  claimNoticeDays: CommercialFact<number>;
  fullyDetailedClaimDays: CommercialFact<number>;
  changedClauses: string[];
  termComparisons: Array<{
    term: string;
    before: string | number | null;
    after: string | number | null;
    unit: string | null;
    authority: CommercialAuthority;
  }>;
  sourceRefs: CommercialSourceRef[];
}

export interface ContractNoticeTerm {
  termId: string;
  noticeType: string;
  days: CommercialFact<number>;
  trigger: string | null;
  clauseIdentifier: string | null;
}

export interface ContractInstrumentRequirement {
  requirementId: string;
  kind:
    | "performance_bond"
    | "advance_payment_bond"
    | "insurance"
    | "retention"
    | "other";
  requiredAmount: CommercialFact<MoneyAmount>;
  requiredPercent: CommercialFact<number>;
  expiryRule: CommercialFact<string>;
  clauseIdentifier: string | null;
  sourceRefs: CommercialSourceRef[];
}

export interface CommercialTermsSnapshot {
  projectId: string;
  currency: CommercialFact<string>;
  vatBasis: CommercialFact<"exclusive" | "inclusive">;
  originalContractValue: CommercialFact<MoneyAmount>;
  currentContractValue: CommercialFact<MoneyAmount>;
  commencementDateIso: CommercialFact<string>;
  originalCompletionIso: CommercialFact<string>;
  revisedCompletionIso: CommercialFact<string>;
  paymentTerms: CommercialFact<string>;
  retentionPercent: CommercialFact<number>;
  retentionCapPercent: CommercialFact<number>;
  ldRatePerDay: CommercialFact<MoneyAmount>;
  ldCapAmount: CommercialFact<MoneyAmount>;
  ldCapPercent: CommercialFact<number>;
  noticeTerms: ContractNoticeTerm[];
  instruments: ContractInstrumentRequirement[];
  amendments: ContractAmendmentRecord[];
  precedence: string[];
  diagnostics: string[];
}

export interface EvmSnapshot {
  dataDateIso: string | null;
  currency: string | null;
  bac: CommercialFact<MoneyAmount>;
  pv: CommercialFact<MoneyAmount>;
  ev: CommercialFact<MoneyAmount>;
  ac: CommercialFact<MoneyAmount>;
  spi: CommercialFact<number>;
  cpi: CommercialFact<number>;
  etc: CommercialFact<MoneyAmount>;
  eac: CommercialFact<MoneyAmount>;
  vac: CommercialFact<MoneyAmount>;
  sourceRefs: CommercialSourceRef[];
  diagnostics: string[];
}

export interface PaymentCertificateRecord {
  paymentId: string;
  type:
    | "ipc"
    | "advance_payment"
    | "retention_release"
    | "final_account"
    | "other";
  applicationDateIso: string | null;
  assessmentDateIso: string | null;
  certificateDateIso: string | null;
  paymentDueDateIso: string | null;
  paidDateIso: string | null;
  grossCertified: MoneyAmount | null;
  retentionWithheld: MoneyAmount | null;
  advanceRecovery: MoneyAmount | null;
  otherDeductions: MoneyAmount | null;
  netCertified: MoneyAmount | null;
  paidAmount: MoneyAmount | null;
  outstandingAmount: MoneyAmount | null;
  applicationStageAuthority: CommercialAuthority;
  assessmentStageAuthority: CommercialAuthority;
  certificationStageAuthority: CommercialAuthority;
  receiptStageAuthority: CommercialAuthority;
  sourceRefs: CommercialSourceRef[];
  diagnostics: string[];
}

export interface VariationRecord {
  variationId: string;
  description: string | null;
  lifecycleState:
    | "instruction"
    | "notified"
    | "quoted"
    | "assessed"
    | "agreed"
    | "approved"
    | "certified"
    | "rejected"
    | "unknown";
  instructionReference: string | null;
  approvalDateIso: string | null;
  claimedValue: MoneyAmount | null;
  assessedValue: MoneyAmount | null;
  agreedValue: MoneyAmount | null;
  approvedValue: MoneyAmount | null;
  certifiedValue: MoneyAmount | null;
  timeImpactDays: number | null;
  authority: CommercialAuthority;
  sourceRefs: CommercialSourceRef[];
  diagnostics: string[];
}

export interface CbsNode {
  cbsCode: string;
  parentCbsCode: string | null;
  description: string | null;
  source:
    | "boq"
    | "cost_register"
    | "manual";
  budget: MoneyAmount | null;
  commitment: MoneyAmount | null;
  certified: MoneyAmount | null;
  paid: MoneyAmount | null;
  actual: MoneyAmount | null;
  etc: MoneyAmount | null;
  eac: MoneyAmount | null;
  vac: MoneyAmount | null;
  sourceRefs: CommercialSourceRef[];
}

export interface CommercialMappingSummary {
  boqRowCount: number;
  mappedBoqRowCount: number;
  unmappedBoqRowCount: number;
  paymentRowCount: number;
  mappedPaymentRowCount: number;
  unmappedPaymentRowCount: number;
  wbsCount: number;
  mappedWbsCount: number;
  unmappedWbsCount: number;
  completenessPercent: number | null;
}

export interface CommitmentRecord {
  commitmentId: string;
  type:
    | "purchase_order"
    | "subcontract"
    | "service_agreement"
    | "other";
  supplier: string | null;
  cbsCode: string | null;
  committedAmount: MoneyAmount | null;
  approvedAmount: MoneyAmount | null;
  status: string;
  sourceRefs: CommercialSourceRef[];
}

export interface AccrualRecord {
  accrualId: string;
  period: string | null;
  cbsCode: string | null;
  amount: MoneyAmount | null;
  invoiceReference: string | null;
  reversed: boolean | null;
  authority: CommercialAuthority;
  sourceRefs: CommercialSourceRef[];
}

export interface CashFlowPeriod {
  periodStartIso: string | null;
  currency: string;
  budget: number | null;
  forecast: number | null;
  certifiedIncome: number | null;
  paidIncome: number | null;
  actualExpenditure: number | null;
  sourceRefs: CommercialSourceRef[];
}

export interface CommercialCanonicalModel {
  schemaVersion: "1.0";
  projectId: string;
  dataDateIso: string | null;
  terms: CommercialTermsSnapshot;
  evm: EvmSnapshot | null;
  cbs: CbsNode[];
  payments: PaymentCertificateRecord[];
  variations: VariationRecord[];
  commitments: CommitmentRecord[];
  accruals: AccrualRecord[];
  cashFlow: CashFlowPeriod[];
  mapping: CommercialMappingSummary;
  currencies: string[];
  sourceDocumentIds: string[];
  diagnostics: string[];
}

export interface CostControlSummary {
  currency: string | null;
  bac: number | null;
  pv: number | null;
  ev: number | null;
  ac: number | null;
  spi: number | null;
  cpi: number | null;
  etc: number | null;
  eac: number | null;
  vac: number | null;
  forecastOverrun: number | null;
  evmReconciliation: {
    sourceSpi: number | null;
    calculatedSpi: number | null;
    sourceCpi: number | null;
    calculatedCpi: number | null;
    sourceEac: number | null;
    calculatedBottomUpEac: number | null;
    states: string[];
  };
}

export interface CommercialReconciliation {
  currency: string | null;
  originalContract: number | null;
  approvedVariations: number | null;
  revisedContract: number | null;
  certified: number | null;
  paid: number | null;
  outstandingCertified: number | null;
  remainingToContract: number | null;
  balanceState:
    | "established"
    | "partial"
    | "not_assessable";
  diagnostics: string[];
}
