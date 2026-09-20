import {
  cell,
  dateValue,
  governedTables,
  norm,
  numberValue,
  type SourceReceipt,
} from "../../truth-kernel/src";
import {
  DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
  activityNearCriticalThresholdHours,
  type ScheduleAnalysisConfig,
} from "../../schedule-analysis-core/src";
import type { ProjectRuntimeState } from "./project-state-types";
import {
  projectControlSchedule,
  projectDataDate,
} from "./canonical-time-claims";
import { inferDocumentType } from "./evidence";

export interface ProjectScheduleControlBasis {
  producerVersion: "schedule-control-basis-v1";
  state: "official" | "candidate" | "missing" | "conflicted";
  criticalFloatThresholdHours: number | null;
  nearCriticalWorkingDays: number | null;
  nearCriticalExplicitHours: number | null;
  nearCriticalSourceCount: number | null;
  nearCriticalThresholdMethod:
    | "explicit_working_days"
    | "explicit_hours"
    | "source_count_reconciliation"
    | "unresolved";
  sourceDataDateIso: string | null;
  programmeDataDateIso: string | null;
  analysisConfig: ScheduleAnalysisConfig;
  sourceRefs: string[];
  receipts: SourceReceipt[];
  diagnostics: string[];
}

const cache = new WeakMap<
  ProjectRuntimeState,
  { version: number; value: ProjectScheduleControlBasis }
>();

function sourceRef(receipt: SourceReceipt): string {
  return (
    "evidence-document:" +
    receipt.documentId +
    ":" +
    receipt.locator
  );
}

function uniqueNumber(values: number[]): number | null {
  const unique = [...new Set(values.map((value) => Number(value.toFixed(8))))];
  return unique.length === 1 ? unique[0]! : null;
}

function definitionNumber(
  raw: string,
  kind: "working_days" | "hours",
): number | null {
  const text = raw.normalize("NFKC").replace(/≤/g, "<=").trim();
  if (!text) return null;
  const unit =
    kind === "working_days"
      ? "(?:working\\s*days?|work\\s*days?|wd)"
      : "(?:hours?|hrs?|h)";
  const bounded = new RegExp(
    "(?:<=|up\\s+to|within|max(?:imum)?(?:\\s+of)?)\\s*\\+?\\s*([0-9]+(?:\\.[0-9]+)?)\\s*" +
      unit,
    "i",
  ).exec(text);
  if (bounded) return numberValue(bounded[1]!) ?? null;

  if (
    kind === "working_days" &&
    /working\s*days?|work\s*days?|\bwd\b/i.test(text)
  ) {
    const matches = [
      ...text.matchAll(/([0-9]+(?:\.[0-9]+)?)/g),
    ]
      .map((match) => numberValue(match[1] ?? ""))
      .filter((value): value is number => value !== null);
    return matches.length ? Math.max(...matches) : null;
  }

  if (
    kind === "hours" &&
    /hours?|hrs?|\bh\b/i.test(text)
  ) {
    const matches = [
      ...text.matchAll(/([0-9]+(?:\.[0-9]+)?)/g),
    ]
      .map((match) => numberValue(match[1] ?? ""))
      .filter((value): value is number => value !== null);
    return matches.length ? Math.max(...matches) : null;
  }

  return null;
}

function criticalThreshold(raw: string): number | null {
  const text = raw.normalize("NFKC").replace(/≤/g, "<=");
  const match =
    /(?:tf|total\s+float|critical)[^\n]{0,80}?(?:<=|less\s+than\s+or\s+equal\s+to)\s*\+?\s*(-?[0-9]+(?:\.[0-9]+)?)/i.exec(
      text,
    ) ??
    /critical[^\n]{0,80}?(-?[0-9]+(?:\.[0-9]+)?)/i.exec(text);
  return match ? numberValue(match[1]!) : null;
}


