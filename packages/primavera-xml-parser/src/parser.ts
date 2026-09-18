import { XMLParser } from "fast-xml-parser";
import { parseStrictNumeric } from "../../boq-parser/src/numeric";
import {
  parseP6ApiDuration,
  parseScheduleDate,
} from "../../schedule-values/src";
import type {
  PrimaveraXmlActivity,
  PrimaveraXmlProject,
  PrimaveraXmlRelationship,
  PrimaveraXmlResult,
} from "./types";

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

function field(obj: AnyObject, names: string[]): string | null {
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
    new Set(["project", "activity", "relationship", "calendar", "wbs"]),
    found,
  );

  const projects: PrimaveraXmlProject[] = (found.get("project") ?? []).map(
    (obj) => ({
      objectId: field(obj, ["ObjectId", "ProjectObjectId"]),
      id: field(obj, ["Id", "ProjectId", "ProjectCode"]),
      name: field(obj, ["Name", "ProjectName"]),
    }),
  );

  const projectObjects = new Set(
    projects
      .map((project) => project.objectId)
      .filter((value): value is string => !!value),
  );

  const wbsObjects = new Set(
    (found.get("wbs") ?? [])
      .map((obj) => field(obj, ["ObjectId", "WBSObjectId", "WbsObjectId"]))
      .filter((value): value is string => !!value),
  );

  const calendarObjects = new Set(
    (found.get("calendar") ?? [])
      .map((obj) => field(obj, ["ObjectId", "CalendarObjectId"]))
      .filter((value): value is string => !!value),
  );

  const missingWbsReferences = new Set<string>();
  const missingCalendarReferences = new Set<string>();

  const activities: PrimaveraXmlActivity[] = (
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
  });

  const activityObjectIds = new Set(
    activities
      .map((activity) => activity.objectId)
      .filter((value): value is string => !!value),
  );

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
