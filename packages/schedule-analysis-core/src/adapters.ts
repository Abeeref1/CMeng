import {
  parseXerDateStrict,
  verifyXerCalendars,
  type XerParseResult,
  type XerRow,
} from "../../xer-parser/src";
import type { PrimaveraXmlResult } from "../../primavera-xml-parser/src";
import type { ScheduleTabularResult } from "../../schedule-tabular-parser/src";
import { parseScheduleDate } from "../../schedule-values/src";
import {
  normalizeActivityStatus,
  normalizeActivityType,
  normalizeRelationshipType,
} from "./normalize";
import type {
  CanonicalCalendar,
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
  CanonicalScheduleRelationship,
  CanonicalWbsNode,
  ScheduleSourceRef,
} from "./types";

function xerRows(
  result: XerParseResult,
  table: string,
): XerRow[] {
  return (result.tables.get(table)?.rows ?? []).filter(
    (row) => row.status === "parsed" && row.data,
  );
}

function xerField(
  row: XerRow,
  name: string,
): string | null {
  const value = row.data?.[name]?.trim();
  return value ? value : null;
}

function firstXerField(
  row: XerRow,
  names: readonly string[],
): string | null {
  for (const name of names) {
    const value = xerField(row, name);
    if (value !== null) return value;
  }
  return null;
}

