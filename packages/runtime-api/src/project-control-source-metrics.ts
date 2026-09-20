import {
  cell,
  governedTables,
  norm,
  numberValue,
  type SourceReceipt,
} from "../../truth-kernel/src";
import type { ProjectRuntimeState } from "./project-state-types";
import { inferDocumentType } from "./evidence";

export interface GovernedNumericMetric {
  value: number | null;
  unit: string | null;
  state: "official" | "candidate" | "missing" | "conflicted";
  receipts: SourceReceipt[];
  sourceRefs: string[];
  diagnostics: string[];
}

function ref(receipt: SourceReceipt): string {
  return "evidence-document:" + receipt.documentId + ":" + receipt.locator;
}

function isProjectControlDocument(state: ProjectRuntimeState, documentId: string): boolean {
  const document = state.evidenceDocuments.find((item) => item.documentId === documentId);
  if (!document) return false;
  const inferred = inferDocumentType(
    document.sourceRelativePath ?? document.sourceFilename,
    null,
  );
  return (
    ["active", "additive", "candidate"].includes(document.basisState) &&
    (
      document.category === "schedule_control" ||
      ["schedule_metric_register", "project_data_book", "schedule_control_basis"].includes(document.documentType) ||
      ["schedule_metric_register", "project_data_book", "schedule_control_basis"].includes(inferred)
    )
  );
}

function metricKey(row: { cells: Readonly<Record<string, string>> }): string {
  return cell(
    row as any,
    "metric",
    "parameter",
    "measure",
    "name",
    "position",
    "indicator",
    "kpi",
    "control",
    "basis item",
  );
}

function semanticKey(value: string): string {
  return norm(value)
    .replace(/\bprogram\b/g, "programme")
    .replace(/\bprojected\b/g, "forecast")
    .replace(/\s+/g, " ")
    .trim();
}

function unitLooksLikeDays(value: string): boolean {
  const unit = semanticKey(value);
  return !unit || /^(?:calendar )?days?$/.test(unit) || unit === "d";
}

export function resolveProjectControlNumberMetric(
  state: ProjectRuntimeState,
  kind:
    | "gross_positive_programme_movement"
    | "gross_negative_programme_movement",
): GovernedNumericMetric {
  const diagnostics: string[] = [];
  const rows = governedTables(state.evidenceDocuments, diagnostics)
    .filter((table) => isProjectControlDocument(state, table.document.documentId))
    .flatMap((table) => table.rows);

  const candidates: Array<{
    value: number;
    unit: string | null;
    receipt: SourceReceipt;
    official: boolean;
  }> = [];

  for (const row of rows) {
    const key = semanticKey(metricKey(row));
    if (!key) continue;
    const unit = cell(row as any, "unit", "uom", "measure unit", "measurement unit");
    const raw = cell(
      row as any,
      "value",
      "metric value",
      "amount",
      "result",
      "days",
    );
    const value = numberValue(raw);
    if (value === null || !unitLooksLikeDays(unit)) continue;

    const positive =
      (
        /\bgross\b.*\bpositive\b.*\b(?:window|programme|completion|movement|delay)\b/.test(key) ||
        /\bpositive\b.*\b(?:window|programme|completion)\b.*\b(?:movement|days?)\b/.test(key) ||
        /\b(?:window|programme)\b.*\bgross\b.*\b(?:movement|delay)\b/.test(key)
      ) &&
      !/\bnegative\b/.test(key);

    const negative =
      /\bgross\b.*\bnegative\b.*\b(?:window|programme|completion|movement|recovery)\b/.test(key) ||
      /\bnegative\b.*\b(?:window|programme|completion)\b.*\b(?:movement|days?)\b/.test(key) ||
      /\b(?:window|programme)\b.*\bnegative\b.*\b(?:movement|recovery)\b/.test(key);

    if (
      (kind === "gross_positive_programme_movement" && !positive) ||
      (kind === "gross_negative_programme_movement" && !negative)
    ) {
      continue;
    }

    candidates.push({
      value,
      unit: unit || "days",
      receipt: row.receipt,
      official: ["active", "additive"].includes(row.receipt.basisState),
    });
  }

  const official = candidates.filter((item) => item.official);
  const pool = official.length ? official : candidates;
  const values = [...new Set(pool.map((item) => Number(item.value.toFixed(6))))];
  const conflicted = values.length > 1;

  if (conflicted) {
    diagnostics.push("CONFLICTING_PROJECT_CONTROL_METRIC:" + kind);
  }

  const value = values.length === 1 ? values[0]! : null;
  const selected = value === null
    ? pool
    : pool.filter((item) => Number(item.value.toFixed(6)) === value);

  return {
    value,
    unit: selected[0]?.unit ?? null,
    state: conflicted
      ? "conflicted"
      : value !== null && official.length > 0
        ? "official"
        : value !== null
          ? "candidate"
          : "missing",
    receipts: selected.map((item) => item.receipt),
    sourceRefs: [...new Set(selected.map((item) => ref(item.receipt)))],
    diagnostics: [...new Set(diagnostics)],
  };
}
