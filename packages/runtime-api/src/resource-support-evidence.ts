import {csv as parseCsv,sourceCandidateHold,sourceCandidateHoldDiagnostic} from "../../truth-kernel/src";
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

export interface WeeklyResourceCapacityOptions {
  dataDateIso?: string | null;
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
  /** Present only when a candidate source disagrees with the adopted source
   * for the same resource and week. The adopted value is the one used. */
  basisDisagreements?: WeeklyResourceBasisDisagreement[];
  diagnostics: string[];
}

export interface WeeklyResourceBasisDisagreement {
  resourceId: string;
  weekStartIso: string | null;
  field: "availableCapacity" | "plannedDemand" | "actualApprovedUsage" | "unit";
  adoptedValue: number | string;
  candidateValue: number | string;
  adoptedSourceRef: string;
  candidateSourceRef: string;
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
  options:
    WeeklyResourceCapacityOptions = {},
): WeeklyResourceCapacitySummary {
  const diagnostics: string[] = [];
  const points:
    WeeklyResourceCapacityPoint[] = [];
  const dataDateMs =
    options.dataDateIso
      ? Date.parse(options.dataDateIso)
      : Number.NaN;
  let futureActualUsageWithheldCount =
    0;
  // T04 one rule: a candidate resource file is used only when the shared
  // candidate rule admits it (fully parsed, no review, unique in its family,
  // no adopted document of that family). Adopted points are kept apart.
  const candidateHold =
    sourceCandidateHold(documents);
  const adoptedPoints =
    new Set<WeeklyResourceCapacityPoint>();
  const isResourceCapacityFile = (
    document: StoredEvidenceDocument,
  ) =>
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
        );

  const candidates =
    documents.filter(
      (document) => {
        if (
          document.basisState ===
            "active" ||
          document.basisState ===
            "additive"
        ) {
          return isResourceCapacityFile(
            document,
          );
        }
        if (
          document.basisState !==
            "candidate" ||
          !isResourceCapacityFile(
            document,
          )
        ) {
          return false;
        }
        const hold =
          candidateHold(document);
        if (hold) {
          diagnostics.push(
            "RESOURCE_SUPPORT_CANDIDATE_HELD:" +
              sourceCandidateHoldDiagnostic(
                document,
                hold,
              ),
          );
          return false;
        }
        return true;
      },
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
          // Recorded hours are supplied under these headings in resource,
          // timesheet and man-hour registers; all mean hours used in the week.
          "actual hours",
          "actual manhours",
          "actual man-hours",
          "actual man hours",
          "actual labor hours",
          "actual labour hours",
          "recorded hours",
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
      const weekStartIso =
        iso(
          cell(
            row,
            weekIndex,
          ),
        );
      const sourceActualApprovedUsage =
        numeric(
          cell(
            row,
            actualIndex,
          ),
        );
      const weekStartMs =
        weekStartIso
          ? Date.parse(weekStartIso)
          : Number.NaN;
      const futureActual =
        sourceActualApprovedUsage !==
          null &&
        Number.isFinite(dataDateMs) &&
        Number.isFinite(weekStartMs) &&
        weekStartMs > dataDateMs;
      if (futureActual) {
        futureActualUsageWithheldCount +=
          1;
      }

      const point: WeeklyResourceCapacityPoint = {
        resourceId,
        resourceName:
          cell(
            row,
            resourceNameIndex,
          ) || null,
        weekStartIso,
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
          futureActual
            ? null
            : sourceActualApprovedUsage,
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
      };
      points.push(point);
      if (
        document.basisState !==
        "candidate"
      ) {
        adoptedPoints.add(point);
      }
    }
  }

  if (
    futureActualUsageWithheldCount >
    0
  ) {
    diagnostics.push(
      "FUTURE_RESOURCE_ACTUAL_USAGE_WITHHELD_AFTER_DATA_DATE:" +
        futureActualUsageWithheldCount,
    );
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
  const basisDisagreements:
    WeeklyResourceBasisDisagreement[] =
    [];

  // Merge one set of points for a resource and week exactly as reported:
  // one point per explicit unit, never across units.
  const mergeBucket = (
    bucket: WeeklyResourceCapacityPoint[],
  ): {
    points: WeeklyResourceCapacityPoint[];
    unitConflict: boolean;
  } => {
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
      return {
        points: merged ? [merged] : [],
        unitConflict: false,
      };
    }

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

    return {
      points: [
        ...byExplicitUnit.values(),
        ...unspecified,
      ],
      unitConflict: true,
    };
  };

  for (
    const rawBucket of
      rawByResourceWeek.values()
  ) {
    // Adopted wins: when an adopted source covers this resource and week,
    // candidate values are never merged into it. The combined candidate
    // value is compared with the combined adopted value actually used, and
    // a difference is shown as a disagreement.
    const adopted =
      mergeBucket(
        rawBucket.filter((point) =>
          adoptedPoints.has(point),
        ),
      );
    const candidate =
      mergeBucket(
        rawBucket.filter(
          (point) =>
            !adoptedPoints.has(point),
        ),
      );
    const used =
      adopted.points.length > 0
        ? adopted
        : candidate;
    if (
      adopted.points.length > 0 &&
      candidate.points.length > 0
    ) {
      const unitKey = (
        point: WeeklyResourceCapacityPoint,
      ) =>
        point.unit
          ?.trim()
          .toUpperCase() ?? "";
      for (const candidatePoint of candidate.points) {
        const adoptedPoint =
          adopted.points.length === 1 &&
          candidate.points.length === 1
            ? adopted.points[0]!
            : adopted.points.find(
                (point) =>
                  unitKey(point) ===
                  unitKey(candidatePoint),
              );
        if (!adoptedPoint) {
          continue;
        }
        const fields = [
          "availableCapacity",
          "plannedDemand",
          "actualApprovedUsage",
          "unit",
        ] as const;
        for (const field of fields) {
          const adoptedValue =
            adoptedPoint[field];
          const candidateValue =
            candidatePoint[field];
          if (
            adoptedValue === null ||
            adoptedValue === "" ||
            candidateValue === null ||
            candidateValue === "" ||
            (
              field === "unit"
                ? String(candidateValue)
                    .trim()
                    .toUpperCase() ===
                  String(adoptedValue)
                    .trim()
                    .toUpperCase()
                : candidateValue ===
                  adoptedValue
            )
          ) {
            continue;
          }
          basisDisagreements.push({
            resourceId:
              adoptedPoint.resourceId,
            weekStartIso:
              adoptedPoint.weekStartIso,
            field,
            adoptedValue,
            candidateValue,
            adoptedSourceRef:
              adoptedPoint.sourceRef,
            candidateSourceRef:
              candidatePoint.sourceRef,
          });
          diagnostics.push(
            "RESOURCE_CANDIDATE_DISAGREES_WITH_ADOPTED:" +
              adoptedPoint.resourceId +
              ":" +
              (adoptedPoint.weekStartIso ??
                "undated") +
              ":" +
              field,
          );
        }
      }
    }
    if (used.unitConflict) {
      diagnostics.push(
        "RESOURCE_UNIT_CONFLICT_PRESERVED_WITHOUT_CROSS_UNIT_MERGE",
      );
    }
    evidencePoints.push(
      ...used.points,
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
        const actualCapacity = actualRows.reduce((sum, point) => sum + point.availableCapacity!, 0);
        const plannedCapacity = plannedRows.reduce((sum, point) => sum + point.availableCapacity!, 0);
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
            plannedCapacity > 0 &&
            plannedDemand !== null
              ? Number(
                  (
                    (
                      plannedDemand /
                      plannedCapacity
                    ) *
                    100
                  ).toFixed(4),
                )
              : null,
          actualUtilizationPercent:
            actualCapacity > 0 &&
            actualApprovedUsage !==
              null
              ? Number(
                  (
                    (
                      actualApprovedUsage /
                      actualCapacity
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
    ...(basisDisagreements.length > 0
      ? {basisDisagreements}
      : {}),
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
