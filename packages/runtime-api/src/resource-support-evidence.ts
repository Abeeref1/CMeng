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
    | "candidate"
    | "not_found";
  rowCount: number;
  comparableRowCount: number;
  resourceCount: number;
  weekCount: number;
  overloadedRowCount: number;
  capacityCoveragePercent:
    number | null;
  unitLabels: string[];
  sourceBasisStates: string[];
  candidateDocumentCount: number;
  points:
    WeeklyResourceCapacityPoint[];
  weeklyTotals: Array<{
    unit: string;
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
  plannedUtilizationPercent:
    number | null;
  actualUtilizationPercent:
    number | null;
  utilizationByUnit: Array<{
    unit: string;
    availableCapacity: number;
    plannedDemand: number | null;
    actualApprovedUsage: number | null;
    plannedUtilizationPercent: number | null;
    actualUtilizationPercent: number | null;
    comparablePlannedRowCount: number;
    comparableActualRowCount: number;
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
            "additive" ||
          document.basisState ===
            "candidate"
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
      (
        capacityIndex < 0 &&
        demandIndex < 0 &&
        actualIndex < 0
      )
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

  const rawByResourceWeek =
    new Map<
      string,
      WeeklyResourceCapacityPoint[]
    >();

  for (const point of points) {
    const baseKey = [
      point.resourceId,
      point.weekStartIso ??
        "undated",
    ].join("::");
    const bucket =
      rawByResourceWeek.get(
        baseKey,
      ) ?? [];
    bucket.push(point);
    rawByResourceWeek.set(
      baseKey,
      bucket,
    );
  }

  const mergePoint = (
    current:
      WeeklyResourceCapacityPoint | null,
    point:
      WeeklyResourceCapacityPoint,
    resolvedUnit:
      string | null,
  ):
    WeeklyResourceCapacityPoint => ({
    resourceId:
      current?.resourceId ??
      point.resourceId,
    resourceName:
      current?.resourceName ??
      point.resourceName,
    weekStartIso:
      current?.weekStartIso ??
      point.weekStartIso,
    availableCapacity:
      current?.availableCapacity ??
      point.availableCapacity,
    plannedDemand:
      current?.plannedDemand ??
      point.plannedDemand,
    actualApprovedUsage:
      current?.actualApprovedUsage ??
      point.actualApprovedUsage,
    unit:
      resolvedUnit ??
      current?.unit ??
      point.unit,
    sourceRef:
      current
        ? [
            current.sourceRef,
            point.sourceRef,
          ].join(";")
        : point.sourceRef,
  });

  const evidencePoints:
    WeeklyResourceCapacityPoint[] =
    [];

  for (
    const bucket of
      rawByResourceWeek.values()
  ) {
    const explicitUnits = [
      ...new Set(
        bucket
          .map((point) =>
            point.unit
              ?.trim()
              .toUpperCase(),
          )
          .filter(
            (unit):
              unit is string =>
              Boolean(unit),
          ),
      ),
    ];

    if (explicitUnits.length <= 1) {
      const resolvedUnit =
        explicitUnits[0] ??
        null;
      let merged:
        WeeklyResourceCapacityPoint | null =
        null;
      for (const point of bucket) {
        merged = mergePoint(
          merged,
          point,
          resolvedUnit,
        );
      }
      if (merged) {
        evidencePoints.push(
          merged,
        );
      }
      continue;
    }

    diagnostics.push(
      "RESOURCE_UNIT_CONFLICT_PRESERVED_WITHOUT_CROSS_UNIT_MERGE",
    );
    const byExplicitUnit =
      new Map<
        string,
        WeeklyResourceCapacityPoint
      >();
    const unspecified =
      bucket.filter(
        (point) =>
          !point.unit?.trim(),
      );

    for (
      const point of bucket.filter(
        (item) =>
          Boolean(
            item.unit?.trim(),
          ),
      )
    ) {
      const resolvedUnit =
        point.unit!
          .trim()
          .toUpperCase();
      byExplicitUnit.set(
        resolvedUnit,
        mergePoint(
          byExplicitUnit.get(
            resolvedUnit,
          ) ?? null,
          point,
          resolvedUnit,
        ),
      );
    }

    evidencePoints.push(
      ...byExplicitUnit.values(),
      ...unspecified,
    );
  }

  if (evidencePoints.length === 0) {
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
      sourceBasisStates: [],
      candidateDocumentCount: 0,
      points: [],
      weeklyTotals: [],
      plannedUtilizationPercent:
        null,
      actualUtilizationPercent:
        null,
      utilizationByUnit: [],
      diagnostics,
    };
  }

  const comparable =
    evidencePoints.filter(
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
        unit: string;
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

  for (const point of evidencePoints) {
    const unit =
      point.unit ??
      "UNSPECIFIED";
    const key =
      unit +
      "::" +
      (
        point.weekStartIso ??
        "undated"
      );
    const row =
      byWeek.get(key) ?? {
        unit,
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
          a.unit.localeCompare(
            b.unit,
          ) ||
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
          unit:
            row.unit,
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

  const sourceBasisStates = [
    ...new Set(
      candidates.map(
        (document) =>
          document.basisState,
      ),
    ),
  ];
  const candidateDocumentCount =
    candidates.filter(
      (document) =>
        document.basisState ===
        "candidate",
    ).length;
  const governedDocumentCount =
    candidates.length -
    candidateDocumentCount;

  const utilizationByUnit =
    [
      ...new Set(
        evidencePoints.map(
          (point) =>
            point.unit ??
            "UNSPECIFIED",
        ),
      ),
    ]
      .sort()
      .map((unit) => {
        const unitPoints =
          evidencePoints.filter(
            (point) =>
              (
                point.unit ??
                "UNSPECIFIED"
              ) === unit,
          );
        const capacityRows =
          unitPoints.filter(
            (point) =>
              point.availableCapacity !==
              null,
          );
        const plannedRows =
          unitPoints.filter(
            (point) =>
              point.availableCapacity !==
                null &&
              point.plannedDemand !==
                null,
          );
        const actualRows =
          unitPoints.filter(
            (point) =>
              point.availableCapacity !==
                null &&
              point.actualApprovedUsage !==
                null,
          );
        const availableCapacity =
          capacityRows.reduce(
            (sum, point) =>
              sum +
              point.availableCapacity!,
            0,
          );
        const plannedDemand =
          plannedRows.length > 0
            ? plannedRows.reduce(
                (sum, point) =>
                  sum +
                  point.plannedDemand!,
                0,
              )
            : null;
        const actualApprovedUsage =
          actualRows.length > 0
            ? actualRows.reduce(
                (sum, point) =>
                  sum +
                  point.actualApprovedUsage!,
                0,
              )
            : null;

        return {
          unit,
          availableCapacity:
            Number(
              availableCapacity.toFixed(
                6,
              ),
            ),
          plannedDemand:
            plannedDemand === null
              ? null
              : Number(
                  plannedDemand.toFixed(
                    6,
                  ),
                ),
          actualApprovedUsage:
            actualApprovedUsage === null
              ? null
              : Number(
                  actualApprovedUsage.toFixed(
                    6,
                  ),
                ),
          plannedUtilizationPercent:
            availableCapacity > 0 &&
            plannedDemand !== null
              ? Number(
                  (
                    (
                      plannedDemand /
                      availableCapacity
                    ) *
                    100
                  ).toFixed(4),
                )
              : null,
          actualUtilizationPercent:
            availableCapacity > 0 &&
            actualApprovedUsage !==
              null
              ? Number(
                  (
                    (
                      actualApprovedUsage /
                      availableCapacity
                    ) *
                    100
                  ).toFixed(4),
                )
              : null,
          comparablePlannedRowCount:
            plannedRows.length,
          comparableActualRowCount:
            actualRows.length,
        };
      });

  const globallyComparable =
    utilizationByUnit.length === 1
      ? utilizationByUnit[0]!
      : null;

  return {
    state:
      governedDocumentCount === 0 &&
      candidateDocumentCount > 0
        ? "candidate"
        : comparable.length ===
            evidencePoints.length
          ? "available"
          : "partial",
    rowCount:
      evidencePoints.length,
    comparableRowCount:
      comparable.length,
    resourceCount:
      new Set(
        evidencePoints.map(
          (point) =>
            point.resourceId,
        ),
      ).size,
    weekCount:
      new Set(
        evidencePoints
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
      evidencePoints.length > 0
        ? Number(
            (
              (
                comparable.length /
                evidencePoints.length
              ) *
              100
            ).toFixed(4),
          )
        : null,
    unitLabels: [
      ...new Set(
        evidencePoints
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
    sourceBasisStates,
    candidateDocumentCount,
    points: evidencePoints,
    weeklyTotals,
    plannedUtilizationPercent:
      globallyComparable
        ?.plannedUtilizationPercent ??
      null,
    actualUtilizationPercent:
      globallyComparable
        ?.actualUtilizationPercent ??
      null,
    utilizationByUnit,
    diagnostics: [
      ...diagnostics,
      ...(utilizationByUnit.length > 1
        ? [
            "RESOURCE_UTILIZATION_REPORTED_BY_UNIT_TO_PREVENT_INCOMPATIBLE_UNIT_ARITHMETIC",
          ]
        : []),
    ],
  };
}
