import {
  parseXerDateStrict,
  verifyXerCalendars,
  type P6CalendarDataResult,
  type XerParseResult,
  type XerRow,
} from "../../xer-parser/src";
import type { PrimaveraXmlResult } from "../../primavera-xml-parser/src";
import { P6_XML_ELEMENTS } from "../../primavera-xml-parser/src/parser";
import type { ScheduleTabularResult } from "../../schedule-tabular-parser/src";
import { parseScheduleDate } from "../../schedule-values/src";
import {reconcileCalendarWithP6Dates} from "../../xer-parser/src/calendar-date-reconciliation";
import {noteXerRead,trackXerReads,xerSourceColumnAudit} from "../../xer-parser/src/read-tracking";
import {sourceColumnAuditEntry} from "../../truth-kernel/src/register-schema";
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
  SourceResourceAssignment,
  SourceResourceRef,
  SourceWbsPath,
} from "./types";

/** Model-level source lookups, present only when the source has them. */
function sourceLookups(wbsPaths:SourceWbsPath[],resources:SourceResourceRef[],costAccounts:SourceResourceRef[]){
  return {
    ...(wbsPaths.length?{sourceWbsPaths:wbsPaths}:{}),
    ...(resources.length?{sourceResources:resources}:{}),
    ...(costAccounts.length?{sourceCostAccounts:costAccounts}:{}),
  };
}

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
  noteXerRead(row.table, name);
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

