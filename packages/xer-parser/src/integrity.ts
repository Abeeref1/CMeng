import { verifyXerCalendars } from "./calendar-integrity";
import type {
  XerDiagnostic,
  XerExternalRelationship,
  XerIntegrityResult,
  XerParseResult,
  XerRow,
} from "./types";

function parsedRows(result: XerParseResult, table: string): XerRow[] {
  return (result.tables.get(table)?.rows ?? []).filter(
    (row) => row.status === "parsed" && row.data,
  );
}

function nonEmpty(row: XerRow, field: string): string | null {
  const value = row.data?.[field]?.trim();
  return value ? value : null;
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) dup.add(value);
    else seen.add(value);
  }
  return [...dup].sort();
}

function key(projectId: string | null, taskId: string | null): string | null {
  return projectId && taskId ? `${projectId}::${taskId}` : null;
}

export function verifyXerIntegrity(result: XerParseResult): XerIntegrityResult {
  const diagnostics: XerDiagnostic[] = [...result.diagnostics];

  const projects = parsedRows(result, "PROJECT");
  const tasks = parsedRows(result, "TASK");
  const relationships = parsedRows(result, "TASKPRED");
  const wbsRows = parsedRows(result, "PROJWBS");
  const calendars = parsedRows(result, "CALENDAR");
  const calendarIntegrity = verifyXerCalendars(result);

  for (const calendar of calendarIntegrity.calendars) {
    if (calendar.status === "unresolved") {
      diagnostics.push({
        code: "XER_CALENDAR_SEMANTICS_UNRESOLVED",
        severity: "error",
        message:
          `Calendar ${calendar.calendarId} could not be semantically certified: ` +
          calendar.diagnostics.join("; "),
        table: "CALENDAR",
      });
    }
  }

  const missingCoreTables = ["PROJECT", "PROJWBS", "TASK"].filter(
    (table) => !result.tables.has(table),
  );

  for (const table of missingCoreTables) {
    diagnostics.push({
      code: "XER_CORE_TABLE_MISSING",
      severity: "error",
      message: `Required core table ${table} is missing.`,
      table,
    });
  }

  const projectIds = new Set(
    projects
      .map((row) => nonEmpty(row, "proj_id"))
      .filter((value): value is string => value !== null),
  );

  const taskKeys = tasks
    .map((row) => key(nonEmpty(row, "proj_id"), nonEmpty(row, "task_id")))
    .filter((value): value is string => value !== null);

  const duplicateTaskIds = duplicates(taskKeys);

  for (const taskKey of duplicateTaskIds) {
    diagnostics.push({
      code: "XER_DUPLICATE_TASK_ID",
      severity: "error",
      message: `Duplicate project/TASK.task_id detected: ${taskKey}`,
      table: "TASK",
    });
  }

  const activityKeys = tasks
    .map((row) => {
      const projId = nonEmpty(row, "proj_id");
      const taskCode = nonEmpty(row, "task_code");
      return projId && taskCode ? `${projId}::${taskCode}` : null;
    })
    .filter((value): value is string => value !== null);

  const duplicateActivityCodes = duplicates(activityKeys);

  for (const activityKey of duplicateActivityCodes) {
    diagnostics.push({
      code: "XER_DUPLICATE_ACTIVITY_CODE",
      severity: "error",
      message: `Duplicate project/activity key detected: ${activityKey}`,
      table: "TASK",
    });
  }

  const taskKeySet = new Set(taskKeys);
  const missingPredecessorTaskIds = new Set<string>();
  const missingSuccessorTaskIds = new Set<string>();
  const externalRelationships: XerExternalRelationship[] = [];

  for (const row of relationships) {
    const successorProjectId = nonEmpty(row, "proj_id");
    const successorTaskId = nonEmpty(row, "task_id");
    const predecessorProjectId =
      nonEmpty(row, "pred_proj_id") ?? successorProjectId;
    const predecessorTaskId = nonEmpty(row, "pred_task_id");

    const successorKey = key(successorProjectId, successorTaskId);
    const predecessorKey = key(predecessorProjectId, predecessorTaskId);

    if (successorKey && !taskKeySet.has(successorKey)) {
      missingSuccessorTaskIds.add(successorKey);
    }

    if (predecessorKey && !taskKeySet.has(predecessorKey)) {
      if (predecessorProjectId && !projectIds.has(predecessorProjectId)) {
        externalRelationships.push({
          line: row.line,
          successorProjectId,
          successorTaskId,
          predecessorProjectId,
          predecessorTaskId,
        });
      } else {
        missingPredecessorTaskIds.add(predecessorKey);
      }
    }
  }

  if (externalRelationships.length > 0) {
    diagnostics.push({
      code: "XER_EXTERNAL_RELATIONSHIPS_REQUIRE_RESOLUTION",
      severity: "warning",
      message:
        `${externalRelationships.length} relationship(s) reference predecessor projects not contained in this XER. ` +
        "The source can be parsed, but the complete schedule graph cannot be certified without resolving those external references.",
      table: "TASKPRED",
    });
  }

  const wbsIds = new Set(
    wbsRows
      .map((row) => nonEmpty(row, "wbs_id"))
      .filter((value): value is string => value !== null),
  );
  const missingWbsIds = new Set<string>();

  for (const row of tasks) {
    const wbsId = nonEmpty(row, "wbs_id");
    if (wbsId && !wbsIds.has(wbsId)) missingWbsIds.add(wbsId);
  }

  const calendarIds = new Set(
    calendars
      .map((row) => nonEmpty(row, "clndr_id"))
      .filter((value): value is string => value !== null),
  );
  const missingCalendarIds = new Set<string>();

  for (const row of tasks) {
    const calendarId = nonEmpty(row, "clndr_id");
    if (calendarId && !calendarIds.has(calendarId)) {
      missingCalendarIds.add(calendarId);
    }
  }

  const missingPred = [...missingPredecessorTaskIds].sort();
  const missingSucc = [...missingSuccessorTaskIds].sort();
  const missingWbs = [...missingWbsIds].sort();
  const missingCalendar = [...missingCalendarIds].sort();

  const referenceFailures = [
    ["XER_MISSING_PREDECESSOR_TASK", "TASKPRED", missingPred],
    ["XER_MISSING_SUCCESSOR_TASK", "TASKPRED", missingSucc],
    ["XER_MISSING_WBS", "TASK", missingWbs],
    ["XER_MISSING_CALENDAR", "TASK", missingCalendar],
  ] as const;

  for (const [code, table, values] of referenceFailures) {
    if (values.length > 0) {
      diagnostics.push({
        code,
        severity: "error",
        message: `${values.length} unresolved internal reference(s): ${values.slice(0, 20).join(", ")}`,
        table,
      });
    }
  }

  const truncated = !result.endMarkerSeen;
  const sourceComplete =
    !truncated &&
    result.rowsUnresolved === 0 &&
    missingCoreTables.length === 0 &&
    duplicateTaskIds.length === 0 &&
    duplicateActivityCodes.length === 0 &&
    missingPred.length === 0 &&
    missingSucc.length === 0 &&
    missingWbs.length === 0 &&
    missingCalendar.length === 0 &&
    calendarIntegrity.complete &&
    diagnostics.every((diagnostic) => diagnostic.severity !== "error");

  const graphComplete = sourceComplete && externalRelationships.length === 0;

  return {
    complete: graphComplete,
    sourceComplete,
    graphComplete,
    activityCount: tasks.length,
    relationshipCount: relationships.length,
    wbsCount: wbsRows.length,
    calendarCount: calendars.length,
    calendarSemanticComplete: calendarIntegrity.complete,
    unresolvedCalendars: calendarIntegrity.unresolvedCalendars,
    duplicateTaskIds,
    duplicateActivityCodes,
    missingPredecessorTaskIds: missingPred,
    missingSuccessorTaskIds: missingSucc,
    missingWbsIds: missingWbs,
    missingCalendarIds: missingCalendar,
    missingCoreTables,
    externalRelationships,
    externalRelationshipCount: externalRelationships.length,
    unresolvedRows: result.rowsUnresolved,
    truncated,
    diagnostics,
  };
}
