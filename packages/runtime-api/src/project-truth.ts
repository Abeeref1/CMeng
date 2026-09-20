import {
  readFileSync,
} from "node:fs";

import type {
  CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";
import type {
  ContractTimeBasis,
} from "../../eot-assessment/src";
import type {
  ProjectRuntimeState,
  StoredEvidenceDocument,
} from "./project-state-types";

export type TruthAuthority =
  | "governed_source"
  | "reconciled_source"
  | "derived"
  | "candidate"
  | "missing"
  | "conflicted";

export interface TruthFact<T> {
  key: string;
  value: T | null;
  unit: string | null;
  authority: TruthAuthority;
  sourceRefs: string[];
  basisRevisionId: string | null;
  effectiveAt: string | null;
  coveragePercent: number | null;
  method: string;
  diagnostics: string[];
}

export interface ScheduleControlTruth {
  dataDate: TruthFact<string>;
  projectCompletionActivityId:
    TruthFact<string>;
  baselineCompletion:
    TruthFact<string>;
  currentCompletion:
    TruthFact<string>;
  revisedContractCompletion:
    TruthFact<string>;
  programmeMovementDays:
    TruthFact<number>;
  forecastSlippageDays:
    TruthFact<number>;
  nearCriticalSourceCount:
    TruthFact<number>;
  nearCriticalThresholdHours:
    TruthFact<number>;
  nearCriticalWorkingDays:
    TruthFact<number>;
  nearCriticalIncludesZeroFloat:
    boolean;
  standardWorkingDayHours:
    number | null;
}

export interface ForecastPosition {
  kind:
    | "submitted_programme"
    | "source_productivity"
    | "cmeng_cpm"
    | "probabilistic_comparator";
  label: string;
  dateIso: string | null;
  authority: TruthAuthority;
  sourceRefs: string[];
  method: string;
  percentile: number | null;
  driverId: string | null;
}

export interface ProjectTruthSnapshot {
  schemaVersion: "1.0";
  projectId: string;
  scheduleRevisionId: string;
  schedule: ScheduleControlTruth;
  contractTimeBasis: ContractTimeBasis | null;
  forecastPositions: ForecastPosition[];
  diagnostics: string[];
}

function norm(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseCsv(
  text: string,
): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    const ch = text[index]!;
    if (quoted) {
      if (ch === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(
        field.replace(/\r$/, ""),
      );
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (
    field.length > 0 ||
    row.length > 0
  ) {
    row.push(
      field.replace(/\r$/, ""),
    );
    rows.push(row);
  }
  return rows;
}

function readCsv(
  document: StoredEvidenceDocument,
): string[][] | null {
  try {
    return parseCsv(
      readFileSync(
        document.storedPath,
        "utf8",
      ).replace(/^\uFEFF/, ""),
    );
  } catch {
    return null;
  }
}

function cell(
  row: string[],
  index: number,
): string {
  return index >= 0
    ? (
        row[index] ??
        ""
      ).trim()
    : "";
}

function findColumn(
  headers: string[],
  names: string[],
): number {
  const values =
    headers.map(norm);
  for (const name of names) {
    const exact =
      values.indexOf(
        norm(name),
      );
    if (exact >= 0) return exact;
  }
  return values.findIndex(
    (value) =>
      names.some(
        (name) =>
          value.includes(
            norm(name),
          ),
      ),
  );
}

function numberValue(
  value: string,
): number | null {
  const parsed =
    Number(
      value
        .replace(/,/g, "")
        .replace(
          /[^0-9.+-]/g,
          "",
        ),
    );
  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function dateValue(
  value: string,
): string | null {
  const parsed =
    Date.parse(
      value.trim(),
    );
  return Number.isFinite(parsed)
    ? new Date(parsed)
        .toISOString()
        .slice(0, 10)
    : null;
}

function activeCandidate(
  document: StoredEvidenceDocument,
): boolean {
  return (
    document.basisState !==
      "superseded" &&
    document.basisState !==
      "historical"
  );
}

function evidenceRef(
  document:
    StoredEvidenceDocument,
  locator?: string,
): string {
  return (
    "evidence-document:" +
    document.documentId +
    (
      locator
        ? ":" + locator
        : ""
    )
  );
}

function fact<T>(
  input: {
    key: string;
    value: T | null;
    unit?: string | null;
    authority:
      TruthAuthority;
    sourceRefs?: string[];
    basisRevisionId?:
      string | null;
    effectiveAt?:
      string | null;
    coveragePercent?:
      number | null;
    method: string;
    diagnostics?: string[];
  },
): TruthFact<T> {
  return {
    key: input.key,
    value: input.value,
    unit: input.unit ?? null,
    authority:
      input.authority,
    sourceRefs:
      input.sourceRefs ?? [],
    basisRevisionId:
      input.basisRevisionId ??
      null,
    effectiveAt:
      input.effectiveAt ??
      null,
    coveragePercent:
      input.coveragePercent ??
      null,
    method: input.method,
    diagnostics:
      input.diagnostics ?? [],
  };
}

function metricRegister(
  state: ProjectRuntimeState,
): {
  document:
    StoredEvidenceDocument;
  values: Map<
    string,
    {
      value: string;
      unit: string;
      source: string;
      row: number;
    }
  >;
} | null {
  const document =
    [...state.evidenceDocuments]
      .filter(
        (item) =>
          activeCandidate(item) &&
          (
            item.documentType ===
              "schedule_metric_register" ||
            /^sch0?2[_-]/i.test(
              item.sourceFilename,
            )
          ),
      )
      .sort(
        (a, b) =>
          a.uploadedAt.localeCompare(
            b.uploadedAt,
          ),
      )
      .at(-1) ??
    null;
  if (!document) return null;
  const rows =
    readCsv(document);
  if (!rows ||
      rows.length < 2) {
    return null;
  }
  const headers =
    rows[0] ?? [];
  const metricIndex =
    findColumn(
      headers,
      ["metric"],
    );
  const valueIndex =
    findColumn(
      headers,
      ["value"],
    );
  const unitIndex =
    findColumn(
      headers,
      ["unit"],
    );
  const sourceIndex =
    findColumn(
      headers,
      ["source"],
    );
  if (
    metricIndex < 0 ||
    valueIndex < 0
  ) return null;

  const values =
    new Map<
      string,
      {
        value: string;
        unit: string;
        source: string;
        row: number;
      }
    >();
  for (
    let index = 1;
    index < rows.length;
    index += 1
  ) {
    const row =
      rows[index] ?? [];
    const key =
      norm(
        cell(
          row,
          metricIndex,
        ),
      );
    if (!key) continue;
    values.set(
      key,
      {
        value:
          cell(
            row,
            valueIndex,
          ),
        unit:
          cell(
            row,
            unitIndex,
          ),
        source:
          cell(
            row,
            sourceIndex,
          ),
        row: index + 1,
      },
    );
  }
  return {
    document,
    values,
  };
}

function metric(
  register:
    ReturnType<
      typeof metricRegister
    >,
  label: string,
) {
  return register
    ?.values.get(
      norm(label),
    ) ??
    null;
}

function sourceActivityId(
  source: string,
): string | null {
  const matches =
    source.match(
      /\b[A-Z][A-Z0-9_-]*-[A-Z0-9_-]+\b/g,
    ) ?? [];
  return (
    matches.at(-1) ??
    null
  );
}

function standardDayHours(
  model: CanonicalScheduleModel,
  activityId:
    string | null,
): number | null {
  const activity =
    activityId
      ? model.activities.find(
          (item) =>
            item.activityId ===
            activityId,
        ) ?? null
      : null;
  const activityCalendar =
    activity?.calendarId
      ? model.calendars.find(
          (calendar) =>
            calendar.calendarId ===
            activity.calendarId,
        ) ?? null
      : null;
  if (
    typeof activityCalendar
      ?.standardDayHours ===
      "number" &&
    activityCalendar
      .standardDayHours >
      0
  ) {
    return activityCalendar
      .standardDayHours;
  }

  const known =
    model.calendars
      .map(
        (calendar) =>
          calendar.standardDayHours,
      )
      .filter(
        (
          value,
        ): value is number =>
          typeof value ===
            "number" &&
          value > 0,
      );
  if (!known.length) return null;
  const counts =
    new Map<number, number>();
  for (const value of known) {
    counts.set(
      value,
      (counts.get(value) ?? 0) +
        1,
    );
  }
  return [
    ...counts.entries(),
  ].sort(
    (a, b) =>
      b[1] - a[1] ||
      a[0] - b[0],
  )[0]?.[0] ?? null;
}

function inferredNearCriticalPolicy(
  model: CanonicalScheduleModel,
  targetCount: number | null,
): {
  thresholdHours: number | null;
  lowerBoundInclusive: boolean;
  state:
    | "reconciled"
    | "ambiguous"
    | "missing";
} {
  if (
    targetCount === null ||
    targetCount <= 0
  ) {
    return {
      thresholdHours: null,
      lowerBoundInclusive: false,
      state: "missing",
    };
  }

  const values =
    model.activities
      .map(
        (activity) =>
          activity.totalFloatHours,
      )
      .filter(
        (
          value,
        ): value is number =>
          typeof value ===
            "number" &&
          Number.isFinite(value) &&
          value >= 0,
      );
  if (!values.length) {
    return {
      thresholdHours: null,
      lowerBoundInclusive: false,
      state: "missing",
    };
  }

  const thresholds = [
    ...new Set(values),
  ].sort((a, b) => a - b);
  const matches: Array<{
    thresholdHours: number;
    lowerBoundInclusive: boolean;
  }> = [];

  for (const threshold of thresholds) {
    const inclusive =
      values.filter(
        (value) =>
          value >= 0 &&
          value <= threshold,
      ).length;
    if (inclusive === targetCount) {
      matches.push({
        thresholdHours: threshold,
        lowerBoundInclusive: true,
      });
    }
    const exclusive =
      values.filter(
        (value) =>
          value > 0 &&
          value <= threshold,
      ).length;
    if (exclusive === targetCount) {
      matches.push({
        thresholdHours: threshold,
        lowerBoundInclusive: false,
      });
    }
  }

  if (matches.length === 1) {
    return {
      ...matches[0]!,
      state: "reconciled",
    };
  }
  if (matches.length > 1) {
    const shortest =
      matches.sort(
        (a, b) =>
          a.thresholdHours -
            b.thresholdHours ||
          Number(
            b.lowerBoundInclusive,
          ) -
            Number(
              a.lowerBoundInclusive,
            ),
      )[0]!;
    return {
      ...shortest,
      state: "ambiguous",
    };
  }
  return {
    thresholdHours: null,
    lowerBoundInclusive: false,
    state: "missing",
  };
}

function contractDocumentText(
  state: ProjectRuntimeState,
  role:
    "main" |
    "amendment",
): Array<{
  documentId: string;
  text: string;
}> {
  return state.contractDocuments
    .filter(
      (document) =>
        document.role === role,
    )
    .filter(
      (document) => {
        const evidence =
          state.evidenceDocuments
            .find(
              (item) =>
                item.documentId ===
                document.documentId,
            );
        return (
          evidence
            ?.basisState !==
          "superseded"
        );
      },
    )
    .map(
      (document) => ({
        documentId:
          document.documentId,
        text:
          document.result.sections
            .map(
              (section) =>
                section.text,
            )
            .join("\n"),
      }),
    );
}

function regexDate(
  text: string,
  patterns: RegExp[],
): string | null {
  for (const pattern of patterns) {
    const match =
      pattern.exec(text);
    if (!match) continue;
    const value =
      dateValue(
        match[1] ?? "",
      );
    if (value) return value;
  }
  return null;
}

function regexNumber(
  text: string,
  patterns: RegExp[],
): number | null {
  for (const pattern of patterns) {
    const match =
      pattern.exec(text);
    if (!match) continue;
    const value =
      numberValue(
        match[1] ?? "",
      );
    if (value !== null) {
      return value;
    }
  }
  return null;
}

function determinationEvidence(
  state: ProjectRuntimeState,
  dataDateIso:
    string | null,
): {
  count: number;
  totalDays: number;
  toDataDateDays: number;
  toDataDateCount: number;
  sourceRefs: string[];
  diagnostics: string[];
} {
  const documents =
    state.evidenceDocuments.filter(
      (document) =>
        activeCandidate(document) &&
        (
          document.documentType ===
            "engineer_determination_register" ||
          /^eot0?3[_-]/i.test(
            document.sourceFilename,
          )
        ),
    );
  let count = 0;
  let totalDays = 0;
  let toDataDateDays = 0;
  let toDataDateCount = 0;
  const sourceRefs:
    string[] = [];
  const diagnostics:
    string[] = [];

  for (const document of documents) {
    const rows =
      readCsv(document);
    if (!rows ||
        rows.length < 2) {
      diagnostics.push(
        "EOT_DETERMINATION_REGISTER_UNREADABLE:" +
          document.documentId,
      );
      continue;
    }
    const headers =
      rows[0] ?? [];
    const daysIndex =
      findColumn(
        headers,
        [
          "awarded eot days",
          "awarded days",
        ],
      );
    const dateIndex =
      findColumn(
        headers,
        [
          "determination date",
          "date",
        ],
      );
    const authorityIndex =
      findColumn(
        headers,
        ["authority"],
      );
    const governanceIndex =
      findColumn(
        headers,
        [
          "governance state",
          "state",
        ],
      );
    if (daysIndex < 0) {
      continue;
    }
    for (
      let index = 1;
      index < rows.length;
      index += 1
    ) {
      const row =
        rows[index] ?? [];
      const days =
        numberValue(
          cell(
            row,
            daysIndex,
          ),
        );
      if (days === null) {
        continue;
      }
      const authority =
        norm(
          cell(
            row,
            authorityIndex,
          ),
        );
      const governance =
        norm(
          cell(
            row,
            governanceIndex,
          ),
        );
      const official =
        (
          !authority ||
          authority.includes(
            "engineer",
          )
        ) &&
        (
          !governance ||
          governance.includes(
            "immutable",
          ) ||
          governance.includes(
            "official",
          ) ||
          governance.includes(
            "approved",
          )
        );
      if (!official) continue;
      count += 1;
      totalDays += days;
      const determinationDate =
        dateValue(
          cell(
            row,
            dateIndex,
          ),
        );
      if (
        dataDateIso &&
        determinationDate &&
        determinationDate <=
          dataDateIso
      ) {
        toDataDateCount += 1;
        toDataDateDays +=
          days;
      }
      sourceRefs.push(
        evidenceRef(
          document,
          "row:" +
            (index + 1),
        ),
      );
    }
  }

  return {
    count,
    totalDays:
      Number(
        totalDays.toFixed(6),
      ),
    toDataDateDays:
      Number(
        toDataDateDays.toFixed(
          6,
        ),
      ),
    toDataDateCount,
    sourceRefs,
    diagnostics,
  };
}

function contractTimeTruth(
  state: ProjectRuntimeState,
  model: CanonicalScheduleModel,
  revisedCompletionFromScheduleControl:
    string | null,
): ContractTimeBasis | null {
  const amendments =
    contractDocumentText(
      state,
      "amendment",
    );
  const main =
    contractDocumentText(
      state,
      "main",
    );
  const amendmentText =
    amendments
      .map(
        (item) =>
          item.text,
      )
      .join("\n");
  const baseText =
    main
      .map(
        (item) =>
          item.text,
      )
      .join("\n");

  const revisedCompletion =
    regexDate(
      amendmentText,
      [
        /revised\s+contractual\s+completion(?:\s+date)?\s*[:\-]?\s*([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i,
        /revised\s+completion(?:\s+date)?\s*[:\-]?\s*([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i,
      ],
    ) ??
    revisedCompletionFromScheduleControl;

  const originalCompletion =
    regexDate(
      baseText,
      [
        /(?:original\s+)?contractual\s+completion(?:\s+date)?\s*[:\-]?\s*([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i,
        /time\s+for\s+completion[^\n]{0,100}?([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i,
      ],
    );

  const incorporatedEot =
    regexNumber(
      amendmentText,
      [
        /eot\s+granted\s*[:\-]?\s*([0-9,.]+)\s*calendar\s+days/i,
        /extended\s+by\s+([0-9,.]+)\s*calendar\s+days/i,
      ],
    );

  const determinations =
    determinationEvidence(
      state,
      model.dataDateIso,
    );

  const sourceRefs = [
    ...amendments.map(
      (item) =>
        "contract-amendment:" +
        item.documentId,
    ),
    ...(
      revisedCompletionFromScheduleControl
        ? state.evidenceDocuments
            .filter(
              (document) =>
                document.documentType ===
                  "schedule_metric_register" ||
                /^sch0?2[_-]/i.test(
                  document.sourceFilename,
                ),
            )
            .map(
              (document) =>
                evidenceRef(
                  document,
                ),
            )
        : []
    ),
  ];

  if (
    !revisedCompletion &&
    determinations.count === 0
  ) {
    return null;
  }

  return {
    contractualCompletionIso:
      revisedCompletion,
    contractualCompletionState:
      revisedCompletion
        ? "official"
        : "missing",
    officialApprovedEotDays:
      determinations.count > 0
        ? determinations
            .totalDays
        : null,
    officialApprovedEotState:
      determinations.count > 0
        ? "official"
        : "missing",
    incorporatedAmendmentEotDays:
      incorporatedEot,
    incorporatedAmendmentEotState:
      incorporatedEot !== null
        ? "official"
        : "missing",
    determinationCount:
      determinations.count,
    determinationAwardedDaysTotal:
      determinations.count > 0
        ? determinations
            .totalDays
        : null,
    determinationAwardedDaysToDataDate:
      determinations.count > 0
        ? determinations
            .toDataDateDays
        : null,
    determinationDataDateIso:
      model.dataDateIso,
    approvedEotAdditionalToContractBasis:
      null,
    eotDayBasis:
      "calendar_days",
    eotDayBasisState:
      revisedCompletion ||
      incorporatedEot !== null
        ? "official"
        : "missing",
    sourceRefs,
    determinationSourceRefs:
      determinations.sourceRefs,
    diagnostics: [
      ...determinations
        .diagnostics,
      ...(originalCompletion
        ? [
            "ORIGINAL_CONTRACTUAL_COMPLETION:" +
              originalCompletion,
          ]
        : []),
      ...(incorporatedEot !==
        null
        ? [
            "AMENDMENT_EOT_IS_INCORPORATED_IN_CURRENT_CONTRACTUAL_COMPLETION_AND_MUST_NOT_BE_ADDED_AGAIN",
          ]
        : []),
      ...(determinations.count >
        0
        ? [
            "EOT_DETERMINATION_REGISTER_TOTAL_REPORTED_SEPARATELY_FROM_CURRENT_CONTRACTUAL_COMPLETION",
            "EOT_DETERMINATIONS_EFFECTIVE_TO_DATA_DATE:" +
              determinations
                .toDataDateCount +
              "_ROWS:" +
              determinations
                .toDataDateDays +
              "_DAYS",
          ]
        : []),
    ],
  };
}

function productivityForecast(
  state: ProjectRuntimeState,
): ForecastPosition | null {
  const document =
    [...state.evidenceDocuments]
      .filter(
        (item) =>
          activeCandidate(item) &&
          (
            item.documentType ===
              "independent_productivity_forecast" ||
            /^if0?1[_-]/i.test(
              item.sourceFilename,
            )
          ),
      )
      .sort(
        (a, b) =>
          a.uploadedAt.localeCompare(
            b.uploadedAt,
          ),
      )
      .at(-1) ??
    null;
  if (!document) return null;
  const rows =
    readCsv(document);
  if (!rows ||
      rows.length < 2) {
    return null;
  }
  const headers =
    rows[0] ?? [];
  const finishIndex =
    findColumn(
      headers,
      [
        "independent forecast finish",
        "forecast finish",
      ],
    );
  const statusIndex =
    findColumn(
      headers,
      ["status"],
    );
  const packageIndex =
    findColumn(
      headers,
      [
        "work package",
        "package",
      ],
    );
  if (finishIndex < 0) {
    return null;
  }
  let latestDate:
    string | null = null;
  let driverId:
    string | null = null;
  let driverRow = 0;
  for (
    let index = 1;
    index < rows.length;
    index += 1
  ) {
    const row =
      rows[index] ?? [];
    const status =
      norm(
        cell(
          row,
          statusIndex,
        ),
      );
    if (
      status &&
      status !== "approved"
    ) continue;
    const finish =
      dateValue(
        cell(
          row,
          finishIndex,
        ),
      );
    if (
      finish &&
      (
        !latestDate ||
        finish > latestDate
      )
    ) {
      latestDate = finish;
      driverId =
        cell(
          row,
          packageIndex,
        ) || null;
      driverRow = index + 1;
    }
  }
  if (!latestDate) return null;
  return {
    kind:
      "source_productivity",
    label:
      "Source productivity forecast",
    dateIso: latestDate,
    authority:
      document.basisState ===
        "candidate"
        ? "candidate"
        : "governed_source",
    sourceRefs: [
      evidenceRef(
        document,
        "row:" +
          driverRow,
      ),
    ],
    method:
      "latest approved work-package forecast finish",
    percentile: null,
    driverId,
  };
}

export function buildProjectTruth(
  state: ProjectRuntimeState,
  model: CanonicalScheduleModel,
): ProjectTruthSnapshot {
  const diagnostics:
    string[] = [];
  const register =
    metricRegister(state);
  const dataDateMetric =
    metric(
      register,
      "Data Date",
    );
  const baselineMetric =
    metric(
      register,
      "Baseline Project Completion",
    );
  const currentMetric =
    metric(
      register,
      "Current Project Completion",
    );
  const revisedMetric =
    metric(
      register,
      "Revised Contract Completion",
    );
  const movementMetric =
    metric(
      register,
      "Programme Movement vs Baseline",
    );
  const slippageMetric =
    metric(
      register,
      "Forecast Slippage vs Revised Contract",
    );
  const nearMetric =
    metric(
      register,
      "Near Critical",
    );

  const projectCompletionActivityId =
    sourceActivityId(
      currentMetric?.source ??
      baselineMetric?.source ??
      "",
    );
  const dayHours =
    standardDayHours(
      model,
      projectCompletionActivityId,
    );
  const nearCount =
    nearMetric
      ? numberValue(
          nearMetric.value,
        )
      : null;
  const nearCriticalPolicy =
    inferredNearCriticalPolicy(
      model,
      nearCount,
    );
  const thresholdHours =
    nearCriticalPolicy
      .thresholdHours;
  const workingDays =
    thresholdHours !== null &&
    dayHours !== null &&
    dayHours > 0
      ? Number(
          (
            thresholdHours /
            dayHours
          ).toFixed(6),
        )
      : null;

  const metricRef = (
    row:
      | {
          row: number;
        }
      | null,
  ) =>
    register &&
    row
      ? [
          evidenceRef(
            register.document,
            "row:" +
              row.row,
          ),
        ]
      : [];

  const modelDataDate =
    model.dataDateIso
      ? model.dataDateIso.slice(
          0,
          10,
        )
      : null;
  const registerDataDate =
    dataDateMetric
      ? dateValue(
          dataDateMetric.value,
        )
      : null;
  if (
    modelDataDate &&
    registerDataDate &&
    modelDataDate !==
      registerDataDate
  ) {
    diagnostics.push(
      "DATA_DATE_CONFLICT_BETWEEN_CURRENT_PROGRAMME_AND_METRIC_REGISTER",
    );
  }

  const revisedCompletion =
    revisedMetric
      ? dateValue(
          revisedMetric.value,
        )
      : null;
  const contractTimeBasis =
    contractTimeTruth(
      state,
      model,
      revisedCompletion,
    );

  const submittedCompletion =
    currentMetric
      ? dateValue(
          currentMetric.value,
        )
      : null;
  const sourceProductivity =
    productivityForecast(
      state,
    );
  const forecastPositions:
    ForecastPosition[] = [
      {
        kind:
          "submitted_programme",
        label:
          "Submitted programme forecast",
        dateIso:
          submittedCompletion,
        authority:
          submittedCompletion
            ? "governed_source"
            : "missing",
        sourceRefs:
          metricRef(
            currentMetric,
          ),
        method:
          "explicit Project Completion milestone in current controlled programme",
        percentile: null,
        driverId:
          projectCompletionActivityId,
      },
      ...(sourceProductivity
        ? [
            sourceProductivity,
          ]
        : []),
    ];

  return {
    schemaVersion: "1.0",
    projectId:
      state.projectId,
    scheduleRevisionId:
      model.sourceRevisionId,
    schedule: {
      dataDate:
        fact({
          key: "schedule.data_date",
          value:
            modelDataDate,
          unit: "date",
          authority:
            modelDataDate
              ? "governed_source"
              : "missing",
          sourceRefs: [
            "schedule-revision:" +
              model.sourceRevisionId,
            ...metricRef(
              dataDateMetric,
            ),
          ],
          basisRevisionId:
            model.sourceRevisionId,
          method:
            "current programme native Data Date; metric register used only as reconciliation evidence",
          diagnostics:
            diagnostics.filter(
              (item) =>
                item.includes(
                  "DATA_DATE",
                ),
            ),
        }),
      projectCompletionActivityId:
        fact({
          key:
            "schedule.project_completion_activity_id",
          value:
            projectCompletionActivityId,
          authority:
            projectCompletionActivityId
              ? "governed_source"
              : "missing",
          sourceRefs:
            metricRef(
              currentMetric,
            ),
          basisRevisionId:
            model.sourceRevisionId,
          method:
            "explicit activity identifier referenced by current schedule metric register",
        }),
      baselineCompletion:
        fact({
          key:
            "schedule.baseline_completion",
          value:
            baselineMetric
              ? dateValue(
                  baselineMetric.value,
                )
              : null,
          unit: "date",
          authority:
            baselineMetric
              ? "governed_source"
              : "missing",
          sourceRefs:
            metricRef(
              baselineMetric,
            ),
          method:
            "controlled baseline Project Completion metric",
        }),
      currentCompletion:
        fact({
          key:
            "schedule.current_completion",
          value:
            submittedCompletion,
          unit: "date",
          authority:
            submittedCompletion
              ? "governed_source"
              : "missing",
          sourceRefs:
            metricRef(
              currentMetric,
            ),
          basisRevisionId:
            model.sourceRevisionId,
          method:
            "explicit current Project Completion metric",
        }),
      revisedContractCompletion:
        fact({
          key:
            "contract.revised_completion",
          value:
            contractTimeBasis
              ?.contractualCompletionIso ??
            revisedCompletion,
          unit: "date",
          authority:
            contractTimeBasis
                ?.contractualCompletionIso
              ? "governed_source"
              : revisedCompletion
                ? "reconciled_source"
                : "missing",
          sourceRefs: [
            ...(
              contractTimeBasis
                ?.sourceRefs ??
              []
            ),
            ...metricRef(
              revisedMetric,
            ),
          ],
          method:
            "contract amendment precedence, reconciled to schedule control metric register",
        }),
      programmeMovementDays:
        fact({
          key:
            "schedule.programme_movement_days",
          value:
            movementMetric
              ? numberValue(
                  movementMetric.value,
                )
              : null,
          unit:
            movementMetric
              ?.unit ||
            "calendar_day",
          authority:
            movementMetric
              ? "governed_source"
              : "missing",
          sourceRefs:
            metricRef(
              movementMetric,
            ),
          method:
            "baseline Project Completion to current Project Completion",
        }),
      forecastSlippageDays:
        fact({
          key:
            "schedule.slippage_vs_revised_contract_days",
          value:
            slippageMetric
              ? numberValue(
                  slippageMetric.value,
                )
              : null,
          unit:
            slippageMetric
              ?.unit ||
            "calendar_day",
          authority:
            slippageMetric
              ? "governed_source"
              : "missing",
          sourceRefs:
            metricRef(
              slippageMetric,
            ),
          method:
            "current Project Completion minus revised contractual completion",
        }),
      nearCriticalSourceCount:
        fact({
          key:
            "schedule.near_critical_count",
          value:
            nearCount,
          unit: "count",
          authority:
            nearMetric
              ? "governed_source"
              : "missing",
          sourceRefs:
            metricRef(
              nearMetric,
            ),
          method:
            "current schedule metric register",
        }),
      nearCriticalThresholdHours:
        fact({
          key:
            "schedule.near_critical_threshold_hours",
          value:
            thresholdHours,
          unit: "hour",
          authority:
            thresholdHours !==
            null
              ? "reconciled_source"
              : "missing",
          sourceRefs: [
            ...metricRef(
              nearMetric,
            ),
            "schedule-revision:" +
              model.sourceRevisionId,
          ],
          basisRevisionId:
            model.sourceRevisionId,
          method:
            "reconcile governed near-critical population to source Total Float distribution; preserve project calendar hours",
          diagnostics:
            nearCriticalPolicy
                .state ===
              "ambiguous"
              ? [
                  "NEAR_CRITICAL_POLICY_RECONCILIATION_AMBIGUOUS",
                ]
              : thresholdHours ===
                  null
                ? [
                    "NEAR_CRITICAL_THRESHOLD_COULD_NOT_BE_RECONCILED_TO_SOURCE_COUNT",
                  ]
                : [],
        }),
      nearCriticalWorkingDays:
        fact({
          key:
            "schedule.near_critical_threshold_working_days",
          value:
            workingDays,
          unit:
            "working_day",
          authority:
            workingDays !== null
              ? "reconciled_source"
              : "missing",
          sourceRefs: [
            ...metricRef(
              nearMetric,
            ),
            "schedule-revision:" +
              model.sourceRevisionId,
          ],
          method:
            "threshold hours divided by governing activity calendar standard day hours",
        }),
      nearCriticalIncludesZeroFloat:
        nearCriticalPolicy
          .lowerBoundInclusive,
      standardWorkingDayHours:
        dayHours,
    },
    contractTimeBasis,
    forecastPositions,
    diagnostics: [
      ...diagnostics,
      ...(
        contractTimeBasis
          ?.diagnostics ??
        []
      ),
    ],
  };
}
