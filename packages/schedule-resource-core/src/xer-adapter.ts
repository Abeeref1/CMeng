import {
  parseXerDateStrict,
  type XerParseResult,
  type XerRow,
} from "../../xer-parser/src";
import type {
  CanonicalResource,
  CanonicalResourceAssignment,
  CanonicalResourceModel,
  CanonicalResourceRate,
  CanonicalResourceType,
  ResourceSourceRef,
} from "./types";

function rows(
  result: XerParseResult,
  table: string,
): XerRow[] {
  return (result.tables.get(table)?.rows ?? [])
    .filter(
      (row) =>
        row.status === "parsed" &&
        row.data !== null,
    );
}

function field(
  row: XerRow,
  name: string,
): string | null {
  const value = row.data?.[name]?.trim();
  return value ? value : null;
}

function numberField(
  row: XerRow,
  name: string,
): number | null {
  const raw = field(row, name);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function dateField(
  row: XerRow,
  name: string,
): string | null {
  const raw = field(row, name);
  if (!raw) return null;
  const parsed = parseXerDateStrict(raw);
  return parsed.status === "valid"
    ? parsed.iso
    : null;
}

function sourceRef(
  table: string,
  row: XerRow,
): ResourceSourceRef {
  return {
    source: "xer",
    locator:
      table + ":line:" + row.line,
  };
}

export function normalizeResourceType(
  raw: string | null | undefined,
): CanonicalResourceType {
  const value = (raw ?? "")
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    value === "rt labor" ||
    value === "labor" ||
    value === "labour"
  ) {
    return "labor";
  }

  if (
    value === "rt nonlabor" ||
    value === "rt non labor" ||
    value === "nonlabor" ||
    value === "non labor" ||
    value === "equipment"
  ) {
    return "nonlabor";
  }

  if (
    value === "rt mat" ||
    value === "material" ||
    value === "materials"
  ) {
    return "material";
  }

  return "unknown";
}

