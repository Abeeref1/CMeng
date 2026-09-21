import type { CanonicalCommercialModel } from "../../runtime-api/src/commercial-canonical";
import type { CommercialFoundationProjection } from "../../commercial-foundation/src";
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

export type CommercialEvidenceState =
  | "established"
  | "candidate"
  | "submitted_unparsed"
  | "not_submitted"
  | "not_applicable";

export interface CommercialMetric<T> {
  value: T | null;
  state: CommercialEvidenceState;
  sourceRefs: string[];
  diagnostics: string[];
}

export interface CommercialMoneyPosition {
  currency: string;
  netCertifiedAmount?: CommercialMetric<number>;
  committedContractValue:
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

export interface CommercialControlInput {
  sourceLedger?: CanonicalCommercialModel;
  foundation: CommercialFoundationProjection;
  generatedAt: string;
  projectId: string;
  contractValue: MoneyValue | null;
  contractValueCandidates?: MoneyValue[];
  variations: VariationRecord[];
  invoices: InvoiceRecord[];
  retentions: RetentionRecord[];
  bonds: BondRecord[];
  claimCommercials: ClaimCommercialRecord[];
  contractTimeBasis: ContractTimeBasis | null;
  commercialEvidenceSubmitted: boolean;
  paymentEvidenceSubmitted: boolean;
  variationEvidenceSubmitted: boolean;
  bondEvidenceSubmitted: boolean;
  claimEvidenceSubmitted: boolean;
}

export interface CommercialControlPosition {
  sourceLedger?: CanonicalCommercialModel;
  foundation: CommercialFoundationProjection;
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
  variationCount: number;
  invoiceCount: number;
  retentionRecordCount: number;
  bondCount: number;
  claimCommercialCount: number;
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
