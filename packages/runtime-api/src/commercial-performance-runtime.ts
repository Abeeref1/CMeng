import {
  buildCommercialPerformance,
  type CommercialPerformanceProjection,
} from "../../commercial-performance/src";
import type {
  CommercialMoney,
} from "./commercial-canonical";
import {
  commercialCanonical,
} from "./commercial-canonical";
import {
  commercialFoundationForState,
} from "./commercial-foundation-runtime";
import {
  projectDataDate,
} from "./canonical-time-claims";
import type {
  ModuleRuntimeResult,
  ProjectRuntimeState,
} from "./project-state-types";
import type {
  SourceReceipt,
} from "../../truth-kernel/src";

export const commercialPerformanceCapabilities = [
  {
    key: "cost-control",
    title: "Cost Control",
    tier: 2,
  },
  {
    key: "evm-performance",
    title:
      "EVM Curves & Performance",
    tier: 2,
  },
  {
    key: "cash-flow-register",
    title: "Cash Flow Register",
    tier: 2,
  },
  {
    key: "cost-scurve",
    title: "Cost S-Curve",
    tier: 2,
  },
] as const;

function receiptRef(
  receipt: SourceReceipt,
): string {
  return (
    "evidence-document:" +
    receipt.documentId +
    ":" +
    receipt.locator
  );
}

function moneyRefs(
  money: CommercialMoney,
): string[] {
  return money.receipts.map(
    receiptRef,
  );
}

const cache = new WeakMap<
  ProjectRuntimeState,
  {
    version: number;
    value:
      CommercialPerformanceProjection;
  }
>();

export function commercialPerformanceForState(
  state: ProjectRuntimeState,
  generatedAt = new Date().toISOString(),
): CommercialPerformanceProjection {
  const prior =
    cache.get(state);
  if (
    prior?.version ===
    state.version
  ) {
    return prior.value;
  }

  const ledger =
    commercialCanonical(state);
  const foundation =
    commercialFoundationForState(
      state,
      generatedAt,
    );

  const performance =
    buildCommercialPerformance({
      projectId:
        state.projectId,
      generatedAt,
      dataDateIso:
        projectDataDate(state),
      foundation,
      costSnapshots:
        ledger.costPosition.map(
          (snapshot) => ({
            currency:
              snapshot.currency,
            taxBasis:
              snapshot.taxBasis as
                | "exclusive"
                | "inclusive"
                | "unknown",
            asOf:
              snapshot.asOf,
            state:
              snapshot.state,
            values: {
              ...snapshot.values,
            },
            sourceRefs:
              snapshot.receipts
                .map(receiptRef),
            diagnostics: [
              ...snapshot
                .diagnostics,
            ],
          }),
        ),
      costMetrics:
        ledger.costMetrics.map(
          (row) => ({
            metric:
              row.metric,
            value:
              row.amount.value,
            currency:
              row.amount
                .currency,
            taxBasis:
              row.amount
                .taxBasis,
            asOf:
              row.amount.asOf,
            state:
              row.amount.state,
            sourceStatus:
              row.sourceStatus,
            amountBasis:
              row.amount.amountBasis,
            cbsId:
              row.cbsId,
            wbsId:
              row.wbsId,
            sourceRefs:
              moneyRefs(
                row.amount,
              ),
          }),
        ),
      payments:
        ledger.payments.map(
          (row) => {
            const certified =
              row.amounts
                .employerCertifiedAmount
                .value ??
              row.amounts
                .netCertifiedAmount
                .value;
            const certifiedMoney =
              row.amounts
                .employerCertifiedAmount
                .value !== null
                ? row.amounts
                    .employerCertifiedAmount
                : row.amounts
                    .netCertifiedAmount;
            return {
              taxBasis: certifiedMoney.taxBasis,
              paymentId:
                row.paymentId,
              periodEnd:
                row.periodEnd,
              certificationDate:
                row.certificationDate,
              paymentDate:
                row.paymentDate,
              currency:
                certifiedMoney
                  .currency ??
                row.amounts
                  .paidAmount
                  .currency,
              certifiedAmount:
                certified,
              certifiedAmountBasis:
                row.certifiedAmountBasis,
              paidAmount:
                row.amounts
                  .paidAmount
                  .value,
              paidAmountBasis:
                row.paidAmountBasis,
              sourceRefs:
                [
                  ...moneyRefs(
                    certifiedMoney,
                  ),
                  ...moneyRefs(
                    row.amounts
                      .paidAmount,
                  ),
                ],
            };
          },
        ),
    });

  cache.set(state, {
    version: state.version,
    value: performance,
  });
  return performance;
}

export function commercialPerformanceCapabilityForState(
  state: ProjectRuntimeState,
  key: string,
): ModuleRuntimeResult | null {
  const performance =
    commercialPerformanceForState(
      state,
    );
  let data: unknown;
  let capabilityState:
    | "established"
    | "candidate"
    | "partial"
    | "missing"
    | "conflicted";

  if (key === "cost-control") {
    data =
      performance.costControl;
    capabilityState =
      performance.costControl
        .state;
  } else if (
    key === "evm-performance"
  ) {
    data =
      performance.evmPerformance;
    capabilityState =
      performance.evmPerformance
        .state;
  } else if (
    key === "cash-flow-register"
  ) {
    data =
      performance.cashFlow;
    capabilityState =
      performance.cashFlow
        .state;
  } else if (
    key === "cost-scurve"
  ) {
    data =
      performance.costScurve;
    capabilityState =
      performance.costScurve
        .state;
  } else {
    return null;
  }

  return {
    key,
    status:
      capabilityState ===
      "established"
        ? "ready"
        : "partial",
    reason:
      capabilityState ===
      "established"
        ? null
        : capabilityState ===
            "conflicted"
          ? "Conflicting commercial performance evidence is retained and requires a governed resolution."
          : capabilityState ===
              "missing"
            ? "The evidence required for this commercial performance capability is not established."
            : "The capability is partially established and its missing source basis remains explicit.",
    dependencies: [
      "commercial-foundation-v1",
      "commercial-canonical-v1",
      "programme Data Date",
    ],
    data,
  };
}
