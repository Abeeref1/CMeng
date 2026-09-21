import type {
  CommercialFinding,
  CommercialFindingAuthority,
  CommercialFindingState,
} from "../../commercial-foundation/src";
import type {
  CashFlowCurrencyPosition,
  CashFlowEntry,
  CommercialPerformanceInput,
  CommercialPerformanceProjection,
  CostControlPosition,
  CostScurveSeries,
  EacScenario,
  EvmPerformancePoint,
  EvmPerformanceSeries,
  PerformanceCostMetricInput,
  PerformanceCostSnapshotInput,
} from "./types";

function uniq(
  values: readonly string[],
): string[] {
  return [
    ...new Set(
      values.filter(Boolean),
    ),
  ].sort();
}

function round(
  value: number,
  digits = 6,
): number {
  const factor =
    10 ** digits;
  return (
    Math.round(
      value * factor,
    ) / factor
  );
}

function pct(
  known: number,
  total: number,
): number | null {
  if (total <= 0) {
    return null;
  }
  return round(
    (known / total) *
      100,
    2,
  );
}

function authorityForSnapshot(
  snapshot:
    PerformanceCostSnapshotInput,
): CommercialFindingAuthority {
  if (
    snapshot.state ===
    "official"
  ) {
    return "source";
  }
  if (
    snapshot.state ===
    "candidate"
  ) {
    return "candidate";
  }
  if (
    snapshot.state ===
    "conflicted"
  ) {
    return "mixed";
  }
  if (
    snapshot.state ===
    "missing"
  ) {
    return "missing";
  }
  return "mixed";
}

function stateForSnapshot(
  snapshot:
    PerformanceCostSnapshotInput,
): CommercialFindingState {
  if (
    snapshot.state ===
    "official"
  ) {
    return "established";
  }
  if (
    snapshot.state ===
    "candidate"
  ) {
    return "candidate";
  }
  if (
    snapshot.state ===
    "conflicted"
  ) {
    return "conflicted";
  }
  if (
    snapshot.state ===
    "missing"
  ) {
    return "missing";
  }
  return "partial";
}

function finding<T>(
  value: T | null,
  options: {
    asOfDate:
      string | null;
    method: string;
    sourceRefs?: string[];
    authority:
      CommercialFindingAuthority;
    state:
      CommercialFindingState;
    submitted?: T | null;
    independent?: T | null;
    gap?:
      number |
      string |
      null;
    consequence?: string | null;
    action?: string | null;
    known?: number;
    total?: number;
    diagnostics?: string[];
  },
): CommercialFinding<T> {
  const known =
    options.known ??
    (value === null ? 0 : 1);
  const total =
    options.total ?? 1;
  return {
    value,
    basis: {
      asOfDate:
        options.asOfDate,
      method:
        options.method,
      sourceRefs: uniq(
        options.sourceRefs ??
          [],
      ),
    },
    coverage: {
      known,
      total,
      percent:
        pct(known, total),
    },
    authority:
      options.authority,
    submitted:
      options.submitted ??
      value,
    independent:
      options.independent ??
      null,
    gap:
      options.gap ??
      null,
    consequence:
      options.consequence ??
      null,
    action:
      options.action ??
      null,
    state:
      options.state,
    diagnostics: [
      ...(options.diagnostics ??
        []),
    ],
  };
}

function missing(
  method: string,
  asOf: string | null,
  consequence: string,
  action: string,
): CommercialFinding<number> {
  return finding<number>(
    null,
    {
      asOfDate: asOf,
      method,
      authority:
        "missing",
      state: "missing",
      consequence,
      action,
    },
  );
}

function snapshotFinding(
  snapshot:
    PerformanceCostSnapshotInput,
  key: string,
  consequence: string,
): CommercialFinding<number> {
  const value =
    snapshot.values[key] ??
    null;
  if (value === null) {
    return missing(
      "source_cost_snapshot:" +
        key,
      snapshot.asOf,
      consequence,
      "Provide or map the " +
        key.toUpperCase() +
        " value for this reporting position.",
    );
  }
  return finding(
    value,
    {
      asOfDate:
        snapshot.asOf,
      method:
        "source_cost_snapshot:" +
        key,
      sourceRefs:
        snapshot.sourceRefs,
      authority:
        authorityForSnapshot(
          snapshot,
        ),
      state:
        stateForSnapshot(
          snapshot,
        ),
      consequence,
      action: null,
      diagnostics:
        snapshot.diagnostics,
    },
  );
}

function calc(
  value: number | null,
  options: {
    asOf: string;
    method: string;
    refs: string[];
    submitted?: number | null;
    consequence: string;
    missingAction: string;
  },
): CommercialFinding<number> {
  if (value === null) {
    return missing(
      options.method,
      options.asOf,
      options.consequence,
      options.missingAction,
    );
  }
  const submitted =
    options.submitted ??
    null;
  return finding(
    round(value),
    {
      asOfDate:
        options.asOf,
      method:
        options.method,
      sourceRefs:
        options.refs,
      authority:
        "calculated",
      state:
        "established",
      submitted,
      independent:
        round(value),
      gap:
        submitted === null
          ? null
          : round(
              value -
                submitted,
            ),
      consequence:
        options.consequence,
      action: null,
    },
  );
}

function safeRatio(
  numerator: number | null,
  denominator: number | null,
): number | null {
  if (
    numerator === null ||
    denominator === null ||
    denominator === 0
  ) {
    return null;
  }
  return (
    numerator /
    denominator
  );
}

function safeSubtract(
  left: number | null,
  right: number | null,
): number | null {
  if (
    left === null ||
    right === null
  ) {
    return null;
  }
  return left - right;
}

function normalized(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /[_-]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    );
}

function metricFrom(
  values:
    Record<
      string,
      number | null
    >,
  aliases: readonly string[],
): number | null {
  const byName =
    new Map(
      Object.entries(
        values,
      ).map(
        ([
          key,
          value,
        ]) => [
          normalized(key),
          value,
        ],
      ),
    );
  for (
    const alias of aliases
  ) {
    const value =
      byName.get(
        normalized(alias),
      );
    if (
      value !==
      undefined
    ) {
      return value;
    }
  }
  return null;
}

const aliases = {
  bac: [
    "bac",
    "budget at completion",
    "approved budget",
    "current control budget",
  ],
  pv: [
    "pv",
    "planned value",
  ],
  ev: [
    "ev",
    "earned value",
  ],
  ac: [
    "ac",
    "actual cost",
    "actual incurred cost",
  ],
  eac: [
    "eac",
    "estimate at completion",
    "forecast final cost",
    "current forecast",
  ],
  etc: [
    "etc",
    "estimate to complete",
    "forecast etc",
    "remaining cost",
  ],
  vac: [
    "vac",
    "variance at completion",
  ],
  priceVariance: [
    "price variance",
    "cost price variance",
  ],
  quantityVariance: [
    "quantity variance",
  ],
  productivityVariance: [
    "productivity variance",
  ],
  expenditureBudget: [
    "expenditure budget",
    "cash expenditure budget",
    "cash budget",
  ],
  expenditureForecast: [
    "expenditure forecast",
    "cash expenditure forecast",
    "cash forecast",
  ],
  actualExpenditure: [
    "actual expenditure",
    "cash actual expenditure",
  ],
} as const;

