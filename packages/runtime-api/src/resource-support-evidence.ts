import {
  readFileSync,
} from "node:fs";

import type {
  StoredEvidenceDocument,
} from "./project-state-types";

export interface WeeklyResourceCapacityPoint {
  resourceId: string;
  resourceName: string | null;
  weekStartIso: string | null;
  availableCapacity: number | null;
  plannedDemand: number | null;
  actualApprovedUsage: number | null;
  unit: string | null;
  sourceRef: string;
}

export interface WeeklyResourceCapacitySummary {
  state:
    | "available"
    | "partial"
    | "not_found";
  rowCount: number;
  comparableRowCount: number;
  resourceCount: number;
  weekCount: number;
  overloadedRowCount: number;
  capacityCoveragePercent:
    number | null;
  unitLabels: string[];
  points:
    WeeklyResourceCapacityPoint[];
  weeklyTotals: Array<{
    weekStartIso: string | null;
    availableCapacity:
      number | null;
    plannedDemand:
      number | null;
    actualApprovedUsage:
      number | null;
    comparableResourceCount:
      number;
  }>;
  diagnostics: string[];
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
        if (
          text[index + 1] ===
          '"'
        ) {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(
        field.replace(
          /\r$/,
          "",
        ),
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
      field.replace(
        /\r$/,
        "",
      ),
    );
    rows.push(row);
  }
  return rows;
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

function findColumn(
  headers: string[],
  candidates: string[],
): number {
  const normalized =
    headers.map(norm);
  for (
    const candidate of
      candidates
  ) {
    const exact =
      normalized.indexOf(
        norm(candidate),
      );
    if (exact >= 0) {
      return exact;
    }
  }
  for (
    let index = 0;
    index <
      normalized.length;
    index += 1
  ) {
    const header =
      normalized[index]!;
    if (
      candidates.some(
        (candidate) =>
          header.includes(
            norm(candidate),
          ),
      )
    ) {
      return index;
    }
  }
  return -1;
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

function numeric(
  value: string,
): number | null {
  const cleaned =
    value
      .replace(/,/g, "")
      .replace(
        /[^0-9.+-]/g,
        "",
      )
      .trim();
  if (!cleaned) {
    return null;
  }
  const parsed =
    Number(cleaned);
  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function iso(
  value: string,
): string | null {
  if (!value.trim()) {
    return null;
  }
  const parsed =
    Date.parse(value);
  return Number.isFinite(parsed)
    ? new Date(parsed)
        .toISOString()
    : null;
}

export function weeklyResourceCapacityEvidence(
  documents:
    readonly StoredEvidenceDocument[],
): WeeklyResourceCapacitySummary {
  const diagnostics: string[] = [];
  const points:
    WeeklyResourceCapacityPoint[] = [];

  const candidates =
    documents.filter(
      (document) =>
        (
          document.basisState ===
            "active" ||
          document.basisState ===
            "additive"
        ) &&
        (
          document.documentType ===
            "resource_register" ||
          /^res\d*[_-]/i.test(
            document.sourceFilename,
          ) ||
          /resource.*capacity/i.test(
            document.sourceFilename,
          )
        ) &&
        /csv/i.test(
          document.mediaType +
            " " +
            document.sourceFilename,
        ),
    );

  for (
    const document of
      candidates
  ) {
    let text = "";
    try {
      text =
        readFileSync(
          document.storedPath,
          "utf8",
        );
    } catch {
      diagnostics.push(
        "RESOURCE_SUPPORT_FILE_NOT_READABLE:" +
          document.documentId,
      );
      continue;
    }

    const rows =
      parseCsv(text);
    if (rows.length < 2) {
      continue;
    }
    const headers =
      rows[0] ?? [];

    const resourceIdIndex =
      findColumn(
        headers,
        [
          "resource id",
          "resource unique id",
          "resource code",
        ],
      );
    const resourceNameIndex =
      findColumn(
        headers,
        [
          "resource name",
          "name",
        ],
      );
    const weekIndex =
      findColumn(
        headers,
        [
          "week start",
          "period start",
          "week",
        ],
      );
    const capacityIndex =
      findColumn(
        headers,
        [
          "available capacity",
          "capacity available",
          "weekly capacity",
          "capacity",
        ],
      );
    const demandIndex =
      findColumn(
        headers,
        [
          "planned demand",
          "forecast demand",
          "required demand",
          "demand",
        ],
      );
    const actualIndex =
      findColumn(
        headers,
        [
          "actual approved usage",
          "approved usage",
          "actual usage",
          "actual demand",
        ],
      );
    const unitIndex =
      findColumn(
        headers,
        [
          "unit",
          "uom",
          "unit of measure",
        ],
      );

    if (
      resourceIdIndex < 0 ||
      capacityIndex < 0 ||
      demandIndex < 0
    ) {
      continue;
    }

    for (
      let rowIndex = 1;
      rowIndex <
        rows.length;
      rowIndex += 1
    ) {
      const row =
        rows[rowIndex] ??
        [];
      const resourceId =
        cell(
          row,
          resourceIdIndex,
        );
      if (!resourceId) {
        continue;
      }
      points.push({
        resourceId,
        resourceName:
          cell(
            row,
            resourceNameIndex,
          ) || null,
        weekStartIso:
          iso(
            cell(
              row,
              weekIndex,
            ),
          ),
        availableCapacity:
          numeric(
            cell(
              row,
              capacityIndex,
            ),
          ),
        plannedDemand:
          numeric(
            cell(
              row,
              demandIndex,
            ),
          ),
        actualApprovedUsage:
          numeric(
            cell(
              row,
              actualIndex,
            ),
          ),
        unit:
          cell(
            row,
            unitIndex,
          ) || null,
        sourceRef:
          "evidence-document:" +
          document.documentId +
          ":row:" +
          (rowIndex + 1),
      });
    }
  }

  if (points.length === 0) {
    return {
      state: "not_found",
      rowCount: 0,
      comparableRowCount: 0,
      resourceCount: 0,
      weekCount: 0,
      overloadedRowCount: 0,
      capacityCoveragePercent:
        null,
      unitLabels: [],
      points: [],
      weeklyTotals: [],
      diagnostics,
    };
  }

  const comparable =
    points.filter(
      (point) =>
        point.availableCapacity !==
          null &&
        point.plannedDemand !==
          null,
    );
  const byWeek =
    new Map<
      string,
      {
        weekStartIso:
          string | null;
        availableCapacity:
          number;
        plannedDemand:
          number;
        actualApprovedUsage:
          number;
        capacityCount: number;
        demandCount: number;
        actualCount: number;
        comparableResourceCount:
          number;
      }
    >();

  for (const point of points) {
    const key =
      point.weekStartIso ??
      "undated";
    const row =
      byWeek.get(key) ?? {
        weekStartIso:
          point.weekStartIso,
        availableCapacity: 0,
        plannedDemand: 0,
        actualApprovedUsage:
          0,
        capacityCount: 0,
        demandCount: 0,
        actualCount: 0,
        comparableResourceCount:
          0,
      };
    if (
      point.availableCapacity !==
      null
    ) {
      row.availableCapacity +=
        point.availableCapacity;
      row.capacityCount += 1;
    }
    if (
      point.plannedDemand !==
      null
    ) {
      row.plannedDemand +=
        point.plannedDemand;
      row.demandCount += 1;
    }
    if (
      point.actualApprovedUsage !==
      null
    ) {
      row.actualApprovedUsage +=
        point.actualApprovedUsage;
      row.actualCount += 1;
    }
    if (
      point.availableCapacity !==
        null &&
      point.plannedDemand !==
        null
    ) {
      row.comparableResourceCount +=
        1;
    }
    byWeek.set(key, row);
  }

  const weeklyTotals =
    [...byWeek.values()]
      .sort(
        (a, b) =>
          (
            a.weekStartIso ??
            ""
          ).localeCompare(
            b.weekStartIso ??
            "",
          ),
      )
      .map(
        (row) => ({
          weekStartIso:
            row.weekStartIso,
          availableCapacity:
            row.capacityCount > 0
              ? Number(
                  row.availableCapacity.toFixed(
                    6,
                  ),
                )
              : null,
          plannedDemand:
            row.demandCount > 0
              ? Number(
                  row.plannedDemand.toFixed(
                    6,
                  ),
                )
              : null,
          actualApprovedUsage:
            row.actualCount > 0
              ? Number(
                  row.actualApprovedUsage.toFixed(
                    6,
                  ),
                )
              : null,
          comparableResourceCount:
            row.comparableResourceCount,
        }),
      );

  return {
    state:
      comparable.length ===
      points.length
        ? "available"
        : "partial",
    rowCount:
      points.length,
    comparableRowCount:
      comparable.length,
    resourceCount:
      new Set(
        points.map(
          (point) =>
            point.resourceId,
        ),
      ).size,
    weekCount:
      new Set(
        points
          .map(
            (point) =>
              point.weekStartIso,
          )
          .filter(
            (
              value,
            ): value is string =>
              value !== null,
          ),
      ).size,
    overloadedRowCount:
      comparable.filter(
        (point) =>
          point.plannedDemand! >
          point.availableCapacity!,
      ).length,
    capacityCoveragePercent:
      points.length > 0
        ? Number(
            (
              (
                comparable.length /
                points.length
              ) *
              100
            ).toFixed(4),
          )
        : null,
    unitLabels: [
      ...new Set(
        points
          .map(
            (point) =>
              point.unit,
          )
          .filter(
            (
              value,
            ): value is string =>
              value !== null,
          ),
      ),
    ],
    points,
    weeklyTotals,
    diagnostics,
  };
}
