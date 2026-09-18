import { parseXerDateStrict } from "../../xer-parser/src/dates";
import type {
  XerParseResult,
  XerRow,
} from "../../xer-parser/src/types";
import type { PrimaveraXmlResult } from "../../primavera-xml-parser/src";
import type { ScheduleTabularResult } from "../../schedule-tabular-parser/src";
import type { BoqParseResult } from "../../boq-parser/src/types";
import type { BoqCsvResult } from "../../boq-csv-parser/src";
import type { BoqPdfResult } from "../../boq-pdf-parser/src";
import type {
  BoqCanonicalItem,
  ScheduleCanonicalActivity,
} from "./types";

export interface CanonicalizationResult<T> {
  items: T[];
  diagnostics: string[];
}

function xerParsedRows(
  result: XerParseResult,
  table: string,
): XerRow[] {
  return (result.tables.get(table)?.rows ?? []).filter(
    (row) => row.status === "parsed" && row.data,
  );
}

function xerField(
  row: XerRow,
  field: string,
): string | null {
  const value = row.data?.[field]?.trim();
  return value ? value : null;
}

function xerNumber(
  row: XerRow,
  field: string,
  diagnostics: string[],
): number | null {
  const raw = xerField(row, field);
  if (raw === null) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    diagnostics.push(
      "XER_CANONICAL_NUMERIC_INVALID:" +
        field +
        ":line=" +
        row.line,
    );
    return null;
  }
  return value;
}

function xerDate(
  row: XerRow,
  field: string,
  diagnostics: string[],
): string | null {
  const raw = xerField(row, field);
  if (raw === null) return null;
  const parsed = parseXerDateStrict(raw);
  if (parsed.status !== "valid") {
    diagnostics.push(
      "XER_CANONICAL_DATE_" +
        parsed.status.toUpperCase() +
        ":" +
        field +
        ":line=" +
        row.line,
    );
    return null;
  }
  return parsed.iso;
}

export interface XerScheduleCanonicalOptions {
  source?: string;
  projectIdOverride?: string | null;
  startField?: string;
  finishField?: string;
  originalDurationField?: string;
  remainingDurationField?: string;
  totalFloatField?: string;
}

export function scheduleActivitiesFromXer(
  result: XerParseResult,
  options: XerScheduleCanonicalOptions = {},
): CanonicalizationResult<ScheduleCanonicalActivity> {
  const diagnostics: string[] = [];
  const items: ScheduleCanonicalActivity[] = [];
  const source = options.source ?? "XER";
  const startField = options.startField ?? "target_start_date";
  const finishField = options.finishField ?? "target_end_date";
  const originalDurationField =
    options.originalDurationField ?? "target_drtn_hr_cnt";
  const remainingDurationField =
    options.remainingDurationField ?? "remain_drtn_hr_cnt";
  const totalFloatField =
    options.totalFloatField ?? "total_float_hr_cnt";

  for (const row of xerParsedRows(result, "TASK")) {
    const activityId = xerField(row, "task_code");
    if (!activityId) {
      diagnostics.push(
        "XER_CANONICAL_ACTIVITY_CODE_MISSING:line=" + row.line,
      );
      continue;
    }

    items.push({
      source,
      projectId:
        options.projectIdOverride ??
        xerField(row, "proj_id"),
      activityId,
      name: xerField(row, "task_name"),
      wbsRef: xerField(row, "wbs_id"),
      calendarRef: xerField(row, "clndr_id"),
      startIso: xerDate(
        row,
        startField,
        diagnostics,
      ),
      finishIso: xerDate(
        row,
        finishField,
        diagnostics,
      ),
      originalDurationHours: xerNumber(
        row,
        originalDurationField,
        diagnostics,
      ),
      remainingDurationHours: xerNumber(
        row,
        remainingDurationField,
        diagnostics,
      ),
      totalFloatHours: xerNumber(
        row,
        totalFloatField,
        diagnostics,
      ),
    });
  }

  return { items, diagnostics };
}

export interface XmlScheduleCanonicalOptions {
  source?: string;
  projectIdOverride?: string | null;
}

