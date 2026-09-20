import type {
  ProjectRuntimeState,
} from "./project-state-types";
import {
  buildCommercialCanonicalModel,
} from "./commercial-evidence";
import {
  commercialReconciliation,
  costControlSummary,
} from "../../commercial-core/src";
import {
  isProgrammeScheduleRevision,
} from "./project-state";

export interface CommercialCertificationCheck {
  checkId: string;
  state:
    | "pass"
    | "fail"
    | "not_applicable";
  detail: string;
  values: Array<{
    source: string;
    value: unknown;
  }>;
}

export interface CommercialCertification {
  schemaVersion: "1.0";
  projectId: string;
  generatedAt: string;
  state: "pass" | "fail";
  checkCount: number;
  failedCheckIds: string[];
  checks: CommercialCertificationCheck[];
}

function normalized(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined
  ) return "__NULL__";
  if (
    typeof value === "number"
  ) {
    return Number.isFinite(value)
      ? String(
          Number(
            value.toFixed(8),
          ),
        )
      : "__NONFINITE__";
  }
  return String(value);
}

function equality(
  checkId: string,
  detail: string,
  values:
    CommercialCertificationCheck["values"],
): CommercialCertificationCheck {
  const established =
    values.filter(
      (item) =>
        item.value !== null &&
        item.value !== undefined,
    );
  if (established.length < 2) {
    return {
      checkId,
      state:
        "not_applicable",
      detail,
      values,
    };
  }
  return {
    checkId,
    state:
      new Set(
        established.map(
          (item) =>
            normalized(
              item.value,
            ),
        ),
      ).size === 1
        ? "pass"
        : "fail",
    detail,
    values,
  };
}

function predicate(
  checkId: string,
  detail: string,
  ok: boolean | null,
  values:
    CommercialCertificationCheck["values"] = [],
): CommercialCertificationCheck {
  return {
    checkId,
    state:
      ok === null
        ? "not_applicable"
        : ok
          ? "pass"
          : "fail",
    detail,
    values,
  };
}

function near(
  a: number | null,
  b: number | null,
  tolerance:
    number = 0.0001,
): boolean | null {
  if (
    a === null ||
    b === null
  ) return null;
  return (
    Math.abs(a - b) <=
    tolerance
  );
}