function refsFor(
  snapshot:
    PerformanceCostSnapshotInput,
): string[] {
  return [
    ...snapshot.sourceRefs,
  ];
}

function valueFor(
  snapshot:
    PerformanceCostSnapshotInput,
  names: readonly string[],
): number | null {
  return metricFrom(
    snapshot.values,
    names,
  );
}

function sourceFinding(
  snapshot:
    PerformanceCostSnapshotInput,
  names: readonly string[],
  label: string,
  consequence: string,
): CommercialFinding<number> {
  const value =
    valueFor(
      snapshot,
      names,
    );
  if (value === null) {
    return missing(
      "source_cost_snapshot:" +
        label,
      snapshot.asOf,
      consequence,
      "Provide or map " +
        label.toUpperCase() +
        " for this reporting position.",
    );
  }
  return finding(
    value,
    {
      asOfDate:
        snapshot.asOf,
      method:
        "source_cost_snapshot:" +
        label,
      sourceRefs:
        snapshot.sourceRefs,
      authority:
        authorityForSnapshot(
          snapshot,
        ),
      state:
        stateForSnapshot(
          snapshot,
        ),
      consequence,
      action: null,
      diagnostics:
        snapshot.diagnostics,
    },
  );
}

function eacScenarios(
  snapshot:
    PerformanceCostSnapshotInput,
  bac: number | null,
  ev: number | null,
  ac: number | null,
  cpi: number | null,
  sourceEac:
    CommercialFinding<number>,
  sourceEtc:
    CommercialFinding<number>,
): EacScenario[] {
  const refs =
    refsFor(snapshot);
  const values:
    EacScenario[] = [];
  if (
    sourceEac.value !==
    null
  ) {
    values.push({
      method:
        "source_reported",
      value:
        sourceEac,
      methodology:
        "Source-reported EAC. CMeng does not replace it with a calculated scenario.",
      official:
        sourceEac.state ===
        "established",
    });
  }
  const cpiEac =
    bac !== null &&
    cpi !== null &&
    cpi !== 0
      ? bac / cpi
      : null;
  values.push({
    method:
      "bac_over_cpi",
    value: calc(
      cpiEac,
      {
        asOf:
          snapshot.asOf,
        method:
          "BAC / CPI",
        refs,
        consequence:
          "CPI continuation is a scenario, not an approved forecast method.",
        missingAction:
          "BAC, EV and AC are required for the BAC/CPI scenario.",
      },
    ),
    methodology:
      "Assumes current cost efficiency continues for all remaining work.",
    official: false,
  });

  const simpleEac =
    ac !== null &&
    bac !== null &&
    ev !== null
      ? ac +
        (bac - ev)
      : null;
  values.push({
    method:
      "ac_plus_remaining_budget",
    value: calc(
      simpleEac,
      {
        asOf:
          snapshot.asOf,
        method:
          "AC + (BAC - EV)",
        refs,
        consequence:
          "Budget-rate completion is a scenario and must not replace an approved forecast.",
        missingAction:
          "BAC, EV and AC are required for the AC+(BAC-EV) scenario.",
      },
    ),
    methodology:
      "Assumes remaining work is completed at its original budgeted rate.",
    official: false,
  });

  const bottomUp =
    ac !== null &&
    sourceEtc.value !==
      null
      ? ac +
        sourceEtc.value
      : null;
  values.push({
    method:
      "bottom_up_etc",
    value: calc(
      bottomUp,
      {
        asOf:
          snapshot.asOf,
        method:
          "AC + source ETC",
        refs: uniq([
          ...refs,
          ...sourceEtc
            .basis
            .sourceRefs,
        ]),
        consequence:
          "Bottom-up EAC uses the submitted ETC and stays distinct from other forecast methods.",
        missingAction:
          "Actual cost and source ETC are required for bottom-up EAC.",
      },
    ),
    methodology:
      "Combines actual cost to date with the source bottom-up estimate to complete.",
    official: false,
  });
  return values;
}

function varianceFinding(
  input:
    CommercialPerformanceInput,
  snapshot:
    PerformanceCostSnapshotInput,
  names: readonly string[],
  label: string,
): CommercialFinding<number> {
  const rows =
    input.costMetrics.filter(
      (row) =>
        row.currency ===
          snapshot.currency &&
        row.taxBasis ===
          snapshot.taxBasis &&
        row.asOf ===
          snapshot.asOf &&
        names
          .map(normalized)
          .includes(
            normalized(
              row.metric,
            ),
          ),
    );
  const known =
    rows.filter(
      (row) =>
        row.value !==
        null,
    );
  if (!known.length) {
    return missing(
      "source_variance_decomposition:" +
        label,
      snapshot.asOf,
      "Variance decomposition remains unestablished without a source price, quantity or productivity attribution.",
      "Provide a compatible " +
        label +
        " variance source if decomposition is required.",
    );
  }
  const distinct =
    new Set(
      known.map(
        (row) =>
          row.value,
      ),
    );
  if (
    distinct.size >
    1
  ) {
    return finding<number>(
      null,
      {
        asOfDate:
          snapshot.asOf,
        method:
          "source_variance_decomposition:" +
          label,
        sourceRefs:
          known.flatMap(
            (row) =>
              row.sourceRefs,
          ),
        authority:
          "mixed",
        state:
          "conflicted",
        consequence:
          "Conflicting variance decomposition values prevent one current position.",
        action:
          "Resolve the conflicting " +
          label +
          " variance values.",
        known: 0,
        total:
          known.length,
      },
    );
  }
  const row =
    known.at(-1)!;
  return finding(
    row.value!,
    {
      asOfDate:
        row.asOf,
      method:
        "source_variance_decomposition:" +
        label,
      sourceRefs:
        row.sourceRefs,
      authority:
        row.state ===
        "official"
          ? "source"
          : "candidate",
      state:
        row.state ===
        "official"
          ? "established"
          : "candidate",
      consequence:
        "Separates the source-attributed driver of cost variance.",
      action: null,
    },
  );
}