function reconcileWorkingDaysFromSourceCount(
  state: ProjectRuntimeState,
  sourceCount: number,
  criticalFloatThresholdHours: number,
): {
  workingDays: number | null;
  diagnostics: string[];
} {
  const current = projectControlSchedule(state);
  if (!current) {
    return {
      workingDays: null,
      diagnostics: [
        "NEAR_CRITICAL_COUNT_RECONCILIATION_REQUIRES_CURRENT_PROGRAMME",
      ],
    };
  }

  const model = current.revision.model;
  const candidates: number[] = [];
  const diagnostics: string[] = [];

  for (let workingDays = 1; workingDays <= 30; workingDays += 1) {
    const config: ScheduleAnalysisConfig = {
      criticalFloatThresholdHours,
      nearCriticalFloatThresholdHours:
        DEFAULT_SCHEDULE_ANALYSIS_CONFIG.nearCriticalFloatThresholdHours,
      nearCriticalWorkingDays: workingDays,
      varianceLateThresholdDays:
        DEFAULT_SCHEDULE_ANALYSIS_CONFIG.varianceLateThresholdDays,
    };

    let unresolved = 0;
    let count = 0;

    for (const activity of model.activities) {
      if (
        activity.totalFloatHours === null ||
        activity.totalFloatHours <=
          criticalFloatThresholdHours
      ) {
        continue;
      }

      const threshold =
        activityNearCriticalThresholdHours(
          model,
          activity,
          config,
        );
      if (threshold === null) {
        unresolved += 1;
        continue;
      }

      if (
        activity.totalFloatHours <=
        threshold
      ) {
        count += 1;
      }
    }

    if (unresolved > 0) {
      diagnostics.push(
        "NEAR_CRITICAL_COUNT_RECONCILIATION_CALENDAR_GAPS:" +
          workingDays +
          ":" +
          unresolved,
      );
      continue;
    }

    if (count === sourceCount) {
      candidates.push(workingDays);
    }
  }

  if (candidates.length === 1) {
    diagnostics.push(
      "NEAR_CRITICAL_WORKING_DAYS_RECONCILED_FROM_SOURCE_COUNT:" +
        sourceCount +
        ":" +
        candidates[0],
    );
    return {
      workingDays: candidates[0]!,
      diagnostics,
    };
  }

  diagnostics.push(
    candidates.length === 0
      ? "NEAR_CRITICAL_SOURCE_COUNT_HAS_NO_WORKING_DAY_SOLUTION:" +
          sourceCount
      : "NEAR_CRITICAL_SOURCE_COUNT_SOLUTION_NOT_UNIQUE:" +
          sourceCount +
          ":" +
          candidates.join(","),
  );
  return {
    workingDays: null,
    diagnostics,
  };
}

