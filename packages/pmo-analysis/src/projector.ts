import type {
  ScheduleAnalyticsProjection,
} from "../../schedule-analytics/src";
import type {
  ProgressReportProjection,
} from "../../progress-report/src";
import type {
  RevisionTrendProjection,
} from "../../revision-trend/src";
import type {
  ResourceUtilizationProjection,
} from "../../resource-utilization/src";
import type {
  ManhourScurveProjection,
} from "../../manhour-scurve/src";
import type {
  QuantityScurveProjection,
} from "../../quantity-scurve/src";
import type {
  IndependentForecastProjection,
} from "../../independent-forecast/src";
import type {
  ChallengeContractProjection,
} from "../../challenge-contract/src";
import type {
  NoticesClaimsProjection,
} from "../../notices-claims/src";
import type {
  DelayClaimsProjection,
} from "../../delay-claims/src";
import type {
  EotAssessmentProjection,
} from "../../eot-assessment/src";
import type {
  PmoAnalysisProjection,
  PmoSourceProjectionRef,
} from "./types";

export function buildPmoAnalysisProjection(
  input: {
    generatedAt: string;
    producerVersion: string;
    evidenceRevisionId: string;
    scheduleAnalytics: ScheduleAnalyticsProjection;
    progressReport: ProgressReportProjection;
    revisionTrend: RevisionTrendProjection;
    resourceUtilization: ResourceUtilizationProjection;
    manhourScurve: ManhourScurveProjection;
    quantityScurve: QuantityScurveProjection;
    independentForecast: IndependentForecastProjection;
    challengeContract: ChallengeContractProjection;
    noticesClaims: NoticesClaimsProjection;
    delayClaims: DelayClaimsProjection;
    eotAssessment: EotAssessmentProjection;
  },
): PmoAnalysisProjection {
  const refs: PmoSourceProjectionRef[] = [
    ["schedule_analytics", input.scheduleAnalytics.producerVersion],
    ["progress_report", input.progressReport.producerVersion],
    ["revision_trend", input.revisionTrend.producerVersion],
    ["resource_utilization", input.resourceUtilization.producerVersion],
    ["manhour_scurve", input.manhourScurve.producerVersion],
    ["quantity_scurve", input.quantityScurve.producerVersion],
    ["independent_forecast", input.independentForecast.producerVersion],
    ["challenge_contract", input.challengeContract.producerVersion],
    ["notices_claims", input.noticesClaims.producerVersion],
    ["delay_claims", input.delayClaims.producerVersion],
    ["eot_assessment", input.eotAssessment.producerVersion],
  ].map(([projectionKey, producerVersion]) => ({
    projectionKey,
    producerVersion,
  }));

  const schedule =
    input.scheduleAnalytics.result;
  const latestRevision =
    input.revisionTrend.points[
      input.revisionTrend.points.length - 1
    ] ?? null;

  return {
    schemaVersion: "1.0",
    projectionKey: "pmo_analysis",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    projectId: schedule.projectId,
    evidenceRevisionId:
      input.evidenceRevisionId,

    sourceProjections: refs,

    schedule: {
      activityCount: schedule.activityCount,
      relationshipCount:
        schedule.relationshipCount,
      graphComplete:
        schedule.graph.complete,
      criticalCount:
        schedule.float.criticalCount,
      nearCriticalCount:
        schedule.float.nearCriticalCount,
      negativeFloatCount:
        schedule.float.negativeFloatCount,
      logicDensity:
        schedule.graph.logicDensity,
    },

    progress: {
      durationWeightedProgressPercent:
        input.progressReport.progress
          .durationWeightedProgressPercent,
      progressCoveragePercent:
        input.progressReport.progress
          .durationWeightedProgressCoveragePercent,
      completedCount:
        input.progressReport.progress.completedCount,
      inProgressCount:
        input.progressReport.progress.inProgressCount,
      lookAheadOverdueCount:
        input.progressReport.lookAhead.overdueCount,
      lateMilestoneCount:
        input.progressReport.milestones.lateOpenCount,
    },

    forecast: {
      sourceCompletionIso:
        input.independentForecast
          .sourceForecastCompletionIso,
      independentCompletionIso:
        input.independentForecast
          .independentForecastCompletionIso,
      varianceDays:
        input.independentForecast
          .forecastVarianceDays,
      origin:
        input.independentForecast.origin,
      complete:
        input.independentForecast.complete,
    },

    resources: {
      assignedResourceCount:
        input.resourceUtilization
          .assignedResourceCount,
      capacityCoveragePercent:
        input.resourceUtilization
          .capacityCoveragePercent,
      overloadedResourceCount:
        input.resourceUtilization
          .overloadedResourceCount,
      laborHoursActualKnown:
        input.manhourScurve
          .actualHoursKnownCurrent,
      laborActualCoveragePercent:
        input.manhourScurve
          .actualAssignmentCoveragePercent,
    },

    quantities: {
      allocationState:
        input.quantityScurve
          .allocationState,
      unitSeriesCount:
        input.quantityScurve.series.length,
      unmappedItemCount:
        input.quantityScurve
          .unmappedItemIds.length,
      overAllocatedItemCount:
        input.quantityScurve
          .overAllocatedItemIds.length,
    },

    contract: {
      physicalComplete:
        input.challengeContract
          .physicalComplete,
      semanticComplete:
        input.challengeContract
          .semanticComplete,
      challengeSignalCount:
        input.challengeContract
          .signalCount,
      noticeRequirementCandidateCount:
        input.challengeContract
          .noticeRequirementCandidates.length,
    },

    claims: {
      eventCount:
        input.noticesClaims.eventCount,
      claimCount:
        input.noticesClaims.claimCount,
      timelyNoticeCount:
        input.noticesClaims
          .timelyNoticeCount,
      lateNoticeCount:
        input.noticesClaims
          .lateNoticeCount,
      observedPositiveMovementDays:
        input.delayClaims
          .observedPositiveIndependentMovementDays,
      candidateAdditionalEotDays:
        input.eotAssessment
          .candidateAdditionalEotDays,
      officialApprovedEotDays:
        input.eotAssessment
          .officialApprovedEotDays,
      officialAdjustedCompletionIso:
        input.eotAssessment
          .officialAdjustedCompletionIso,
      scenarioAdjustedCompletionIso:
        input.eotAssessment
          .scenarioAdjustedCompletionIso,
    },

    revision: {
      revisionCount:
        input.revisionTrend.revisionCount,
      latestAddedActivityCount:
        latestRevision?.addedVsPrevious ??
        null,
      latestRemovedActivityCount:
        latestRevision?.removedVsPrevious ??
        null,
      latestModifiedActivityCount:
        latestRevision?.modifiedVsPrevious ??
        null,
    },

    diagnostics: [
      ...new Set([
        ...schedule.diagnostics,
        ...input.progressReport.diagnostics,
        ...input.independentForecast.diagnostics,
        ...input.challengeContract.diagnostics,
        ...input.delayClaims.diagnostics,
        ...input.eotAssessment.diagnostics,
      ]),
    ],
  };
}