function costControl(
  input:
    CommercialPerformanceInput,
) {
  const latestByBasis =
    new Map<
      string,
      PerformanceCostSnapshotInput
    >();
  for (
    const snapshot of
      input.costSnapshots
  ) {
    if (
      input.dataDateIso &&
      snapshot.asOf >
        input.dataDateIso
    ) {
      continue;
    }
    const key = [
      snapshot.currency,
      snapshot.taxBasis,
    ].join("|");
    const prior =
      latestByBasis.get(key);
    if (
      !prior ||
      prior.asOf <
        snapshot.asOf
    ) {
      latestByBasis.set(
        key,
        snapshot,
      );
    }
  }

  const positions:
    CostControlPosition[] =
    [];
  for (
    const snapshot of
      latestByBasis.values()
  ) {
    const refs =
      refsFor(snapshot);
    const bac =
      sourceFinding(
        snapshot,
        aliases.bac,
        "bac",
        "BAC establishes the current approved control budget basis.",
      );
    const pv =
      sourceFinding(
        snapshot,
        aliases.pv,
        "pv",
        "PV is required for schedule-performance EVM.",
      );
    const ev =
      sourceFinding(
        snapshot,
        aliases.ev,
        "ev",
        "EV is required for cost and schedule performance.",
      );
    const ac =
      sourceFinding(
        snapshot,
        aliases.ac,
        "ac",
        "Actual cost is required for CPI, CV and cost forecasting.",
      );
    const sourceEac =
      sourceFinding(
        snapshot,
        aliases.eac,
        "eac",
        "Source EAC is retained separately from CMeng forecast scenarios.",
      );
    const sourceEtc =
      sourceFinding(
        snapshot,
        aliases.etc,
        "etc",
        "Source ETC is retained as a submitted forecast basis.",
      );
    const sourceVac =
      sourceFinding(
        snapshot,
        aliases.vac,
        "vac",
        "Source VAC is retained and reconciled against BAC minus source EAC.",
      );

    const compatibleMoneyBasis =
      snapshot.taxBasis !==
      "unknown";
    const spiValue =
      compatibleMoneyBasis
        ? safeRatio(
            ev.value,
            pv.value,
          )
        : null;
    const cpiValue =
      compatibleMoneyBasis
        ? safeRatio(
            ev.value,
            ac.value,
          )
        : null;
    const svValue =
      compatibleMoneyBasis
        ? safeSubtract(
            ev.value,
            pv.value,
          )
        : null;
    const cvValue =
      compatibleMoneyBasis
        ? safeSubtract(
            ev.value,
            ac.value,
          )
        : null;
    const calculatedVacValue =
      compatibleMoneyBasis
        ? safeSubtract(
            bac.value,
            sourceEac.value,
          )
        : null;
    const tcpiBudgetValue =
      compatibleMoneyBasis &&
      bac.value !== null &&
      ev.value !== null &&
      bac.value !== null &&
      ac.value !== null
        ? safeRatio(
            bac.value -
              ev.value,
            bac.value -
              ac.value,
          )
        : null;
    const tcpiForecastValue =
      compatibleMoneyBasis &&
      bac.value !== null &&
      ev.value !== null &&
      sourceEac.value !==
        null &&
      ac.value !== null
        ? safeRatio(
            bac.value -
              ev.value,
            sourceEac.value -
              ac.value,
          )
        : null;

    const spi =
      calc(spiValue, {
        asOf:
          snapshot.asOf,
        method: "EV / PV",
        refs,
        submitted:
          snapshot.values[
            "spi"
          ] ?? null,
        consequence:
          "SPI below one indicates earned progress is behind the planned-value position.",
        missingAction:
          "PV and EV are required for SPI.",
      });
    const cpi =
      calc(cpiValue, {
        asOf:
          snapshot.asOf,
        method: "EV / AC",
        refs,
        submitted:
          snapshot.values[
            "cpi"
          ] ?? null,
        consequence:
          "CPI below one indicates the earned value is below actual cost.",
        missingAction:
          "EV and AC are required for CPI.",
      });
    const sv =
      calc(svValue, {
        asOf:
          snapshot.asOf,
        method: "EV - PV",
        refs,
        submitted:
          metricFrom(
            snapshot.values,
            [
              "sv",
              "schedule variance",
            ],
          ),
        consequence:
          "Schedule variance in value units shows earned versus planned value at the Data Date.",
        missingAction:
          "PV and EV are required for schedule variance.",
      });
    const cv =
      calc(cvValue, {
        asOf:
          snapshot.asOf,
        method: "EV - AC",
        refs,
        submitted:
          metricFrom(
            snapshot.values,
            [
              "cv",
              "cost variance",
            ],
          ),
        consequence:
          "Negative cost variance indicates actual cost exceeds earned value.",
        missingAction:
          "EV and AC are required for cost variance.",
      });
    const calculatedVac =
      calc(
        calculatedVacValue,
        {
          asOf:
            snapshot.asOf,
          method:
            "BAC - source EAC",
          refs,
          submitted:
            sourceVac.value,
          consequence:
            "Reconciles the reported VAC against the source BAC and EAC.",
          missingAction:
            "BAC and source EAC are required for calculated VAC.",
        },
      );
    const tcpiBudget =
      calc(
        tcpiBudgetValue,
        {
          asOf:
            snapshot.asOf,
          method:
            "(BAC - EV) / (BAC - AC)",
          refs,
          consequence:
            "TCPI to BAC indicates the efficiency required to finish within the approved budget.",
          missingAction:
            "BAC, EV and AC are required for TCPI to budget.",
        },
      );
    const tcpiForecast =
      calc(
        tcpiForecastValue,
        {
          asOf:
            snapshot.asOf,
          method:
            "(BAC - EV) / (EAC - AC)",
          refs,
          consequence:
            "TCPI to EAC indicates the efficiency required to meet the current source forecast.",
          missingAction:
            "BAC, EV, AC and source EAC are required for TCPI to forecast.",
        },
      );
    const scenarios =
      eacScenarios(
        snapshot,
        compatibleMoneyBasis
          ? bac.value
          : null,
        compatibleMoneyBasis
          ? ev.value
          : null,
        compatibleMoneyBasis
          ? ac.value
          : null,
        compatibleMoneyBasis
          ? cpi.value
          : null,
        sourceEac,
        sourceEtc,
      );

    positions.push({
      currency:
        snapshot.currency,
      taxBasis:
        snapshot.taxBasis,
      asOf: snapshot.asOf,
      bac,
      pv,
      ev,
      ac,
      sourceEac,
      sourceEtc,
      sourceVac,
      sv,
      cv,
      spi,
      cpi,
      calculatedVac,
      tcpiBudget,
      tcpiForecast,
      eacScenarios:
        scenarios,
      forecastMethodState:
        sourceEac.value !==
        null
          ? "source_reported"
          : scenarios.some(
                (scenario) =>
                  scenario.value
                    .value !==
                  null,
              )
            ? "scenarios_only"
            : "not_established",
      varianceDecomposition: {
        price:
          varianceFinding(
            input,
            snapshot,
            aliases.priceVariance,
            "price",
          ),
        quantity:
          varianceFinding(
            input,
            snapshot,
            aliases.quantityVariance,
            "quantity",
          ),
        productivity:
          varianceFinding(
            input,
            snapshot,
            aliases.productivityVariance,
            "productivity",
          ),
      },
      sourceRefs: refs,
      diagnostics: [
        ...snapshot
          .diagnostics,
        "SOURCE_REPORTED_EAC_REMAINS_SEPARATE_FROM_CMENG_SCENARIOS",
        ...(snapshot.taxBasis === "unknown"
          ? [
              "UNKNOWN_TAX_BASIS_DERIVED_COST_ARITHMETIC_WITHHELD",
            ]
          : []),
        ...(ac.value === null
          ? [
              "ACTUAL_COST_NOT_ESTABLISHED_COST_PERFORMANCE_QUALIFIED",
            ]
          : []),
      ],
    });
  }

  const managementSummary:
    string[] = [];
  for (
    const position of
      positions
  ) {
    if (
      position.cpi.value !==
        null &&
      position.cpi.value < 1
    ) {
      managementSummary.push(
        position.currency +
          " CPI " +
          position.cpi.value +
          " indicates adverse cost efficiency.",
      );
    }
    if (
      position.spi.value !==
        null &&
      position.spi.value < 1
    ) {
      managementSummary.push(
        position.currency +
          " SPI " +
          position.spi.value +
          " indicates earned value is behind planned value.",
      );
    }
    if (
      position
        .calculatedVac.value !==
        null &&
      position
        .calculatedVac.value < 0
    ) {
      managementSummary.push(
        position.currency +
          " forecast indicates an overrun against BAC of " +
          Math.abs(
            position
              .calculatedVac
              .value,
          ) +
          ".",
      );
    }
  }

  return {
    capabilityKey:
      "cost-control" as const,
    state:
      positions.length === 0
        ? "missing" as const
        : positions.some(
              (position) =>
                position.bac
                  .state ===
                  "conflicted" ||
                position.sourceEac
                  .state ===
                  "conflicted",
            )
          ? "conflicted" as const
          : positions.every(
                (position) =>
                  position.bac
                    .value !==
                    null &&
                  position.ev
                    .value !==
                    null,
              )
            ? "established" as const
            : "partial" as const,
    positions,
    managementSummary,
    diagnostics: [
      "DOCUMENTED_EVM_AND_CMENG_CALCULATIONS_REMAIN_SEPARATE",
      "MISSING_ACTUAL_COST_NEVER_BECOMES_ZERO",
      "FORECAST_METHOD_SCENARIOS_ARE_NOT_AUTOMATICALLY_APPROVED",
    ],
  };
}

