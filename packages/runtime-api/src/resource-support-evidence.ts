import {
  readFileSync,
} from "node:fs";

import type {
  StoredEvidenceDocument,
} from "./project-state-types";

export interface WeeklyResourceCapacityPoint {
  resourceId: string;
  resourceName: string | null;
  resourceClass:
    | "labor"
    | "equipment"
    | "material"
    | "unknown";
  utilizationApplicable:
    boolean | null;
  weekStartIso: string | null;
  availableCapacity: number | null;
  plannedDemand: number | null;
  actualApprovedUsage: number | null;
  plannedUtilizationPercent:
    number | null;
  actualUtilizationPercent:
    number | null;
  plannedOverallocated:
    boolean | null;
  actualOverallocated:
    boolean | null;
  unit: string | null;
  sourceRef: string;
}

export interface WeeklyResourceCapacitySummary {
  state:
    | "available"
    | "partial"
    | "candidate"
    | "not_found";
  dataDateIso: string | null;
  rowCount: number;
  comparableRowCount: number;
  resourceCount: number;
  utilizationApplicableResourceCount:
    number;
  laborResourceCount: number;
  equipmentResourceCount: number;
  materialResourceCount: number;
  weekCount: number;
  approvedActualUsageRowCount:
    number;
  assignmentWeekRowCount: number;
  monthlySummaryRowCount: number;
  plannedOverallocatedResourceWeekCount:
    number;
  actualOverallocatedResourceWeekCount:
    number;
  overloadedRowCount: number;
  capacityCoveragePercent:
    number | null;
  averagePlannedUtilizationToDataDate:
    number | null;
  averageActualUtilizationToDataDate:
    number | null;
  unitLabels: string[];
  utilizationUnitLabels: string[];
  materialUnitLabels: string[];
  materialExcludedFromUtilization:
    boolean;
  unitSafe: boolean;
  sourceBasisStates: string[];
  candidateDocumentCount: number;
  sourceDocumentIds: string[];
  points:
    WeeklyResourceCapacityPoint[];
  weeklyTotals: Array<{
    unit: string;
    weekStartIso:
      string | null;
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

function yesNo(
  value: string,
): boolean | null {
  const normalized =
    norm(value);
  if (
    normalized === "yes" ||
    normalized === "y" ||
    normalized === "true"
  ) return true;
  if (
    normalized === "no" ||
    normalized === "n" ||
    normalized === "false"
  ) return false;
  return null;
}

function resourceClass(
  value: string,
):
  | "labor"
  | "equipment"
  | "material"
  | "unknown" {
  const normalized =
    norm(value);
  if (
    normalized.includes(
      "labor",
    ) ||
    normalized.includes(
      "labour",
    )
  ) return "labor";
  if (
    normalized.includes(
      "equipment",
    ) ||
    normalized.includes(
      "plant",
    ) ||
    normalized.includes(
      "nonlabor",
    )
  ) return "equipment";
  if (
    normalized.includes(
      "material",
    )
  ) return "material";
  return "unknown";
}

function readRows(
  document: StoredEvidenceDocument,
  diagnostics: string[],
): string[][] | null {
  try {
    return parseCsv(
      readFileSync(
        document.storedPath,
        "utf8",
      ),
    );
  } catch {
    diagnostics.push(
      "RESOURCE_SUPPORT_FILE_NOT_READABLE:" +
        document.documentId,
    );
    return null;
  }
}

function sourceRef(
  document:
    StoredEvidenceDocument,
  rowNumber: number,
): string {
  return (
    "evidence-document:" +
    document.documentId +
    ":row:" +
    rowNumber
  );
}

function documentMatches(
  document: StoredEvidenceDocument,
  types: string[],
  filenamePatterns: RegExp[],
): boolean {
  return (
    types.includes(
      document.documentType,
    ) ||
    filenamePatterns.some(
      (pattern) =>
        pattern.test(
          document.sourceFilename,
        ),
    )
  );
}

function withinDataDate(
  dateIso: string | null,
  dataDateIso: string | null,
): boolean {
  if (!dataDateIso) return true;
  if (!dateIso) return false;
  const date = Date.parse(dateIso);
  const dataDate =
    Date.parse(dataDateIso);
  return (
    Number.isFinite(date) &&
    Number.isFinite(dataDate) &&
    date <= dataDate
  );
}

function average(
  values:
    Array<number | null>,
): number | null {
  const known =
    values.filter(
      (
        value,
      ): value is number =>
        value !== null &&
        Number.isFinite(value),
    );
  if (!known.length) return null;
  return Number(
    (
      known.reduce(
        (sum, value) =>
          sum + value,
        0,
      ) / known.length
    ).toFixed(6),
  );
}

export function weeklyResourceCapacityEvidence(
  documents:
    readonly StoredEvidenceDocument[],
  dataDateIso:
    string | null = null,
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
        /csv/i.test(
          document.mediaType +
            " " +
            document.sourceFilename,
        ) &&
        (
          document.documentType
            .startsWith(
              "resource_",
            ) ||
          /^res\d*[_-]/i.test(
            document.sourceFilename,
          )
        ),
    );

  const resourceMeta =
    new Map<
      string,
      {
        name: string | null;
        class:
          WeeklyResourceCapacityPoint["resourceClass"];
        unit: string | null;
        utilizationApplicable:
          boolean | null;
      }
    >();

  let approvedActualUsageRowCount =
    0;
  let assignmentWeekRowCount = 0;
  let monthlySummaryRowCount = 0;

  for (
    const document of
      candidates
  ) {
    const rows =
      readRows(
        document,
        diagnostics,
      );
    if (!rows ||
        rows.length < 2) {
      continue;
    }
    const headers =
      rows[0] ?? [];

    if (
      documentMatches(
        document,
        [
          "resource_capacity_master",
        ],
        [/^res0?1[_-]/i],
      )
    ) {
      const resourceIdIndex =
        findColumn(
          headers,
          ["resource id"],
        );
      const resourceNameIndex =
        findColumn(
          headers,
          ["resource name"],
        );
      const classIndex =
        findColumn(
          headers,
          ["class", "resource class"],
        );
      const unitIndex =
        findColumn(
          headers,
          ["unit"],
        );
      const applicableIndex =
        findColumn(
          headers,
          [
            "utilization applicable",
          ],
        );
      for (
        let rowIndex = 1;
        rowIndex <
          rows.length;
        rowIndex += 1
      ) {
        const row =
          rows[rowIndex] ?? [];
        const resourceId =
          cell(
            row,
            resourceIdIndex,
          );
        if (!resourceId) continue;
        resourceMeta.set(
          resourceId,
          {
            name:
              cell(
                row,
                resourceNameIndex,
              ) || null,
            class:
              resourceClass(
                cell(
                  row,
                  classIndex,
                ),
              ),
            unit:
              cell(
                row,
                unitIndex,
              ) || null,
            utilizationApplicable:
              yesNo(
                cell(
                  row,
                  applicableIndex,
                ),
              ),
          },
        );
      }
      continue;
    }

    if (
      documentMatches(
        document,
        [
          "resource_approved_actual_usage",
        ],
        [/^res0?3[_-]/i],
      )
    ) {
      approvedActualUsageRowCount +=
        rows
          .slice(1)
          .filter(
            (row) =>
              row.some(
                (value) =>
                  value.trim() !==
                  "",
              ),
          )
          .length;
      continue;
    }

    if (
      documentMatches(
        document,
        [
          "resource_assignment_timephased_weekly",
        ],
        [/^res0?4[_-]/i],
      )
    ) {
      assignmentWeekRowCount +=
        rows
          .slice(1)
          .filter(
            (row) =>
              row.some(
                (value) =>
                  value.trim() !==
                  "",
              ),
          )
          .length;
      continue;
    }

    if (
      documentMatches(
        document,
        [
          "resource_monthly_utilization_summary",
        ],
        [/^res0?6[_-]/i],
      )
    ) {
      monthlySummaryRowCount +=
        rows
          .slice(1)
          .filter(
            (row) =>
              row.some(
                (value) =>
                  value.trim() !==
                  "",
              ),
          )
          .length;
      continue;
    }

    if (
      !documentMatches(
        document,
        [
          "resource_weekly_capacity_utilization",
          "resource_register",
        ],
        [
          /^res0?2[_-]/i,
          /resource.*capacity.*utilization/i,
        ],
      )
    ) {
      continue;
    }

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
    const classIndex =
      findColumn(
        headers,
        [
          "class",
          "resource class",
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
    const plannedUtilIndex =
      findColumn(
        headers,
        [
          "planned utilization",
          "planned utilization %",
        ],
      );
    const actualUtilIndex =
      findColumn(
        headers,
        [
          "actual utilization",
          "actual utilization %",
        ],
      );
    const plannedOverIndex =
      findColumn(
        headers,
        [
          "planned overallocated",
        ],
      );
    const actualOverIndex =
      findColumn(
        headers,
        [
          "actual overallocated",
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
      diagnostics.push(
        "RESOURCE_WEEKLY_REGISTER_COLUMNS_INCOMPLETE:" +
          document.documentId,
      );
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
      const meta =
        resourceMeta.get(
          resourceId,
        );
      const classValue =
        resourceClass(
          cell(
            row,
            classIndex,
          ),
        );
      const capacity =
        numeric(
          cell(
            row,
            capacityIndex,
          ),
        );
      const demand =
        numeric(
          cell(
            row,
            demandIndex,
          ),
        );
      const actual =
        numeric(
          cell(
            row,
            actualIndex,
          ),
        );
      const plannedUtil =
        numeric(
          cell(
            row,
            plannedUtilIndex,
          ),
        ) ??
        (
          capacity !== null &&
          capacity > 0 &&
          demand !== null
            ? Number(
                (
                  (
                    demand /
                    capacity
                  ) *
                  100
                ).toFixed(6),
              )
            : null
        );
      const actualUtil =
        numeric(
          cell(
            row,
            actualUtilIndex,
          ),
        ) ??
        (
          capacity !== null &&
          capacity > 0 &&
          actual !== null
            ? Number(
                (
                  (
                    actual /
                    capacity
                  ) *
                  100
                ).toFixed(6),
              )
            : null
        );
      points.push({
        resourceId,
        resourceName:
          cell(
            row,
            resourceNameIndex,
          ) ||
          meta?.name ??
          null,
        resourceClass:
          classValue ===
          "unknown"
            ? meta?.class ??
              "unknown"
            : classValue,
        utilizationApplicable:
          meta
            ?.utilizationApplicable ??
          (
            classValue ===
              "material"
              ? false
              : classValue ===
                    "labor" ||
                  classValue ===
                    "equipment"
                ? true
                : null
          ),
        weekStartIso:
          iso(
            cell(
              row,
              weekIndex,
            ),
          ),
        availableCapacity:
          capacity,
        plannedDemand:
          demand,
        actualApprovedUsage:
          actual,
        plannedUtilizationPercent:
          plannedUtil,
        actualUtilizationPercent:
          actualUtil,
        plannedOverallocated:
          yesNo(
            cell(
              row,
              plannedOverIndex,
            ),
          ) ??
          (
            plannedUtil === null
              ? null
              : plannedUtil >
                100
          ),
        actualOverallocated:
          yesNo(
            cell(
              row,
              actualOverIndex,
            ),
          ) ??
          (
            actualUtil === null
              ? null
              : actualUtil >
                100
          ),
        unit:
          cell(
            row,
            unitIndex,
          ) ||
          meta?.unit ??
          null,
        sourceRef:
          sourceRef(
            document,
            rowIndex + 1,
          ),
      });
    }
  }

  if (points.length === 0) {
    return {
      state: "not_found",
      dataDateIso,
      rowCount: 0,
      comparableRowCount: 0,
      resourceCount:
        resourceMeta.size,
      utilizationApplicableResourceCount:
        [
          ...resourceMeta.values(),
        ].filter(
          (item) =>
            item
              .utilizationApplicable ===
            true,
        ).length,
      laborResourceCount:
        [
          ...resourceMeta.values(),
        ].filter(
          (item) =>
            item.class ===
            "labor",
        ).length,
      equipmentResourceCount:
        [
          ...resourceMeta.values(),
        ].filter(
          (item) =>
            item.class ===
            "equipment",
        ).length,
      materialResourceCount:
        [
          ...resourceMeta.values(),
        ].filter(
          (item) =>
            item.class ===
            "material",
        ).length,
      weekCount: 0,
      approvedActualUsageRowCount,
      assignmentWeekRowCount,
      monthlySummaryRowCount,
      plannedOverallocatedResourceWeekCount:
        0,
      actualOverallocatedResourceWeekCount:
        0,
      overloadedRowCount: 0,
      capacityCoveragePercent:
        null,
      averagePlannedUtilizationToDataDate:
        null,
      averageActualUtilizationToDataDate:
        null,
      unitLabels: [],
      utilizationUnitLabels: [],
      materialUnitLabels: [],
      materialExcludedFromUtilization:
        true,
      unitSafe: true,
      sourceBasisStates: [],
      candidateDocumentCount: 0,
      sourceDocumentIds: [],
      points: [],
      weeklyTotals: [],
      diagnostics,
    };
  }

  const applicablePoints =
    points.filter(
      (point) =>
        point
          .utilizationApplicable !==
        false &&
        point.resourceClass !==
          "material",
    );
  const comparable =
    applicablePoints.filter(
      (point) =>
        point.availableCapacity !==
          null &&
        point.plannedDemand !==
          null,
    );
  const toDataDate =
    applicablePoints.filter(
      (point) =>
        withinDataDate(
          point.weekStartIso,
          dataDateIso,
        ),
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

  for (const point of applicablePoints) {
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

  const utilizationUnitLabels = [
    ...new Set(
      applicablePoints
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
  ];
  const materialUnitLabels = [
    ...new Set(
      points
        .filter(
          (point) =>
            point.resourceClass ===
            "material",
        )
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
  ];

  const badUtilizationUnits =
    applicablePoints.filter(
      (point) =>
        (
          point.resourceClass ===
            "labor" &&
          point.unit !==
            "labor_hour"
        ) ||
        (
          point.resourceClass ===
            "equipment" &&
          point.unit !==
            "equipment_hour"
        ),
    );

  const utilizationApplicableResourceCount =
    resourceMeta.size > 0
      ? [
          ...resourceMeta.values(),
        ].filter(
          (item) =>
            item
              .utilizationApplicable ===
            true,
        ).length
      : new Set(
          applicablePoints.map(
            (point) =>
              point.resourceId,
          ),
        ).size;

  const sourceDocumentIds =
    candidates.map(
      (document) =>
        document.documentId,
    );

  return {
    state:
      governedDocumentCount === 0 &&
      candidateDocumentCount > 0
        ? "candidate"
        : comparable.length ===
            applicablePoints.length &&
          resourceMeta.size > 0
          ? "available"
          : "partial",
    dataDateIso,
    rowCount:
      points.length,
    comparableRowCount:
      comparable.length,
    resourceCount:
      resourceMeta.size > 0
        ? resourceMeta.size
        : new Set(
            points.map(
              (point) =>
                point.resourceId,
            ),
          ).size,
    utilizationApplicableResourceCount,
    laborResourceCount:
      [
        ...resourceMeta.values(),
      ].filter(
        (item) =>
          item.class ===
          "labor",
      ).length,
    equipmentResourceCount:
      [
        ...resourceMeta.values(),
      ].filter(
        (item) =>
          item.class ===
          "equipment",
      ).length,
    materialResourceCount:
      [
        ...resourceMeta.values(),
      ].filter(
        (item) =>
          item.class ===
          "material",
      ).length,
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
    approvedActualUsageRowCount,
    assignmentWeekRowCount,
    monthlySummaryRowCount,
    plannedOverallocatedResourceWeekCount:
      applicablePoints.filter(
        (point) =>
          point
            .plannedOverallocated ===
          true,
      ).length,
    actualOverallocatedResourceWeekCount:
      applicablePoints.filter(
        (point) =>
          point
            .actualOverallocated ===
          true,
      ).length,
    overloadedRowCount:
      comparable.filter(
        (point) =>
          point.plannedDemand! >
          point.availableCapacity!,
      ).length,
    capacityCoveragePercent:
      applicablePoints.length > 0
        ? Number(
            (
              (
                comparable.length /
                applicablePoints.length
              ) *
              100
            ).toFixed(4),
          )
        : null,
    averagePlannedUtilizationToDataDate:
      average(
        toDataDate.map(
          (point) =>
            point
              .plannedUtilizationPercent,
        ),
      ),
    averageActualUtilizationToDataDate:
      average(
        toDataDate.map(
          (point) =>
            point
              .actualUtilizationPercent,
        ),
      ),
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
    utilizationUnitLabels,
    materialUnitLabels,
    materialExcludedFromUtilization:
      true,
    unitSafe:
      badUtilizationUnits.length ===
        0,
    sourceBasisStates,
    candidateDocumentCount,
    sourceDocumentIds,
    points,
    weeklyTotals,
    diagnostics: [
      ...diagnostics,
      ...(badUtilizationUnits.length
        ? [
            "RESOURCE_UTILIZATION_UNIT_MISMATCH:" +
              badUtilizationUnits.length,
          ]
        : []),
      ...(materialUnitLabels.length
        ? [
            "MATERIAL_RESOURCES_EXCLUDED_FROM_UTILIZATION_PERCENTAGES",
          ]
        : []),
    ],
  };
}