export function canonicalResourcesFromXer(
  result: XerParseResult,
  input: {
    sourceRevisionId: string;
    projectId?: string | null;
  },
): CanonicalResourceModel {
  const taskRows = rows(result, "TASK");
  const resourceRows = rows(result, "RSRC");
  const rateRows = rows(result, "RSRCRATE");
  const assignmentRows =
    rows(result, "TASKRSRC");

  const taskCodeByNative = new Map<
    string,
    string
  >();

  for (const task of taskRows) {
    const projectId = field(task, "proj_id");
    const nativeTaskId =
      field(task, "task_id");
    const activityId =
      field(task, "task_code");

    if (
      projectId &&
      nativeTaskId &&
      activityId
    ) {
      taskCodeByNative.set(
        projectId + "::" + nativeTaskId,
        activityId,
      );
    }
  }

  const ratesByResource = new Map<
    string,
    CanonicalResourceRate[]
  >();

  for (const row of rateRows) {
    const resourceId =
      field(row, "rsrc_id");
    if (!resourceId) continue;

    const rate: CanonicalResourceRate = {
      effectiveDateIso:
        dateField(row, "start_date"),
      maxUnitsPerHour:
        numberField(
          row,
          "max_qty_per_hr",
        ),
      sourceRefs: [
        sourceRef("RSRCRATE", row),
      ],
    };

    const list =
      ratesByResource.get(resourceId) ??
      [];
    list.push(rate);
    ratesByResource.set(
      resourceId,
      list,
    );
  }

  for (const list of ratesByResource.values()) {
    list.sort((a, b) => {
      if (
        a.effectiveDateIso === null &&
        b.effectiveDateIso === null
      ) {
        return 0;
      }
      if (a.effectiveDateIso === null) {
        return -1;
      }
      if (b.effectiveDateIso === null) {
        return 1;
      }
      return (
        Date.parse(a.effectiveDateIso) -
        Date.parse(b.effectiveDateIso)
      );
    });
  }

  const resources: CanonicalResource[] =
    resourceRows.flatMap((row) => {
      const resourceId =
        field(row, "rsrc_id");
      if (!resourceId) return [];

      return [
        {
          resourceId,
          nativeId: resourceId,
          shortName:
            field(
              row,
              "rsrc_short_name",
            ),
          name: field(
            row,
            "rsrc_name",
          ),
          parentResourceId:
            field(
              row,
              "parent_rsrc_id",
            ),
          resourceType:
            normalizeResourceType(
              field(row, "rsrc_type"),
            ),
          unitId:
            field(row, "unit_id"),
          calendarId:
            field(row, "clndr_id"),
          priceTimeUnit:
            field(
              row,
              "cost_qty_type",
            ),
          rates: [
            ...(ratesByResource.get(
              resourceId,
            ) ?? []),
          ],
          sourceRefs: [
            sourceRef("RSRC", row),
          ],
        },
      ];
    });

  const resourceById = new Map(
    resources.map((resource) => [
      resource.resourceId,
      resource,
    ]),
  );

  const diagnostics: string[] = [];

  const assignments:
    CanonicalResourceAssignment[] =
    assignmentRows.flatMap((row) => {
      const nativeTaskId =
        field(row, "task_id");
      const projectId =
        field(row, "proj_id");

      if (!nativeTaskId) {
        diagnostics.push(
          "RESOURCE_ASSIGNMENT_TASK_ID_MISSING:line=" +
            row.line,
        );
        return [];
      }

      const taskKey =
        (projectId ?? "") +
        "::" +
        nativeTaskId;
      const activityId =
        taskCodeByNative.get(taskKey) ??
        "native:" + taskKey;

      const resourceId =
        field(row, "rsrc_id");
      const resource =
        resourceId
          ? resourceById.get(resourceId)
          : null;

      const rowDiagnostics = [
        ...row.diagnosticCodes,
      ];

      if (
        resourceId &&
        !resource
      ) {
        rowDiagnostics.push(
          "RESOURCE_ASSIGNMENT_RESOURCE_REFERENCE_UNRESOLVED",
        );
      }

      const assignmentId =
        field(row, "taskrsrc_id") ??
        "taskrsrc-line-" + row.line;

      return [
        {
          assignmentId,
          projectId,
          activityId,
          nativeTaskId,
          resourceId,
          roleId:
            field(row, "role_id"),
          resourceType:
            normalizeResourceType(
              field(row, "rsrc_type"),
            ) !== "unknown"
              ? normalizeResourceType(
                  field(
                    row,
                    "rsrc_type",
                  ),
                )
              : resource?.resourceType ??
                "unknown",
          plannedUnits:
            numberField(
              row,
              "target_qty",
            ),
          actualRegularUnits:
            numberField(
              row,
              "act_reg_qty",
            ),
          actualOvertimeUnits:
            numberField(
              row,
              "act_ot_qty",
            ),
          remainingUnits:
            numberField(
              row,
              "remain_qty",
            ),
          atCompletionUnits:
            numberField(
              row,
              "total_qty",
            ),
          plannedUnitsPerHour:
            numberField(
              row,
              "target_qty_per_hr",
            ),
          remainingUnitsPerHour:
            numberField(
              row,
              "remain_qty_per_hr",
            ),
          plannedStartIso:
            dateField(
              row,
              "target_start_date",
            ),
          plannedFinishIso:
            dateField(
              row,
              "target_end_date",
            ),
          actualStartIso:
            dateField(
              row,
              "act_start_date",
            ),
          actualFinishIso:
            dateField(
              row,
              "act_end_date",
            ),
          remainingStartIso:
            dateField(
              row,
              "restart_date",
            ),
          remainingFinishIso:
            dateField(
              row,
              "reend_date",
            ),
          curveId:
            field(row, "curv_id"),
          sourceRefs: [
            sourceRef(
              "TASKRSRC",
              row,
            ),
          ],
          diagnostics:
            rowDiagnostics,
        },
      ];
    });

  return {
    projectId:
      input.projectId ?? null,
    sourceRevisionId:
      input.sourceRevisionId,
    resources,
    assignments,
    diagnostics,
  };
}
