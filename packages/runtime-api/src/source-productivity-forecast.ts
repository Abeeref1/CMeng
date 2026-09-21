import {
  cell,
  dateValue,
  governedTables,
  norm,
  numberValue,
  sourceTables,
  type SourceReceipt,
  type SourceRow,
  type SourceTable,
} from "../../truth-kernel/src";
import {
  calendarWorkingDayHours,
  type CanonicalCalendar,
} from "../../schedule-analysis-core/src";
import {
  addWorkingHours,
  parseScheduleInstant,
  resolveWorkingCalendar,
} from "../../schedule-cpm/src";
import type { ProjectRuntimeState } from "./project-state-types";
import {
  projectControlSchedule,
  projectDataDate,
} from "./canonical-time-claims";
import { inferDocumentType } from "./evidence";

export type ProductivityForecastMethod =
  | "source_evidence_derived_productivity"
  | "source_work_package_productivity_model"
  | "source_declared_productivity_date"
  | "missing";

export interface ProductivityWorkPackageForecastRow {
  workPackageId: string;
  description: string | null;
  unit: string | null;
  discipline: string | null;
  linkedActivityId: string | null;
  calendarId: string | null;
  asOfIso: string | null;
  startIso: string | null;
  totalQuantity: number | null;
  installedQuantity: number | null;
  remainingQuantity: number | null;
  actualHours: number | null;
  recentAchievedRatePerDay: number | null;
  conservativeAchievableRatePerDay: number | null;
  calculatedProductiveDays: number | null;
  sourceProductiveDays: number | null;
  productiveDaysReconciliation:
    | "reconciled"
    | "different"
    | "missing";
  sourceInterfaceAllowanceDays: number | null;
  sourceIndependentForecastFinishIso: string | null;
  measuredRatePerHour: number | null;
  conservativeFactor: number | null;
  evidencedRatePerHour: number | null;
  rateBasis:
    | "explicit_hourly_rate"
    | "explicit_working_day_rate"
    | "explicit_productive_day_rate"
    | "measured_installed_per_actual_hour"
    | "measured_rate_with_conservative_factor"
    | "missing";
  allowanceHours: number | null;
  allowanceWorkingDays: number | null;
  allowanceCalendarDays: number | null;
  requiredWorkingHours: number | null;
  completionIso: string | null;
  completionBasis:
    | "calendar_calculated"
    | "source_model_finish"
    | "unresolved";
  state: "official" | "candidate" | "unresolved";
  sourceRefs: string[];
  receipts: SourceReceipt[];
  diagnostics: string[];
}

export interface SourceProductivityForecastEvidence {
  producerVersion: "source-productivity-forecast-v2";
  completionIso: string | null;
  state: "official" | "candidate" | "missing" | "conflicted";
  asOfIso: string | null;
  method: ProductivityForecastMethod;
  submittedCompletionIso: string | null;
  submittedState: "official" | "candidate" | "missing" | "conflicted";
  driverWorkPackageId: string | null;
  driverWorkPackageIds: string[];
  workPackageCount: number;
  calculatedWorkPackageCount: number;
  calendarCalculatedWorkPackageCount: number;
  sourceModelWorkPackageCount: number;
  calculationCoveragePercent: number | null;
  receipts: SourceReceipt[];
  sourceRefs: string[];
  rows: ProductivityWorkPackageForecastRow[];
  reconciliation: {
    submittedCompletionIso: string | null;
    calculatedCompletionIso: string | null;
    varianceDays: number | null;
    state:
      | "reconciled"
      | "different"
      | "submitted_only"
      | "calculated_only"
      | "missing";
  };
  diagnostics: string[];
}

const cache = new WeakMap<
  ProjectRuntimeState,
  { version: number; value: SourceProductivityForecastEvidence }
>();

const DAY_MS = 86_400_000;

function ref(receipt: SourceReceipt): string {
  return "evidence-document:" + receipt.documentId + ":" + receipt.locator;
}

function sourcePath(document: ProjectRuntimeState["evidenceDocuments"][number]): string {
  return (
    document.sourceRelativePath ??
    document.sourceFilename ??
    ""
  );
}

function basename(value: string): string {
  return value
    .split("\\")
    .join("/")
    .split("/")
    .at(-1) ?? value;
}

function productivityDocumentKind(
  document: ProjectRuntimeState["evidenceDocuments"][number],
): "work_packages" | "basis" | null {
  const inferred =
    inferDocumentType(
      sourcePath(document),
      null,
    );
  const name =
    basename(
      sourcePath(document),
    ).toLowerCase();

  if (
    document.documentType ===
      "productivity_work_package_register" ||
    inferred ===
      "productivity_work_package_register" ||
    /^if0?1(?:[_\-.]|$)/i.test(name) ||
    /productiv.*work.*package/i.test(name)
  ) {
    return "work_packages";
  }

  if (
    document.documentType ===
      "productivity_forecast_basis" ||
    inferred ===
      "productivity_forecast_basis" ||
    /^if0?2(?:[_\-.]|$)/i.test(name) ||
    /productiv.*(?:forecast.*basis|basis.*forecast|allowance)/i.test(name)
  ) {
    return "basis";
  }

  return null;
}

function receiptState(
  receipts: readonly SourceReceipt[],
): "official" | "candidate" {
  return (
    receipts.length > 0 &&
    receipts.every((receipt) =>
      ["active", "additive"].includes(
        receipt.basisState,
      ),
    )
  )
    ? "official"
    : "candidate";
}

function coverage(
  known: number,
  total: number,
): number | null {
  if (total <= 0) return null;
  return Number(
    ((known / total) * 100).toFixed(4),
  );
}

function daysBetween(
  from: string | null,
  to: string | null,
): number | null {
  if (!from || !to) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return null;
  }
  return Number(
    ((b - a) / DAY_MS).toFixed(6),
  );
}