function evmPerformance(
  input:
    CommercialPerformanceInput,
) {
  const groups =
    new Map<
      string,
      PerformanceCostSnapshotInput[]
    >();
  let futureExcluded =
    0;
  for (
    const snapshot of
      input.costSnapshots
  ) {
    if (
      input.dataDateIso &&
      snapshot.asOf >
        input.dataDateIso
    ) {
      futureExcluded +=
        1;
      continue;
    }
    const key = [
      snapshot.currency,
      snapshot.taxBasis,
    ].join("|");
    const list =
      groups.get(key) ?? [];
    list.push(snapshot);
    groups.set(key, list);
  }

  const series:
    EvmPerformanceSeries[] =
    [];
  for (
    const [key, snapshots] of
      groups
  ) {
    const [
      currency,
      taxBasis,
    ] = key.split("|") as [
      string,
      "exclusive" |
      "inclusive" |
      "unknown",
    ];
    const points:
      EvmPerformancePoint[] =
      snapshots
        .sort(
          (a, b) =>
            a.asOf.localeCompare(
              b.asOf,
            ),
        )
        .map((snapshot) => {
          const refs =
            snapshot
              .sourceRefs;
          const pv =
            sourceFinding(
              snapshot,
              aliases.pv,
              "pv",
              "PV is the source planned-value curve point.",
            );
          const ev =
            sourceFinding(
              snapshot,
              aliases.ev,
              "ev",
              "EV is the source earned-value curve point.",
            );
          const ac =
            sourceFinding(
              snapshot,
              aliases.ac,
              "ac",
              "AC is the source actual-cost curve point.",
            );
          const compatibleMoneyBasis =
            snapshot.taxBasis !==
            "unknown";
          return {
            asOf:
              snapshot.asOf,
            pv,
            ev,
            ac,
            spi: calc(
              compatibleMoneyBasis
                ? safeRatio(
                    ev.value,
                    pv.value,
                  )
                : null,
              {
                asOf:
                  snapshot.asOf,
                method:
                  "EV / PV",
                refs,
                consequence:
                  "Time-phased SPI trend compares earned and planned value.",
                missingAction:
                  "PV and EV are required for SPI at this period.",
              },
            ),
            cpi: calc(
              compatibleMoneyBasis
                ? safeRatio(
                    ev.value,
                    ac.value,
                  )
                : null,
              {
                asOf:
                  snapshot.asOf,
                method:
                  "EV / AC",
                refs,
                consequence:
                  "Time-phased CPI trend compares earned value and actual cost.",
                missingAction:
                  "EV and AC are required for CPI at this period.",
              },
            ),
            sv: calc(
              compatibleMoneyBasis
                ? safeSubtract(
                    ev.value,
                    pv.value,
                  )
                : null,
              {
                asOf:
                  snapshot.asOf,
                method:
                  "EV - PV",
                refs,
                consequence:
                  "Schedule variance trend remains in value units.",
                missingAction:
                  "PV and EV are required for SV.",
              },
            ),
            cv: calc(
              compatibleMoneyBasis
                ? safeSubtract(
                    ev.value,
                    ac.value,
                  )
                : null,
              {
                asOf:
                  snapshot.asOf,
                method:
                  "EV - AC",
                refs,
                consequence:
                  "Cost variance trend compares earned value and actual cost.",
                missingAction:
                  "EV and AC are required for CV.",
              },
            ),
          };
        });
    const complete =
      points.filter(
        (point) =>
          point.pv.value !==
            null &&
          point.ev.value !==
            null &&
          point.ac.value !==
            null,
      ).length;
    series.push({
      currency,
      taxBasis,
      points,
      pointCount:
        points.length,
      completePvEvAcPointCount:
        complete,
      coveragePercent:
        pct(
          complete,
          points.length,
        ),
      futureExcludedPointCount:
        futureExcluded,
      diagnostics: [
        ...(complete <
        points.length
          ? [
              "INCOMPLETE_DATED_PV_EV_AC_SERIES",
            ]
          : []),
        ...(taxBasis ===
        "unknown"
          ? [
              "UNKNOWN_TAX_BASIS_DERIVED_RATIOS_QUALIFIED",
            ]
          : []),
      ],
    });
  }
  return {
    capabilityKey:
      "evm-performance" as const,
    state:
      series.length === 0
        ? "missing" as const
        : series.every(
              (item) =>
                item.coveragePercent ===
                100,
            )
          ? "established" as const
          : "partial" as const,
    series,
    documentedVsCalculated:
      "separated" as const,
    diagnostics: [
      "PV_EV_AC_CURVES_USE_SOURCE_SNAPSHOT_VALUES_NOT_FRONTEND_ARITHMETIC",
      "FUTURE_DATED_POINTS_ARE_EXCLUDED_FROM_CURRENT_POSITION",
    ],
  };
}