function metadataValues(
  result: ScheduleTabularResult,
  candidates: readonly string[],
): string[] {
  const wanted = new Set(
    candidates.map((value) =>
      value
        .toLowerCase()
        .replace(/[_:\-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    ),
  );

  const values: string[] = [];
  for (const sheet of result.metadataSheets) {
    for (const field of sheet.fields) {
      const key = field.key
        .toLowerCase()
        .replace(/[_:\-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (wanted.has(key) && field.value.trim()) values.push(field.value);
    }
  }

  return values;
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
        activity.activityType ?? null,
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
          ...(activity.resource||activity.costAccount?{sourceResourceAssignments:[{resourceRef:activity.resource??null,costAccountRef:activity.costAccount??null}]}:{}),
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

  const rawDataDates = [...metadataValues(result, [
    "data date",
    "current data date",
    "status date",
  ]), ...(result.dataDateValues ?? []).map(value => value.raw)];
  const dateValues = rawDataDates.map(raw => parseScheduleDate(raw));
  const dateDiagnostics: string[] = [];
  if (dateValues.some(value => value.status !== "valid" || !value.iso)) dateDiagnostics.push("SCHEDULE_DATA_DATE_INVALID_OR_AMBIGUOUS");
  const uniqueDates = new Set(dateValues.filter(value => value.status === "valid" && value.iso).map(value => value.iso!.slice(0,10)));
  if (uniqueDates.size > 1) dateDiagnostics.push("SCHEDULE_DATA_DATE_CONFLICTING");
  const dataDateIso = dateDiagnostics.length === 0 && uniqueDates.size === 1 ? [...uniqueDates][0]! : null;

  return {
    projectId: input.projectId ?? null,
    source,
    sourceRevisionId: input.sourceRevisionId,
    ...(result.columnAudit ? {sourceColumnAudit: result.columnAudit} : {}),
    dataDateIso,
    activities,
    relationships,
    wbs,
    calendars,
    // Resource and cost-account cell text is kept as the source states it;
    // whether it is a code or a name is not known, so both stay null.
    ...sourceLookups(
      sourceWbsPaths(result.wbsRows.map(row=>({wbsId:row.wbsId||null,parentWbsId:row.parentWbsId,code:null,name:row.name}))),
      [...new Set(result.activities.map(a=>a.resource).filter((v):v is string=>!!v))].map(ref=>({ref,code:null,name:null})),
      [...new Set(result.activities.map(a=>a.costAccount).filter((v):v is string=>!!v))].map(ref=>({ref,code:null,name:null})),
    ),
    diagnostics: [...result.diagnostics, ...dateDiagnostics],
  };
}

export function canonicalScheduleFromXer(
  result: XerParseResult,
  input: {
    sourceRevisionId: string;
    projectId?: string | null;
  },
): CanonicalScheduleModel {
  // Every column of every table received, not only TASK/TASKPRED/PROJWBS.
  // Ingestion recomputes this over the schedule and resource readers together.
  const {value:model,read}=trackXerReads(()=>canonicalScheduleFromXerRead(result,input));
  return {...model,sourceColumnAudit:xerSourceColumnAudit(result,read)};
}

/** WBS path (root to node, by WBS code, else name, else id) for each node.
 * A missing parent or a loop ends the path; nothing is guessed. Shared by
 * every programme format. */
type SourceWbsNodeInput={wbsId:string|null;parentWbsId:string|null;code:string|null;name:string|null};
export function sourceWbsPaths(nodes: ReadonlyArray<SourceWbsNodeInput>): SourceWbsPath[] {
  const byId=new Map<string,SourceWbsNodeInput>(nodes.filter(node=>node.wbsId).map(node=>[node.wbsId!,node] as const));
  return [...byId.keys()].map(wbsId=>{
    const path:string[]=[],seen=new Set<string>();
    let current:string|null=wbsId;
    while(current&&byId.has(current)&&!seen.has(current)){
      seen.add(current);const node:SourceWbsNodeInput=byId.get(current)!;
      path.unshift(node.code??node.name??current);
      current=node.parentWbsId;
    }
    return {wbsId,path};
  });
}

/** Resources, cost accounts and per-task assignment references (TASKRSRC with RSRC and ACCOUNT). */
function xerResourceSources(result: XerParseResult){
  const resources:SourceResourceRef[]=xerRows(result,"RSRC").flatMap(row=>{const ref=xerField(row,"rsrc_id");return ref?[{ref,code:xerField(row,"rsrc_short_name"),name:xerField(row,"rsrc_name")}]:[];});
  const costAccounts:SourceResourceRef[]=xerRows(result,"ACCOUNT").flatMap(row=>{const ref=xerField(row,"acct_id");return ref?[{ref,code:xerField(row,"acct_short_name"),name:xerField(row,"acct_name")}]:[];});
  const byTask=new Map<string,SourceResourceAssignment[]>();
  for(const row of xerRows(result,"TASKRSRC")){
    const taskId=xerField(row,"task_id");if(!taskId)continue;
    const list=byTask.get(taskId)??[];
    list.push({resourceRef:xerField(row,"rsrc_id"),costAccountRef:xerField(row,"acct_id")});
    byTask.set(taskId,list);
  }
  return {resources,costAccounts,byTask};
}

function canonicalScheduleFromXerRead(
  result: XerParseResult,
  input: {
    sourceRevisionId: string;
    projectId?: string | null;
  },
): CanonicalScheduleModel {
  const resourceSources=xerResourceSources(result);
  const projectRows = xerRows(result, "PROJECT");
  const taskRows = xerRows(result, "TASK");
  const predRows = xerRows(result, "TASKPRED");
  const wbsRows = xerRows(result, "PROJWBS");
  // Activity codes: TASKACTV assigns an ACTVCODE value of an ACTVTYPE code type.
  // Read only exact ID joins; an unresolved assignment is not guessed.
  const codeTypeNames = new Map<string, string>(), codeValues = new Map<string, XerRow>();
  for (const row of xerRows(result, "ACTVTYPE")) { const id = xerField(row, "actv_code_type_id"), name = xerField(row, "actv_code_type"); if (id && name?.trim()) codeTypeNames.set(id, name); }
  for (const row of xerRows(result, "ACTVCODE")) { const id = xerField(row, "actv_code_id"); if (id) codeValues.set(id, row); }
  const activityCodesByTask = new Map<string, Array<{typeName:string;value:string;description:string|null}>>();
  for (const row of xerRows(result, "TASKACTV")) {
    const taskId = xerField(row, "task_id"), code = codeValues.get(xerField(row, "actv_code_id") ?? "");
    if (!taskId || !code) continue;
    const typeName = codeTypeNames.get(xerField(code, "actv_code_type_id") ?? "") ?? codeTypeNames.get(xerField(row, "actv_code_type_id") ?? "");
    const value = (xerField(code, "short_name") ?? xerField(code, "actv_code_name"))?.trim();
    if (!typeName || !value) continue;
    const list = activityCodesByTask.get(taskId) ?? [];
    list.push({typeName: typeName.trim(), value, description: xerField(code, "actv_code_name")?.trim() || null});
    activityCodesByTask.set(taskId, list);
  }
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
  const nativeTaskCandidates = new Map<string, Array<{projectId:string;activityId:string}>>();
  for (const row of taskRows) {
    const nativeId = xerField(row, "task_id");
    const projId = xerField(row, "proj_id");
    const activityId = xerField(row, "task_code");
    if (nativeId && activityId) {
      if (projId) {
        taskCodeByNative.set(
          projId + "::" + nativeId,
          activityId,
        );
      }
      // TASK rows that carry no proj_id are still candidates; their scope is
      // recorded as "" so they never satisfy an explicit foreign project.
      const candidates=nativeTaskCandidates.get(nativeId)??[];
      candidates.push({projectId:projId??"",activityId});
      nativeTaskCandidates.set(nativeId,candidates);
    }
  }

  // An activity ID (task_code) carried by more than one TASK row (another
  // WBS or another project) is reported with its source lines, and no link
  // is attached to it: a link to such an ID could only be matched by guess.
  const taskLinesByCode=new Map<string,number[]>();
  for(const row of taskRows){
    const code=xerField(row,"task_code");
    if(code)taskLinesByCode.set(code,[...(taskLinesByCode.get(code)??[]),row.line]);
  }
  const duplicateActivityIdDiagnostics=[...taskLinesByCode].filter(([,lines])=>lines.length>1)
    .map(([code,lines])=>"XER_DUPLICATE_ACTIVITY_ID:"+code+":"+lines.map(line=>"TASK:line:"+line).join("|"));
  const duplicateActivityIds=new Set([...taskLinesByCode].filter(([,lines])=>lines.length>1).map(([code])=>code));

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
          ...(()=>{const list=nativeId?resourceSources.byTask.get(nativeId):undefined;return list?.length?{sourceResourceAssignments:list}:{};})(),
          sourceConstraints: [
            {type:xerField(row,'cstr_type'),dateIso:xerDate(xerField(row,'cstr_date'))},
            {type:xerField(row,'cstr_type2'),dateIso:xerDate(xerField(row,'cstr_date2'))},
          ].filter((c):c is {type:string;dateIso:string|null}=>Boolean(c.type)),
          wbsId: xerField(row, "wbs_id"),
          ...(nativeId && activityCodesByTask.has(nativeId) ? {activityCodes: activityCodesByTask.get(nativeId)!} : {}),
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

      // Some exports omit project IDs on link rows (or on TASK rows). P6
      // task_id is unique within the exporting database, so a missing scope
      // is inferred only from exactly one task carrying that task_id in the
      // whole file. An explicit project scope is inferred only onto an
      // unscoped task of a single-project export. Explicit external IDs and
      // ambiguous task_ids stay unresolved, and an inferred end attaches only
      // when the other end also resolves, so no half-guessed link is made.
      const resolveEndpoint=(scope:string|null,nativeId:string,key:string):{id:string|null;inferred:boolean}=>{
        const exact=taskCodeByNative.get(key);
        if(exact)return {id:exact,inferred:false};
        const candidates=nativeTaskCandidates.get(nativeId)??[];
        if(scope===null){
          const unique=candidates.length===1?candidates[0]!:null;
          // Single-project export, task carries proj_id: attached as before.
          const established=unique!==null&&projectIds.size===1&&unique.projectId!=="";
          return {id:unique?.activityId??null,inferred:!established};
        }
        const single=projectIds.size===0||(projectIds.size===1&&projectIds.has(scope));
        return {id:single&&candidates.length===1&&candidates[0]!.projectId===""?candidates[0]!.activityId:null,inferred:true};
      };
      const successorResolved = resolveEndpoint(successorProject,successorNative,successorKey);
      const predecessorResolved = resolveEndpoint(predecessorProject,predecessorNative,predecessorKey);
      const ambiguousEnds=[successorResolved.id,predecessorResolved.id].filter((id):id is string=>id!==null&&duplicateActivityIds.has(id));
      const usable=(end:{id:string|null})=>end.id!==null&&!duplicateActivityIds.has(end.id);
      const endpoint=(own:{id:string|null;inferred:boolean},other:{id:string|null},key:string)=>
        usable(own)&&(!own.inferred||usable(other))?own.id!:"native:"+key;
      const successorActivityId = endpoint(successorResolved,predecessorResolved,successorKey);
      const predecessorActivityId = endpoint(predecessorResolved,successorResolved,predecessorKey);

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
          diagnostics: [...row.diagnosticCodes,...[...new Set(ambiguousEnds)].map(id=>"XER_LINK_ENDPOINT_DUPLICATE_ACTIVITY_ID:"+id)],
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
          code:xerField(row,'wbs_short_name'),
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

  // Data date: PROJECT.last_recalc_date (P6). In a multi-project export the
  // first row is never chosen arbitrarily: differing data dates stay unknown.
  const projectDataDates=[...new Set(projectRows.map(row=>xerDate(firstXerField(row,["last_recalc_date","data_date"]))).filter((v):v is string=>v!==null))];
  const xerDataDate=projectRows.length>1&&projectDataDates.length>1
    ?{iso:null as string|null,diagnostics:["XER_PROJECT_DATA_DATE_CONFLICT:"+projectDataDates.sort().join(",")]}
    :{iso:firstProject?xerDate(firstXerField(firstProject,["last_recalc_date","data_date"])):null,diagnostics:[] as string[]};
  const calendarIntegrity =
    verifyXerCalendars(result);
  // Source calendar intervals remain the first authority. Only where they
  // are genuinely absent, a unique P6-dated duration reconciliation can
  // supply an explicitly qualified working pattern.
  const reconciledP6Calendars=new Map(calendarIntegrity.calendars.flatMap(calendar=>{
    const data=reconcileCalendarWithP6Dates(calendar,taskRows);
    return data?[[calendar.calendarId,data] as const]:[];
  }));
  const calendarById =
    new Map(
      calendarIntegrity.calendars.map(
        (calendar) => [
          calendar.calendarId,
          calendar,
        ] as const,
      ),
    );
  const resolvedCalendarData =
    new Map<
      string,
      {
        data: P6CalendarDataResult;
        inheritedFrom: string[];
      } | null
    >();

  const resolveCalendarData = (
    calendarId: string,
    visiting:
      Set<string> = new Set(),
  ): {
    data: P6CalendarDataResult;
    inheritedFrom: string[];
  } | null => {
    if (
      resolvedCalendarData.has(
        calendarId,
      )
    ) {
      return (
        resolvedCalendarData.get(
          calendarId,
        ) ?? null
      );
    }

    if (visiting.has(calendarId)) {
      resolvedCalendarData.set(
        calendarId,
        null,
      );
      return null;
    }

    const calendar =
      calendarById.get(
        calendarId,
      );
    const recovered=reconciledP6Calendars.get(calendarId);
    if(recovered){
      const qualified={data:recovered,inheritedFrom:[] as string[]};
      resolvedCalendarData.set(calendarId,qualified);
      return qualified;
    }
    if (
      !calendar ||
      calendar.status ===
        "unresolved"
    ) {
      resolvedCalendarData.set(
        calendarId,
        null,
      );
      return null;
    }

    const own =
      calendar.data;
    if (
      own?.status === "valid" &&
      own.days.length > 0
    ) {
      const resolved = {
        data: own,
        inheritedFrom: [],
      };
      resolvedCalendarData.set(
        calendarId,
        resolved,
      );
      return resolved;
    }

    if (!calendar.baseCalendarId) {
      resolvedCalendarData.set(
        calendarId,
        null,
      );
      return null;
    }

    const next =
      new Set(visiting);
    next.add(calendarId);
    const parent =
      resolveCalendarData(
        calendar.baseCalendarId,
        next,
      );
    if (!parent) {
      resolvedCalendarData.set(
        calendarId,
        null,
      );
      return null;
    }

    // P6 base calendars provide the weekly pattern when the child does not
    // define one. Child exceptions remain authoritative for the same date.
    const exceptions =
      new Map(
        parent.data.exceptions.map(
          (exception) => [
            exception.isoDate,
            exception,
          ] as const,
        ),
      );
    for (
      const exception of
        own?.exceptions ?? []
    ) {
      exceptions.set(
        exception.isoDate,
        exception,
      );
    }

    const inherited: {
      data: P6CalendarDataResult;
      inheritedFrom: string[];
    } = {
      data: {
        status: "valid",
        root:
          own?.root ??
          parent.data.root,
        days:
          parent.data.days.map(
            (day) => ({
              ...day,
              intervals:
                day.intervals.map(
                  (interval) => ({
                    ...interval,
                  }),
                ),
            }),
          ),
        exceptions: [
          ...exceptions.values(),
        ].sort(
          (a, b) =>
            a.serialDay -
            b.serialDay,
        ),
        unknownTopLevelNodes: [
          ...new Set([
            ...parent.data
              .unknownTopLevelNodes,
            ...(own
              ?.unknownTopLevelNodes ??
              []),
          ]),
        ],
        diagnostics: [
          ...new Set([
            ...parent.data
              .diagnostics,
            ...(own?.diagnostics ??
              []),
          ]),
        ],
      },
      inheritedFrom: [
        calendar.baseCalendarId,
        ...parent.inheritedFrom,
      ],
    };
    resolvedCalendarData.set(
      calendarId,
      inherited,
    );
    return inherited;
  };

  const calendarDiagnostics =
    calendarIntegrity.calendars
      .flatMap(
        (calendar) => {
          const resolved =
            resolveCalendarData(
              calendar.calendarId,
            );
          if(reconciledP6Calendars.has(calendar.calendarId)){
            return ["CALENDAR_P6_DATE_RECONCILIATION_QUALIFIED:"+calendar.calendarId];
          }
          if (
            calendar.status ===
            "unresolved"
          ) {
            return (
              calendar.diagnostics.length
                ? calendar.diagnostics.map(
                    (diagnostic) =>
                      "CALENDAR_SEMANTICS_UNRESOLVED:" +
                      calendar.calendarId +
                      ":" +
                      diagnostic,
                  )
                : [
                    "CALENDAR_SEMANTICS_UNRESOLVED:" +
                      calendar.calendarId,
                  ]
            );
          }
          if (!resolved) {
            return [
              "CALENDAR_WORK_PATTERN_NOT_ESTABLISHED:" +
                calendar.calendarId,
            ];
          }
          return resolved
            .inheritedFrom.length
            ? [
                "CALENDAR_BASE_PATTERN_INHERITED:" +
                  calendar.calendarId +
                  ":" +
                  resolved.inheritedFrom.join(
                    ">",
                  ),
              ]
            : [];
        },
      );

  const calendars: CanonicalCalendar[] =
    calendarIntegrity.calendars.map(
      (calendar) => {
        const resolved =
          resolveCalendarData(
            calendar.calendarId,
          );
        const days =
          resolved?.data.days ??
          [];
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
          sourceConversionDayHours:calendar.conversionDayHours,
          sourceConversionWeekHours:calendar.conversionWeekHours,
          reconciledFromP6Dates:reconciledP6Calendars.has(calendar.calendarId),
          semanticComplete:
            (calendar.status === "verified" || reconciledP6Calendars.has(calendar.calendarId)) &&
            resolved !== null &&
            resolved.data.status === "valid" &&
            days.length === 7,
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
            resolved?.data.exceptions.map(
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
            ...(
              resolved?.inheritedFrom ??
              []
            ).map(
              (baseId) =>
                sourceRef(
                  "xer",
                  "CALENDAR:" +
                    baseId,
                ),
            ),
          ],
        };
      },
    );

  return {
    projectId,
    source: "xer",
    sourceRevisionId: input.sourceRevisionId,
    declaredProjectFinishIso:projectRows.length===1?xerDate(xerField(firstProject!,"plan_end_date")):null,
    // PROJECT.scd_end_date is the finish P6 computed at the last schedule
    // run. It is held apart from the declared (plan_end_date) finish and
    // from any activity-derived or independent CPM finish.
    scheduledProjectFinishIso:projectRows.length===1?xerDate(xerField(firstProject!,"scd_end_date")):null,
    dataDateIso: xerDataDate.iso,
    activities,
    relationships,
    wbs,
    calendars,
    ...sourceLookups(sourceWbsPaths(wbs.map(node=>({wbsId:node.wbsId,parentWbsId:node.parentWbsId,code:node.code??null,name:node.name}))),resourceSources.resources,resourceSources.costAccounts),
    diagnostics: [
      ...result.diagnostics.map(
        (diagnostic) =>
          diagnostic.code +
          ":" +
          diagnostic.message,
      ),
      ...calendarDiagnostics,
      ...calendarIntegrity.calendars.flatMap(c=>c.conversionDiagnostics.map(d=>'CALENDAR_CONVERSION_REVIEW:'+c.calendarId+':'+d)),
      ...xerDataDate.diagnostics,
      ...duplicateActivityIdDiagnostics,
    ],
  };
}

let rawFieldNamesRead: Set<string> | null = null;
function rawField(
  raw: Record<string, unknown>,
  names: readonly string[],
): string | null {
  if (rawFieldNamesRead) for (const name of names) rawFieldNamesRead.add(name.toLowerCase().replace(/[^a-z0-9]/g, ""));
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
  const previous=rawFieldNamesRead,read=new Set<string>(result.activityFieldsRead??[]);
  rawFieldNamesRead=read;
  let model: CanonicalScheduleModel;
  try{model=canonicalScheduleFromPrimaveraXmlRead(result,input);}finally{rawFieldNamesRead=previous;}
  // Every Activity field in the file: read by the reader/adapter, or unused
  // with a sample. Child elements that P6 XML collects as their own element
  // type (for example ResourceAssignment) are audited as their own table.
  const norm=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
  const headers=new Map<string,string|null>();
  for(const activity of result.activities)for(const [key,value] of Object.entries(activity.raw)){
    if(P6_XML_ELEMENTS[norm(key)])continue;
    const sample=typeof value==='string'||typeof value==='number'||typeof value==='boolean'?String(value).trim()||null:null;
    if(!headers.has(key)||(headers.get(key)===null&&sample!==null))headers.set(key,sample);
  }
  const sourceColumnAudit=[...(result.columnAudit??[]),...[...headers].map(([header,sample])=>({table:'Activity',...sourceColumnAuditEntry(header,header,'other',read.has(norm(header)),
    'Read by the P6 XML schedule reader into the canonical schedule model.',sample)}))];
  // WBS path, resources and cost accounts once per file; activities carry
  // only the assignment references (exact ObjectIds).
  const wbsPaths=sourceWbsPaths((result.wbsNodes??[]).map(node=>({wbsId:node.objectId,parentWbsId:node.parentObjectId,code:node.code,name:node.name})));
  const refs=(items:ReadonlyArray<{objectId:string|null;id:string|null;name:string|null}>):SourceResourceRef[]=>items.flatMap(item=>item.objectId?[{ref:item.objectId,code:item.id,name:item.name}]:[]);
  const byActivity=new Map<string,SourceResourceAssignment[]>();
  for(const assignment of result.resourceAssignments??[]){
    if(!assignment.activityObjectId)continue;
    const list=byActivity.get(assignment.activityObjectId)??[];
    list.push({resourceRef:assignment.resourceObjectId,costAccountRef:assignment.costAccountObjectId});
    byActivity.set(assignment.activityObjectId,list);
  }
  const activities=byActivity.size?model.activities.map(activity=>{const list=activity.nativeId?byActivity.get(activity.nativeId):undefined;return list?{...activity,sourceResourceAssignments:list}:activity;}):model.activities;
  return {...model,activities,sourceColumnAudit,...sourceLookups(wbsPaths,refs(result.resources??[]),refs(result.costAccounts??[]))};
}

function canonicalScheduleFromPrimaveraXmlRead(
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
    // Project header dates are read only from a single-project file; a
    // multi-project file never has one project's dates chosen arbitrarily.
    dataDateIso: result.projects.length===1?tabularDate(result.projects[0]!.dataDate??null):null,
    declaredProjectFinishIso: result.projects.length===1?tabularDate(result.projects[0]!.mustFinishByDate??null):null,
    scheduledProjectFinishIso: result.projects.length===1?tabularDate(result.projects[0]!.scheduledFinishDate??null):null,
    activities,
    relationships,
    wbs: [],
    calendars: [],
    diagnostics: [...result.diagnostics],
  };
}
