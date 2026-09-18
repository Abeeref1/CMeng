import type {
  CanonicalActivityStatus,
  CanonicalActivityType,
} from "../../schedule-analysis-core/src";

export interface MilestoneRow {
  activityId: string;
  name: string | null;
  wbsId: string | null;
  activityType: CanonicalActivityType;
  status: CanonicalActivityStatus;
  baselineDateIso: string | null;
  currentDateIso: string | null;
  actualDateIso: string | null;
  totalFloatHours: number | null;
  varianceDays: number | null;
  daysFromDataDate: number | null;
}

export interface MilestonesProjection {
  schemaVersion: "1.0";
  projectionKey: "milestones";
  generatedAt: string;
  producerVersion: string;
  projectId: string | null;
  sourceRevisionId: string;
  dataDateIso: string | null;
  milestoneCount: number;
  completedCount: number;
  openCount: number;
  lateOpenCount: number;
  rows: MilestoneRow[];
}
