import type {
  CommercialFinding,
  CommercialFindingState,
} from "../../commercial-foundation/src";

export interface ContractControlMoney {
  value: number | null;
  currency: string | null;
  state:
    | "official"
    | "candidate"
    | "partial"
    | "missing"
    | "conflicted";
  asOf: string | null;
  sourceRefs: string[];
}

export interface VariationControlInput {
  variationId: string;
  description: string;
  status: string;
  authority: string | null;
  instructionId: string | null;
  instructionDate: string | null;
  submittedDate: string | null;
  quotationDate: string | null;
  assessedDate: string | null;
  agreedDate: string | null;
  approvalDate: string | null;
  scheduleImpactDays: number | null;
  claimId: string | null;
  paymentId: string | null;
  activityIds: string[];
  clauseIdentifiers: string[];
  claimedAmount: ContractControlMoney;
  assessedAmount: ContractControlMoney;
  agreedAmount: ContractControlMoney;
  approvedAmount: ContractControlMoney;
  sourceRefs: string[];
}

export interface SiteInstructionControlInput {
  instructionId: string;
  description: string;
  issueDate: string | null;
  status: string;
  variationId: string | null;
  quotationDueDate: string | null;
  quotationDate: string | null;
  scheduleImpactDays: number | null;
  claimId: string | null;
  paymentId: string | null;
  activityIds: string[];
  clauseIdentifiers: string[];
  estimatedAmount: ContractControlMoney;
  sourceRefs: string[];
}

export interface ObligationControlInput {
  obligationId: string;
  clauseIdentifier: string | null;
  description: string;
  responsibleParty: string | null;
  dueDate: string | null;
  completedDate: string | null;
  status: string;
  evidenceReference: string | null;
  sourceRefs: string[];
}

export interface ContractClauseCandidateInput {
  clauseKey: string;
  identifier: string | null;
  heading: string | null;
  governanceState:
    | "effective"
    | "provisional"
    | "unresolved";
  textPreview: string;
  sourceRef: string;
}

export interface BondControlInput {
  bondId: string;
  kind:
    | "performance"
    | "advance_payment"
    | "retention"
    | "other";
  status:
    | "active"
    | "expired"
    | "released";
  expiryIso: string | null;
  amount: number;
  currency: string;
  sourceRefs: string[];
}

export interface InsuranceControlInput {
  policyId: string;
  kind: string;
  insurer: string | null;
  status: string;
  inceptionDate: string | null;
  expiryDate: string | null;
  coverageAmount: ContractControlMoney;
  sourceRequirement: string | null;
  sourceRefs: string[];
}

export interface RetentionControlInput {
  retentionId: string;
  certificateNo: string | null;
  state: string;
  trigger: string | null;
  dueDate: string | null;
  releaseDate: string | null;
  amount: ContractControlMoney;
  sourceRefs: string[];
}

export interface ExistingRetentionInput {
  retentionId: string;
  state:
    | "held"
    | "released";
  amount: number;
  currency: string;
  sourceRefs: string[];
}

export interface PaymentRetentionInput {
  paymentId: string;
  periodEnd: string | null;
  retentionDeduction:
    ContractControlMoney;
  retentionReleaseDate:
    string | null;
  sourceRefs: string[];
}

export interface RawLdTermInput {
  rateState:
    | "candidate"
    | "missing"
    | "conflicted";
  capState:
    | "candidate"
    | "missing"
    | "conflicted";
  rate: {
    basis:
      | "fixed_amount_per_day"
      | "fixed_amount_per_week"
      | "percent_contract_amount_per_day"
      | "percent_contract_amount_per_week";
    amount: number | null;
    currency: string | null;
    percent: number | null;
    sourceRefs: string[];
  } | null;
  cap: {
    basis:
      | "fixed_amount"
      | "percent_contract_amount";
    amount: number | null;
    currency: string | null;
    percent: number | null;
    sourceRefs: string[];
  } | null;
  diagnostics: string[];
}

export interface ContractValuePositionInput {
  currency: string;
  value: number | null;
  state: CommercialFindingState;
  sourceRefs: string[];
}

