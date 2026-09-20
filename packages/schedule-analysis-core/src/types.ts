export type CanonicalScheduleSource =
  | "xer"
  | "primavera_xml"
  | "schedule_csv"
  | "schedule_xlsx";

export type CanonicalActivityStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "unknown";

export type CanonicalRelationshipType =
  | "FS"
  | "SS"
  | "FF"
  | "SF"
  | "unknown";

export type CanonicalActivityType =
  | "task"
  | "start_milestone"
  | "finish_milestone"
  | "milestone"
  | "level_of_effort"
  | "wbs_summary"
  | "unknown";

export interface ScheduleSourceRef {
  source: CanonicalScheduleSource;
  locator: string;
}

export interface CanonicalWbsNode {
  wbsId: string;
  parentWbsId: string | null;
  name: string | null;
  sourceRefs: ScheduleSourceRef[];
}

export interface CanonicalCalendarException {
  isoDate: string;
  nonWorking: boolean;
  workIntervals: Array<{
    start: string;
    finish: string;
    minutes: number;
  }>;
}

export interface CanonicalCalendar {
  calendarId: string;
  name: string | null;
  semanticComplete: boolean;
  weeklyWorkMinutes?: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  weeklyWorkIntervals?: Array<{
    dayIndex: number;
    intervals: Array<{
      start: string;
      finish: string;
      minutes: number;
    }>;
  }>;
  exceptions?: CanonicalCalendarException[];
  standardDayHours?: number | null;
  standardWeekHours?: number | null;
  sourceRefs: ScheduleSourceRef[];
}

export interface CanonicalScheduleActivity {
  projectId: string | null;
  activityId: string;
  nativeId: string | null;
  name: string | null;
  wbsId: string | null;
  calendarId: string | null;
  activityType: CanonicalActivityType;
  status: CanonicalActivityStatus;

  baselineStartIso: string | null;
  baselineFinishIso: string | null;
  currentStartIso: string | null;
  currentFinishIso: string | null;
  actualStartIso: string | null;
  actualFinishIso: string | null;
  forecastStartIso: string | null;
  forecastFinishIso: string | null;

  originalDurationHours: number | null;
  remainingDurationHours: number | null;
  totalFloatHours: number | null;
  freeFloatHours: number | null;

  originalDurationRaw?: string | null;
  originalDurationUnit?:
    | "hours"
    | "days"
    | "weeks"
    | "minutes"
    | "unknown";
  remainingDurationRaw?: string | null;
  remainingDurationUnit?:
    | "hours"
    | "days"
    | "weeks"
    | "minutes"
    | "unknown";
  percentComplete: number | null;

  sourceRefs: ScheduleSourceRef[];
  diagnostics: string[];
}

export interface CanonicalScheduleRelationship {
  relationshipId: string;
  predecessorActivityId: string;
  successorActivityId: string;
  type: CanonicalRelationshipType;
  lagHours: number | null;
  external: boolean;
  sourceRefs: ScheduleSourceRef[];
  diagnostics: string[];
}

export interface CanonicalScheduleModel {
  projectId: string | null;
  source: CanonicalScheduleSource;
  sourceRevisionId: string;
  dataDateIso: string | null;
  activities: CanonicalScheduleActivity[];
  relationships: CanonicalScheduleRelationship[];
  wbs: CanonicalWbsNode[];
  calendars: CanonicalCalendar[];
  diagnostics: string[];
}

export interface ScheduleGraphNode {
  activityId: string;
  predecessorIds: string[];
  successorIds: string[];
}

export interface ScheduleGraphComponent {
  componentId: number;
  activityIds: string[];
}

export interface ScheduleGraphAnalysis {
  activityCount: number;
  relationshipCount: number;
  internalRelationshipCount: number;
  externalRelationshipCount: number;

  duplicateActivityIds: string[];
  duplicateRelationshipKeys: string[];
  brokenPredecessorActivityIds: string[];
  brokenSuccessorActivityIds: string[];
  selfLoops: string[];
  cyclicActivityIds: string[];
  acyclic: boolean;

  openStartActivityIds: string[];
  openFinishActivityIds: string[];
  isolatedActivityIds: string[];