function numeric(
  value: string | null,
): number | null {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function percent(
  value: string | null,
): number | null {
  const parsed = numeric(value);
  if (
    parsed === null ||
    parsed < 0 ||
    parsed > 100
  ) {
    return null;
  }
  return parsed;
}

function xerDate(
  value: string | null,
): string | null {
  if (!value) return null;
  const parsed = parseXerDateStrict(value);
  return parsed.status === "valid"
    ? parsed.iso
    : null;
}

function tabularDate(
  value: string | null,
): string | null {
  if (!value) return null;
  const parsed = parseScheduleDate(value);
  return parsed.status === "valid"
    ? parsed.iso
    : null;
}

function sourceRef(
  source:
    | "xer"
    | "primavera_xml"
    | "schedule_csv"
    | "schedule_xlsx",
  locator: string,
): ScheduleSourceRef {
  return { source, locator };
}

function metadataValue(
  result: ScheduleTabularResult,
  candidates: readonly string[],
): string | null {
  const wanted = new Set(
    candidates.map((value) =>
      value
        .toLowerCase()
        .replace(/[_:\-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    ),
  );

  for (const sheet of result.metadataSheets) {
    for (const field of sheet.fields) {
      const key = field.key
        .toLowerCase()
        .replace(/[_:\-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (wanted.has(key)) return field.value;
    }
  }

  return null;
}

function zeroFromRaw(
  raw: string | null,
): number | null {
  if (raw === null) return null;
  const value = Number(raw.trim());
  return Number.isFinite(value) && value === 0
    ? 0
    : null;
}

export function canonicalScheduleFromTabular(
  result: ScheduleTabularResult,
  input: {
    sourceRevisionId: string;
    projectId?: string | null;
  },
): CanonicalScheduleModel {
  const source =
    result.sourceType === "csv"
      ? "schedule_csv"
      : "schedule_xlsx";

  const activities: CanonicalScheduleActivity[] =
    result.activities.flatMap((activity, index) => {
      if (!activity.activityId) return [];

      const durationHours =
        activity.originalDurationHours ??
        zeroFromRaw(activity.originalDurationRaw);
      const type = normalizeActivityType(
        null,
        durationHours,
      );

      return [
        {
          projectId: input.projectId ?? null,
          activityId: activity.activityId,
          nativeId: null,
          name: activity.activityName,
          wbsId: activity.wbsId ?? activity.wbs,
          calendarId: activity.calendar,
          activityType: type.type,
          status: normalizeActivityStatus(
            activity.status,
            activity.percentComplete,
            activity.actualFinishIso,
          ),
          baselineStartIso:
            activity.baselineStartIso,
          baselineFinishIso:
            activity.baselineFinishIso,
          currentStartIso: activity.startIso,
          currentFinishIso: activity.finishIso,
          actualStartIso: activity.actualStartIso,
          actualFinishIso: activity.actualFinishIso,
          forecastStartIso: null,
          forecastFinishIso: null,
          originalDurationHours: durationHours,
          remainingDurationHours:
            activity.remainingDurationHours,
          totalFloatHours: activity.totalFloatHours,
          originalDurationRaw:
            activity.originalDurationRaw,
          originalDurationUnit:
            activity.originalDurationUnit,
          remainingDurationRaw:
            activity.remainingDurationRaw,
          remainingDurationUnit:
            activity.remainingDurationUnit,
          freeFloatHours: activity.freeFloatHours,
          percentComplete: activity.percentComplete,
          sourceRefs: [
            sourceRef(
              source,
              "activity-row:" + (index + 1),
            ),
          ],
          diagnostics: [
            ...activity.diagnostics,
            ...(type.inferredFromZeroDuration
              ? [
                  "SCHEDULE_ACTIVITY_TYPE_INFERRED_ZERO_DURATION",
                ]
              : []),
          ],
        },
      ];
    });

  const relationships: CanonicalScheduleRelationship[] =
    result.relationships.flatMap(
      (relationship, index) => {
        if (
          !relationship.predecessorId ||
          !relationship.successorId
        ) {
          return [];
        }

        return [
          {
            relationshipId:
              "tabular-rel-" + (index + 1),
            predecessorActivityId:
              relationship.predecessorId,
            successorActivityId:
              relationship.successorId,
            type: normalizeRelationshipType(
              relationship.relationshipType,
            ),
            lagHours: relationship.lagHours,
            external: false,
            sourceRefs: [
              sourceRef(
                source,
                "relationship-row:" +
                  (index + 1),
              ),
            ],
            diagnostics: [
              ...relationship.diagnostics,
              ...(relationship.relationshipType ===
              null
                ? [
                    "SCHEDULE_RELATIONSHIP_TYPE_NOT_PROVIDED",
                  ]
                : []),
            ],
          },
        ];
      },
    );

  const wbs: CanonicalWbsNode[] =
    result.wbsRows.map((row) => ({
      wbsId: row.wbsId,
      parentWbsId: row.parentWbsId,
      name: row.name,
      sourceRefs: [
        sourceRef(source, "wbs-row:" + row.row),
      ],
    }));

  const calendars: CanonicalCalendar[] =
    result.calendarRows.map((row) => ({
      calendarId: row.calendarId,
      name: row.name,
      semanticComplete:
        row.statusState === "verified",
      sourceRefs: [
        sourceRef(
          source,
          "calendar-row:" + row.row,
        ),
      ],
    }));

  const rawDataDate = metadataValue(result, [
    "data date",
    "current data date",
    "status date",
  ]);

  return {
    projectId: input.projectId ?? null,
    source,
    sourceRevisionId: input.sourceRevisionId,
    dataDateIso: tabularDate(rawDataDate),
    activities,
    relationships,
    wbs,
    calendars,
    diagnostics: [...result.diagnostics],
  };
}

export function canonicalScheduleFromXer(
  result: XerParseResult,
  input: {
    sourceRevisionId: string;
    projectId?: string | null;
  },
): CanonicalScheduleModel {
  const projectRows = xerRows(result, "PROJECT");
  const taskRows = xerRows(result, "TASK");
  const predRows = xerRows(result, "TASKPRED");
  const wbsRows = xerRows(result, "PROJWBS");
  const projectIds = new Set(
    projectRows
      .map((row) => xerField(row, "proj_id"))
      .filter((value): value is string => !!value),
  );

  const firstProject = projectRows[0] ?? null;
  const projectId =
    input.projectId ??
    (firstProject
      ? firstXerField(firstProject, [
          "proj_short_name",
          "proj_id",
        ])
      : null);

  const taskCodeByNative = new Map<string, string>();
  for (const row of taskRows) {
    const nativeId = xerField(row, "task_id");
    const projId = xerField(row, "proj_id");
    const activityId = xerField(row, "task_code");
    if (nativeId && projId && activityId) {
      taskCodeByNative.set(
        projId + "::" + nativeId,
        activityId,
      );
    }
  }

  const activities: CanonicalScheduleActivity[] =
    taskRows.flatMap((row) => {
      const activityId = xerField(
        row,
        "task_code",
      );
      if (!activityId) return [];

      const nativeId = xerField(row, "task_id");
      const originalDurationHours = numeric(
        firstXerField(row, [
          "target_drtn_hr_cnt",
          "orig_drtn_hr_cnt",
        ]),
      );
      const actualFinishIso = xerDate(
        xerField(row, "act_end_date"),
      );
      const pct = percent(
        firstXerField(row, [
          "phys_complete_pct",
          "complete_pct",
        ]),
      );
      const type = normalizeActivityType(
        xerField(row, "task_type"),
        originalDurationHours,
      );

      return [
        {
          projectId:
            xerField(row, "proj_id") ??
            projectId,
          activityId,
          nativeId,
          name: xerField(row, "task_name"),
          sourceConstraints: [
            {type:xerField(row,'cstr_type'),dateIso:xerDate(xerField(row,'cstr_date'))},
            {type:xerField(row,'cstr_type2'),dateIso:xerDate(xerField(row,'cstr_date2'))},
          ].filter((c):c is {type:string;dateIso:string|null}=>Boolean(c.type)),
          wbsId: xerField(row, "wbs_id"),
          calendarId: xerField(row, "clndr_id"),
          activityType: type.type,
          status: normalizeActivityStatus(
            xerField(row, "status_code"),
            pct,
            actualFinishIso,
          ),
          baselineStartIso: xerDate(
            xerField(row, "target_start_date"),
          ),
          baselineFinishIso: xerDate(
            xerField(row, "target_end_date"),
          ),
          baselineDateBasis: "xer_target_dates" as const,
          currentStartIso: xerDate(
            firstXerField(row, [
              "early_start_date",
              "restart_date",
            ]),
          ),
          currentFinishIso: xerDate(
            firstXerField(row, [
              "early_end_date",
              "reend_date",
            ]),
          ),
          actualStartIso: xerDate(
            xerField(row, "act_start_date"),
          ),
          actualFinishIso,
          forecastStartIso: xerDate(
            xerField(row, "restart_date"),
          ),
          forecastFinishIso: xerDate(
            xerField(row, "reend_date"),
          ),
          originalDurationHours,
          remainingDurationHours: numeric(
            xerField(
              row,
              "remain_drtn_hr_cnt",
            ),
          ),
          originalDurationRaw:
            firstXerField(row, [
              "target_drtn_hr_cnt",
              "orig_drtn_hr_cnt",
            ]),
          originalDurationUnit: "hours",
          remainingDurationRaw:
            xerField(
              row,
              "remain_drtn_hr_cnt",
            ),
          remainingDurationUnit: "hours",
          totalFloatHours: numeric(
            xerField(
              row,
              "total_float_hr_cnt",
            ),
          ),
          freeFloatHours: numeric(
            xerField(
              row,
              "free_float_hr_cnt",
            ),
          ),
          percentComplete: pct,
          sourceRefs: [
            sourceRef(
              "xer",
              "TASK:line:" + row.line,
            ),
          ],
          diagnostics: [
            ...row.diagnosticCodes,
            ...(type.inferredFromZeroDuration
              ? [
                  "SCHEDULE_ACTIVITY_TYPE_INFERRED_ZERO_DURATION",
                ]
              : []),
          ],
        },
      ];
    });

  const relationships: CanonicalScheduleRelationship[] =
    predRows.flatMap((row) => {
      const successorProject =
        xerField(row, "proj_id");
      const successorNative =
        xerField(row, "task_id");
      const predecessorProject =
        xerField(row, "pred_proj_id") ??
        successorProject;
      const predecessorNative =
        xerField(row, "pred_task_id");

      if (
        !successorNative ||
        !predecessorNative
      ) {
        return [];
      }

      const successorKey =
        (successorProject ?? "") +
        "::" +
        successorNative;
      const predecessorKey =
        (predecessorProject ?? "") +
        "::" +
        predecessorNative;

      const successorActivityId =
        taskCodeByNative.get(successorKey) ??
        "native:" + successorKey;
      const predecessorActivityId =
        taskCodeByNative.get(predecessorKey) ??
        "native:" + predecessorKey;

      const external =
        predecessorProject !== null &&
        !projectIds.has(predecessorProject);

      return [
        {
          relationshipId:
            xerField(row, "task_pred_id") ??
            "xer-rel-line-" + row.line,
          predecessorActivityId,
          successorActivityId,
          type: normalizeRelationshipType(
            xerField(row, "pred_type"),
          ),
          lagHours: numeric(
            xerField(row, "lag_hr_cnt"),
          ),
          external,
          sourceRefs: [
            sourceRef(
              "xer",
              "TASKPRED:line:" + row.line,
            ),
          ],
          diagnostics: [...row.diagnosticCodes],
        },
      ];
    });

  const wbs: CanonicalWbsNode[] =
    wbsRows.flatMap((row) => {
      const wbsId = xerField(row, "wbs_id");
      if (!wbsId) return [];

      return [
        {
          wbsId,
          parentWbsId:
            xerField(row, "parent_wbs_id"),
          name: firstXerField(row, [
            "wbs_name",
            "wbs_short_name",
          ]),
          sourceRefs: [
            sourceRef(
              "xer",
              "PROJWBS:line:" + row.line,
            ),
          ],
        },
      ];
    });

  const calendarIntegrity =
    verifyXerCalendars(result);
  const calendars: CanonicalCalendar[] =
    calendarIntegrity.calendars.map(
      (calendar) => {
        const days = calendar.data?.days ?? [];
        const weeklyWorkMinutes = [
          1, 2, 3, 4, 5, 6, 7,
        ].map(
          (dayIndex) =>
            days.find(
              (day) =>
                day.dayIndex === dayIndex,
            )?.workMinutes ?? 0,
        ) as [
          number,
          number,
          number,
          number,
          number,
          number,
          number,
        ];

        const nonZeroDayHours = [
          ...new Set(
            weeklyWorkMinutes
              .filter((minutes) => minutes > 0)
              .map((minutes) => minutes / 60),
          ),
        ];

        return {
          calendarId: calendar.calendarId,
          name: calendar.name,
          semanticComplete:
            calendar.status === "verified" &&
            calendar.data?.status === "valid" &&
            days.length > 0,
          weeklyWorkMinutes,
          weeklyWorkIntervals:
            days.map((day) => ({
              dayIndex: day.dayIndex,
              intervals: day.intervals.map(
                (interval) => ({
                  start: interval.start,
                  finish: interval.finish,
                  minutes: interval.minutes,
                }),
              ),
            })),
          exceptions:
            calendar.data?.exceptions.map(
              (exception) => ({
                isoDate: exception.isoDate,
                nonWorking:
                  exception.nonWorking,
                workIntervals:
                  exception.intervals.map(
                    (interval) => ({
                      start: interval.start,
                      finish: interval.finish,
                      minutes:
                        interval.minutes,
                    }),
                  ),
              }),
            ) ?? [],
          standardDayHours:
            nonZeroDayHours.length === 1
              ? nonZeroDayHours[0]!
              : null,
          standardWeekHours:
            weeklyWorkMinutes.reduce(
              (sum, minutes) =>
                sum + minutes,
              0,
            ) / 60,
          sourceRefs: [
            sourceRef(
              "xer",
              "CALENDAR:" +
                calendar.calendarId,
            ),
          ],
        };
      },
    );

  return {
    projectId,
    source: "xer",
    sourceRevisionId: input.sourceRevisionId,
    dataDateIso: firstProject
      ? xerDate(
          firstXerField(firstProject, [
            "last_recalc_date",
            "data_date",
          ]),
        )
      : null,
    activities,
    relationships,
    wbs,
    calendars,
    diagnostics: result.diagnostics.map(
      (diagnostic) =>
        diagnostic.code +
        ":" +
        diagnostic.message,
    ),
  };
}

function rawField(
  raw: Record<string, unknown>,
  names: readonly string[],
): string | null {
  const wanted = new Set(
    names.map((name) =>
      name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ""),
    ),
  );

  for (const [key, value] of Object.entries(raw)) {
    const normalized = key
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (!wanted.has(normalized)) continue;
    if (
      typeof value === "string" ||
      typeof value === "number"
    ) {
      const text = String(value).trim();
      return text || null;
    }
  }

  return null;
}

export function canonicalScheduleFromPrimaveraXml(
  result: PrimaveraXmlResult,
  input: {
    sourceRevisionId: string;
    projectId?: string | null;
  },
): CanonicalScheduleModel {
  const projectId =
    input.projectId ??
    result.projects[0]?.id ??
    result.projects[0]?.objectId ??
    null;

  const activityIdByObject =
    new Map<string, string>();

  for (const activity of result.activities) {
    if (activity.objectId && activity.id) {
      activityIdByObject.set(
        activity.objectId,
        activity.id,
      );
    }
  }

  const activities: CanonicalScheduleActivity[] =
    result.activities.flatMap((activity) => {
      if (!activity.id) return [];

      const pct = percent(
        rawField(activity.raw, [
          "PhysicalPercentComplete",
          "PercentComplete",
        ]),
      );
      const actualFinishIso = tabularDate(
        rawField(activity.raw, [
          "ActualFinishDate",
          "ActualFinish",
        ]),
      );
      const type = normalizeActivityType(
        rawField(activity.raw, [
          "Type",
          "ActivityType",
        ]),
        activity.originalDurationHours,
      );

      return [
        {
          projectId:
            activity.projectObjectId ??
            projectId,
          activityId: activity.id,
          nativeId: activity.objectId,
          name: activity.name,
          wbsId: activity.wbsObjectId,
          calendarId:
            activity.calendarObjectId,
          activityType: type.type,
          status: normalizeActivityStatus(
            rawField(activity.raw, [
              "Status",
              "ActivityStatus",
            ]),
            pct,
            actualFinishIso,
          ),
          baselineStartIso: tabularDate(
            rawField(activity.raw, [
              "PlannedStartDate",
              "BaselineStartDate",
            ]),
          ),
          baselineFinishIso: tabularDate(
            rawField(activity.raw, [
              "PlannedFinishDate",
              "BaselineFinishDate",
            ]),
          ),
          currentStartIso:
            activity.startDateIso,
          currentFinishIso:
            activity.finishDateIso,
          actualStartIso: tabularDate(
            rawField(activity.raw, [
              "ActualStartDate",
              "ActualStart",
            ]),
          ),
          actualFinishIso,
          forecastStartIso: tabularDate(
            rawField(activity.raw, [
              "ForecastStartDate",
            ]),
          ),
          forecastFinishIso: tabularDate(
            rawField(activity.raw, [
              "ForecastFinishDate",
            ]),
          ),
          originalDurationHours:
            activity.originalDurationHours,
          remainingDurationHours:
            activity.remainingDurationHours,
          originalDurationRaw:
            activity.originalDurationRaw,
          originalDurationUnit:
            activity.originalDurationRaw
              ? activity.originalDurationRaw.trim().toLowerCase().endsWith("d")
                ? "days"
                : activity.originalDurationRaw.trim().toLowerCase().endsWith("w")
                  ? "weeks"
                  : activity.originalDurationHours !== null
                    ? "hours"
                    : "unknown"
              : activity.originalDurationHours !== null
                ? "hours"
                : "unknown",
          remainingDurationRaw:
            activity.remainingDurationRaw,
          remainingDurationUnit:
            activity.remainingDurationRaw
              ? activity.remainingDurationRaw.trim().toLowerCase().endsWith("d")
                ? "days"
                : activity.remainingDurationRaw.trim().toLowerCase().endsWith("w")
                  ? "weeks"
                  : activity.remainingDurationHours !== null
                    ? "hours"
                    : "unknown"
              : activity.remainingDurationHours !== null
                ? "hours"
                : "unknown",
          totalFloatHours:
            activity.totalFloatHours,
          freeFloatHours: numeric(
            rawField(activity.raw, [
              "FreeFloat",
              "FreeFloatHours",
            ]),
          ),
          percentComplete: pct,
          sourceRefs: [
            sourceRef(
              "primavera_xml",
              "Activity:" +
                (activity.objectId ??
                  activity.id),
            ),
          ],
          diagnostics: [
            ...activity.diagnostics,
            ...(type.inferredFromZeroDuration
              ? [
                  "SCHEDULE_ACTIVITY_TYPE_INFERRED_ZERO_DURATION",
                ]
              : []),
          ],
        },
      ];
    });

  const relationships: CanonicalScheduleRelationship[] =
    result.relationships.flatMap(
      (relationship, index) => {
        if (
          !relationship.predecessorActivityObjectId ||
          !relationship.successorActivityObjectId
        ) {
          return [];
        }

        const predecessorActivityId =
          activityIdByObject.get(
            relationship.predecessorActivityObjectId,
          ) ??
          "native:" +
            relationship.predecessorActivityObjectId;
        const successorActivityId =
          activityIdByObject.get(
            relationship.successorActivityObjectId,
          ) ??
          "native:" +
            relationship.successorActivityObjectId;

        return [
          {
            relationshipId:
              "xml-rel-" + (index + 1),
            predecessorActivityId,
            successorActivityId,
            type: normalizeRelationshipType(
              relationship.type,
            ),
            lagHours: relationship.lagHours,
            external: relationship.external,
            sourceRefs: [
              sourceRef(
                "primavera_xml",
                "Relationship:" +
                  (index + 1),
              ),
            ],
            diagnostics: [
              ...relationship.diagnostics,
            ],
          },
        ];
      },
    );

  return {
    projectId,
    source: "primavera_xml",
    sourceRevisionId: input.sourceRevisionId,
    dataDateIso: null,
    activities,
    relationships,
    wbs: [],
    calendars: [],
    diagnostics: [...result.diagnostics],
  };
}
