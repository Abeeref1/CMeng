import type {
  CanonicalApprovedResourceUsageRow,
  CanonicalAssignmentTimephasedRow,
  CanonicalMonthlyResourceUtilizationRow,
  CanonicalResourceCapacityMasterRow,
  CanonicalResourceSupportFragment,
  CanonicalResourceSupportModel,
  CanonicalResourceUtilizationHeadline,
  CanonicalResourceWeekRow,
  UtilizationResourceClass,
} from "../../schedule-resource-core/src";
import type {
  ProjectRuntimeState,
  StoredEvidenceDocument,
} from "./project-state-types";

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

function indexOf(headers: string[], candidates: string[]): number {
  const normalized = headers.map(norm);
  for (const candidate of candidates) {
    const exact = normalized.indexOf(norm(candidate));
    if (exact >= 0) return exact;
  }
  return normalized.findIndex((header) =>
    candidates.some((candidate) => header.includes(norm(candidate))),
  );
}

function value(row: string[], index: number): string {
  return index >= 0 ? (row[index] ?? "").trim() : "";
}

function numeric(raw: string): number | null {
  const clean = raw.replace(/,/g, "").replace(/[^0-9.+-]/g, "").trim();
  if (!clean) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function iso(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function yesNo(raw: string): boolean | null {
  const v = norm(raw);
  if (["yes", "y", "true", "1"].includes(v)) return true;
  if (["no", "n", "false", "0"].includes(v)) return false;
  return null;
}

function resourceClass(raw: string): UtilizationResourceClass {
  const v = norm(raw);
  if (v.includes("labor") || v.includes("labour")) return "labor";
  if (v.includes("equipment") || v.includes("plant") || v.includes("nonlabor")) {
    return "equipment";
  }
  if (v.includes("material")) return "material";
  return "unknown";
}

function ref(document: StoredEvidenceDocument, row: number) {
  return {
    sourceId: document.documentId,
    locator: "row:" + row,
  };
}

function kindFromFilename(document: StoredEvidenceDocument): CanonicalResourceSupportFragment["kind"] {
  const name = document.sourceFilename.toLowerCase();
  if (/res01[_-]/.test(name)) return "capacity_master";
  if (/res02[_-]/.test(name)) return "weekly_utilization";
  if (/res03[_-]/.test(name)) return "approved_actual_usage";
  if (/res04[_-]/.test(name)) return "assignment_timephased";
  if (/res06[_-]/.test(name)) return "monthly_utilization";
  if (/res07[_-]/.test(name)) return "headline_metrics";
  return "unknown";
}

export function deriveResourceSupportFromCsv(input: {
  document: StoredEvidenceDocument;
  bytes: Uint8Array;
}): CanonicalResourceSupportFragment | null {
  const text = Buffer.from(input.bytes).toString("utf8").replace(/^\uFEFF/, "");
  const rows = parseCsv(text);
  const headers = rows[0] ?? [];
  if (headers.length === 0) return null;

  const kind = kindFromFilename(input.document);
  if (kind === "unknown") return null;

  const fragment: CanonicalResourceSupportFragment = {
    documentId: input.document.documentId,
    kind,
    capacityMaster: [],
    weekly: [],
    actualUsage: [],
    assignmentTimephased: [],
    monthly: [],
    headlineMetrics: [],
    diagnostics: [],
  };

  if (kind === "capacity_master") {
    const resourceId = indexOf(headers, ["resource id"]);
    const uid = indexOf(headers, ["resource uid", "resource unique id"]);
    const name = indexOf(headers, ["resource name"]);
    const cls = indexOf(headers, ["class", "resource class"]);
    const trade = indexOf(headers, ["trade discipline", "trade / discipline"]);
    const unit = indexOf(headers, ["unit"]);
    const applicable = indexOf(headers, ["utilization applicable"]);
    const available = indexOf(headers, ["available units"]);
    const hours = indexOf(headers, ["hours per unit per week"]);
    const capacity = indexOf(headers, ["base weekly capacity"]);
    if (resourceId < 0 || unit < 0) return null;
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i] ?? [];
      const id = value(row, resourceId);
      if (!id) continue;
      const item: CanonicalResourceCapacityMasterRow = {
        resourceId: id,
        resourceUid: value(row, uid) || null,
        resourceName: value(row, name) || null,
        resourceClass: resourceClass(value(row, cls)),
        trade: value(row, trade) || null,
        unit: value(row, unit) || null,
        utilizationApplicable: yesNo(value(row, applicable)),
        availableUnits: numeric(value(row, available)),
        hoursPerUnitPerWeek: numeric(value(row, hours)),
        baseWeeklyCapacity: numeric(value(row, capacity)),
        sourceRefs: [ref(input.document, i + 1)],
      };
      fragment.capacityMaster.push(item);
    }
  }

  if (kind === "weekly_utilization") {
    const resourceId = indexOf(headers, ["resource id"]);
    const uid = indexOf(headers, ["resource uid"]);
    const cls = indexOf(headers, ["class"]);
    const trade = indexOf(headers, ["trade discipline", "trade / discipline"]);
    const unit = indexOf(headers, ["unit"]);
    const week = indexOf(headers, ["week start"]);
    const capacity = indexOf(headers, ["available capacity"]);
    const planned = indexOf(headers, ["planned demand"]);
    const actual = indexOf(headers, ["actual approved usage"]);
    const forecast = indexOf(headers, ["forecast demand"]);
    const plannedUtil = indexOf(headers, ["planned utilization %", "planned utilization"]);
    const actualUtil = indexOf(headers, ["actual utilization %", "actual utilization"]);
    const plannedOver = indexOf(headers, ["planned overallocated"]);
    const actualOver = indexOf(headers, ["actual overallocated"]);
    if (resourceId < 0 || unit < 0 || capacity < 0 || planned < 0) return null;
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i] ?? [];
      const id = value(row, resourceId);
      if (!id) continue;
      const item: CanonicalResourceWeekRow = {
        resourceId: id,
        resourceUid: value(row, uid) || null,
        resourceClass: resourceClass(value(row, cls)),
        trade: value(row, trade) || null,
        unit: value(row, unit) || null,
        weekStartIso: iso(value(row, week)),
        availableCapacity: numeric(value(row, capacity)),
        plannedDemand: numeric(value(row, planned)),
        actualApprovedUsage: numeric(value(row, actual)),
        forecastDemand: numeric(value(row, forecast)),
        plannedUtilizationPercent: numeric(value(row, plannedUtil)),
        actualUtilizationPercent: numeric(value(row, actualUtil)),
        plannedOverallocated: yesNo(value(row, plannedOver)),
        actualOverallocated: yesNo(value(row, actualOver)),
        sourceRefs: [ref(input.document, i + 1)],
      };
      fragment.weekly.push(item);
    }
  }

  if (kind === "approved_actual_usage") {
    const resourceId = indexOf(headers, ["resource id"]);
    const uid = indexOf(headers, ["resource uid"]);
    const week = indexOf(headers, ["week start"]);
    const unit = indexOf(headers, ["unit"]);
    const actual = indexOf(headers, ["actual approved usage"]);
    const status = indexOf(headers, ["source status", "status"]);
    if (resourceId < 0 || actual < 0) return null;
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i] ?? [];
      const id = value(row, resourceId);
      if (!id) continue;
      const item: CanonicalApprovedResourceUsageRow = {
        resourceId: id,
        resourceUid: value(row, uid) || null,
        weekStartIso: iso(value(row, week)),
        unit: value(row, unit) || null,
        actualApprovedUsage: numeric(value(row, actual)),
        sourceStatus: value(row, status) || null,
        sourceRefs: [ref(input.document, i + 1)],
      };
      fragment.actualUsage.push(item);
    }
  }

  if (kind === "assignment_timephased") {
    const assignmentId = indexOf(headers, ["assignment id"]);
    const activityId = indexOf(headers, ["activity id"]);
    const uid = indexOf(headers, ["resource uid"]);
    const resourceId = indexOf(headers, ["resource id"]);
    const week = indexOf(headers, ["week start"]);
    const unit = indexOf(headers, ["unit"]);
    const planned = indexOf(headers, ["planned quantity"]);
    const actual = indexOf(headers, ["actual quantity"]);
    const remaining = indexOf(headers, ["remaining forecast quantity"]);
    if (assignmentId < 0 || resourceId < 0 || unit < 0) return null;
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i] ?? [];
      const aid = value(row, assignmentId);
      if (!aid) continue;
      const item: CanonicalAssignmentTimephasedRow = {
        assignmentId: aid,
        activityId: value(row, activityId) || null,
        resourceUid: value(row, uid) || null,
        resourceId: value(row, resourceId) || null,
        weekStartIso: iso(value(row, week)),
        unit: value(row, unit) || null,
        plannedQuantity: numeric(value(row, planned)),
        actualQuantity: numeric(value(row, actual)),
        remainingForecastQuantity: numeric(value(row, remaining)),
        sourceRefs: [ref(input.document, i + 1)],
      };
      fragment.assignmentTimephased.push(item);
    }
  }

  if (kind === "monthly_utilization") {
    const resourceId = indexOf(headers, ["resource id"]);
    const uid = indexOf(headers, ["resource uid"]);
    const cls = indexOf(headers, ["class"]);
    const trade = indexOf(headers, ["trade discipline", "trade / discipline"]);
    const unit = indexOf(headers, ["unit"]);
    const month = indexOf(headers, ["month"]);
    const capacity = indexOf(headers, ["available capacity"]);
    const planned = indexOf(headers, ["planned demand"]);
    const actual = indexOf(headers, ["actual usage"]);
    const forecast = indexOf(headers, ["forecast demand"]);
    const plannedUtil = indexOf(headers, ["planned utilization %", "planned utilization"]);
    const actualUtil = indexOf(headers, ["actual utilization %", "actual utilization"]);
    const forecastUtil = indexOf(headers, ["forecast utilization %", "forecast utilization"]);
    if (resourceId < 0 || unit < 0) return null;
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i] ?? [];
      const id = value(row, resourceId);
      if (!id) continue;
      const item: CanonicalMonthlyResourceUtilizationRow = {
        resourceId: id,
        resourceUid: value(row, uid) || null,
        resourceClass: resourceClass(value(row, cls)),
        trade: value(row, trade) || null,
        unit: value(row, unit) || null,
        month: value(row, month) || null,
        availableCapacity: numeric(value(row, capacity)),
        plannedDemand: numeric(value(row, planned)),
        actualUsage: numeric(value(row, actual)),
        forecastDemand: numeric(value(row, forecast)),
        plannedUtilizationPercent: numeric(value(row, plannedUtil)),
        actualUtilizationPercent: numeric(value(row, actualUtil)),
        forecastUtilizationPercent: numeric(value(row, forecastUtil)),
        sourceRefs: [ref(input.document, i + 1)],
      };
      fragment.monthly.push(item);
    }
  }

  if (kind === "headline_metrics") {
    const metric = indexOf(headers, ["metric"]);
    const val = indexOf(headers, ["value"]);
    const unit = indexOf(headers, ["unit"]);
    const source = indexOf(headers, ["source"]);
    if (metric < 0 || val < 0) return null;
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i] ?? [];
      const label = value(row, metric);
      if (!label) continue;
      const raw = value(row, val);
      const parsed = numeric(raw);
      const item: CanonicalResourceUtilizationHeadline = {
        metric: label,
        value: parsed === null ? raw || null : parsed,
        unit: value(row, unit) || null,
        source: value(row, source) || null,
        sourceRefs: [ref(input.document, i + 1)],
      };
      fragment.headlineMetrics.push(item);
    }
  }

  return fragment;
}