  logicDensity: number | null;
  connectedComponentCount: number;
  components: ScheduleGraphComponent[];
  topologicalOrder: string[] | null;
  complete: boolean;
  diagnostics: string[];
}

export interface ScheduleAnalysisConfig {
  criticalFloatThresholdHours: number;
  nearCriticalFloatThresholdHours: number;
  /**
   * When established from the project control basis, near-criticality is
   * evaluated as working days using each activity's own calendar. This takes
   * precedence over the legacy elapsed-hour threshold.
   */
  nearCriticalWorkingDays?: number | null;
  /**
   * Management watchlist convention only. Criticality remains mutually
   * exclusive and governed by criticalFloatThresholdHours. When true, the
   * float-risk watchlist includes activities exactly on the critical boundary
   * (for example TF = 0) in addition to strict near-critical activities.
   */
  floatRiskWatchlistIncludesCriticalThreshold?: boolean;
  varianceLateThresholdDays: number;
}

export const DEFAULT_SCHEDULE_ANALYSIS_CONFIG: ScheduleAnalysisConfig = {
  criticalFloatThresholdHours: 0,
  nearCriticalFloatThresholdHours: 40,
  nearCriticalWorkingDays: null,
  floatRiskWatchlistIncludesCriticalThreshold: false,
  varianceLateThresholdDays: 0,
};

export interface PopulationMetric {
  value: number;
  denominator: number;
  coveragePercent: number | null;
}

export interface AverageMetric {
  value: number | null;
  knownCount: number;
  totalCount: number;
  coveragePercent: number | null;
}

export interface ActivityStatusSummary {
  completed: number;
  inProgress: number;
  notStarted: number;
  unknown: number;
}

export interface FloatSummary {
  criticalCount: number;
  nearCriticalCount: number;
  floatRiskWatchlistCount: number;
  zeroFloatCount: number;
  negativeFloatCount: number;
  positiveFloatCount: number;
  unknownFloatCount: number;
  knownFloatCount: number;
  totalActivities: number;
  coveragePercent: number | null;
  criticalThresholdHours: number;
  nearCriticalThresholdHours: number | null;
  nearCriticalWorkingDays: number | null;
  nearCriticalThresholdBasis:
    | "elapsed_hours"
    | "activity_working_days";
  floatRiskWatchlistIncludesCriticalThreshold: boolean;
  nearCriticalThresholdUnresolvedCount: number;
}

export interface MilestoneSummary {
  milestoneActivityIds: string[];
  completedMilestones: string[];
  openMilestones: string[];
  inferredFromZeroDurationIds: string[];
}

export interface VarianceSummary {
  method: string;
  comparableActivities: number;
  lateActivities: number;
  earlyActivities: number;
  onTimeActivities: number;
  unknownActivities: number;
  averageFinishVarianceDays: number | null;
  maximumDelayDays: number | null;
  coveragePercent: number | null;
}

export interface ProgressSummary {
  status: ActivityStatusSummary;
  percentCompleteAverage: AverageMetric;
  durationWeightedPercentComplete: AverageMetric;
}

export interface CompletionBasisValue {
  basis:
    | "programme"
    | "forecast"
    | "actual";
  dateIso: string | null;
  activityId: string | null;
  state: "available" | "partial" | "missing";
  coveragePercent: number | null;
  method: string;
  sourceRefs: string[];
}

export interface ScheduleAnalyticsResult {
  projectId: string | null;
  sourceRevisionId: string;
  dataDateIso: string | null;

  graph: ScheduleGraphAnalysis;
  status: ActivityStatusSummary;
  progress: ProgressSummary;
  float: FloatSummary;
  milestones: MilestoneSummary;
  finishVariance: VarianceSummary;
  completionBases: CompletionBasisValue[];

  activityCount: number;
  relationshipCount: number;
  wbsCount: number;
  calendarCount: number;

  diagnostics: string[];
  complete: boolean;
}


export interface ActivityLogicIndexEntry {
  activityId: string;
  predecessorIds: string[];
  successorIds: string[];
  incomingRelationshipIds: string[];
  outgoingRelationshipIds: string[];
}

export interface ScheduleActivityLogicIndex {
  byActivityId: Record<string, ActivityLogicIndexEntry>;
  brokenRelationshipIds: string[];
}
