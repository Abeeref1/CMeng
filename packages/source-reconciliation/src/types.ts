export interface ScheduleCanonicalActivity {
  source: string;
  projectId: string | null;
  activityId: string;
  name: string | null;
  wbsRef: string | null;
  calendarRef: string | null;
  startIso: string | null;
  finishIso: string | null;
  originalDurationHours: number | null;
  remainingDurationHours: number | null;
  totalFloatHours: number | null;
}

export interface BoqCanonicalItem {
  source: string;
  itemNumber: string;
  description: string | null;
  unit: string | null;
  quantity: number | null;
  rate: number | null;
  amount: number | null;
}

export interface ReconciliationMismatch {
  key: string;
  field: string;
  left: string | number | null;
  right: string | number | null;
}

export interface ReconciliationResult {
  leftSource: string;
  rightSource: string;
  leftCount: number;
  rightCount: number;
  matchedCount: number;
  leftOnlyKeys: string[];
  rightOnlyKeys: string[];
  duplicateLeftKeys: string[];
  duplicateRightKeys: string[];
  mismatches: ReconciliationMismatch[];
  populationCoveragePercent: number | null;
  completeMatch: boolean;
  authoritative: boolean;
  diagnostics: string[];
}
