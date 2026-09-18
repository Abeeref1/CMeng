import type {
  XerDiagnostic,
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

export function verifyXerIntegrity(result: XerParseResult): XerIntegrityResult {
  const diagnostics: XerDiagnostic[] = [...result.diagnostics];

  const tasks = parsedRows(result, "TASK");
  const relationships = parsedRows(result, "TASKPRED");
  const wbsRows = parsedRows(result, "PROJWBS");
  const calendars = parsedRows(result, "CALENDAR");

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

  const taskIds = tasks
    .map((row) => nonEmpty(row, "task_id"))
    .filter((value): value is string => value !== null);

  const duplicateTaskIds = duplicates(taskIds);

  for (const taskId of duplicateTaskIds) {
    diagnostics.push({
      code: "XER_DUPLICATE_TASK_ID",
      severity: "error",
      message: `Duplicate TASK.task_id detected: ${taskId}`,
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

  for (const key of duplicateActivityCodes) {
    diagnostics.push({
      code: "XER_DUPLICATE_ACTIVITY_CODE",
      severity: "error",
      message: `Duplicate project/activity key detected: ${key}`,
      table: "TASK",
    });
  }

  const taskIdSet = new Set(taskIds);
  const missingPredecessorTaskIds = new Set<string>();
  const missingSuccessorTaskIds = new Set<string>();

  for (const row of relationships) {
    const predTaskId = nonEmpty(row, "pred_task_id");
    const successorTaskId = nonEmpty(row, "task_id");

    if (predTaskId && !taskIdSet.has(predTaskId)) {
      missingPredecessorTaskIds.add(predTaskId);
    }
    if (successorTaskId && !taskIdSet.has(successorTaskId)) {
      missingSuccessorTaskIds.add(successorTaskId);
    }
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
        message: `${values.length} unresolved reference(s): ${values.slice(0, 20).join(", ")}`,
        table,
      });
    }
  }

  const truncated = !result.endMarkerSeen;
  const complete =
    !truncated &&
    result.rowsUnresolved === 0 &&
    missingCoreTables.length === 0 &&
    duplicateTaskIds.length === 0 &&
    duplicateActivityCodes.length === 0 &&
    missingPred.length === 0 &&
    missingSucc.length === 0 &&
    missingWbs.length === 0 &&
    missingCalendar.length === 0 &&
    diagnostics.every((diagnostic) => diagnostic.severity !== "error");

  return {
    complete,
    activityCount: tasks.length,
    relationshipCount: relationships.length,
    wbsCount: wbsRows.length,
    calendarCount: calendars.length,
    duplicateTaskIds,
    duplicateActivityCodes,
    missingPredecessorTaskIds: missingPred,
    missingSuccessorTaskIds: missingSucc,
    missingWbsIds: missingWbs,
    missingCalendarIds: missingCalendar,
    missingCoreTables,
    unresolvedRows: result.rowsUnresolved,
    truncated,
    diagnostics,
  };
}