function sumKnown(
  values:
    Array<number | null>,
): number | null {
  if (
    !values.length ||
    values.some(
      (value) =>
        value === null,
    )
  ) {
    return null;
  }
  return values.reduce<number>(
    (sum, value) =>
      sum +
      (value as number),
    0,
  );
}

function cashFlow(
  input:
    CommercialPerformanceInput,
) {
  const currencySet =
    new Set<string>();
  for (
    const payment of
      input.payments
  ) {
    if (payment.currency) {
      currencySet.add(
        payment.currency,
      );
    }
  }
  for (
    const metric of
      input.costMetrics
  ) {
    if (metric.currency) {
      currencySet.add(
        metric.currency,
      );
    }
  }

  const currencies:
    CashFlowCurrencyPosition[] =
    [];
  for (
    const currency of
      [...currencySet].sort()
  ) {
    const entries:
      CashFlowEntry[] = [];
    const cashDiagnostics:
      string[] = [];
    const payments =
      input.payments.filter(
        (payment) =>
          payment.currency ===
          currency,
      );

    const addPaymentSeries = (
      kind:
        "certified_income" |
        "paid_income",
    ) => {
      const isCertified =
        kind ===
        "certified_income";
      const eligible =
        payments
          .map(
            (payment) => ({
              payment,
              value: isCertified
                ? payment
                    .certifiedAmount
                : payment
                    .paidAmount,
              basis: isCertified
                ? payment
                    .certifiedAmountBasis
                : payment
                    .paidAmountBasis,
              date: isCertified
                ? (
                    payment
                      .certificationDate ??
                    payment.periodEnd
                  )
                : payment
                    .paymentDate,
            }),
          )
          .filter(
            (row) =>
              row.value !==
                null &&
              row.date !==
                null &&
              (
                !input.dataDateIso ||
                row.date! <=
                  input.dataDateIso
              ),
          )
          .sort(
            (a, b) =>
              a.date!.localeCompare(
                b.date!,
              ),
          );

      if (!eligible.length) {
        return;
      }

      const bases =
        new Set(
          eligible.map(
            (row) =>
              row.basis,
          ),
        );
      if (bases.size !== 1) {
        cashDiagnostics.push(
          (
            isCertified
              ? "CERTIFIED"
              : "PAID"
          ) +
            "_SERIES_MIXED_AMOUNT_BASIS_NOT_AGGREGATED",
        );
        return;
      }

      const basis =
        eligible[0]!.basis;
      if (
        basis ===
          "certificate_cumulative" ||
        basis === "unknown"
      ) {
        cashDiagnostics.push(
          (
            isCertified
              ? "CERTIFIED"
              : "PAID"
          ) +
            "_SERIES_" +
            basis.toUpperCase() +
            "_NOT_AGGREGATED",
        );
        return;
      }

      if (basis === "incremental") {
        for (const row of eligible) {
          entries.push({
            entryId:
              row.payment
                .paymentId +
              ":" +
              (
                isCertified
                  ? "certified"
                  : "paid"
              ),
            periodDate:
              row.date!,
            currency,
            kind,
            amount: finding(
              row.value!,
              {
                asOfDate:
                  row.date!,
                method:
                  isCertified
                    ? "source_incremental_certification"
                    : "source_incremental_payment",
                sourceRefs:
                  row.payment
                    .sourceRefs,
                authority:
                  "source",
                state:
                  "established",
                consequence:
                  isCertified
                    ? "Certified income remains separate from cash received."
                    : "Paid income is accepted as cash only from an explicit incremental dated payment basis.",
                action: null,
              },
            ),
            sourceRefs: [
              ...row.payment
                .sourceRefs,
            ],
          });
        }
        return;
      }

      // Explicit project-cumulative series are converted to period deltas.
      let prior = 0;
      const staged:
        CashFlowEntry[] = [];
      for (const row of eligible) {
        const delta =
          row.value! - prior;
        if (delta < -0.01) {
          cashDiagnostics.push(
            (
              isCertified
                ? "CERTIFIED"
                : "PAID"
            ) +
              "_PROJECT_CUMULATIVE_SERIES_NON_MONOTONIC",
          );
          return;
        }
        staged.push({
          entryId:
            row.payment
              .paymentId +
            ":" +
            (
              isCertified
                ? "certified_delta"
                : "paid_delta"
            ),
          periodDate:
            row.date!,
          currency,
          kind,
          amount: finding(
            round(delta),
            {
              asOfDate:
                row.date!,
              method:
                isCertified
                  ? "project_cumulative_certification_delta"
                  : "project_cumulative_payment_delta",
              sourceRefs:
                row.payment
                  .sourceRefs,
              authority:
                "calculated",
              state:
                "established",
              submitted:
                row.value!,
              independent:
                round(delta),
              consequence:
                "Project-cumulative source positions are converted to period movement before aggregation.",
              action: null,
            },
          ),
          sourceRefs: [
            ...row.payment
              .sourceRefs,
          ],
        });
        prior = row.value!;
      }
      entries.push(...staged);
    };

    addPaymentSeries(
      "certified_income",
    );
    addPaymentSeries(
      "paid_income",
    );

    const explicit =
      input.costMetrics.filter(
        (metric) =>
          metric.currency ===
            currency &&
          metric.asOf !==
            null &&
          (
            !input.dataDateIso ||
            metric.asOf <=
              input.dataDateIso
          ),
      );

    const metricSeriesBasis = (
      value: string,
    ):
      | "incremental"
      | "project_cumulative"
      | "certificate_cumulative"
      | "unknown" => {
      const basis =
        normalized(value);
      if (
        [
          "incremental",
          "period",
          "periodic",
          "this period",
          "transaction",
          "current period",
          "period amount",
        ].includes(basis)
      ) {
        return "incremental";
      }
      if (
        [
          "project cumulative",
          "cumulative project",
          "cumulative to date",
          "to date",
          "project to date",
          "cumulative total",
        ].includes(basis)
      ) {
        return "project_cumulative";
      }
      if (
        [
          "cumulative",
          "certificate total",
          "cumulative allocated to certificate",
          "certificate cumulative",
        ].includes(basis)
      ) {
        return "certificate_cumulative";
      }
      return "unknown";
    };

    const addMetrics = (
      names:
        readonly string[],
      kind:
        "expenditure_budget" |
        "expenditure_forecast" |
        "actual_expenditure",
    ) => {
      const sourceRows =
        explicit.filter(
          (row) =>
            names
              .map(
                normalized,
              )
              .includes(
                normalized(
                  row.metric,
                ),
              ) &&
            row.value !==
              null &&
            row.asOf !== null,
        );
      if (!sourceRows.length) {
        return;
      }

      const groups =
        new Map<
          string,
          typeof sourceRows
        >();
      for (const row of sourceRows) {
        const groupKey =
          row.cbsId ??
          "__PROJECT__";
        const list =
          groups.get(
            groupKey,
          ) ?? [];
        list.push(row);
        groups.set(
          groupKey,
          list,
        );
      }

      for (
        const [
          groupKey,
          groupRows,
        ] of groups
      ) {
        const ordered =
          [...groupRows].sort(
            (a, b) =>
              a.asOf!.localeCompare(
                b.asOf!,
              ),
          );
        const bases =
          new Set(
            ordered.map(
              (row) =>
                metricSeriesBasis(
                  row.amountBasis,
                ),
            ),
          );
        if (bases.size !== 1) {
          cashDiagnostics.push(
            kind.toUpperCase() +
              "_MIXED_AMOUNT_BASIS_NOT_AGGREGATED:" +
              groupKey,
          );
          continue;
        }
        const basis =
          metricSeriesBasis(
            ordered[0]!
              .amountBasis,
          );
        if (
          basis ===
            "unknown" ||
          basis ===
            "certificate_cumulative"
        ) {
          cashDiagnostics.push(
            kind.toUpperCase() +
              "_" +
              basis.toUpperCase() +
              "_NOT_AGGREGATED:" +
              groupKey,
          );
          continue;
        }

        if (basis === "incremental") {
          for (const metric of ordered) {
            entries.push({
              entryId:
                kind +
                ":" +
                metric.asOf +
                ":" +
                groupKey,
              periodDate:
                metric.asOf!,
              currency,
              kind,
              amount:
                finding(
                  metric.value!,
                  {
                    asOfDate:
                      metric.asOf,
                    method:
                      "explicit_incremental_cash_flow_metric",
                    sourceRefs:
                      metric
                        .sourceRefs,
                    authority:
                      metric.state ===
                      "official"
                        ? "source"
                        : "candidate",
                    state:
                      metric.state ===
                      "official"
                        ? "established"
                        : "candidate",
                    consequence:
                      "Cash-flow expenditure is aggregated only from an explicit incremental series basis.",
                    action: null,
                  },
                ),
              sourceRefs: [
                ...metric
                  .sourceRefs,
              ],
            });
          }
          continue;
        }

        let prior = 0;
        const staged:
          CashFlowEntry[] = [];
        let monotonic = true;
        for (const metric of ordered) {
          const delta =
            metric.value! -
            prior;
          if (delta < -0.01) {
            monotonic = false;
            break;
          }
          staged.push({
            entryId:
              kind +
              ":delta:" +
              metric.asOf +
              ":" +
              groupKey,
            periodDate:
              metric.asOf!,
            currency,
            kind,
            amount:
              finding(
                round(delta),
                {
                  asOfDate:
                    metric.asOf,
                  method:
                    "project_cumulative_cash_flow_delta",
                  sourceRefs:
                    metric
                      .sourceRefs,
                  authority:
                    "calculated",
                  state:
                    "established",
                  submitted:
                    metric.value!,
                  independent:
                    round(delta),
                  consequence:
                    "Project-cumulative expenditure is converted to period movement before aggregation.",
                  action: null,
                },
              ),
            sourceRefs: [
              ...metric
                .sourceRefs,
            ],
          });
          prior =
            metric.value!;
        }
        if (!monotonic) {
          cashDiagnostics.push(
            kind.toUpperCase() +
              "_PROJECT_CUMULATIVE_SERIES_NON_MONOTONIC:" +
              groupKey,
          );
          continue;
        }
        entries.push(
          ...staged,
        );
      }
    };

    addMetrics(
      aliases.expenditureBudget,
      "expenditure_budget",
    );
    addMetrics(
      aliases.expenditureForecast,
      "expenditure_forecast",
    );
    addMetrics(
      aliases.actualExpenditure,
      "actual_expenditure",
    );

    entries.sort(
      (a, b) =>
        a.periodDate
          .localeCompare(
            b.periodDate,
          ),
    );

    const totalFor = (
      kind:
        CashFlowEntry["kind"],
    ) => {
      const rows =
        entries.filter(
          (entry) =>
            entry.kind ===
            kind,
        );
      if (!rows.length) {
        return null;
      }
      return sumKnown(
        rows.map(
          (row) =>
            row.amount.value,
        ),
      );
    };
    const refsForKind = (
      kind:
        CashFlowEntry["kind"],
    ) =>
      uniq(
        entries
          .filter(
            (entry) =>
              entry.kind ===
              kind,
          )
          .flatMap(
            (entry) =>
              entry.sourceRefs,
          ),
      );
    const totalFinding = (
      kind:
        CashFlowEntry["kind"],
      label: string,
    ) => {
      const value =
        totalFor(kind);
      return value === null
        ? missing(
            "cash_flow_total:" +
              label,
            input.dataDateIso,
            label +
              " is not established from compatible dated entries.",
            "Provide compatible dated " +
              label +
              " entries.",
          )
        : finding(
            value,
            {
              asOfDate:
                input.dataDateIso,
              method:
                "sum_explicit_dated_entries:" +
                label,
              sourceRefs:
                refsForKind(
                  kind,
                ),
              authority:
                "calculated",
              state:
                "established",
              independent:
                value,
              consequence:
                "The total uses only explicit dated entries of one currency.",
              action: null,
            },
          );
    };

    const certifiedIncome =
      totalFinding(
        "certified_income",
        "certified income",
      );
    const paidIncome =
      totalFinding(
        "paid_income",
        "paid income",
      );
    const expenditureBudget =
      totalFinding(
        "expenditure_budget",
        "expenditure budget",
      );
    const expenditureForecast =
      totalFinding(
        "expenditure_forecast",
        "expenditure forecast",
      );
    const actualExpenditure =
      totalFinding(
        "actual_expenditure",
        "actual expenditure",
      );

    const net =
      paidIncome.value !==
        null &&
      actualExpenditure.value !==
        null
        ? paidIncome.value -
          actualExpenditure.value
        : null;
    const netCashPosition =
      calc(net, {
        asOf:
          input.dataDateIso ??
          "",
        method:
          "paid income - actual expenditure",
        refs: uniq([
          ...paidIncome.basis
            .sourceRefs,
          ...actualExpenditure
            .basis
            .sourceRefs,
        ]),
        consequence:
          "Cash position compares evidenced paid income with evidenced actual expenditure only.",
        missingAction:
          "Paid income and actual expenditure are both required for cash position.",
      });

    const certifiedUnpaid =
      calc(
        certifiedIncome.value !==
            null &&
          paidIncome.value !==
            null
          ? certifiedIncome.value -
            paidIncome.value
          : null,
        {
          asOf:
            input.dataDateIso ??
            "",
          method:
            "certified income - paid income",
          refs: uniq([
            ...certifiedIncome.basis
              .sourceRefs,
            ...paidIncome.basis
              .sourceRefs,
          ]),
          consequence:
            "Certified-but-unpaid value is kept separate from actual cash received.",
          missingAction:
            "Certified income and paid income are both required to establish certified-but-unpaid value.",
        },
      );

    const dates =
      uniq(
        entries.map(
          (entry) =>
            entry.periodDate,
        ),
      );
    const hasKind = (
      kind:
        CashFlowEntry["kind"],
    ) =>
      entries.some(
        (entry) =>
          entry.kind === kind,
      );
    const hasCertifiedIncome =
      hasKind(
        "certified_income",
      );
    const hasPaidIncome =
      hasKind(
        "paid_income",
      );
    const hasBudget =
      hasKind(
        "expenditure_budget",
      );
    const hasForecast =
      hasKind(
        "expenditure_forecast",
      );
    const hasActualExpenditure =
      hasKind(
        "actual_expenditure",
      );

    const dayTotal = (
      date: string,
      kind:
        CashFlowEntry["kind"],
    ): number | null => {
      const rows =
        entries.filter(
          (entry) =>
            entry.periodDate ===
              date &&
            entry.kind === kind,
        );
      if (!rows.length) {
        return 0;
      }
      return sumKnown(
        rows.map(
          (row) =>
            row.amount.value,
        ),
      );
    };

    let cumulativeCertified:
      number | null =
      hasCertifiedIncome
        ? 0
        : null;
    let cumulativePaid:
      number | null =
      hasPaidIncome
        ? 0
        : null;
    let cumulativeBudget:
      number | null =
      hasBudget
        ? 0
        : null;
    let cumulativeForecast:
      number | null =
      hasForecast
        ? 0
        : null;
    let cumulativeActual:
      number | null =
      hasActualExpenditure
        ? 0
        : null;
    const cumulativeActualSeries:
      CashFlowCurrencyPosition["cumulativeActualSeries"] =
      [];
    const cumulativePositionSeries:
      CashFlowCurrencyPosition["cumulativePositionSeries"] =
      [];
    let peakNeed:
      number | null =
      hasPaidIncome &&
      hasActualExpenditure
        ? 0
        : null;

    for (const date of dates) {
      const certified =
        dayTotal(
          date,
          "certified_income",
        );
      const paid =
        dayTotal(
          date,
          "paid_income",
        );
      const budget =
        dayTotal(
          date,
          "expenditure_budget",
        );
      const forecast =
        dayTotal(
          date,
          "expenditure_forecast",
        );
      const actual =
        dayTotal(
          date,
          "actual_expenditure",
        );

      cumulativeCertified =
        cumulativeCertified !==
          null &&
        certified !== null
          ? cumulativeCertified +
            certified
          : null;
      cumulativePaid =
        cumulativePaid !==
          null &&
        paid !== null
          ? cumulativePaid +
            paid
          : null;
      cumulativeBudget =
        cumulativeBudget !==
          null &&
        budget !== null
          ? cumulativeBudget +
            budget
          : null;
      cumulativeForecast =
        cumulativeForecast !==
          null &&
        forecast !== null
          ? cumulativeForecast +
            forecast
          : null;
      cumulativeActual =
        cumulativeActual !==
          null &&
        actual !== null
          ? cumulativeActual +
            actual
          : null;

      const pointNet =
        cumulativePaid !==
          null &&
        cumulativeActual !==
          null
          ? cumulativePaid -
            cumulativeActual
          : null;
      if (
        peakNeed !== null &&
        pointNet !== null &&
        pointNet < 0
      ) {
        peakNeed =
          Math.max(
            peakNeed,
            -pointNet,
          );
      }

      cumulativeActualSeries.push({
        asOf: date,
        cumulativeIncome:
          cumulativePaid,
        cumulativeExpenditure:
          cumulativeActual,
        net: pointNet,
      });
      cumulativePositionSeries.push({
        asOf: date,
        cumulativeCertifiedIncome:
          cumulativeCertified,
        cumulativePaidIncome:
          cumulativePaid,
        cumulativeExpenditureBudget:
          cumulativeBudget,
        cumulativeExpenditureForecast:
          cumulativeForecast,
        cumulativeActualExpenditure:
          cumulativeActual,
        actualNetCash:
          pointNet,
      });
    }

    const periods =
      uniq(
        dates.map(
          (date) =>
            date.slice(0, 7),
        ),
      );
    const periodMovementSeries:
      CashFlowCurrencyPosition["periodMovementSeries"] =
      periods.map(
        (period) => {
          const periodTotal = (
            kind:
              CashFlowEntry["kind"],
            established:
              boolean,
          ):
            number | null => {
            if (!established) {
              return null;
            }
            const rows =
              entries.filter(
                (entry) =>
                  entry.kind ===
                    kind &&
                  entry.periodDate
                    .startsWith(
                      period,
                    ),
              );
            if (!rows.length) {
              return 0;
            }
            return sumKnown(
              rows.map(
                (row) =>
                  row.amount
                    .value,
              ),
            );
          };
          const certified =
            periodTotal(
              "certified_income",
              hasCertifiedIncome,
            );
          const paid =
            periodTotal(
              "paid_income",
              hasPaidIncome,
            );
          const budget =
            periodTotal(
              "expenditure_budget",
              hasBudget,
            );
          const forecast =
            periodTotal(
              "expenditure_forecast",
              hasForecast,
            );
          const actual =
            periodTotal(
              "actual_expenditure",
              hasActualExpenditure,
            );
          return {
            period,
            certifiedIncome:
              certified,
            paidIncome: paid,
            expenditureBudget:
              budget,
            expenditureForecast:
              forecast,
            actualExpenditure:
              actual,
            actualNetCashMovement:
              paid !== null &&
              actual !== null
                ? paid - actual
                : null,
          };
        },
      );

    const peakFundingNeed =
      peakNeed === null
        ? missing(
            "peak_funding_need",
            input.dataDateIso,
            "Peak funding need requires both dated paid-income and actual-expenditure series.",
            "Provide dated actual cash receipts and expenditure records.",
          )
        : calc(
            peakNeed,
            {
              asOf:
                input.dataDateIso ??
                "",
              method:
                "max negative cumulative cash position",
              refs: uniq(
                entries.flatMap(
                  (entry) =>
                    entry.sourceRefs,
                ),
              ),
              consequence:
                "Peak funding need is the greatest evidenced cumulative cash deficit.",
              missingAction:
                "",
            },
          );

    currencies.push({
      currency,
      entries,
      certifiedIncome,
      paidIncome,
      expenditureBudget,
      expenditureForecast,
      actualExpenditure,
      netCashPosition,
      peakFundingNeed,
      certifiedUnpaid,
      cumulativeActualSeries,
      cumulativePositionSeries,
      periodMovementSeries,
      diagnostics: [
        "CERTIFIED_INCOME_IS_NOT_CASH_RECEIVED",
        "COMMITMENTS_AND_RETENTION_ARE_NOT_CASH_EXPENDITURE",
        "CASH_SERIES_REQUIRE_EXPLICIT_INCREMENTAL_OR_PROJECT_CUMULATIVE_BASIS",
        ...cashDiagnostics,
        ...(actualExpenditure
          .value === null
          ? [
              "ACTUAL_EXPENDITURE_NOT_ESTABLISHED_CASH_POSITION_QUALIFIED",
            ]
          : []),
      ],
    });
  }

  return {
    capabilityKey:
      "cash-flow-register" as const,
    state:
      currencies.length === 0
        ? "missing" as const
        : currencies.some(
              (position) =>
                position.paidIncome
                  .value !==
                  null ||
                position
                  .actualExpenditure
                  .value !==
                  null,
            )
          ? "partial" as const
          : "missing" as const,
    currencies,
    diagnostics: [
      "CASH_FLOW_USES_DATED_EVIDENCE_AND_NEVER_INFERS_BANK_RECEIPTS_FROM_CERTIFICATION",
    ],
  };
}