function average(values: number[]): number | null {
  return values.length
    ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(6))
    : null;
}

export function rebuildCanonicalResourceSupport(state: ProjectRuntimeState): void {
  const fragments = state.resourceSupportByDocument ?? {};
  const docs = new Map(
    state.evidenceDocuments.map((document) => [document.documentId, document]),
  );
  const selected = Object.values(fragments).filter((fragment) => {
    const document = docs.get(fragment.documentId);
    return Boolean(
      document &&
      ["active", "additive", "candidate"].includes(document.basisState),
    );
  });

  if (selected.length === 0) {
    state.resourceSupport = null;
    return;
  }

  const latest = state.schedules
    .filter((item) => item.role !== "recovery")
    .sort((a, b) =>
      (a.revision.model.dataDateIso ?? a.revision.effectiveAt ?? "")
        .localeCompare(b.revision.model.dataDateIso ?? b.revision.effectiveAt ?? ""),
    )
    .at(-1);
  const dataDateIso = latest?.revision.model.dataDateIso ?? null;
  const dataDateMs = dataDateIso ? Date.parse(dataDateIso) : Number.NaN;

  const capacityMaster = selected.flatMap((fragment) => fragment.capacityMaster);
  const weekly = selected.flatMap((fragment) => fragment.weekly);
  const actualUsage = selected.flatMap((fragment) => fragment.actualUsage);
  const assignmentTimephased = selected.flatMap((fragment) => fragment.assignmentTimephased);
  const monthly = selected.flatMap((fragment) => fragment.monthly);
  const headlineMetrics = selected.flatMap((fragment) => fragment.headlineMetrics);

  const applicableIds = new Set(
    capacityMaster
      .filter((row) => row.utilizationApplicable === true && row.resourceClass !== "material")
      .map((row) => row.resourceId),
  );
  const materialIds = new Set(
    capacityMaster
      .filter((row) => row.resourceClass === "material")
      .map((row) => row.resourceId),
  );
  const periodRows = weekly.filter((row) => {
    if (!applicableIds.has(row.resourceId)) return false;
    if (!Number.isFinite(dataDateMs) || !row.weekStartIso) return true;
    const period = Date.parse(row.weekStartIso);
    return Number.isFinite(period) && period <= dataDateMs;
  });

  const planned = periodRows
    .map((row) => row.plannedUtilizationPercent)
    .filter((value): value is number => value !== null);
  const actual = periodRows
    .map((row) => row.actualUtilizationPercent)
    .filter((value): value is number => value !== null);

  const model: CanonicalResourceSupportModel = {
    projectId: state.projectId,
    dataDateIso,
    capacityMaster,
    weekly,
    actualUsage,
    assignmentTimephased,
    monthly,
    headlineMetrics,
    utilizationApplicableResourceCount: applicableIds.size,
    materialResourceCount: materialIds.size,
    weeklyRowCount: weekly.length,
    actualUsageRowCount: actualUsage.length,
    assignmentTimephasedRowCount: assignmentTimephased.length,
    averagePlannedUtilizationToDataDatePercent: average(planned),
    averageActualUtilizationToDataDatePercent: average(actual),
    plannedOverallocationRowCount: weekly.filter((row) => row.plannedOverallocated === true).length,
    actualOverallocationRowCount: weekly.filter((row) => row.actualOverallocated === true).length,
    units: [...new Set(
      [...capacityMaster, ...weekly]
        .map((row) => row.unit)
        .filter((unit): unit is string => Boolean(unit)),
    )].sort(),
    sourceDocumentIds: [...new Set(selected.map((fragment) => fragment.documentId))],
    diagnostics: [
      ...new Set(selected.flatMap((fragment) => fragment.diagnostics)),
      ...(materialIds.size > 0
        ? ["MATERIAL_RESOURCES_EXCLUDED_FROM_UTILIZATION_PERCENTAGES"]
        : []),
    ],
  };

  state.resourceSupport = model;
}
