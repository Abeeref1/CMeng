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
  sourceFloatCriticality,
  sourceFloatInFloatRiskWatchlist,
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
  sourceReportedNearCriticalLabelCount: number | null;
  floatRiskWatchlistIncludesCriticalThreshold: boolean;
  sourceCountReconcilesTo:
    | "strict_near_critical"
    | "float_risk_watchlist"
    | "neither"
    | null;
  nearCriticalThresholdMethod:
    | "explicit_working_days"
    | "explicit_hours"
    | "cmeng_policy_default"
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
  const text = raw.normalize("NFKC").replace(/≤/g, "<=").trim();
  if (!text) return null;

  const comparator =
    /(?:tf|total\s+float|critical(?:\s+(?:total\s+)?float)?)[^\n]{0,100}?(?:<=|less\s+than\s+or\s+equal\s+to)\s*\+?\s*(-?[0-9]+(?:\.[0-9]+)?)/i.exec(
      text,
    );
  if (comparator) {
    return numberValue(comparator[1]!) ?? null;
  }

  const explicitThreshold =
    /critical(?:\s+(?:total\s+)?float)?\s+(?:threshold|definition|basis)[^\n]{0,80}?(-?[0-9]+(?:\.[0-9]+)?)(?:\s*(?:hours?|hrs?|hr|h))?/i.exec(
      text,
    );
  return explicitThreshold
    ? numberValue(explicitThreshold[1]!) ?? null
    : null;
}