export interface LdTimePositionInput {
  contractualCompletionIso:
    string | null;
  contractualCompletionState:
    string;
  programmeCompletionIso:
    string | null;
  programmeCompletionMethod:
    string;
  programmeSourceRefs:
    string[];
  claimedEotDays:
    number | null;
  claimedEotCoveragePercent:
    number | null;
  assessedEotDays:
    number | null;
  assessedEotCoveragePercent:
    number | null;
  awardedEotDays:
    number | null;
  awardedEotState:
    string;
  awardedOverlapResolution:
    "resolved"
    | "unresolved"
    | "not_applicable";
  eotSourceRefs: string[];
}

export interface ContractControlsInput {
  projectId: string;
  generatedAt: string;
  dataDateIso: string | null;
  variations: VariationControlInput[];
  siteInstructions:
    SiteInstructionControlInput[];
  obligations:
    ObligationControlInput[];
  contractClauses:
    ContractClauseCandidateInput[];
  bonds: BondControlInput[];
  insurances:
    InsuranceControlInput[];
  retentions:
    RetentionControlInput[];
  existingRetentions:
    ExistingRetentionInput[];
  paymentRetentions:
    PaymentRetentionInput[];
  retentionPercent:
    CommercialFinding<number>;
  retentionCapPercent:
    CommercialFinding<number>;
  performanceBondRequirement:
    CommercialFinding<string>;
  advancePaymentBondRequirement:
    CommercialFinding<string>;
  insuranceRequirementCount: number;
  ldTerms: RawLdTermInput | null;
  contractValues:
    ContractValuePositionInput[];
  ldTime: LdTimePositionInput;
}

export interface VariationLifecycleRecord {
  variationId: string;
  description: string;
  lifecycleStage:
    | "instruction"
    | "submitted"
    | "quoted"
    | "assessed"
    | "agreed"
    | "approved"
    | "rejected"
    | "unknown";
  status: string;
  authority: string | null;
  dates: {
    instruction: string | null;
    submitted: string | null;
    quotation: string | null;
    assessed: string | null;
    agreed: string | null;
    approved: string | null;
  };
  ageDays:
    CommercialFinding<number>;
  cost: {
    claimed:
      CommercialFinding<number>;
    assessed:
      CommercialFinding<number>;
    agreed:
      CommercialFinding<number>;
    approved:
      CommercialFinding<number>;
  };
  scheduleImpactDays:
    CommercialFinding<number>;
  instructionId: string | null;
  claimId: string | null;
  paymentId: string | null;
  activityIds: string[];
  clauseIdentifiers: string[];
  linkageCoveragePercent:
    number | null;
  sourceRefs: string[];
  diagnostics: string[];
}

export interface VariationsProjection {
  capabilityKey: "variations";
  state: CommercialFindingState;
  recordCount: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  lifecycleCoveragePercent:
    number | null;
  scheduleLinkCoveragePercent:
    number | null;
  claimLinkCoveragePercent:
    number | null;
  paymentLinkCoveragePercent:
    number | null;
  rows: VariationLifecycleRecord[];
  diagnostics: string[];
}

export interface SiteInstructionRecord {
  instructionId: string;
  description: string;
  issueDate: string | null;
  status: string;
  quotationDueDate:
    CommercialFinding<string>;
  quotationDate: string | null;
  quotationTimeliness:
    | "on_time"
    | "late"
    | "open"
    | "not_established";
  openAgeDays:
    CommercialFinding<number>;
  estimatedAmount:
    CommercialFinding<number>;
  scheduleImpactDays:
    CommercialFinding<number>;
  variationId: string | null;
  claimId: string | null;
  paymentId: string | null;
  activityIds: string[];
  clauseIdentifiers: string[];
  sourceRefs: string[];
}

export interface SiteInstructionsProjection {
  capabilityKey:
    "site-instructions";
  state: CommercialFindingState;
  recordCount: number;
  unquotedCount: number;
  overdueQuotationCount: number;
  convertedVariationCount: number;
  rows: SiteInstructionRecord[];
  diagnostics: string[];
}

export interface ObligationRecord {
  obligationId: string;
  origin:
    | "explicit_register"
    | "contract_clause_candidate";
  clauseIdentifier: string | null;
  description: string;
  responsibleParty: string | null;
  dueDate: string | null;
  completedDate: string | null;
  status:
    | "complete"
    | "open"
    | "overdue"
    | "candidate"
    | "unresolved";
  daysToDue:
    CommercialFinding<number>;
  evidenceReference: string | null;
  sourceRefs: string[];
  diagnostics: string[];
}

