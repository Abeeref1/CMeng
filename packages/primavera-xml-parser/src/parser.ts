import { XMLParser } from "fast-xml-parser";
import { parseStrictNumeric } from "../../boq-parser/src/numeric";
import {
  parseP6ApiDuration,
  parseScheduleDate,
} from "../../schedule-values/src";
import { sourceColumnAuditEntry } from "../../truth-kernel/src/register-schema";
import type {
  PrimaveraXmlActivity,
  PrimaveraXmlProject,
  PrimaveraXmlRelationship,
  PrimaveraXmlResult,
} from "./types";

/** P6 XML business-object elements CMeng collects; each is audited as its own table. */
export const P6_XML_ELEMENTS: Record<string, string> = {
  project: "Project", wbs: "WBS", calendar: "Calendar", activity: "Activity", relationship: "Relationship",
  resource: "Resource", resourceassignment: "ResourceAssignment", costaccount: "CostAccount",
};

type AnyObject = Record<string, unknown>;

function isObject(value: unknown): value is AnyObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function arr<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function keyNorm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Field names the reader asks for while one element type is read
// (shared R1 unused-column report).
let fieldNamesRead: Set<string> | null = null;

/** Every field of every collected element type except Activity (audited by
 * the schedule adapter, which also reads Activity fields): read, or unused
 * with its first scalar value. Child elements that are collected element
 * types are audited as their own table, not as a field. */
function elementColumnAudit(found: Map<string, AnyObject[]>, reads: Map<string, Set<string>>) {
  return Object.entries(P6_XML_ELEMENTS).filter(([key]) => key !== "activity").flatMap(([key, table]) => {
    const samples = new Map<string, string | null>();
    for (const obj of found.get(key) ?? []) for (const [name, value] of Object.entries(obj)) {
      if (P6_XML_ELEMENTS[keyNorm(name)]) continue;
      const sample = typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value).trim() || null : null;
      if (!samples.has(name) || (samples.get(name) === null && sample !== null)) samples.set(name, sample);
    }
    return [...samples].map(([name, sample]) => ({table, ...sourceColumnAuditEntry(name, name, "other", reads.get(key)?.has(keyNorm(name)) ?? false,
      "Read by the P6 XML reader.", sample)}));
  });
}
function field(obj: AnyObject, names: string[]): string | null {
  if (fieldNamesRead) for (const name of names) fieldNamesRead.add(keyNorm(name));
  const wanted = new Set(names.map(keyNorm));
  for (const [key, value] of Object.entries(obj)) {
    if (!wanted.has(keyNorm(key))) continue;
    if (
      value === null ||
      value === undefined ||
      (typeof value !== "string" &&
        typeof value !== "number" &&
        typeof value !== "boolean")
    ) {
      continue;
    }
    const text = String(value).trim();
    return text || null;
  }
  return null;
}

function numeric(
  obj: AnyObject,
  names: string[],
  diagnostics: string[],
  code: string,
): number | null {
  const raw = field(obj, names);
  if (raw === null) return null;
  const parsed = parseStrictNumeric(raw);
  if (parsed.status === "valid") return parsed.value;
  diagnostics.push(code + "_" + parsed.status.toUpperCase());
  return null;
}

function durationField(
  obj: AnyObject,
  explicitHourNames: string[],
  apiDurationNames: string[],
  diagnostics: string[],
  code: string,
): { raw: string | null; hours: number | null } {
  const explicit = field(obj, explicitHourNames);
  if (explicit !== null) {
    const parsed = parseStrictNumeric(explicit);
    if (parsed.status === "valid") {
      return { raw: explicit, hours: parsed.value };
    }
    diagnostics.push(code + "_" + parsed.status.toUpperCase());
    return { raw: explicit, hours: null };
  }

  const raw = field(obj, apiDurationNames);
  if (raw === null) return { raw: null, hours: null };

  const parsed = parseP6ApiDuration(raw);
  if (parsed.status !== "valid") {
    diagnostics.push(code + "_" + parsed.status.toUpperCase());
  }
  return { raw, hours: parsed.hours };
}

function dateField(
  obj: AnyObject,
  names: string[],
  diagnostics: string[],
  code: string,
): { raw: string | null; iso: string | null } {
  const raw = field(obj, names);
  if (raw === null) return { raw: null, iso: null };
  const parsed = parseScheduleDate(raw);
  if (parsed.status !== "valid") {
    diagnostics.push(code + "_" + parsed.status.toUpperCase());
  }
  return { raw, iso: parsed.iso };
}