export function scheduleActivitiesFromPrimaveraXml(
  result: PrimaveraXmlResult,
  options: XmlScheduleCanonicalOptions = {},
): CanonicalizationResult<ScheduleCanonicalActivity> {
  const diagnostics: string[] = [];
  const source = options.source ?? "Primavera XML";

  const items = result.activities.flatMap(
    (activity): ScheduleCanonicalActivity[] => {
      if (!activity.id) {
        diagnostics.push(
          "P6XML_CANONICAL_ACTIVITY_ID_MISSING:" +
            (activity.objectId ?? "<unknown>"),
        );
        return [];
      }

      return [
        {
          source,
          projectId:
            options.projectIdOverride ??
            activity.projectObjectId,
          activityId: activity.id,
          name: activity.name,
          wbsRef: activity.wbsObjectId,
          calendarRef: activity.calendarObjectId,
          startIso: activity.startDateIso,
          finishIso: activity.finishDateIso,
          originalDurationHours:
            activity.originalDurationHours,
          remainingDurationHours:
            activity.remainingDurationHours,
          totalFloatHours: activity.totalFloatHours,
        },
      ];
    },
  );

  return { items, diagnostics };
}

export interface TabularScheduleCanonicalOptions {
  source?: string;
  projectId: string | null;
}

export function scheduleActivitiesFromTabular(
  result: ScheduleTabularResult,
  options: TabularScheduleCanonicalOptions,
): CanonicalizationResult<ScheduleCanonicalActivity> {
  const diagnostics: string[] = [];
  const source = options.source ?? result.sourceType.toUpperCase();

  const items = result.activities.flatMap(
    (activity): ScheduleCanonicalActivity[] => {
      if (!activity.activityId) {
        diagnostics.push(
          "TABULAR_CANONICAL_ACTIVITY_ID_MISSING",
        );
        return [];
      }

      return [
        {
          source,
          projectId: options.projectId,
          activityId: activity.activityId,
          name: activity.activityName,
          wbsRef: activity.wbsId ?? activity.wbs,
          calendarRef: activity.calendar,
          startIso: activity.startIso,
          finishIso: activity.finishIso,
          originalDurationHours:
            activity.originalDurationHours,
          remainingDurationHours:
            activity.remainingDurationHours,
          totalFloatHours: activity.totalFloatHours,
        },
      ];
    },
  );

  return { items, diagnostics };
}

function canonicalBoqItem(
  source: string,
  item: {
    rowKind: string;
    itemNumber: string | null;
    description: string;
    unit: string | null;
    quantity: number | null;
    rate: number | null;
    amount: number | null;
  },
  diagnostics: string[],
): BoqCanonicalItem[] {
  if (item.rowKind !== "line_item") return [];
  if (!item.itemNumber) {
    diagnostics.push(
      "BOQ_CANONICAL_ITEM_NUMBER_MISSING:" + item.description,
    );
    return [];
  }

  return [
    {
      source,
      itemNumber: item.itemNumber,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.amount,
    },
  ];
}

export function boqItemsFromXlsx(
  result: BoqParseResult,
  source = "XLSX",
): CanonicalizationResult<BoqCanonicalItem> {
  const diagnostics: string[] = [];
  const items = result.sheets.flatMap((sheet) =>
    sheet.items.flatMap((item) =>
      canonicalBoqItem(source, item, diagnostics),
    ),
  );
  return { items, diagnostics };
}

export function boqItemsFromCsv(
  result: BoqCsvResult,
  source = "CSV",
): CanonicalizationResult<BoqCanonicalItem> {
  const diagnostics: string[] = [];
  const items = result.items.flatMap((item) =>
    canonicalBoqItem(source, item, diagnostics),
  );
  return { items, diagnostics };
}

export function boqItemsFromPdf(
  result: BoqPdfResult,
  source = "PDF",
): CanonicalizationResult<BoqCanonicalItem> {
  const diagnostics: string[] = [];
  const items = result.items.flatMap((item) =>
    canonicalBoqItem(source, item, diagnostics),
  );
  return { items, diagnostics };
}