function reconcileSourceReportedCount(
  state: ProjectRuntimeState,
  sourceCount: number,
  config: ScheduleAnalysisConfig,
): {
  reconcilesTo:
    | "strict_near_critical"
    | "float_risk_watchlist"
    | "neither";
  strictNearCriticalCount: number | null;
  floatRiskWatchlistCount: number | null;
  diagnostics: string[];
} {
  const current = projectControlSchedule(state);
  if (!current) {
    return {
      reconcilesTo: "neither",
      strictNearCriticalCount: null,
      floatRiskWatchlistCount: null,
      diagnostics: [
        "FLOAT_RISK_SOURCE_RECONCILIATION_REQUIRES_CURRENT_PROGRAMME",
      ],
    };
  }

  const model = current.revision.model;
  let strictNearCriticalCount = 0;
  let floatRiskWatchlistCount = 0;
  let unresolvedWatchlist = 0;

  for (const activity of model.activities) {
    if (activity.totalFloatHours === null) continue;

    if (
      sourceFloatCriticality(
        model,
        activity,
        config,
      ) === "near_critical"
    ) {
      strictNearCriticalCount += 1;
    }

    const watchlist =
      sourceFloatInFloatRiskWatchlist(
        model,
        activity,
        config,
      );
    if (watchlist === null) {
      unresolvedWatchlist += 1;
    } else if (watchlist) {
      floatRiskWatchlistCount += 1;
    }
  }

  const diagnostics: string[] = [];
  if (unresolvedWatchlist > 0) {
    diagnostics.push(
      "FLOAT_RISK_SOURCE_RECONCILIATION_CALENDAR_GAPS:" +
        unresolvedWatchlist,
    );
    return {
      reconcilesTo: "neither",
      strictNearCriticalCount: null,
      floatRiskWatchlistCount: null,
      diagnostics,
    };
  }

  const strictMatch =
    strictNearCriticalCount === sourceCount;
  const watchlistMatch =
    floatRiskWatchlistCount === sourceCount;

  const reconcilesTo =
    strictMatch && !watchlistMatch
      ? "strict_near_critical"
      : watchlistMatch && !strictMatch
        ? "float_risk_watchlist"
        : "neither";

  diagnostics.push(
    reconcilesTo === "strict_near_critical"
      ? "SOURCE_NEAR_CRITICAL_LABEL_RECONCILES_TO_STRICT_NEAR_CRITICAL"
      : reconcilesTo === "float_risk_watchlist"
        ? "SOURCE_NEAR_CRITICAL_LABEL_RECONCILES_TO_FLOAT_RISK_WATCHLIST"
        : "SOURCE_NEAR_CRITICAL_LABEL_DIFFERS_FROM_CMENG_CLASSIFICATIONS",
  );

  return {
    reconcilesTo,
    strictNearCriticalCount,
    floatRiskWatchlistCount,
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
      const rawUnit = cell(
        row,
        "unit",
        "uom",
        "measure",
        "measurement unit",
      );
      const normalizedKey = norm(key);
      const nearCriticalMetric =
        /\bnear\s*critical\b/i.test(normalizedKey) ||
        /\bnearcritical\b/i.test(normalizedKey);

      const nearDefinition =
        cell(
          row,
          "near critical definition",
          "near-critical definition",
          "near critical basis",
          "near-critical basis",
        ) ||
        (
          nearCriticalMetric
            ? [rawDefinition, rawValue, rawUnit].filter(Boolean).join(" ")
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
      const genericNearWorkingDays =
        nearCriticalMetric &&
        (
          /^(working\s*days?|work\s*days?|workdays?|wd)$/i.test(rawUnit.trim()) ||
          /\b(?:working\s*days?|work\s*days?|workdays?|wd)\b/i.test(key)
        )
          ? numberValue(rawValue)
          : null;
      const parsedWorking =
        directNearDays ??
        genericNearWorkingDays ??
        definitionNumber(nearDefinition, "working_days");
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
        nearCriticalMetric &&
        (
          /(count|activities|activity|watchlist|population|items|records)/i.test(key) ||
          /^(activities?|activity|count|items?|records?)$/i.test(rawUnit.trim())
        )
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
      const genericNearHours =
        nearCriticalMetric &&
        (
          /^(hours?|hrs?|hr|h)$/i.test(rawUnit.trim()) ||
          /\b(?:hours?|hrs?|hr)\b/i.test(key)
        )
          ? numberValue(rawValue)
          : null;
      const parsedHours =
        directNearHours ??
        genericNearHours ??
        definitionNumber(nearDefinition, "hours");
      if (parsedHours !== null) {
        nearHours.push(parsedHours);
        nearHourReceipts.push(row.receipt);
      }

      const criticalMetricDefinition =
        !nearCriticalMetric &&
        /\bcritical\b/i.test(normalizedKey) &&
        /\b(?:threshold|definition|basis)\b/i.test(normalizedKey);
      const criticalDefinition =
        cell(
          row,
          "critical definition",
          "critical basis",
          "critical float threshold",
          "critical total float threshold",
        ) ||
        (
          criticalMetricDefinition
            ? [key, rawValue, rawUnit, rawDefinition]
                .filter(Boolean)
                .join(" ")
            : ""
        );
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

  const CMENG_DEFAULT_NEAR_CRITICAL_WORKING_DAYS = 5;
  const resolvedNearWorking =
    uniqueNearWorking ??
    (
      uniqueNearHours === null
        ? CMENG_DEFAULT_NEAR_CRITICAL_WORKING_DAYS
        : null
    );
  const resolvedWatchlistIncludesCriticalThreshold = true;
  const thresholdMethod:
    ProjectScheduleControlBasis["nearCriticalThresholdMethod"] =
    uniqueNearWorking !== null
      ? "explicit_working_days"
      : uniqueNearHours !== null
        ? "explicit_hours"
        : "cmeng_policy_default";

  if (
    uniqueNearWorking === null &&
    uniqueNearHours === null
  ) {
    diagnostics.push(
      "CMENG_NEAR_CRITICAL_POLICY_DEFAULT_APPLIED:5_WORKING_DAYS",
    );
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
  const hasSourceThreshold =
    uniqueNearWorking !== null ||
    uniqueNearHours !== null;
  const hasAnalysisThreshold =
    resolvedNearWorking !== null ||
    uniqueNearHours !== null;
  const conflict =
    explicitConflict;

  const stateValue: ProjectScheduleControlBasis["state"] =
    conflict
      ? "conflicted"
      : hasSourceThreshold && thresholdEstablished
        ? "official"
        : hasSourceThreshold
          ? "candidate"
          : "missing";

  const analysisConfig: ScheduleAnalysisConfig = {
    criticalFloatThresholdHours,
    nearCriticalFloatThresholdHours:
      uniqueNearHours ??
      DEFAULT_SCHEDULE_ANALYSIS_CONFIG.nearCriticalFloatThresholdHours,
    nearCriticalWorkingDays:
      resolvedNearWorking,
    floatRiskWatchlistIncludesCriticalThreshold:
      resolvedWatchlistIncludesCriticalThreshold,
    varianceLateThresholdDays:
      DEFAULT_SCHEDULE_ANALYSIS_CONFIG.varianceLateThresholdDays,
  };

  let sourceCountReconcilesTo:
    ProjectScheduleControlBasis["sourceCountReconcilesTo"] =
    null;
  if (
    uniqueNearCount !== null &&
    !explicitConflict
  ) {
    const reconciliation =
      reconcileSourceReportedCount(
        state,
        uniqueNearCount,
        analysisConfig,
      );
    sourceCountReconcilesTo =
      reconciliation.reconcilesTo;
    diagnostics.push(
      ...reconciliation.diagnostics,
    );
  }

  if (!hasSourceThreshold) {
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
      hasAnalysisThreshold ? criticalFloatThresholdHours : null,
    nearCriticalWorkingDays: resolvedNearWorking,
    nearCriticalExplicitHours: uniqueNearHours,
    nearCriticalSourceCount: uniqueNearCount,
    sourceReportedNearCriticalLabelCount:
      uniqueNearCount,
    floatRiskWatchlistIncludesCriticalThreshold:
      resolvedWatchlistIncludesCriticalThreshold,
    sourceCountReconcilesTo,
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
