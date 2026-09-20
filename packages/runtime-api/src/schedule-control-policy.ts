import { readFileSync } from "node:fs";
import {
  DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
  type CanonicalScheduleModel,
  type ScheduleAnalysisConfig,
} from "../../schedule-analysis-core/src";
import type {
  ProjectRuntimeState,
  StoredEvidenceDocument,
} from "./project-state-types";

export interface ResolvedScheduleControlPolicy {
  config: ScheduleAnalysisConfig;
  authority:
    | "default"
    | "project_control_basis"
    | "source_metric_reconciled";
  definition: string;
  sourceRefs: string[];
  reportedNearCriticalCount: number | null;
  sourceDataDateIso: string | null;
  dataDateConflict: boolean;
  diagnostics: string[];
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function norm(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function num(raw: string): number | null {
  const cleaned = raw
    .replace(/,/g, "")
    .replace(/[^0-9.+-]/g, "")
    .trim();
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value)
    ? value
    : null;
}

function iso(raw: string): string | null {
  const parsed = Date.parse(raw.trim());
  return Number.isFinite(parsed)
    ? new Date(parsed).toISOString()
    : null;
}

function sourceRef(
  document: StoredEvidenceDocument,
  row: number,
): string {
  return (
    "evidence-document:" +
    document.documentId +
    ":row:" +
    row
  );
}

function metricRegister(
  documents:
    readonly StoredEvidenceDocument[],
): {
  nearCriticalCount: number | null;
  dataDateIso: string | null;
  sourceRefs: string[];
  diagnostics: string[];
} {
  const sourceRefs: string[] = [];
  const diagnostics: string[] = [];
  let nearCriticalCount:
    number | null = null;
  let dataDateIso:
    string | null = null;

  const candidates =
    documents
      .filter(
        (document) =>
          document.documentType ===
            "schedule_metric_register" &&
          (
            document.basisState ===
              "active" ||
            document.basisState ===
              "additive" ||
            document.basisState ===
              "candidate"
          ),
      )
      .sort(
        (a, b) =>
          a.uploadedAt.localeCompare(
            b.uploadedAt,
          ),
      );

  for (const document of candidates) {
    try {
      const rows = parseCsv(
        readFileSync(
          document.storedPath,
          "utf8",
        ),
      );
      if (rows.length < 2) {
        continue;
      }
      const headers =
        (rows[0] ?? [])
          .map(norm);
      const metricIndex =
        headers.findIndex(
          (header) =>
            header === "metric" ||
            header.includes(
              "metric",
            ),
        );
      const valueIndex =
        headers.findIndex(
          (header) =>
            header === "value" ||
            header.includes(
              "value",
            ),
        );
      if (
        metricIndex < 0 ||
        valueIndex < 0
      ) {
        continue;
      }
      for (
        let rowIndex = 1;
        rowIndex < rows.length;
        rowIndex += 1
      ) {
        const row =
          rows[rowIndex] ??
          [];
        const metric =
          norm(
            row[metricIndex] ??
            "",
          );
        const raw =
          (
            row[valueIndex] ??
            ""
          ).trim();

        if (
          metric ===
            "near critical" ||
          metric ===
            "near critical activities" ||
          (
            metric.includes(
              "near critical",
            ) &&
            !metric.includes(
              "threshold",
            )
          )
        ) {
          const value =
            num(raw);
          if (value !== null) {
            nearCriticalCount =
              value;
            sourceRefs.push(
              sourceRef(
                document,
                rowIndex + 1,
              ),
            );
          }
        }

        if (
          metric ===
            "data date" ||
          metric.includes(
            "data date",
          )
        ) {
          const value =
            iso(raw);
          if (value) {
            dataDateIso =
              value;
            sourceRefs.push(
              sourceRef(
                document,
                rowIndex + 1,
              ),
            );
          }
        }
      }
    } catch {
      diagnostics.push(
        "SCHEDULE_METRIC_REGISTER_NOT_READABLE:" +
          document.documentId,
      );
    }
  }

  return {
    nearCriticalCount,
    dataDateIso,
    sourceRefs: [
      ...new Set(
        sourceRefs,
      ),
    ],
    diagnostics,
  };
}

function dayHours(
  model: CanonicalScheduleModel,
): number | null {
  const hours =
    model.calendars
      .map(
        (calendar) =>
          calendar
            .standardDayHours,
      )
      .filter(
        (
          value,
        ): value is number =>
          typeof value ===
            "number" &&
          Number.isFinite(
            value,
          ) &&
          value > 0,
      );
  if (hours.length === 0) {
    return null;
  }
  const counts =
    new Map<number, number>();
  for (const value of hours) {
    counts.set(
      value,
      (
        counts.get(
          value,
        ) ??
        0
      ) + 1,
    );
  }
  return [
    ...counts.entries(),
  ]
    .sort(
      (a, b) =>
        b[1] - a[1] ||
        a[0] - b[0],
    )[0]?.[0] ??
    null;
}

function explicitBasis(
  state: ProjectRuntimeState,
  model: CanonicalScheduleModel,
): {
  lower: number;
  inclusive: boolean;
  upper: number;
  definition: string;
  sourceRefs: string[];
} | null {
  const hoursPerDay =
    dayHours(model);
  const candidates =
    state.evidenceDocuments
      .filter(
        (document) =>
          document.documentType ===
            "schedule_control_basis" &&
          (
            document.basisState ===
              "active" ||
            document.basisState ===
              "additive" ||
            document.basisState ===
              "candidate"
          ),
      );

  for (const document of candidates) {
    const corpus = [
      document.identification
        .detectedTitle ??
        "",
      ...document.assertions
        .map(
          (assertion) =>
            assertion.sourceText,
        ),
    ]
      .join("\n")
      .normalize("NFKC");

    const match =
      /near[-\s]?critical[^\n\r]{0,180}?(?:0\s*(?:\.\.|to|through|-)\s*\+?\s*)?(\d+(?:\.\d+)?)\s*(working\s+days?|calendar\s+days?|days?|hours?|hrs?|h)\b/i.exec(
        corpus,
      );
    if (!match?.[1] ||
        !match[2]) {
      continue;
    }

    const amount =
      Number(match[1]);
    if (!Number.isFinite(amount)) {
      continue;
    }
    const unit =
      match[2]
        .toLowerCase();
    let upper =
      amount;
    if (
      unit.includes("day")
    ) {
      if (
        !hoursPerDay
      ) {
        continue;
      }
      upper =
        amount *
        hoursPerDay;
    }

    const inclusive =
      /(?:^|[^0-9])0\s*(?:\.\.|to|through|-)\s*\+?/i.test(
        match[0],
      );

    return {
      lower: 0,
      inclusive,
      upper,
      definition:
        match[0]
          .replace(/\s+/g, " ")
          .trim(),
      sourceRefs:
        document.assertions.length
          ? document.assertions
              .map(
                (assertion) =>
                  assertion.sourceRef,
              )
          : [
              "evidence-document:" +
                document.documentId,
            ],
    };
  }

  return null;
}

function reconcileThreshold(
  model: CanonicalScheduleModel,
  targetCount: number,
): {
  lower: number;
  inclusive: boolean;
  upper: number;
} | null {
  const values =
    model.activities
      .map(
        (activity) =>
          activity
            .totalFloatHours,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null &&
          Number.isFinite(
            value,
          ),
      );
  const thresholds = [
    ...new Set(
      values
        .filter(
          (value) =>
            value >= 0,
        )
        .sort(
          (a, b) =>
            a - b,
        ),
    ),
  ];

  const matches: Array<{
    lower: number;
    inclusive: boolean;
    upper: number;
  }> = [];

  for (
    const inclusive of
      [true, false]
  ) {
    for (const upper of thresholds) {
      const count =
        values.filter(
          (value) =>
            (
              inclusive
                ? value >= 0
                : value > 0
            ) &&
            value <= upper,
        ).length;
      if (
        count ===
        targetCount
      ) {
        matches.push({
          lower: 0,
          inclusive,
          upper,
        });
        break;
      }
      if (
        count >
        targetCount
      ) {
        break;
      }
    }
  }

  return matches.length === 1
    ? matches[0]!
    : null;
}

export function resolveScheduleControlPolicy(
  state: ProjectRuntimeState,
  model: CanonicalScheduleModel,
): ResolvedScheduleControlPolicy {
  const sourceMetrics =
    metricRegister(
      state.evidenceDocuments,
    );
  const diagnostics = [
    ...sourceMetrics
      .diagnostics,
  ];
  const explicit =
    explicitBasis(
      state,
      model,
    );

  let config: ScheduleAnalysisConfig = {
    ...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
  };
  let authority:
    ResolvedScheduleControlPolicy["authority"] =
    "default";
  let definition =
    "Default CMeng near-critical screen: total float > 0 and <= 40 hours.";
  let sourceRefs: string[] = [];

  if (explicit) {
    config = {
      ...config,
      nearCriticalLowerBoundHours:
        explicit.lower,
      nearCriticalLowerBoundInclusive:
        explicit.inclusive,
      nearCriticalFloatThresholdHours:
        explicit.upper,
    };
    authority =
      "project_control_basis";
    definition =
      explicit.definition;
    sourceRefs = [
      ...explicit.sourceRefs,
    ];
  } else if (
    sourceMetrics
      .nearCriticalCount !==
    null
  ) {
    const reconciled =
      reconcileThreshold(
        model,
        sourceMetrics
          .nearCriticalCount,
      );
    if (reconciled) {
      config = {
        ...config,
        nearCriticalLowerBoundHours:
          reconciled.lower,
        nearCriticalLowerBoundInclusive:
          reconciled.inclusive,
        nearCriticalFloatThresholdHours:
          reconciled.upper,
      };
      authority =
        "source_metric_reconciled";
      definition =
        "Near-critical threshold reconciled from the governed source metric population: total float " +
        (
          reconciled.inclusive
            ? ">= "
            : "> "
        ) +
        reconciled.lower +
        " h and <= " +
        reconciled.upper +
        " h.";
      sourceRefs = [
        ...sourceMetrics
          .sourceRefs,
      ];
      diagnostics.push(
        "NEAR_CRITICAL_POLICY_RECONCILED_TO_SOURCE_REGISTER_POPULATION",
      );
    } else {
      diagnostics.push(
        "NEAR_CRITICAL_SOURCE_COUNT_COULD_NOT_UNIQUELY_RESOLVE_THRESHOLD_POLICY",
      );
    }
  }

  const dataDateConflict =
    sourceMetrics
      .dataDateIso !==
      null &&
    model.dataDateIso !==
      null &&
    sourceMetrics
      .dataDateIso !==
      model.dataDateIso;

  if (dataDateConflict) {
    diagnostics.push(
      "SOURCE_METRIC_REGISTER_DATA_DATE_CONFLICTS_WITH_CURRENT_PROGRAMME_DATA_DATE",
    );
  }

  return {
    config,
    authority,
    definition,
    sourceRefs: [
      ...new Set(
        sourceRefs,
      ),
    ],
    reportedNearCriticalCount:
      sourceMetrics
        .nearCriticalCount,
    sourceDataDateIso:
      sourceMetrics
        .dataDateIso,
    dataDateConflict,
    diagnostics: [
      ...new Set(
        diagnostics,
      ),
    ],
  };
}
