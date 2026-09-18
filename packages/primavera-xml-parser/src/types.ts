export interface PrimaveraXmlProject {
  objectId: string | null;
  id: string | null;
  name: string | null;
}

export interface PrimaveraXmlActivity {
  projectObjectId: string | null;
  objectId: string | null;
  id: string | null;
  name: string | null;
  wbsObjectId: string | null;
  calendarObjectId: string | null;
  startDate: string | null;
  finishDate: string | null;
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
  relationships: PrimaveraXmlRelationship[];
  calendarsSeen: number;
  wbsSeen: number;
  activityCount: number;
  unresolvedActivities: number;
  relationshipCount: number;
  unresolvedRelationships: number;
  externalRelationships: number;
  coveragePercent: number | null;
  complete: boolean;
  sourceComplete: boolean;
  graphComplete: boolean;
  diagnostics: string[];
}