export interface ContractObligationsProjection {
  capabilityKey:
    "contract-obligations";
  state: CommercialFindingState;
  recordCount: number;
  explicitRecordCount: number;
  clauseCandidateCount: number;
  overdueCount: number;
  completeCount: number;
  rows: ObligationRecord[];
  diagnostics: string[];
}

export interface LdScenario {
  scenario:
    | "no_eot"
    | "claimed_eot"
    | "assessed_eot"
    | "awarded_eot";
  eotDays:
    CommercialFinding<number>;
  adjustedCompletion:
    CommercialFinding<string>;
  forecastCompletion:
    CommercialFinding<string>;
  exposureDays:
    CommercialFinding<number>;
  currency: string | null;
  uncappedExposure:
    CommercialFinding<number>;
  capAmount:
    CommercialFinding<number>;
  cappedExposure:
    CommercialFinding<number>;
  rateBasis: string | null;
  diagnostics: string[];
}

export interface LiquidatedDamagesProjection {
  capabilityKey:
    "liquidated-damages";
  state: CommercialFindingState;
  rateState:
    CommercialFindingState;
  capState:
    CommercialFindingState;
  scenarios: LdScenario[];
  diagnostics: string[];
}

export interface BondPosition {
  bondId: string;
  kind: BondControlInput["kind"];
  status: BondControlInput["status"];
  amount:
    CommercialFinding<number>;
  expiryDate: string | null;
  daysToExpiry:
    CommercialFinding<number>;
  expiryState:
    | "expired"
    | "expiring_30"
    | "expiring_90"
    | "valid"
    | "date_missing";
  sourceRefs: string[];
}

export interface InsurancePosition {
  policyId: string;
  kind: string;
  insurer: string | null;
  status: string;
  coverageAmount:
    CommercialFinding<number>;
  inceptionDate: string | null;
  expiryDate: string | null;
  daysToExpiry:
    CommercialFinding<number>;
  expiryState:
    | "expired"
    | "expiring_30"
    | "expiring_90"
    | "valid"
    | "date_missing";
  sourceRequirement: string | null;
  sourceRefs: string[];
}

export interface BondsInsuranceProjection {
  capabilityKey:
    "bonds-insurance";
  state: CommercialFindingState;
  performanceBondRequirement:
    CommercialFinding<string>;
  advancePaymentBondRequirement:
    CommercialFinding<string>;
  insuranceRequirementCount: number;
  activeBondCount: number;
  expiredBondCount: number;
  expiringBondCount: number;
  activeInsuranceCount: number;
  expiredInsuranceCount: number;
  expiringInsuranceCount: number;
  bonds: BondPosition[];
  insurances: InsurancePosition[];
  diagnostics: string[];
}

export interface RetentionCalendarRecord {
  retentionId: string;
  origin:
    | "explicit_register"
    | "governed_control"
    | "payment_deduction";
  certificateNo: string | null;
  state: string;
  trigger: string | null;
  amount:
    CommercialFinding<number>;
  dueDate:
    CommercialFinding<string>;
  releaseDate: string | null;
  daysToDue:
    CommercialFinding<number>;
  sourceRefs: string[];
  diagnostics: string[];
}

export interface RetentionCalendarProjection {
  capabilityKey:
    "retention-calendar";
  state: CommercialFindingState;
  retentionPercent:
    CommercialFinding<number>;
  retentionCapPercent:
    CommercialFinding<number>;
  recordCount: number;
  heldCount: number;
  releasedCount: number;
  dueCount: number;
  overdueCount: number;
  rows:
    RetentionCalendarRecord[];
  diagnostics: string[];
}

export interface ContractControlsProjection {
  schemaVersion: "1.0";
  projectionKey:
    "commercial_contract_controls";
  producerVersion:
    "commercial-contract-controls-v1";
  generatedAt: string;
  projectId: string;
  dataDateIso: string | null;
  variations: VariationsProjection;
  siteInstructions:
    SiteInstructionsProjection;
  contractObligations:
    ContractObligationsProjection;
  liquidatedDamages:
    LiquidatedDamagesProjection;
  bondsInsurance:
    BondsInsuranceProjection;
  retentionCalendar:
    RetentionCalendarProjection;
  diagnostics: string[];
}