function collectByLocalName(
  root: unknown,
  names: Set<string>,
  out: Map<string, AnyObject[]>,
): void {
  if (Array.isArray(root)) {
    for (const item of root) collectByLocalName(item, names, out);
    return;
  }
  if (!isObject(root)) return;

  for (const [key, value] of Object.entries(root)) {
    const normalized = keyNorm(key);
    if (names.has(normalized)) {
      for (const item of arr(value as AnyObject | AnyObject[] | undefined)) {
        if (!isObject(item)) continue;
        const list = out.get(normalized) ?? [];
        list.push(item);
        out.set(normalized, list);
      }
    }
    collectByLocalName(value, names, out);
  }
}

function duplicateKeys<T>(
  items: readonly T[],
  keyOf: (item: T) => string | null,
): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of items) {
    const key = keyOf(item);
    if (!key) continue;
    if (seen.has(key)) duplicates.add(key);
    else seen.add(key);
  }

  return [...duplicates].sort();
}

export function parsePrimaveraXml(bytes: Uint8Array): PrimaveraXmlResult {
  fieldNamesRead = null;
  const diagnostics: string[] = [];
  let parsed: unknown;

  try {
    const source = new TextDecoder("utf-8", { fatal: false })
      .decode(bytes)
      .replace(/^\uFEFF/, "");

    if (source.includes("\uFFFD")) {
      diagnostics.push("P6XML_UTF8_REPLACEMENT_CHARACTER_PRESENT");
    }

    parsed = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      removeNSPrefix: true,
      parseTagValue: false,
      parseAttributeValue: false,
      trimValues: true,
    }).parse(source);
  } catch (error) {
    return {
      projects: [],
      activities: [],
      relationships: [],
      calendarsSeen: 0,
      wbsSeen: 0,
      activityCount: 0,
      unresolvedActivities: 0,
      relationshipCount: 0,
      unresolvedRelationships: 0,
      externalRelationships: 0,
      missingWbsReferences: [],
      missingCalendarReferences: [],
      coveragePercent: null,
      complete: false,
      sourceComplete: false,
      graphComplete: false,
      diagnostics: [
        "P6XML_PARSE_ERROR:" +
          (error instanceof Error ? error.message : String(error)),
      ],
    };
  }

  const found = new Map<string, AnyObject[]>();
  collectByLocalName(
    parsed,
    new Set(Object.keys(P6_XML_ELEMENTS)),
    found,
  );
  const reads = new Map<string, Set<string>>();
  const readsFor = (element: string) => { let set = reads.get(element); if (!set) reads.set(element, set = new Set()); return set; };

  fieldNamesRead = readsFor("project");
  const projects: PrimaveraXmlProject[] = (found.get("project") ?? []).map(
    (obj) => ({
      objectId: field(obj, ["ObjectId", "ProjectObjectId"]),
      id: field(obj, ["Id", "ProjectId", "ProjectCode"]),
      name: field(obj, ["Name", "ProjectName"]),
      dataDate: field(obj, ["DataDate"]),
      scheduledFinishDate: field(obj, ["ScheduledFinishDate"]),
      mustFinishByDate: field(obj, ["MustFinishByDate"]),
    }),
  );

  const projectObjects = new Set(
    projects
      .map((project) => project.objectId)
      .filter((value): value is string => !!value),
  );

  fieldNamesRead = readsFor("wbs");
  const wbsObjects = new Set(
    (found.get("wbs") ?? [])
      .map((obj) => field(obj, ["ObjectId", "WBSObjectId", "WbsObjectId"]))
      .filter((value): value is string => !!value),
  );

  fieldNamesRead = readsFor("calendar");
  const calendarObjects = new Set(
    (found.get("calendar") ?? [])
      .map((obj) => field(obj, ["ObjectId", "CalendarObjectId"]))
      .filter((value): value is string => !!value),
  );

  const missingWbsReferences = new Set<string>();
  const missingCalendarReferences = new Set<string>();

  const activityFieldsRead = readsFor("activity");
  fieldNamesRead = activityFieldsRead;
  let activities: PrimaveraXmlActivity[];
  try { activities = (
    found.get("activity") ?? []
  ).map((obj) => {
    const rowDiagnostics: string[] = [];

    const start = dateField(
      obj,
      ["StartDate", "Start"],
      rowDiagnostics,
      "P6XML_START_DATE",
    );
    const finish = dateField(
      obj,
      ["FinishDate", "Finish"],
      rowDiagnostics,
      "P6XML_FINISH_DATE",
    );
    const originalDuration = durationField(
      obj,
      ["OriginalDurationHours", "PlannedDurationHours"],
      ["OriginalDuration", "PlannedDuration"],
      rowDiagnostics,
      "P6XML_ORIGINAL_DURATION",
    );
    const remainingDuration = durationField(
      obj,
      ["RemainingDurationHours"],
      ["RemainingDuration"],
      rowDiagnostics,
      "P6XML_REMAINING_DURATION",
    );
    const totalFloat = durationField(
      obj,
      ["TotalFloatHours"],
      ["TotalFloat"],
      rowDiagnostics,
      "P6XML_TOTAL_FLOAT",
    );

    const wbsObjectId = field(obj, ["WBSObjectId", "WbsObjectId"]);
    const calendarObjectId = field(obj, ["CalendarObjectId"]);

    if (wbsObjectId && !wbsObjects.has(wbsObjectId)) {
      missingWbsReferences.add(wbsObjectId);
      rowDiagnostics.push("P6XML_WBS_REFERENCE_UNRESOLVED");
    }

    if (calendarObjectId && !calendarObjects.has(calendarObjectId)) {
      missingCalendarReferences.add(calendarObjectId);
      rowDiagnostics.push("P6XML_CALENDAR_REFERENCE_UNRESOLVED");
    }

    const activity: PrimaveraXmlActivity = {
      projectObjectId: field(obj, [
        "ProjectObjectId",
        "ProjectObjectID",
      ]),
      objectId: field(obj, [
        "ObjectId",
        "ActivityObjectId",
        "TaskObjectId",
      ]),
      id: field(obj, ["Id", "ActivityId", "ActivityID", "TaskId"]),
      name: field(obj, ["Name", "ActivityName", "TaskName"]),
      wbsObjectId,
      calendarObjectId,
      startDate: start.raw,
      startDateIso: start.iso,
      finishDate: finish.raw,
      finishDateIso: finish.iso,
      originalDurationRaw: originalDuration.raw,
      originalDurationHours: originalDuration.hours,
      remainingDurationRaw: remainingDuration.raw,
      remainingDurationHours: remainingDuration.hours,
      totalFloatRaw: totalFloat.raw,
      totalFloatHours: totalFloat.hours,
      raw: obj,
      status: "verified",
      diagnostics: rowDiagnostics,
    };

    if (!activity.objectId && !activity.id) {
      rowDiagnostics.push("P6XML_ACTIVITY_IDENTITY_MISSING");
    }

    activity.status =
      rowDiagnostics.length === 0 ? "verified" : "unresolved";
    return activity;
  }); } finally { fieldNamesRead = null; }

  const activityObjectIds = new Set(
    activities
      .map((activity) => activity.objectId)
      .filter((value): value is string => !!value),
  );

  fieldNamesRead = readsFor("relationship");
  const relationships: PrimaveraXmlRelationship[] = (
    found.get("relationship") ?? []
  ).map((obj) => {
    const rowDiagnostics: string[] = [];

    const predecessorProjectObjectId = field(obj, [
      "PredecessorProjectObjectId",
      "PredecessorProjectObjectID",
    ]);
    const successorProjectObjectId = field(obj, [
      "SuccessorProjectObjectId",
      "SuccessorProjectObjectID",
    ]);
    const predecessorActivityObjectId = field(obj, [
      "PredecessorActivityObjectId",
      "PredecessorActivityObjectID",
      "PredecessorObjectId",
    ]);
    const successorActivityObjectId = field(obj, [
      "SuccessorActivityObjectId",
      "SuccessorActivityObjectID",
      "SuccessorObjectId",
    ]);

    const external =
      !!predecessorProjectObjectId &&
      !projectObjects.has(predecessorProjectObjectId);

    if (!predecessorActivityObjectId) {
      rowDiagnostics.push("P6XML_PREDECESSOR_ACTIVITY_MISSING");
    }
    if (!successorActivityObjectId) {
      rowDiagnostics.push("P6XML_SUCCESSOR_ACTIVITY_MISSING");
    }

    if (
      predecessorActivityObjectId &&
      !external &&
      !activityObjectIds.has(predecessorActivityObjectId)
    ) {
      rowDiagnostics.push("P6XML_PREDECESSOR_REFERENCE_UNRESOLVED");
    }

    if (
      successorActivityObjectId &&
      !activityObjectIds.has(successorActivityObjectId)
    ) {
      rowDiagnostics.push("P6XML_SUCCESSOR_REFERENCE_UNRESOLVED");
    }

    return {
      predecessorProjectObjectId,
      successorProjectObjectId,
      predecessorActivityObjectId,
      successorActivityObjectId,
      type: field(obj, ["Type", "RelationshipType"]),
      lagRaw:
        field(obj, ["LagHours"]) ??
        field(obj, ["Lag"]),
      lagHours: durationField(
        obj,
        ["LagHours"],
        ["Lag"],
        rowDiagnostics,
        "P6XML_LAG",
      ).hours,
      external,
      status:
        rowDiagnostics.length === 0 ? "verified" : "unresolved",
      diagnostics: rowDiagnostics,
    };
  });

  // WBS hierarchy, resources, cost accounts and resource assignments as the
  // file states them (exact ObjectId references; nothing is guessed).
  fieldNamesRead = readsFor("wbs");
  const wbsNodes = (found.get("wbs") ?? []).map((obj) => ({
    objectId: field(obj, ["ObjectId", "WBSObjectId", "WbsObjectId"]),
    parentObjectId: field(obj, ["ParentObjectId", "ParentWBSObjectId"]),
    code: field(obj, ["Code"]),
    name: field(obj, ["Name"]),
  }));
  fieldNamesRead = readsFor("resource");
  const resources = (found.get("resource") ?? []).map((obj) => ({
    objectId: field(obj, ["ObjectId", "ResourceObjectId"]), id: field(obj, ["Id", "ResourceId"]), name: field(obj, ["Name", "ResourceName"]),
  }));
  fieldNamesRead = readsFor("costaccount");
  const costAccounts = (found.get("costaccount") ?? []).map((obj) => ({
    objectId: field(obj, ["ObjectId", "CostAccountObjectId"]), id: field(obj, ["Id", "CostAccountId"]), name: field(obj, ["Name", "CostAccountName"]),
  }));
  fieldNamesRead = readsFor("resourceassignment");
  const resourceAssignments = (found.get("resourceassignment") ?? []).map((obj) => ({
    activityObjectId: field(obj, ["ActivityObjectId"]),
    resourceObjectId: field(obj, ["ResourceObjectId"]),
    costAccountObjectId: field(obj, ["CostAccountObjectId"]),
  }));
  fieldNamesRead = null;
  const columnAudit = elementColumnAudit(found, reads);

  const duplicateActivityIdentities = duplicateKeys(activities, (activity) => {
    const project = activity.projectObjectId ?? "?";
    if (activity.objectId) {
      return project + "::OID::" + activity.objectId;
    }
    if (activity.id) {
      return project + "::ID::" + activity.id;
    }
    return null;
  });

  if (duplicateActivityIdentities.length > 0) {
    diagnostics.push(
      "P6XML_DUPLICATE_ACTIVITY_IDENTITIES:" +
        duplicateActivityIdentities.join(","),
    );
  }

  const unresolvedActivities = activities.filter(
    (activity) => activity.status === "unresolved",
  ).length;
  const unresolvedRelationships = relationships.filter(
    (relationship) => relationship.status === "unresolved",
  ).length;
  const externalRelationships = relationships.filter(
    (relationship) => relationship.external,
  ).length;

  const total = activities.length + relationships.length;
  const verified =
    total - unresolvedActivities - unresolvedRelationships;

  if (activities.length === 0) {
    diagnostics.push("P6XML_NO_ACTIVITIES_FOUND");
  }

  const sourceComplete =
    activities.length > 0 &&
    unresolvedActivities === 0 &&
    unresolvedRelationships === 0 &&
    duplicateActivityIdentities.length === 0 &&
    !diagnostics.some((code) =>
      code.startsWith("P6XML_PARSE_ERROR"),
    );

  const graphComplete =
    sourceComplete && externalRelationships === 0;

  return {
    projects,
    activities,
    activityFieldsRead: [...activityFieldsRead].sort(),
    wbsNodes,
    resources,
    costAccounts,
    resourceAssignments,
    columnAudit,
    relationships,
    calendarsSeen: (found.get("calendar") ?? []).length,
    wbsSeen: (found.get("wbs") ?? []).length,
    activityCount: activities.length,
    unresolvedActivities,
    relationshipCount: relationships.length,
    unresolvedRelationships,
    externalRelationships,
    missingWbsReferences: [...missingWbsReferences].sort(),
    missingCalendarReferences: [...missingCalendarReferences].sort(),
    coveragePercent:
      total === 0
        ? null
        : Number(((verified / total) * 100).toFixed(4)),
    complete: graphComplete,
    sourceComplete,
    graphComplete,
    diagnostics,
  };
}
