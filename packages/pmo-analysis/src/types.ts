export interface PmoSourceProjectionRef {
  projectionKey: string;
  producerVersion: string;
}

export interface PmoAnalysisProjection {
  schemaVersion: "1.0";
  projectionKey: "pmo_analysis";
  generatedAt: string;
  producerVersion: string;
  projectId: string | null;
  evidenceRevisionId: string;

  sourceProjections: PmoSourceProjectionRef[];

  schedule: {
    activityCount: number;
    relationshipCount: number;
    graphComplete: boolean;
    criticalCount: number;
    nearCriticalCount: number;
    negativeFloatCount: number;
    logicDensity: number | null;
  };

  progress: {
    durationWeightedProgressPercent: number | null;
    progressCoveragePercent: number | null;
    completedCount: number;
    inProgressCount: number;
    lookAheadOverdueCount: number;
    lateMilestoneCount: number;
  };

  forecast: {
    sourceCompletionIso: string | null;
    independentCompletionIso: string | null;
    varianceDays: number | null;
    origin: string;
    complete: boolean;
  };

  resources: {
    assignedResourceCount: number;
    capacityCoveragePercent: number | null;
    overloadedResourceCount: number;
    laborHoursActualKnown: number;
    laborActualCoveragePercent: number | null;
  };

  quantities: {
    allocationState: string;
    unitSeriesCount: number;
    unmappedItemCount: number;
    overAllocatedItemCount: number;
  };

  contract: {
    physicalComplete: boolean;
    semanticComplete: boolean;
    challengeSignalCount: number;
    noticeRequirementCandidateCount: number;
  };

  claims: {
    eventCount: number;
    claimCount: number;
    timelyNoticeCount: number;
    lateNoticeCount: number;
    observedPositiveMovementDays: number;
    candidateAdditionalEotDays: number;
    officialApprovedEotDays: number | null;
    officialAdjustedCompletionIso: string | null;
    scenarioAdjustedCompletionIso: string | null;
  };

  revision: {
    revisionCount: number;
    latestAddedActivityCount: number | null;
    latestRemovedActivityCount: number | null;
    latestModifiedActivityCount: number | null;
  };

  diagnostics: string[];
}