function numberWithSuffix(
  raw: string,
): {
  value: number | null;
  suffix: string;
} {
  const direct = numberValue(raw);
  if (direct !== null) {
    return {
      value: direct,
      suffix: "",
    };
  }

  const normalized =
    raw
      .normalize("NFKC")
      .trim()
      .replace(/[٠-٩]/g, (digit) =>
        String(
          digit.charCodeAt(0) -
            0x660,
        ),
      )
      .replace(/[٬]/g, ",")
      .replace(/[٫]/g, ".");

  const match =
    /^([+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?)\s*(.*)$/.exec(
      normalized,
    );
  if (!match) {
    return {
      value: null,
      suffix: "",
    };
  }

  const parsed =
    Number(
      match[1]!
        .replace(/,/g, ""),
    );
  return {
    value:
      Number.isFinite(parsed)
        ? parsed
        : null,
    suffix:
      match[2]?.trim() ?? "",
  };
}

function rowDate(
  row: SourceRow,
): string | null {
  return dateValue(
    cell(
      row,
      "as of",
      "as of date",
      "data date",
      "reporting date",
      "reporting period",
      "period end",
      "status date",
    ),
  );
}

function workPackageId(
  row: SourceRow,
): string {
  return cell(
    row,
    "work package id",
    "work package",
    "workpackage id",
    "wp id",
    "wp",
    "package id",
    "package code",
    "work package code",
  );
}

function rowPriority(
  row: SourceRow,
): number {
  const date =
    rowDate(row);
  return date
    ? Date.parse(date)
    : Number.NEGATIVE_INFINITY;
}

function latestFirst(
  rows: readonly SourceRow[],
): SourceRow[] {
  return [...rows].sort(
    (a, b) =>
      rowPriority(b) -
        rowPriority(a) ||
      a.receipt.documentId.localeCompare(
        b.receipt.documentId,
      ) ||
      a.receipt.locator.localeCompare(
        b.receipt.locator,
      ),
  );
}

function firstCell(
  rows: readonly SourceRow[],
  ...names: string[]
): string {
  for (const row of latestFirst(rows)) {
    const value =
      cell(
        row,
        ...names,
      );
    if (value) return value;
  }
  return "";
}

function firstNumber(
  rows: readonly SourceRow[],
  ...names: string[]
): number | null {
  const raw =
    firstCell(
      rows,
      ...names,
    );
  if (!raw) return null;
  return numberWithSuffix(raw).value;
}

function settingRows(
  tables: readonly SourceTable[],
): SourceRow[] {
  return tables
    .flatMap(
      (table) =>
        table.rows,
    )
    .filter(
      (row) =>
        !workPackageId(row),
    );
}

function settingValue(
  rows: readonly SourceRow[],
  keys: readonly string[],
): {
  value: string;
  unit: string;
  receipt: SourceReceipt | null;
} {
  const normalizedKeys =
    new Set(
      keys.map(norm),
    );

  for (const row of latestFirst(rows)) {
    const key =
      cell(
        row,
        "metric",
        "parameter",
        "setting",
        "name",
        "basis item",
      );
    if (
      !key ||
      !normalizedKeys.has(
        norm(key),
      )
    ) {
      continue;
    }
    return {
      value:
        cell(
          row,
          "value",
          "setting value",
          "control value",
        ),
      unit:
        cell(
          row,
          "unit",
          "uom",
          "basis",
          "rate basis",
        ),
      receipt:
        row.receipt,
    };
  }

  return {
    value: "",
    unit: "",
    receipt: null,
  };
}

function dateFromProductivityRow(
  row: { cells: Readonly<Record<string, string>> },
): string | null {
  const direct = [
    "source productivity forecast",
    "source productivity forecast completion",
    "productivity forecast",
    "productivity forecast completion",
    "productivity completion forecast",
    "productivity based completion",
    "productivity-based completion",
    "productivity finish",
  ]
    .map(
      (name) =>
        row.cells[norm(name)] ??
        "",
    )
    .find(
      (value) =>
        value.trim(),
    );
  if (direct) {
    const parsed =
      dateValue(direct);
    if (parsed) return parsed;
  }

  const key =
    cell(
      row as SourceRow,
      "metric",
      "parameter",
      "measure",
      "name",
      "forecast type",
      "position",
    ) || "";
  const basis =
    cell(
      row as SourceRow,
      "forecast basis",
      "forecast method",
      "method",
      "calculation basis",
      "basis",
      "source",
      "forecast source",
    ) || "";
  const semanticText = [
    key,
    basis,
    ...Object.values(
      row.cells,
    ),
  ]
    .join(" | ")
    .normalize("NFKC");

  if (
    !/productivity/i.test(
      semanticText,
    ) ||
    !/(forecast|completion|finish)/i.test(
      semanticText,
    )
  ) {
    return null;
  }

  const explicitCompletionValues = [
    "value",
    "completion",
    "completion date",
    "forecast completion",
    "forecast completion date",
    "forecast date",
    "finish",
    "finish date",
    "projected completion",
    "projected finish",
  ]
    .map(
      (name) =>
        row.cells[norm(name)] ??
        "",
    )
    .filter(Boolean)
    .map(dateValue)
    .filter(
      (
        value,
      ): value is string =>
        value !== null,
    );

  const unique = [
    ...new Set(
      explicitCompletionValues,
    ),
  ];
  return unique.length === 1
    ? unique[0]!
    : null;
}

function declaredProductivityForecast(
  state: ProjectRuntimeState,
  diagnostics: string[],
): {
  completionIso: string | null;
  state: "official" | "candidate" | "missing" | "conflicted";
  asOfIso: string | null;
  receipts: SourceReceipt[];
} {
  const productivitySourceTypes =
    new Set([
      "schedule_control_basis",
      "schedule_metric_register",
      "project_data_book",
    ]);
  const ids =
    new Set(
      state.evidenceDocuments
        .filter(
          (document) => {
            const inferred =
              inferDocumentType(
                sourcePath(document),
                null,
              );
            return (
              (
                document.category ===
                  "schedule_control" ||
                productivitySourceTypes.has(
                  document.documentType,
                ) ||
                productivitySourceTypes.has(
                  inferred,
                )
              ) &&
              [
                "active",
                "additive",
                "candidate",
              ].includes(
                document.basisState,
              )
            );
          },
        )
        .map(
          (document) =>
            document.documentId,
        ),
    );

  const cutoff =
    projectDataDate(state);
  const candidates: Array<{
    completionIso: string;
    asOfIso: string | null;
    receipt: SourceReceipt;
    official: boolean;
  }> = [];

  for (const document of state.evidenceDocuments) {
    if (!ids.has(document.documentId)) continue;

    const asOfAssertion =
      document.assertions
        .filter(
          (assertion) =>
            assertion.metric ===
            "schedule_control_data_date",
        )
        .map(
          (assertion) =>
            typeof assertion.value ===
              "string"
              ? dateValue(
                  assertion.value,
                )
              : null,
        )
        .find(
          (
            value,
          ): value is string =>
            value !== null,
        ) ??
      null;

    for (const assertion of document.assertions) {
      const specific =
        assertion.metric ===
        "source_productivity_forecast_completion";
      const contextual =
        assertion.metric ===
          "completion_date" &&
        /productivity/i.test(
          assertion.sourceText ??
            "",
        ) &&
        /(forecast|completion|finish|projected)/i.test(
          assertion.sourceText ??
            "",
        );
      if (!specific && !contextual) {
        continue;
      }

      const completionIso =
        typeof assertion.value ===
          "string"
          ? dateValue(
              assertion.value,
            )
          : null;
      if (!completionIso) continue;

      if (
        cutoff !== null &&
        asOfAssertion !== null &&
        asOfAssertion > cutoff
      ) {
        diagnostics.push(
          "FUTURE_SOURCE_PRODUCTIVITY_FORECAST_NOT_APPLIED:" +
            document.documentId +
            ":" +
            assertion.sourceRef,
        );
        continue;
      }

      candidates.push({
        completionIso,
        asOfIso:
          asOfAssertion,
        receipt: {
          documentId:
            document.documentId,
          sourceHash:
            document.sourceHashSha256,
          revision:
            document.linkedArtifactId ??
            document.sourceHashSha256,
          locator:
            assertion.sourceRef ||
            "assertion:" +
              assertion.assertionId,
          basisState:
            document.basisState,
          authority:
            "source_record",
        },
        official:
          ["active", "additive"].includes(
            document.basisState,
          ),
      });
    }
  }

  const tables =
    governedTables(
      state.evidenceDocuments,
      diagnostics,
    ).filter(
      (table) =>
        ids.has(
          table.document.documentId,
        ),
    );

  for (const table of tables) {
    for (const row of table.rows) {
      const completionIso =
        dateFromProductivityRow(
          row,
        );
      if (!completionIso) continue;

      const asOfIso =
        rowDate(row);
      if (
        cutoff !== null &&
        asOfIso !== null &&
        asOfIso > cutoff
      ) {
        diagnostics.push(
          "FUTURE_SOURCE_PRODUCTIVITY_FORECAST_NOT_APPLIED:" +
            row.receipt.documentId +
            ":" +
            row.receipt.locator,
        );
        continue;
      }

      candidates.push({
        completionIso,
        asOfIso,
        receipt:
          row.receipt,
        official:
          ["active", "additive"].includes(
            row.receipt.basisState,
          ),
      });
    }
  }

  const official =
    candidates.filter(
      (item) =>
        item.official,
    );
  const pool =
    official.length > 0
      ? official
      : candidates;
  pool.sort(
    (a, b) =>
      (a.asOfIso ?? "")
        .localeCompare(
          b.asOfIso ?? "",
        ) ||
      a.receipt.documentId.localeCompare(
        b.receipt.documentId,
      ) ||
      a.receipt.locator.localeCompare(
        b.receipt.locator,
      ),
  );

  const latestAsOf =
    pool.at(-1)?.asOfIso ??
    null;
  const latest =
    pool.filter(
      (item) =>
        item.asOfIso ===
        latestAsOf,
    );
  const values = [
    ...new Set(
      latest.map(
        (item) =>
          item.completionIso,
      ),
    ),
  ];

  if (values.length > 1) {
    diagnostics.push(
      "CONFLICTING_SOURCE_PRODUCTIVITY_FORECASTS",
    );
    return {
      completionIso: null,
      state: "conflicted",
      asOfIso:
        latestAsOf,
      receipts:
        latest.map(
          (item) =>
            item.receipt,
        ),
    };
  }

  const completionIso =
    values[0] ??
    null;
  const receipts =
    completionIso === null
      ? []
      : latest
          .filter(
            (item) =>
              item.completionIso ===
              completionIso,
          )
          .map(
            (item) =>
              item.receipt,
          );

  return {
    completionIso,
    state:
      completionIso === null
        ? "missing"
        : official.length > 0
          ? "official"
          : "candidate",
    asOfIso:
      latestAsOf,
    receipts,
  };
}

function productivityTables(
  state: ProjectRuntimeState,
  diagnostics: string[],
): SourceTable[] {
  const byId =
    new Map(
      state.evidenceDocuments
        .map(
          (document) => [
            document.documentId,
            {
              document,
              kind:
                productivityDocumentKind(
                  document,
                ),
            },
          ] as const,
        )
        .filter(
          (
            item,
          ): item is readonly [
            string,
            {
              document: ProjectRuntimeState["evidenceDocuments"][number];
              kind: "work_packages" | "basis";
            },
          ] =>
            item[1].kind !== null,
        ),
    );

  const all =
    sourceTables(
      state.evidenceDocuments,
      diagnostics,
    ).filter(
      (table) =>
        byId.has(
          table.document.documentId,
        ),
    );

  return all.filter(
    (table) => {
      const kind =
        byId.get(
          table.document.documentId,
        )!.kind;
      const sameKind =
        all.filter(
          (candidate) =>
            byId.get(
              candidate.document.documentId,
            )!.kind ===
            kind,
        );
      const established =
        sameKind.some(
          (candidate) =>
            ["active", "additive"].includes(
              candidate.document.basisState,
            ),
        );

      if (
        established &&
        table.document.basisState ===
          "candidate"
      ) {
        diagnostics.push(
          "CANDIDATE_PRODUCTIVITY_REVISION_NOT_APPLIED:" +
            table.document.documentId,
        );
        return false;
      }
      return true;
    },
  );
}

function calendarFromRows(
  rows: readonly SourceRow[],
  schedule:
    NonNullable<
      ReturnType<
        typeof projectControlSchedule
      >
    >,
  globals: readonly SourceRow[],
  linkedActivityId: string | null,
): {
  calendar: CanonicalCalendar | null;
  calendarId: string | null;
  source: string;
} {
  const explicit =
    firstCell(
      rows,
      "calendar id",
      "calendar",
      "work calendar",
      "working calendar",
      "productivity calendar",
    );

  const global =
    settingValue(
      globals,
      [
        "default calendar",
        "default calendar id",
        "productivity calendar",
        "productivity calendar id",
        "work calendar",
      ],
    ).value;

  const requested =
    explicit ||
    global;

  if (requested) {
    const exact =
      schedule.revision.model.calendars.find(
        (calendar) =>
          calendar.calendarId ===
          requested,
      );
    if (exact) {
      return {
        calendar:
          exact,
        calendarId:
          exact.calendarId,
        source:
          explicit
            ? "work_package"
            : "global_basis",
      };
    }

    const normalized =
      norm(requested);
    const byName =
      schedule.revision.model.calendars.filter(
        (calendar) =>
          calendar.name &&
          norm(calendar.name) ===
            normalized,
      );
    if (byName.length === 1) {
      return {
        calendar:
          byName[0]!,
        calendarId:
          byName[0]!.calendarId,
        source:
          explicit
            ? "work_package_name"
            : "global_basis_name",
      };
    }
  }

  if (linkedActivityId) {
    const activity =
      schedule.revision.model.activities.find(
        (candidate) =>
          candidate.activityId ===
          linkedActivityId,
      );
    if (
      activity?.calendarId
    ) {
      const resolution =
        resolveWorkingCalendar(
          activity.calendarId,
          schedule.revision.model.calendars,
          false,
        );
      if (resolution) {
        return {
          calendar:
            resolution.calendar,
          calendarId:
            resolution.calendar.calendarId,
          source:
            "linked_activity",
        };
      }
    }
  }

  return {
    calendar: null,
    calendarId: null,
    source: "unresolved",
  };
}

function parseConservativeFactor(
  rows: readonly SourceRow[],
  globals: readonly SourceRow[],
): number | null {
  const raw =
    firstCell(
      rows,
      "conservative factor",
      "achievable factor",
      "productivity factor",
      "rate factor",
    ) ||
    settingValue(
      globals,
      [
        "conservative factor",
        "achievable factor",
        "productivity factor",
        "rate factor",
      ],
    ).value;

  if (!raw) return null;
  const parsed =
    numberWithSuffix(raw).value;
  if (
    parsed === null ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed > 1 && parsed <= 100
    ? parsed / 100
    : parsed <= 1
      ? parsed
      : null;
}

function allowance(
  rows: readonly SourceRow[],
  globals: readonly SourceRow[],
): {
  hours: number | null;
  workingDays: number | null;
  calendarDays: number | null;
  explicit: boolean;
} {
  let hours =
    firstNumber(
      rows,
      "interface allowance hours",
      "allowance hours",
      "forecast allowance hours",
    );
  let workingDays =
    firstNumber(
      rows,
      "interface allowance working days",
      "allowance working days",
      "forecast allowance working days",
    );
  let calendarDays =
    firstNumber(
      rows,
      "interface allowance calendar days",
      "allowance calendar days",
      "forecast allowance calendar days",
    );

  let explicit =
    hours !== null ||
    workingDays !== null ||
    calendarDays !== null;

  if (!explicit) {
    for (
      const names of [
        [
          "interface allowance",
          "allowance",
          "forecast allowance",
        ],
      ]
    ) {
      const raw =
        firstCell(
          rows,
          ...names,
        );
      const unit =
        firstCell(
          rows,
          "allowance unit",
          "interface allowance unit",
          "allowance basis",
        );
      if (!raw) continue;
      const parsed =
        numberWithSuffix(raw);
      const semantic =
        (
          unit ||
          parsed.suffix
        ).toLowerCase();

      if (
        parsed.value !== null
      ) {
        if (
          /(?:working|work)\s*day|\bwd\b/.test(
            semantic,
          )
        ) {
          workingDays =
            parsed.value;
          explicit = true;
        } else if (
          /calendar\s*day|\bcd\b/.test(
            semantic,
          )
        ) {
          calendarDays =
            parsed.value;
          explicit = true;
        } else if (
          /hour|\bhr\b|\bh\b/.test(
            semantic,
          )
        ) {
          hours =
            parsed.value;
          explicit = true;
        }
      }
    }
  }

  if (!explicit) {
    const global =
      settingValue(
        globals,
        [
          "interface allowance",
          "default interface allowance",
          "productivity interface allowance",
          "forecast allowance",
        ],
      );
    if (global.value) {
      const parsed =
        numberWithSuffix(
          global.value,
        );
      const semantic =
        (
          global.unit ||
          parsed.suffix
        ).toLowerCase();

      if (
        parsed.value !== null
      ) {
        if (
          /(?:working|work)\s*day|\bwd\b/.test(
            semantic,
          )
        ) {
          workingDays =
            parsed.value;
          explicit = true;
        } else if (
          /calendar\s*day|\bcd\b/.test(
            semantic,
          )
        ) {
          calendarDays =
            parsed.value;
          explicit = true;
        } else if (
          /hour|\bhr\b|\bh\b/.test(
            semantic,
          )
        ) {
          hours =
            parsed.value;
          explicit = true;
        }
      }
    }
  }

  return {
    hours,
    workingDays,
    calendarDays,
    explicit,
  };
}

function ratePerHour(
  rows: readonly SourceRow[],
  globals: readonly SourceRow[],
  calendar: CanonicalCalendar,
  installed: number | null,
  actualHours: number | null,
): {
  rate: number | null;
  measuredRate: number | null;
  factor: number | null;
  basis: ProductivityWorkPackageForecastRow["rateBasis"];
  diagnostics: string[];
} {
  const diagnostics: string[] = [];

  const measured =
    installed !== null &&
    installed > 0 &&
    actualHours !== null &&
    actualHours > 0
      ? installed /
        actualHours
      : null;

  const explicitHourly =
    firstNumber(
      rows,
      "conservative achievable rate per hour",
      "achievable rate per hour",
      "conservative rate per hour",
      "production rate per hour",
      "productivity rate per hour",
      "qty per hour",
      "quantity per hour",
    );
  if (
    explicitHourly !== null &&
    explicitHourly > 0
  ) {
    return {
      rate:
        explicitHourly,
      measuredRate:
        measured,
      factor: null,
      basis:
        "explicit_hourly_rate",
      diagnostics,
    };
  }

  const explicitDaily =
    firstNumber(
      rows,
      "conservative achievable rate per day",
      "conservative achievable rate day",
      "achievable rate per day",
      "achievable rate day",
      "conservative rate per day",
      "production rate per day",
      "productivity rate per day",
      "qty per working day",
      "quantity per working day",
    );
  if (
    explicitDaily !== null &&
    explicitDaily > 0
  ) {
    const dayHours =
      calendarWorkingDayHours(
        calendar,
      );
    if (
      dayHours !== null &&
      dayHours > 0
    ) {
      return {
        rate:
          explicitDaily /
          dayHours,
        measuredRate:
          measured,
        factor: null,
        basis:
          "explicit_working_day_rate",
        diagnostics,
      };
    }
  }

  const genericRaw =
    firstCell(
      rows,
      "conservative achievable rate",
      "achievable rate",
      "conservative rate",
      "production rate",
      "productivity rate",
    ) ||
    settingValue(
      globals,
      [
        "conservative achievable rate",
        "achievable rate",
        "productivity rate",
      ],
    ).value;
  if (genericRaw) {
    const parsed =
      numberWithSuffix(
        genericRaw,
      );
    const rateUnit =
      firstCell(
        rows,
        "rate unit",
        "productivity unit",
        "rate basis",
        "rate uom",
      );
    const semantic =
      (
        rateUnit ||
        parsed.suffix
      ).toLowerCase();

    if (
      parsed.value !== null &&
      parsed.value > 0
    ) {
      if (
        /(?:per|\/)\s*(?:hour|hr|h)\b|\b(?:hourly|per hour)\b/.test(
          semantic,
        )
      ) {
        return {
          rate:
            parsed.value,
          measuredRate:
            measured,
          factor: null,
          basis:
            "explicit_hourly_rate",
          diagnostics,
        };
      }

      if (
        /(?:per|\/)\s*(?:(?:working|work)\s*)?day\b|\bdaily\b/.test(
          semantic,
        )
      ) {
        const dayHours =
          calendarWorkingDayHours(
            calendar,
          );
        if (
          dayHours !== null &&
          dayHours > 0
        ) {
          return {
            rate:
              parsed.value /
              dayHours,
            measuredRate:
              measured,
            factor: null,
            basis:
              "explicit_working_day_rate",
            diagnostics,
          };
        }
      }

      diagnostics.push(
        "PRODUCTIVITY_RATE_UNIT_UNRESOLVED",
      );
    }
  }

  const factor =
    parseConservativeFactor(
      rows,
      globals,
    );

  if (
    measured !== null &&
    measured > 0 &&
    factor !== null
  ) {
    return {
      rate:
        measured * factor,
      measuredRate:
        measured,
      factor,
      basis:
        "measured_rate_with_conservative_factor",
      diagnostics,
    };
  }

  if (
    measured !== null &&
    measured > 0
  ) {
    return {
      rate:
        measured,
      measuredRate:
        measured,
      factor: null,
      basis:
        "measured_installed_per_actual_hour",
      diagnostics,
    };
  }

  diagnostics.push(
    "PRODUCTIVITY_RATE_NOT_ESTABLISHED",
  );
  return {
    rate: null,
    measuredRate:
      measured,
    factor,
    basis: "missing",
    diagnostics,
  };
}

function buildWorkPackageRows(
  state: ProjectRuntimeState,
  diagnostics: string[],
): ProductivityWorkPackageForecastRow[] {
  const schedule =
    projectControlSchedule(
      state,
    );
  if (!schedule) {
    diagnostics.push(
      "PRODUCTIVITY_FORECAST_REQUIRES_ACTIVE_PROGRAMME",
    );
    return [];
  }

  const cutoff =
    projectDataDate(
      state,
    );
  if (!cutoff) {
    diagnostics.push(
      "PRODUCTIVITY_FORECAST_REQUIRES_DATA_DATE",
    );
    return [];
  }

  const tables =
    productivityTables(
      state,
      diagnostics,
    );
  if (tables.length === 0) {
    diagnostics.push(
      "PRODUCTIVITY_WORK_PACKAGE_EVIDENCE_NOT_SUBMITTED",
    );
    return [];
  }

  const globals =
    settingRows(
      tables,
    );
  const groups =
    new Map<
      string,
      SourceRow[]
    >();

  for (const table of tables) {
    for (const row of table.rows) {
      const asOf =
        rowDate(
          row,
        );
      if (
        asOf !== null &&
        asOf > cutoff
      ) {
        diagnostics.push(
          "FUTURE_PRODUCTIVITY_WORK_PACKAGE_ROW_NOT_APPLIED:" +
            row.receipt.documentId +
            ":" +
            row.receipt.locator,
        );
        continue;
      }

      const id =
        workPackageId(
          row,
        );
      if (!id) continue;

      const list =
        groups.get(id) ??
        [];
      list.push(row);
      groups.set(
        id,
        list,
      );
    }
  }

  const globalCalendarSetting =
    settingValue(
      globals,
      [
        "default calendar",
        "default calendar id",
        "productivity calendar",
        "productivity calendar id",
      ],
    );

  const output:
    ProductivityWorkPackageForecastRow[] =
    [];

  for (const [
    workPackageId,
    groupRows,
  ] of groups) {
    const rowDiagnostics:
      string[] = [];
    const rows =
      latestFirst(
        groupRows,
      );

    const description =
      firstCell(
        rows,
        "description",
        "work package description",
        "package description",
        "scope description",
      ) ||
      null;
    const discipline =
      firstCell(
        rows,
        "discipline",
        "trade",
        "work package discipline",
      ) ||
      null;
    const unit =
      firstCell(
        rows,
        "unit",
        "uom",
        "quantity unit",
      ) ||
      null;
    const linkedActivityId =
      firstCell(
        rows,
        "activity id",
        "linked activity",
        "linked schedule activity",
        "schedule activity",
      ) ||
      null;

    const calendarResolved =
      calendarFromRows(
        rows,
        schedule,
        globals,
        linkedActivityId,
      );
    if (
      !calendarResolved.calendar
    ) {
      rowDiagnostics.push(
        "PRODUCTIVITY_CALENDAR_NOT_ESTABLISHED",
      );
    }

    const total =
      firstNumber(
        rows,
        "total quantity",
        "scope quantity",
        "work package quantity",
        "original quantity",
        "budget quantity",
        "quantity",
      );
    const installed =
      firstNumber(
        rows,
        "installed quantity",
        "actual installed quantity",
        "actual installed",
        "actual quantity",
        "completed quantity",
        "quantity installed",
        "cumulative installed quantity",
      );
    const explicitRemaining =
      firstNumber(
        rows,
        "remaining quantity",
        "quantity remaining",
        "remaining qty",
        "remaining",
      );
    let remaining =
      explicitRemaining;

    if (
      remaining === null &&
      total !== null &&
      installed !== null
    ) {
      remaining =
        Number(
          (
            total -
            installed
          ).toFixed(8),
        );
    }

    if (
      remaining === null
    ) {
      rowDiagnostics.push(
        "PRODUCTIVITY_REMAINING_QUANTITY_NOT_ESTABLISHED",
      );
    } else if (
      remaining < 0
    ) {
      rowDiagnostics.push(
        "PRODUCTIVITY_REMAINING_QUANTITY_NEGATIVE",
      );
      remaining = null;
    }

    const actualHours =
      firstNumber(
        rows,
        "actual hours",
        "actual manhours",
        "actual man hours",
        "actual labour hours",
        "actual labor hours",
        "expended hours",
        "actual work hours",
      );

    const recentAchievedRatePerDay =
      firstNumber(
        rows,
        "recent achieved rate per day",
        "recent achieved rate day",
        "recent production rate per day",
        "recent production rate day",
      );
    const conservativeAchievableRatePerDay =
      firstNumber(
        rows,
        "conservative achievable rate per day",
        "conservative achievable rate day",
        "achievable rate per day",
        "achievable rate day",
      );
    const sourceProductiveDays =
      firstNumber(
        rows,
        "productive days",
        "production days",
      );
    const sourceInterfaceAllowanceDays =
      firstNumber(
        rows,
        "interface allowance days",
        "interface days",
      );
    const sourceIndependentForecastFinishIso =
      dateValue(
        firstCell(
          rows,
          "independent forecast finish",
          "independent forecast completion",
          "productivity forecast finish",
          "productivity forecast completion",
        ),
      );

    const calculatedProductiveDays =
      remaining !== null &&
      conservativeAchievableRatePerDay !== null &&
      conservativeAchievableRatePerDay > 0
        ? remaining /
          conservativeAchievableRatePerDay
        : null;
    const productiveDaysReconciliation =
      calculatedProductiveDays === null ||
      sourceProductiveDays === null
        ? "missing" as const
        : (
            Math.abs(
              sourceProductiveDays -
              calculatedProductiveDays,
            ) <= 0.02 ||
            Math.abs(
              sourceProductiveDays -
              Math.ceil(
                calculatedProductiveDays,
              ),
            ) <= 0.02
          )
          ? "reconciled" as const
          : "different" as const;

    const asOfIso =
      rows
        .map(
          rowDate,
        )
        .filter(
          (
            value,
          ): value is string =>
            value !== null,
        )
        .sort()
        .at(-1) ??
      cutoff;

    const explicitStart =
      dateValue(
        firstCell(
          rows,
          "remaining start",
          "forecast start",
          "productivity start",
          "start date",
          "available start",
          "available from",
        ),
      );
    const startIso =
      explicitStart !== null &&
      explicitStart > cutoff
        ? explicitStart
        : cutoff;

    const allowanceValue =
      allowance(
        rows,
        globals,
      );
    if (
      !allowanceValue.explicit &&
      sourceInterfaceAllowanceDays === null
    ) {
      rowDiagnostics.push(
        "PRODUCTIVITY_INTERFACE_ALLOWANCE_NOT_ESTABLISHED",
      );
    }

    let completionIso:
      string | null = null;
    let completionBasis:
      ProductivityWorkPackageForecastRow["completionBasis"] =
      "unresolved";
    let requiredWorkingHours:
      number | null = null;
    let evidencedRatePerHour:
      number | null = null;
    let measuredRatePerHour:
      number | null = null;
    let rateBasis:
      ProductivityWorkPackageForecastRow["rateBasis"] =
      "missing";
    let conservativeFactor:
      number | null = null;

    if (
      calendarResolved.calendar
    ) {
      const rate =
        ratePerHour(
          rows,
          globals,
          calendarResolved.calendar,
          installed,
          actualHours,
        );
      rowDiagnostics.push(
        ...rate.diagnostics,
      );
      evidencedRatePerHour =
        rate.rate;
      measuredRatePerHour =
        rate.measuredRate;
      rateBasis =
        rate.basis;
      conservativeFactor =
        rate.factor;

      if (
        remaining !== null &&
        rate.rate !== null &&
        rate.rate > 0 &&
        allowanceValue.explicit
      ) {
        requiredWorkingHours =
          remaining /
          rate.rate;

        const dayHours =
          calendarWorkingDayHours(
            calendarResolved.calendar,
          );
        const allowanceWorkingHours =
          (
            allowanceValue.hours ??
            0
          ) +
          (
            allowanceValue.workingDays !==
              null &&
            dayHours !==
              null
              ? allowanceValue.workingDays *
                dayHours
              : 0
          );

        if (
          allowanceValue.workingDays !==
            null &&
          dayHours ===
            null
        ) {
          rowDiagnostics.push(
            "PRODUCTIVITY_WORKING_DAY_ALLOWANCE_CALENDAR_HOURS_UNRESOLVED",
          );
        } else {
          const startMs =
            parseScheduleInstant(
              startIso,
            );
          if (
            startMs ===
            null
          ) {
            rowDiagnostics.push(
              "PRODUCTIVITY_START_DATE_INVALID",
            );
          } else {
            try {
              let finishMs =
                addWorkingHours(
                  calendarResolved.calendar,
                  startMs,
                  requiredWorkingHours +
                    allowanceWorkingHours,
                );
              if (
                allowanceValue.calendarDays !==
                null
              ) {
                finishMs +=
                  allowanceValue.calendarDays *
                  DAY_MS;
              }
              completionIso =
                new Date(
                  finishMs,
                )
                  .toISOString()
                  .slice(
                    0,
                    10,
                  );
              completionBasis =
                "calendar_calculated";
            } catch (error) {
              rowDiagnostics.push(
                "PRODUCTIVITY_CALENDAR_CALCULATION_FAILED:" +
                  (
                    error instanceof Error
                      ? error.message
                      : String(
                          error,
                        )
                  ),
              );
            }
          }
        }
      }
    }

    if (
      completionIso === null &&
      sourceIndependentForecastFinishIso !== null &&
      remaining !== null &&
      conservativeAchievableRatePerDay !== null &&
      conservativeAchievableRatePerDay > 0 &&
      sourceProductiveDays !== null &&
      sourceInterfaceAllowanceDays !== null &&
      productiveDaysReconciliation ===
        "reconciled"
    ) {
      completionIso =
        sourceIndependentForecastFinishIso;
      completionBasis =
        "source_model_finish";
      rateBasis =
        "explicit_productive_day_rate";
      rowDiagnostics.push(
        "PRODUCTIVITY_SOURCE_MODEL_ARITHMETIC_RECONCILED",
      );
      rowDiagnostics.push(
        "PRODUCTIVITY_SOURCE_FINISH_RETAINED_CALENDAR_BASIS_NOT_INDEPENDENTLY_RECALCULATED",
      );
    } else if (
      productiveDaysReconciliation ===
        "different"
    ) {
      rowDiagnostics.push(
        "PRODUCTIVITY_SOURCE_PRODUCTIVE_DAYS_ARITHMETIC_MISMATCH",
      );
    }

    const receipts =
      [
        ...new Map(
          rows.map(
            (row) => [
              row.receipt.documentId +
                ":" +
                row.receipt.locator,
              row.receipt,
            ],
          ),
        ).values(),
      ];
    if (
      globalCalendarSetting.receipt &&
      calendarResolved.source.startsWith(
        "global_basis",
      )
    ) {
      receipts.push(
        globalCalendarSetting.receipt,
      );
    }

    const sourceRefs = [
      ...new Set(
        receipts.map(ref),
      ),
    ];

    const official =
      receiptState(
        receipts,
      ) ===
      "official";

    output.push({
      workPackageId,
      description,
      unit,
      discipline,
      linkedActivityId,
      calendarId:
        calendarResolved.calendarId,
      asOfIso,
      startIso,
      totalQuantity:
        total,
      installedQuantity:
        installed,
      remainingQuantity:
        remaining,
      actualHours,
      recentAchievedRatePerDay,
      conservativeAchievableRatePerDay,
      calculatedProductiveDays:
        calculatedProductiveDays === null
          ? null
          : Number(
              calculatedProductiveDays.toFixed(
                6,
              ),
            ),
      sourceProductiveDays,
      productiveDaysReconciliation,
      sourceInterfaceAllowanceDays,
      sourceIndependentForecastFinishIso,
      measuredRatePerHour:
        measuredRatePerHour ===
        null
          ? null
          : Number(
              measuredRatePerHour.toFixed(
                8,
              ),
            ),
      conservativeFactor,
      evidencedRatePerHour:
        evidencedRatePerHour ===
        null
          ? null
          : Number(
              evidencedRatePerHour.toFixed(
                8,
              ),
            ),
      rateBasis,
      allowanceHours:
        allowanceValue.hours,
      allowanceWorkingDays:
        allowanceValue.workingDays,
      allowanceCalendarDays:
        allowanceValue.calendarDays,
      requiredWorkingHours:
        requiredWorkingHours ===
        null
          ? null
          : Number(
              requiredWorkingHours.toFixed(
                6,
              ),
            ),
      completionIso,
      completionBasis,
      state:
        completionIso ===
        null
          ? "unresolved"
          : official
            ? "official"
            : "candidate",
      sourceRefs,
      receipts,
      diagnostics: [
        ...new Set(
          rowDiagnostics,
        ),
      ],
    });
  }

  return output.sort(
    (a, b) =>
      a.workPackageId.localeCompare(
        b.workPackageId,
        undefined,
        { numeric: true },
      ),
  );
}

export function sourceProductivityForecastEvidence(
  state: ProjectRuntimeState,
): SourceProductivityForecastEvidence {
  const old =
    cache.get(state);
  if (
    old?.version ===
    state.version
  ) {
    return old.value;
  }

  const diagnostics:
    string[] = [];
  const submitted =
    declaredProductivityForecast(
      state,
      diagnostics,
    );
  const rows =
    buildWorkPackageRows(
      state,
      diagnostics,
    );
  const calculated =
    rows.filter(
      (row) =>
        row.completionIso !==
        null,
    );
  const calendarCalculated =
    calculated.filter(
      (row) =>
        row.completionBasis ===
        "calendar_calculated",
    );
  const sourceModelCalculated =
    calculated.filter(
      (row) =>
        row.completionBasis ===
        "source_model_finish",
    );

  const latestIso =
    calculated
      .map(
        (row) =>
          row.completionIso!,
      )
      .sort()
      .at(-1) ??
    null;
  const drivers =
    latestIso === null
      ? []
      : calculated.filter(
          (row) =>
            row.completionIso ===
            latestIso,
        );

  const calculatedState:
    "official" |
    "candidate" |
    "missing" =
    latestIso ===
    null
      ? "missing"
      : rows.length > 0 &&
          calculated.length ===
            rows.length &&
          rows.every(
            (row) =>
              row.state ===
              "official",
          )
        ? "official"
        : "candidate";

  if (
    rows.length > 0 &&
    calculated.length <
      rows.length
  ) {
    diagnostics.push(
      "PRODUCTIVITY_FORECAST_PARTIAL_WORK_PACKAGE_COVERAGE:" +
        calculated.length +
        "/" +
        rows.length,
    );
  }

  const useDerived =
    latestIso !==
    null;
  const completionIso =
    useDerived
      ? latestIso
      : submitted.completionIso;
  const method:
    ProductivityForecastMethod =
    useDerived
      ? (
          sourceModelCalculated.length >
          0
            ? "source_work_package_productivity_model"
            : "source_evidence_derived_productivity"
        )
      : submitted.completionIso !==
          null
        ? "source_declared_productivity_date"
        : "missing";

  const stateValue:
    SourceProductivityForecastEvidence["state"] =
    useDerived
      ? calculatedState
      : submitted.state;

  const driverReceipts =
    drivers.flatMap(
      (row) =>
        row.receipts,
    );
  const receipts =
    useDerived
      ? [
          ...new Map(
            driverReceipts.map(
              (receipt) => [
                receipt.documentId +
                  ":" +
                  receipt.locator,
                receipt,
              ],
            ),
          ).values(),
        ]
      : submitted.receipts;

  const varianceDays =
    daysBetween(
      submitted.completionIso,
      useDerived
        ? latestIso
        : null,
    );
  const reconciliationState:
    SourceProductivityForecastEvidence["reconciliation"]["state"] =
    submitted.completionIso &&
    latestIso
      ? varianceDays === 0
        ? "reconciled"
        : "different"
      : submitted.completionIso
        ? "submitted_only"
        : latestIso
          ? "calculated_only"
          : "missing";

  const value:
    SourceProductivityForecastEvidence = {
    producerVersion:
      "source-productivity-forecast-v2",
    completionIso,
    state:
      stateValue,
    asOfIso:
      drivers
        .map(
          (row) =>
            row.asOfIso,
        )
        .filter(
          (
            item,
          ): item is string =>
            item !== null,
        )
        .sort()
        .at(-1) ??
      submitted.asOfIso ??
      projectDataDate(
        state,
      ),
    method,
    submittedCompletionIso:
      submitted.completionIso,
    submittedState:
      submitted.state,
    driverWorkPackageId:
      drivers[0]
        ?.workPackageId ??
      null,
    driverWorkPackageIds:
      drivers.map(
        (row) =>
          row.workPackageId,
      ),
    workPackageCount:
      rows.length,
    calculatedWorkPackageCount:
      calculated.length,
    calendarCalculatedWorkPackageCount:
      calendarCalculated.length,
    sourceModelWorkPackageCount:
      sourceModelCalculated.length,
    calculationCoveragePercent:
      coverage(
        calculated.length,
        rows.length,
      ),
    receipts,
    sourceRefs: [
      ...new Set(
        receipts.map(ref),
      ),
    ],
    rows,
    reconciliation: {
      submittedCompletionIso:
        submitted.completionIso,
      calculatedCompletionIso:
        latestIso,
      varianceDays,
      state:
        reconciliationState,
    },
    diagnostics: [
      ...new Set(
        diagnostics,
      ),
    ],
  };

  cache.set(
    state,
    {
      version:
        state.version,
      value,
    },
  );
  return value;
}