export function certifyCommercial(
  state: ProjectRuntimeState,
  generatedAt =
    new Date().toISOString(),
): CommercialCertification {
  const latest =
    state.schedules
      .filter(
        isProgrammeScheduleRevision,
      )
      .filter(
        (item) =>
          item.role !==
          "recovery",
      )
      .sort(
        (a, b) =>
          (
            a.revision.model
              .dataDateIso ??
            a.revision
              .effectiveAt ??
            ""
          ).localeCompare(
            b.revision.model
              .dataDateIso ??
            b.revision
              .effectiveAt ??
            "",
          ),
      )
      .at(-1) ??
    null;
  const model =
    buildCommercialCanonicalModel(
      state,
      latest?.revision.model
        .dataDateIso ??
        null,
    );
  const cost =
    costControlSummary(
      model,
    );
  const reconciliation =
    commercialReconciliation(
      model,
    );
  const checks:
    CommercialCertificationCheck[] = [];

  const original =
    reconciliation
      .originalContract;
  const variations =
    reconciliation
      .approvedVariations;
  const revised =
    reconciliation
      .revisedContract;

  checks.push(
    predicate(
      "CONTRACT_PLUS_VARIATIONS_RECONCILES",
      "Original contract plus approved variation impact must reconcile to the current governed contract value when all values share one currency.",
      original !== null &&
      variations !== null &&
      revised !== null
        ? near(
            original +
              variations,
            revised,
            0.01,
          )
        : null,
      [
        {
          source:
            "original-contract",
          value: original,
        },
        {
          source:
            "approved-variations",
          value: variations,
        },
        {
          source:
            "current-contract",
          value: revised,
        },
      ],
    ),
  );

  checks.push(
    predicate(
      "EVM_SPI_RECONCILES",
      "Documented SPI must reconcile to EV/PV within tolerance when both are established.",
      near(
        cost
          .evmReconciliation
          .sourceSpi,
        cost
          .evmReconciliation
          .calculatedSpi,
      ),
      [
        {
          source:
            "documented-spi",
          value:
            cost
              .evmReconciliation
              .sourceSpi,
        },
        {
          source:
            "calculated-ev-div-pv",
          value:
            cost
              .evmReconciliation
              .calculatedSpi,
        },
      ],
    ),
  );

  checks.push(
    predicate(
      "EVM_CPI_RECONCILES",
      "Documented CPI must reconcile to EV/AC within tolerance when both are established.",
      near(
        cost
          .evmReconciliation
          .sourceCpi,
        cost
          .evmReconciliation
          .calculatedCpi,
      ),
      [
        {
          source:
            "documented-cpi",
          value:
            cost
              .evmReconciliation
              .sourceCpi,
        },
        {
          source:
            "calculated-ev-div-ac",
          value:
            cost
              .evmReconciliation
              .calculatedCpi,
        },
      ],
    ),
  );

  checks.push(
    predicate(
      "EVM_EAC_RECONCILES",
      "Documented EAC and AC+ETC are compared without silently replacing either method.",
      near(
        cost
          .evmReconciliation
          .sourceEac,
        cost
          .evmReconciliation
          .calculatedBottomUpEac,
        0.01,
      ),
      [
        {
          source:
            "documented-eac",
          value:
            cost
              .evmReconciliation
              .sourceEac,
        },
        {
          source:
            "calculated-ac-plus-etc",
          value:
            cost
              .evmReconciliation
              .calculatedBottomUpEac,
        },
      ],
    ),
  );

  const certifiedExists =
    model.payments.some(
      (payment) =>
        payment
          .netCertified !==
        null,
    );
  const receiptExists =
    model.payments.some(
      (payment) =>
        payment
          .paidAmount !==
        null,
    );

  checks.push(
    predicate(
      "CERTIFICATE_NOT_TREATED_AS_CASH_RECEIPT",
      "A certified payment amount must not create paid cash without receipt evidence.",
      certifiedExists
        ? receiptExists ||
          reconciliation.paid ===
            null
        : null,
      [
        {
          source:
            "certificate-count",
          value:
            model.payments.length,
        },
        {
          source:
            "cash-receipt-evidence-exists",
          value:
            receiptExists,
        },
        {
          source:
            "reconciliation-paid",
          value:
            reconciliation.paid,
        },
      ],
    ),
  );

  checks.push(
    predicate(
      "NO_SILENT_CROSS_CURRENCY_ARITHMETIC",
      "Commercial aggregation must not produce one money-flow balance across multiple currencies without governed FX.",
      model.currencies.length > 1
        ? reconciliation
            .balanceState ===
          "not_assessable"
        : true,
      [
        {
          source:
            "commercial-currencies",
          value:
            model.currencies.join(
              ",",
            ),
        },
        {
          source:
            "reconciliation-state",
          value:
            reconciliation
              .balanceState,
        },
      ],
    ),
  );

  checks.push(
    predicate(
      "CBS_MAPPING_COUNTS_RECONCILE",
      "Mapped plus unmapped populations must equal their source populations.",
      (
        model.mapping
          .mappedBoqRowCount +
          model.mapping
            .unmappedBoqRowCount ===
        model.mapping.boqRowCount
      ) &&
      (
        model.mapping
          .mappedPaymentRowCount +
          model.mapping
            .unmappedPaymentRowCount ===
        model.mapping.paymentRowCount
      ) &&
      (
        model.mapping
          .mappedWbsCount +
          model.mapping
            .unmappedWbsCount ===
        model.mapping.wbsCount
      ),
      [
        {
          source:
            "mapping",
          value:
            model.mapping,
        },
      ],
    ),
  );

  checks.push(
    equality(
      "COMMERCIAL_DATA_DATE_MATCHES_PROGRAMME",
      "Commercial reporting cutoff must use the current programme Data Date where a programme is established.",
      [
        {
          source:
            "current-programme",
          value:
            latest?.revision.model
              .dataDateIso ??
            null,
        },
        {
          source:
            "commercial-model",
          value:
            model.dataDateIso,
        },
      ],
    ),
  );

  const failedCheckIds =
    checks
      .filter(
        (check) =>
          check.state ===
          "fail",
      )
      .map(
        (check) =>
          check.checkId,
      );

  return {
    schemaVersion: "1.0",
    projectId:
      state.projectId,
    generatedAt,
    state:
      failedCheckIds.length
        ? "fail"
        : "pass",
    checkCount:
      checks.length,
    failedCheckIds,
    checks,
  };
}