export function projectScheduleControlBasis(
  state: ProjectRuntimeState,
): ProjectScheduleControlBasis {
  const prior = cache.get(state);
  if (prior?.version === state.version) return prior.value;

  const diagnostics: string[] = [];
  const basisDocumentTypes = new Set([
    "schedule_control_basis",
    "schedule_metric_register",
    "project_data_book",
  ]);
  const documents = state.evidenceDocuments.filter(
    (document) => {
      const inferredType =
        inferDocumentType(
          document.sourceRelativePath ??
            document.sourceFilename,
          null,
        );
      return (
        (
          basisDocumentTypes.has(
            document.documentType,
          ) ||
          basisDocumentTypes.has(
            inferredType,
          )
        ) &&
        ["active", "additive", "candidate"].includes(
          document.basisState,
        )
      );
    },
  );
  const ids = new Set(
    documents.map(
      (document) =>
        document.documentId,
    ),
  );
  if (
    documents.some(
      (document) =>
        document.category !==
          "schedule_control" ||
        !basisDocumentTypes.has(
          document.documentType,
        ),
    )
  ) {
    diagnostics.push(
      "LEGACY_PROJECT_CONTROL_EVIDENCE_INCLUDED_BY_VERIFIED_SOURCE_IDENTITY",
    );
  }
  const tables = governedTables(state.evidenceDocuments, diagnostics).filter(
    (table) => ids.has(table.document.documentId),
  );

  const nearWorking: number[] = [];
  const nearHours: number[] = [];
  const criticalHours: number[] = [];
  const sourceDates: string[] = [];
  const nearCriticalCounts: number[] = [];
  const receipts: SourceReceipt[] = [];
  const nearWorkingReceipts: SourceReceipt[] = [];
  const nearHourReceipts: SourceReceipt[] = [];
  const nearCountReceipts: SourceReceipt[] = [];

  for (const document of documents) {
    for (const assertion of document.assertions) {
      const receipt: SourceReceipt = {
        documentId: document.documentId,
        sourceHash: document.sourceHashSha256,
        revision:
          document.linkedArtifactId ??
          document.sourceHashSha256,
        locator:
          assertion.sourceRef ||
          "assertion:" + assertion.assertionId,
        basisState: document.basisState,
        authority: "source_record",
      };

      if (
        assertion.metric === "near_critical_working_days" &&
        typeof assertion.value === "number" &&
        Number.isFinite(assertion.value) &&
        assertion.value >= 0
      ) {
        nearWorking.push(assertion.value);
        nearWorkingReceipts.push(receipt);
        receipts.push(receipt);
      } else if (
        assertion.metric === "near_critical_threshold_hours" &&
        typeof assertion.value === "number" &&
        Number.isFinite(assertion.value) &&
        assertion.value >= 0
      ) {
        nearHours.push(assertion.value);
        nearHourReceipts.push(receipt);
        receipts.push(receipt);
      } else if (
        assertion.metric === "near_critical_count" &&
        typeof assertion.value === "number" &&
        Number.isFinite(assertion.value) &&
        assertion.value >= 0
      ) {
        nearCriticalCounts.push(assertion.value);
        nearCountReceipts.push(receipt);
        receipts.push(receipt);
      } else if (
        assertion.metric === "critical_float_threshold_hours" &&
        typeof assertion.value === "number" &&
        Number.isFinite(assertion.value)
      ) {
        criticalHours.push(assertion.value);
        receipts.push(receipt);
      } else if (
        assertion.metric === "schedule_control_data_date" &&
        typeof assertion.value === "string"
      ) {
        const parsed = dateValue(assertion.value);
        if (parsed) {
          sourceDates.push(parsed);
          receipts.push(receipt);
        }
      }
    }
  }

  for (const table of tables) {
    for (const row of table.rows) {
      const rowText = Object.entries(row.cells)
        .map(([key, value]) => key + ": " + value)
        .join(" | ");
      const key = cell(
        row,
        "metric",
        "parameter",
        "control",
        "setting",
        "name",
        "basis item",
      );
      const rawValue = cell(
        row,
        "value",
        "setting value",
        "control value",
      );
      const rawDefinition = cell(
        row,
        "definition",
        "criteria",
        "criterion",
        "basis",
        "rule",
      );

      const nearDefinition =
        cell(
          row,
          "near critical definition",
          "near-critical definition",
          "near critical basis",
          "near-critical basis",
        ) ||
        (
          norm(key).includes("near critical")
            ? rawDefinition || rawValue
            : ""
        ) ||
        (/near[- ]?critical/i.test(rowText) ? rowText : "");

      const directNearDays = numberValue(
        cell(
          row,
          "near critical working days",
          "near-critical working days",
          "near critical threshold working days",
          "near-critical threshold working days",
          "near critical upper bound working days",
          "near-critical upper bound working days",
          "near critical max working days",
          "near-critical max working days",
        ),
      );
      const parsedWorking =
        directNearDays ?? definitionNumber(nearDefinition, "working_days");
      if (parsedWorking !== null) {
        nearWorking.push(parsedWorking);
        nearWorkingReceipts.push(row.receipt);
      }

      const directNearCount = numberValue(
        cell(
          row,
          "near critical count",
          "near-critical count",
          "near critical activity count",
          "near-critical activity count",
          "near critical activities",
          "near-critical activities",
          "near critical watchlist count",
          "near-critical watchlist count",
        ),
      );
      const keyedNearCount =
        norm(key).includes("near critical") &&
        /(count|activities|watchlist)/i.test(key)
          ? numberValue(rawValue)
          : null;
      const parsedNearCount =
        directNearCount ?? keyedNearCount;
      if (
        parsedNearCount !== null &&
        parsedNearCount >= 0
      ) {
        nearCriticalCounts.push(parsedNearCount);
        nearCountReceipts.push(row.receipt);
      }

      const directNearHours = numberValue(
        cell(
          row,
          "near critical hours",
          "near-critical hours",
          "near critical threshold hours",
          "near-critical threshold hours",
        ),
      );
      const parsedHours =
        directNearHours ?? definitionNumber(nearDefinition, "hours");
      if (parsedHours !== null) {
        nearHours.push(parsedHours);
        nearHourReceipts.push(row.receipt);
      }

      const criticalDefinition =
        cell(
          row,
          "critical definition",
          "critical basis",
        ) ||
        (norm(key) === "critical definition" ? rawValue : "") ||
        (/critical/i.test(rowText) && !/near[- ]?critical/i.test(rowText)
          ? rowText
          : "");
      const parsedCritical = criticalThreshold(criticalDefinition);
      if (parsedCritical !== null) criticalHours.push(parsedCritical);

      const sourceDate = dateValue(
        cell(
          row,
          "data date",
          "current data date",
          "programme data date",
          "program data date",
        ) ||
          (norm(key).includes("data date") ? rawValue : ""),
      );
      if (sourceDate) sourceDates.push(sourceDate);

      if (
        parsedWorking !== null ||
        parsedHours !== null ||
        parsedNearCount !== null ||
        parsedCritical !== null ||
        sourceDate !== null
      ) {
        receipts.push(row.receipt);
      }
    }
  }

  const uniqueNearWorking = uniqueNumber(nearWorking);
  const uniqueNearHours = uniqueNumber(nearHours);
  const uniqueNearCount = uniqueNumber(nearCriticalCounts);
  const uniqueCritical = uniqueNumber(criticalHours);
  const uniqueDates = [...new Set(sourceDates)];
  const sourceDataDateIso = uniqueDates.length === 1 ? uniqueDates[0]! : null;
  const programmeDataDateIso = projectDataDate(state);

  if (new Set(nearWorking).size > 1) {
    diagnostics.push("CONFLICTING_NEAR_CRITICAL_WORKING_DAY_DEFINITIONS");
  }
  if (new Set(nearHours).size > 1) {
    diagnostics.push("CONFLICTING_NEAR_CRITICAL_HOUR_DEFINITIONS");
  }
  if (new Set(criticalHours).size > 1) {
    diagnostics.push("CONFLICTING_CRITICAL_FLOAT_DEFINITIONS");
  }
  if (new Set(nearCriticalCounts).size > 1) {
    diagnostics.push("CONFLICTING_NEAR_CRITICAL_SOURCE_COUNTS");
  }
  if (uniqueDates.length > 1) {
    diagnostics.push("CONFLICTING_SCHEDULE_CONTROL_DATA_DATES");
  }
  if (
    sourceDataDateIso !== null &&
    programmeDataDateIso !== null &&
    sourceDataDateIso !== programmeDataDateIso
  ) {
    diagnostics.push(
      "SCHEDULE_CONTROL_DATA_DATE_DIFFERS_FROM_CURRENT_PROGRAMME:" +
        sourceDataDateIso +
        "!=" +
        programmeDataDateIso,
    );
  }

  const explicitConflict =
    diagnostics.some((item) =>
      item.startsWith("CONFLICTING_"),
    );
  const criticalFloatThresholdHours = uniqueCritical ?? 0;

  let resolvedNearWorking =
    uniqueNearWorking;
  let thresholdMethod:
    ProjectScheduleControlBasis["nearCriticalThresholdMethod"] =
    uniqueNearWorking !== null
      ? "explicit_working_days"
      : uniqueNearHours !== null
        ? "explicit_hours"
        : "unresolved";

  if (
    !explicitConflict &&
    resolvedNearWorking === null &&
    uniqueNearHours === null &&
    uniqueNearCount !== null
  ) {
    const reconciled =
      reconcileWorkingDaysFromSourceCount(
        state,
        uniqueNearCount,
        criticalFloatThresholdHours,
      );
    diagnostics.push(
      ...reconciled.diagnostics,
    );
    if (
      reconciled.workingDays !==
      null
    ) {
      resolvedNearWorking =
        reconciled.workingDays;
      thresholdMethod =
        "source_count_reconciliation";
    }
  }

  const thresholdReceipts =
    resolvedNearWorking !== null
      ? uniqueNearWorking !== null
        ? nearWorkingReceipts
        : nearCountReceipts
      : uniqueNearHours !== null
        ? nearHourReceipts
        : [];
  const thresholdEstablished =
    thresholdReceipts.some(
      (receipt) =>
        ["active", "additive"].includes(receipt.basisState),
    );
  const hasThreshold =
    resolvedNearWorking !== null ||
    uniqueNearHours !== null;
  const conflict =
    explicitConflict;

  const stateValue: ProjectScheduleControlBasis["state"] =
    conflict
      ? "conflicted"
      : hasThreshold && thresholdEstablished
        ? "official"
        : hasThreshold
          ? "candidate"
          : "missing";

  const analysisConfig: ScheduleAnalysisConfig =
    stateValue === "official" || stateValue === "candidate"
      ? {
          criticalFloatThresholdHours,
          nearCriticalFloatThresholdHours:
            uniqueNearHours ??
            DEFAULT_SCHEDULE_ANALYSIS_CONFIG.nearCriticalFloatThresholdHours,
          nearCriticalWorkingDays: resolvedNearWorking,
          varianceLateThresholdDays:
            DEFAULT_SCHEDULE_ANALYSIS_CONFIG.varianceLateThresholdDays,
        }
      : {
          ...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
        };

  if (!hasThreshold) {
    diagnostics.push(
      "PROJECT_NEAR_CRITICAL_BASIS_NOT_ESTABLISHED_LEGACY_DEFAULT_RETAINED",
    );
  } else if (
    resolvedNearWorking !== null &&
    thresholdReceipts.some((receipt) =>
      state.evidenceDocuments.some(
        (document) =>
          document.documentId === receipt.documentId &&
          document.documentType !== "schedule_control_basis",
      ),
    )
  ) {
    diagnostics.push(
      "PROJECT_NEAR_CRITICAL_BASIS_CORROBORATED_FROM_CONTROL_REGISTER",
    );
  }
  if (resolvedNearWorking !== null && uniqueNearHours !== null) {
    diagnostics.push(
      "WORKING_DAY_NEAR_CRITICAL_BASIS_TAKES_PRECEDENCE_OVER_HOUR_VALUE",
    );
  }

  const value: ProjectScheduleControlBasis = {
    producerVersion: "schedule-control-basis-v1",
    state: stateValue,
    criticalFloatThresholdHours:
      hasThreshold ? criticalFloatThresholdHours : null,
    nearCriticalWorkingDays: resolvedNearWorking,
    nearCriticalExplicitHours: uniqueNearHours,
    nearCriticalSourceCount: uniqueNearCount,
    nearCriticalThresholdMethod:
      thresholdMethod,
    sourceDataDateIso,
    programmeDataDateIso,
    analysisConfig,
    sourceRefs: [...new Set(receipts.map(sourceRef))],
    receipts,
    diagnostics: [...new Set(diagnostics)],
  };

  cache.set(state, { version: state.version, value });
  return value;
}
