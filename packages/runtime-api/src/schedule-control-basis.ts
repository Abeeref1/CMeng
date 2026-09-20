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
  type ScheduleAnalysisConfig,
} from "../../schedule-analysis-core/src";
import type { ProjectRuntimeState } from "./project-state-types";
import { projectDataDate } from "./canonical-time-claims";

export interface ProjectScheduleControlBasis {
  producerVersion: "schedule-control-basis-v1";
  state: "official" | "candidate" | "missing" | "conflicted";
  criticalFloatThresholdHours: number | null;
  nearCriticalWorkingDays: number | null;
  nearCriticalExplicitHours: number | null;
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
    (document) =>
      document.category === "schedule_control" &&
      basisDocumentTypes.has(document.documentType) &&
      ["active", "additive", "candidate"].includes(document.basisState),
  );
  const ids = new Set(documents.map((document) => document.documentId));
  const tables = governedTables(state.evidenceDocuments, diagnostics).filter(
    (table) => ids.has(table.document.documentId),
  );

  const nearWorking: number[] = [];
  const nearHours: number[] = [];
  const criticalHours: number[] = [];
  const sourceDates: string[] = [];
  const receipts: SourceReceipt[] = [];
  const nearWorkingReceipts: SourceReceipt[] = [];
  const nearHourReceipts: SourceReceipt[] = [];

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
        parsedCritical !== null ||
        sourceDate !== null
      ) {
        receipts.push(row.receipt);
      }
    }
  }

  const uniqueNearWorking = uniqueNumber(nearWorking);
  const uniqueNearHours = uniqueNumber(nearHours);
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

  const conflict = diagnostics.some((item) => item.startsWith("CONFLICTING_"));
  const thresholdReceipts =
    uniqueNearWorking !== null
      ? nearWorkingReceipts
      : uniqueNearHours !== null
        ? nearHourReceipts
        : [];
  const thresholdEstablished =
    thresholdReceipts.some(
      (receipt) =>
        ["active", "additive"].includes(receipt.basisState),
    );
  const hasThreshold =
    uniqueNearWorking !== null || uniqueNearHours !== null;

  const stateValue: ProjectScheduleControlBasis["state"] =
    conflict
      ? "conflicted"
      : hasThreshold && thresholdEstablished
        ? "official"
        : hasThreshold
          ? "candidate"
          : "missing";

  const criticalFloatThresholdHours = uniqueCritical ?? 0;
  const analysisConfig: ScheduleAnalysisConfig =
    stateValue === "official" || stateValue === "candidate"
      ? {
          criticalFloatThresholdHours,
          nearCriticalFloatThresholdHours:
            uniqueNearHours ??
            DEFAULT_SCHEDULE_ANALYSIS_CONFIG.nearCriticalFloatThresholdHours,
          nearCriticalWorkingDays: uniqueNearWorking,
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
    uniqueNearWorking !== null &&
    nearWorkingReceipts.some((receipt) =>
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
  if (uniqueNearWorking !== null && uniqueNearHours !== null) {
    diagnostics.push(
      "WORKING_DAY_NEAR_CRITICAL_BASIS_TAKES_PRECEDENCE_OVER_HOUR_VALUE",
    );
  }

  const value: ProjectScheduleControlBasis = {
    producerVersion: "schedule-control-basis-v1",
    state: stateValue,
    criticalFloatThresholdHours:
      hasThreshold ? criticalFloatThresholdHours : null,
    nearCriticalWorkingDays: uniqueNearWorking,
    nearCriticalExplicitHours: uniqueNearHours,
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