function costScurve(
  input:
    CommercialPerformanceInput,
) {
  const groups =
    new Map<
      string,
      PerformanceCostSnapshotInput[]
    >();
  const futureByKey =
    new Map<
      string,
      number
    >();
  for (
    const snapshot of
      input.costSnapshots
  ) {
    const key = [
      snapshot.currency,
      snapshot.taxBasis,
    ].join("|");
    if (
      input.dataDateIso &&
      snapshot.asOf >
        input.dataDateIso
    ) {
      futureByKey.set(
        key,
        (
          futureByKey.get(
            key,
          ) ?? 0
        ) + 1,
      );
      continue;
    }
    const list =
      groups.get(key) ?? [];
    list.push(snapshot);
    groups.set(key, list);
  }

  const series:
    CostScurveSeries[] =
    [];
  for (
    const [
      key,
      snapshots,
    ] of groups
  ) {
    const [
      currency,
      taxBasis,
    ] = key.split("|") as [
      string,
      "exclusive" |
      "inclusive" |
      "unknown",
    ];
    const points =
      snapshots
        .sort(
          (a, b) =>
            a.asOf.localeCompare(
              b.asOf,
            ),
        )
        .map((snapshot) => {
          const bac =
            valueFor(
              snapshot,
              aliases.bac,
            );
          const eac =
            valueFor(
              snapshot,
              aliases.eac,
            );
          const ac =
            valueFor(
              snapshot,
              aliases.ac,
            );
          const refs =
            snapshot
              .sourceRefs;
          return {
            asOf:
              snapshot.asOf,
            plannedCost:
              sourceFinding(
                snapshot,
                aliases.pv,
                "pv",
                "Planned cost curve uses source PV.",
              ),
            earnedValue:
              sourceFinding(
                snapshot,
                aliases.ev,
                "ev",
                "Earned/certified curve keeps EV separate from cash and actual cost.",
              ),
            actualCost:
              sourceFinding(
                snapshot,
                aliases.ac,
                "ac",
                "Actual-cost curve requires source AC.",
              ),
            sourceEac:
              sourceFinding(
                snapshot,
                aliases.eac,
                "eac",
                "Forecast cost remains the source EAC position.",
              ),
            remainingCost:
              calc(
                snapshot.taxBasis ===
                  "unknown"
                  ? null
                  : eac !== null &&
                      ac !== null
                    ? eac - ac
                    : bac !==
                          null &&
                        ac !== null
                      ? bac - ac
                      : null,
                {
                  asOf:
                    snapshot.asOf,
                  method:
                    eac !== null
                      ? "source EAC - AC"
                      : "BAC - AC scenario",
                  refs,
                  consequence:
                    "Remaining cost is calculated only where compatible source cost bases exist.",
                  missingAction:
                    "EAC or BAC plus AC are required for remaining cost.",
                },
              ),
          };
        });

    const sourceRows =
      input.costMetrics.filter(
        (row) =>
          row.currency ===
            currency &&
          row.taxBasis ===
            taxBasis &&
          (
            !input.dataDateIso ||
            (
              row.asOf !==
                null &&
              row.asOf <=
                input.dataDateIso
            )
          ),
      );
    series.push({
      currency,
      taxBasis,
      points,
      futureExcludedPointCount:
        futureByKey.get(
          key,
        ) ?? 0,
      cbsIds: uniq(
        sourceRows
          .map(
            (row) =>
              row.cbsId ??
              "",
          )
          .filter(Boolean),
      ),
      wbsIds: uniq(
        sourceRows
          .map(
            (row) =>
              row.wbsId ??
              "",
          )
          .filter(Boolean),
      ),
      sourceRefs: uniq(
        sourceRows.flatMap(
          (row) =>
            row.sourceRefs,
        ),
      ),
      diagnostics: [
        "CURVE_POINTS_ARE_SOURCE_CUMULATIVE_POSITIONS_NOT_SUMMED_SNAPSHOTS",
        ...(taxBasis ===
        "unknown"
          ? [
              "UNKNOWN_TAX_BASIS_CURVE_QUALIFIED",
            ]
          : []),
      ],
    });
  }
  return {
    capabilityKey:
      "cost-scurve" as const,
    state:
      series.length === 0
        ? "missing" as const
        : series.some(
              (item) =>
                item.points
                  .length > 0,
            )
          ? "established" as const
          : "partial" as const,
    series,
    diagnostics: [
      "COST_SCURVE_NEVER_CROSS_SUMS_CURRENCY_OR_TAX_BASIS",
      "FUTURE_DATED_SOURCE_POSITIONS_ARE_EXCLUDED_FROM_CURRENT_CURVE",
    ],
  };
}

export function buildCommercialPerformance(
  input:
    CommercialPerformanceInput,
): CommercialPerformanceProjection {
  const cost =
    costControl(input);
  const evm =
    evmPerformance(input);
  const cash =
    cashFlow(input);
  const scurve =
    costScurve(input);

  return {
    schemaVersion: "1.0",
    projectionKey:
      "commercial_performance",
    producerVersion:
      "commercial-performance-v1",
    generatedAt:
      input.generatedAt,
    projectId:
      input.projectId,
    dataDateIso:
      input.dataDateIso,
    foundationProducerVersion:
      input.foundation
        .producerVersion,
    costControl: cost,
    evmPerformance: evm,
    cashFlow: cash,
    costScurve: scurve,
    diagnostics: [
      "COST_EVM_CASH_AND_CURVES_SHARE_ONE_CANONICAL_COMMERCIAL_SOURCE",
      "SOURCE_REPORTED_AND_INDEPENDENT_CALCULATED_POSITIONS_REMAIN_SEPARATE",
      "MISSING_VALUES_ARE_NOT_ZERO_FILLED",
    ],
  };
}
