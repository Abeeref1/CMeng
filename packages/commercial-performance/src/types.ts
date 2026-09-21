import type {
  CommercialFinding,
  CommercialFindingState,
  CommercialFoundationProjection,
} from "../../commercial-foundation/src";

export interface PerformanceSourceReceipt {
  documentId: string;
  locator: string;
  sourceRef: string;
}

export interface PerformanceCostSnapshotInput {
  currency: string;
  taxBasis: "exclusive" | "inclusive" | "unknown";
  asOf: string;
  state:
    | "official"
    | "candidate"
    | "partial"
    | "conflicted"
    | "missing";
  values: Record<string, number | null>;
  sourceRefs: string[];
  diagnostics: string[];
}

export interface PerformanceCostMetricInput {
  metric: string;
  value: number | null;
  currency: string | null;
  taxBasis: "exclusive" | "inclusive" | "unknown";
  asOf: string | null;
  state:
    | "official"
    | "candidate"
    | "missing"
    | "partial"
    | "conflicted";
  sourceStatus: string;
  cbsId: string | null;
  wbsId: string | null;
  sourceRefs: string[];
}

export type PerformancePaymentSeriesBasis =
  | "incremental"
  | "project_cumulative"
  | "certificate_cumulative"
  | "unknown";

export interface PerformancePaymentInput {
  paymentId: string;
  periodEnd: string | null;
  certificationDate: string | null;
  paymentDate: string | null;
  currency: string | null;
  certifiedAmount: number | null;
  certifiedAmountBasis: PerformancePaymentSeriesBasis;
  paidAmount: number | null;
  paidAmountBasis: PerformancePaymentSeriesBasis;
  sourceRefs: string[];
}

export interface CommercialPerformanceInput {
  projectId: string;
  generatedAt: string;
  dataDateIso: string | null;
  foundation: CommercialFoundationProjection;
  costSnapshots: PerformanceCostSnapshotInput[];
  costMetrics: PerformanceCostMetricInput[];
  payments: PerformancePaymentInput[];
}

export interface EacScenario {
  method:
    | "source_reported"
    | "bac_over_cpi"
    | "ac_plus_remaining_budget"
    | "bottom_up_etc";
  value: CommercialFinding<number>;
  methodology:
    string;
  official: boolean;
}

export interface CostControlPosition {
  currency: string;
  taxBasis:
    | "exclusive"
    | "inclusive"
    | "unknown";
  asOf: string;
  bac: CommercialFinding<number>;
  pv: CommercialFinding<number>;
  ev: CommercialFinding<number>;
  ac: CommercialFinding<number>;
  sourceEac: CommercialFinding<number>;
  sourceEtc: CommercialFinding<number>;
  sourceVac: CommercialFinding<number>;
  sv: CommercialFinding<number>;
  cv: CommercialFinding<number>;
  spi: CommercialFinding<number>;
  cpi: CommercialFinding<number>;
  calculatedVac:
    CommercialFinding<number>;
  tcpiBudget:
    CommercialFinding<number>;
  tcpiForecast:
    CommercialFinding<number>;
  eacScenarios: EacScenario[];
  forecastMethodState:
    | "source_reported"
    | "scenarios_only"
    | "not_established";
  varianceDecomposition: {
    price:
      CommercialFinding<number>;
    quantity:
      CommercialFinding<number>;
    productivity:
      CommercialFinding<number>;
  };
  sourceRefs: string[];
  diagnostics: string[];
}

export interface CostControlProjection {
  capabilityKey:
    "cost-control";
  state: CommercialFindingState;
  positions:
    CostControlPosition[];
  managementSummary: string[];
  diagnostics: string[];
}

export interface EvmPerformancePoint {
  asOf: string;
  pv: CommercialFinding<number>;
  ev: CommercialFinding<number>;
  ac: CommercialFinding<number>;
  spi: CommercialFinding<number>;
  cpi: CommercialFinding<number>;
  sv: CommercialFinding<number>;
  cv: CommercialFinding<number>;
}

export interface EvmPerformanceSeries {
  currency: string;
  taxBasis:
    | "exclusive"
    | "inclusive"
    | "unknown";
  points: EvmPerformancePoint[];
  pointCount: number;
  completePvEvAcPointCount: number;
  coveragePercent: number | null;
  futureExcludedPointCount: number;
  diagnostics: string[];
}

export interface EvmPerformanceProjection {
  capabilityKey:
    "evm-performance";
  state: CommercialFindingState;
  series: EvmPerformanceSeries[];
  documentedVsCalculated:
    "separated";
  diagnostics: string[];
}

export interface CashFlowEntry {
  entryId: string;
  periodDate: string;
  currency: string;
  kind:
    | "certified_income"
    | "paid_income"
    | "expenditure_budget"
    | "expenditure_forecast"
    | "actual_expenditure";
  amount: CommercialFinding<number>;
  sourceRefs: string[];
}

export interface CashFlowCurrencyPosition {
  currency: string;
  entries: CashFlowEntry[];
  certifiedIncome:
    CommercialFinding<number>;
  paidIncome:
    CommercialFinding<number>;
  expenditureBudget:
    CommercialFinding<number>;
  expenditureForecast:
    CommercialFinding<number>;
  actualExpenditure:
    CommercialFinding<number>;
  netCashPosition:
    CommercialFinding<number>;
  peakFundingNeed:
    CommercialFinding<number>;
  cumulativeActualSeries:
    Array<{
      asOf: string;
      cumulativeIncome:
        number | null;
      cumulativeExpenditure:
        number | null;
      net:
        number | null;
    }>;
  diagnostics: string[];
}

export interface CashFlowProjection {
  capabilityKey:
    "cash-flow-register";
  state: CommercialFindingState;
  currencies:
    CashFlowCurrencyPosition[];
  diagnostics: string[];
}

export interface CostScurvePoint {
  asOf: string;
  plannedCost:
    CommercialFinding<number>;
  earnedValue:
    CommercialFinding<number>;
  actualCost:
    CommercialFinding<number>;
  sourceEac:
    CommercialFinding<number>;
  remainingCost:
    CommercialFinding<number>;
}

export interface CostScurveSeries {
  currency: string;
  taxBasis:
    | "exclusive"
    | "inclusive"
    | "unknown";
  points: CostScurvePoint[];
  futureExcludedPointCount: number;
  cbsIds: string[];
  wbsIds: string[];
  sourceRefs: string[];
  diagnostics: string[];
}

export interface CostScurveProjection {
  capabilityKey:
    "cost-scurve";
  state: CommercialFindingState;
  series: CostScurveSeries[];
  diagnostics: string[];
}

export interface CommercialPerformanceProjection {
  schemaVersion: "1.0";
  projectionKey:
    "commercial_performance";
  producerVersion:
    "commercial-performance-v1";
  generatedAt: string;
  projectId: string;
  dataDateIso: string | null;
  foundationProducerVersion:
    CommercialFoundationProjection["producerVersion"];
  costControl:
    CostControlProjection;
  evmPerformance:
    EvmPerformanceProjection;
  cashFlow:
    CashFlowProjection;
  costScurve:
    CostScurveProjection;
  diagnostics: string[];
}
