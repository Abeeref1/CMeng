import type { P6CalendarDataResult } from "../../xer-parser/src/calendar-data";

export interface PrimaveraXmlProject {
  objectId: string | null;
  id: string | null;
  name: string | null;
  /** Raw P6 XML Project.DataDate text, when present. */
  dataDate?: string | null;
  /** Raw P6 XML Project.ScheduledFinishDate text (finish computed by P6). */
  scheduledFinishDate?: string | null;
  /** Raw P6 XML Project.MustFinishByDate text (declared finish, XER plan_end_date). */
  mustFinishByDate?: string | null;
  /** P6 XML Project.ActivityDefaultCalendarObjectId: the project's default activity calendar. */
  activityDefaultCalendarObjectId?: string | null;
}

/** One P6 XML Calendar element. Its working time (StandardWorkWeek and
 * HolidayOrExceptions) is read into the same P6 calendar model as XER
 * clndr_data; null when the element states neither. */
export interface PrimaveraXmlCalendar {
  objectId: string | null;
  name: string | null;
  baseCalendarObjectId: string | null;
  hoursPerDayRaw: string | null;
  hoursPerWeekRaw: string | null;
  data: P6CalendarDataResult | null;
}

export interface PrimaveraXmlActivity {
  projectObjectId: string | null;
  objectId: string | null;
  id: string | null;
  name: string | null;
  wbsObjectId: string | null;
  calendarObjectId: string | null;
  startDate: string | null;
  startDateIso: string | null;
  finishDate: string | null;
  finishDateIso: string | null;
  originalDurationRaw: string | null;
  originalDurationHours: number | null;
  remainingDurationRaw: string | null;
  remainingDurationHours: number | null;
  totalFloatRaw: string | null;
  totalFloatHours: number | null;
  raw: Record<string, unknown>;
  status: "verified" | "unresolved";
  diagnostics: string[];
}

export interface PrimaveraXmlRelationship {
  predecessorProjectObjectId: string | null;
  successorProjectObjectId: string | null;
  predecessorActivityObjectId: string | null;
  successorActivityObjectId: string | null;
  type: string | null;
  lagRaw: string | null;
  lagHours: number | null;
  external: boolean;
  status: "verified" | "unresolved";
  diagnostics: string[];
}

export interface PrimaveraXmlResult {
  projects: PrimaveraXmlProject[];
  activities: PrimaveraXmlActivity[];
  /** Normalised Activity field names the reader reads (shared R1 unused-column report). */
  activityFieldsRead?: string[];
  /** WBS nodes, resources, cost accounts and resource assignments as stated in the file (exact ObjectIds). */
  wbsNodes?: Array<{objectId:string|null;parentObjectId:string|null;code:string|null;name:string|null}>;
  resources?: Array<{objectId:string|null;id:string|null;name:string|null}>;
  costAccounts?: Array<{objectId:string|null;id:string|null;name:string|null}>;
  resourceAssignments?: Array<{activityObjectId:string|null;resourceObjectId:string|null;costAccountObjectId:string|null}>;
  /** Fields of every collected element except Activity: read, or unused with a sample (shared R1 report). */
  columnAudit?: Array<{table:string;sourceHeader:string;canonicalHeader:string;kind:string;mappingState:'schema_recognized'|'unused';reason:string;sample?:string|null}>;
  relationships: PrimaveraXmlRelationship[];
  /** Calendar elements with their working time (additive). */
  calendars?: PrimaveraXmlCalendar[];
  calendarsSeen: number;
  wbsSeen: number;
  activityCount: number;
  unresolvedActivities: number;
  relationshipCount: number;
  unresolvedRelationships: number;
  externalRelationships: number;
  missingWbsReferences: string[];
  missingCalendarReferences: string[];
  coveragePercent: number | null;
  complete: boolean;
  sourceComplete: boolean;
  graphComplete: boolean;
  diagnostics: string[];
}
