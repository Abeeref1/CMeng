import {
  ProjectionDependencyNotReadyError,
  RetryableProjectionError,
  type AnalysisProjectionKey,
  type ProjectionChunkResult,
  type ProjectionJob,
} from "../../analysis-runtime/src";
import type {
  AnalysisMetadataStore,
  ProjectionArtifactStore,
} from "../../analysis-runtime/src";
import type {
  ProjectionExecutor,
} from "../../analysis-runtime/src";
import type {
  ProjectAnalysisContext,
  ProjectAnalysisContextStore,
} from "./types";

import type {
  CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";
import type {
  ScheduleRevision,
} from "../../schedule-revision-core/src";
import type {
  CanonicalResourceModel,
} from "../../schedule-resource-core/src";
import type {
  CanonicalQuantityProgressModel,
} from "../../quantity-progress-core/src";
import type {
  ContractDocumentResult,
} from "../../contract-parser/src";
import type {
  DelayClaimsModel,
} from "../../delay-analysis-core/src";
import type {
  ContractTimeBasis,
} from "../../eot-assessment/src";

import {
  buildScheduleAnalyticsProjection,
  type ScheduleAnalyticsProjection,
} from "../../schedule-analytics/src";
import {
  buildActivityAnalyticsProjection,
} from "../../activity-analytics/src";
import {
  buildMilestonesProjection,
  type MilestonesProjection,
} from "../../milestones-analysis/src";
import {
  buildNearCriticalProjection,
} from "../../near-critical-analysis/src";
import {
  buildLookAheadProjection,
  type LookAheadProjection,
} from "../../lookahead-schedule/src";
import {
  buildProgressBreakdownProjection,
} from "../../progress-breakdown/src";
import {
  buildProgressScurveProjection,
  type ProgressScurveProjection,
} from "../../progress-scurve/src";
import {
  buildIndependentForecastProjection,
  type IndependentForecastProjection,
} from "../../independent-forecast/src";
import {
  buildScheduleChangeReportFromHistory,
} from "../../schedule-change-report/src";
import {
  buildRevisionTrendProjection,
  type RevisionTrendProjection,
} from "../../revision-trend/src";
import {
  buildVarianceTrendsProjection,
} from "../../variance-trends/src";
import {
  buildResourceUtilizationProjection,
  type ResourceUtilizationProjection,
} from "../../resource-utilization/src";
import {
  buildManhourScurveProjection,
  type ManhourScurveProjection,
} from "../../manhour-scurve/src";
import {
  buildQuantityScurveProjection,
  type QuantityScurveProjection,
} from "../../quantity-scurve/src";
import {
  buildChallengeContractProjection,
  type ChallengeContractProjection,
} from "../../challenge-contract/src";
import {
  buildNoticesClaimsProjection,
  type NoticesClaimsProjection,
} from "../../notices-claims/src";
import {
  buildWindowsAnalysisProjection,
  type WindowsAnalysisProjection,
} from "../../windows-analysis/src";
import {
  buildDelayClaimsProjection,
  type DelayClaimsProjection,
} from "../../delay-claims/src";
import {
  buildEotAssessmentProjection,
  type EotAssessmentProjection,
} from "../../eot-assessment/src";
import {
  buildProgressReportProjection,
  type ProgressReportProjection,
} from "../../progress-report/src";
import {
  buildForecastHistoryProjection,
  forecastSnapshotFromProjection,
} from "../../forecast-history/src";
import {
  buildPmoAnalysisProjection,
} from "../../pmo-analysis/src";

function encode(value: unknown): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify(value),
  );
}

function decode<T>(payload: Uint8Array): T {
  return JSON.parse(
    new TextDecoder().decode(payload),
  ) as T;
}

function producerVersion(
  context: ProjectAnalysisContext,
  key: AnalysisProjectionKey,
): string {
  return (
    context.analysisEngineVersion +
    ":" +
    key
  );
}

function emptySchedule(
  context: ProjectAnalysisContext,
): CanonicalScheduleModel {
  return {
    projectId: context.projectId,
    source: "schedule_csv",
    sourceRevisionId:
      "missing-schedule:" +
      context.evidenceRevisionId,
    dataDateIso: null,
    activities: [],
    relationships: [],
    wbs: [],
    calendars: [],
    diagnostics: [
      "SCHEDULE_SOURCE_NOT_AVAILABLE",
    ],
  };
}

function currentSchedule(
  context: ProjectAnalysisContext,
): CanonicalScheduleModel {
  return (
    context.currentSchedule ??
    emptySchedule(context)
  );
}

function scheduleHistory(
  context: ProjectAnalysisContext,
  schedule: CanonicalScheduleModel,
): ScheduleRevision[] {
  if (context.scheduleRevisions.length > 0) {
    return [...context.scheduleRevisions];
  }

  return [
    {
      revisionId:
        schedule.sourceRevisionId,
      label: null,
      sequence: 1,
      effectiveAt:
        schedule.dataDateIso,
      model: schedule,
    },
  ];
}

function emptyResources(
  context: ProjectAnalysisContext,
  schedule: CanonicalScheduleModel,
): CanonicalResourceModel {
  return {
    projectId: context.projectId,
    sourceRevisionId:
      schedule.sourceRevisionId,
    units: [],
    financialPeriods: [],
    resources: [],
    assignments: [],
    periodActuals: [],
    diagnostics: [
      "RESOURCE_SOURCE_NOT_AVAILABLE",
    ],
  };
}

function emptyQuantities(
  context: ProjectAnalysisContext,
  schedule: CanonicalScheduleModel,
): CanonicalQuantityProgressModel {
  return {
    projectId: context.projectId,
    boqRevisionId:
      "missing-boq:" +
      context.evidenceRevisionId,
    scheduleRevisionId:
      schedule.sourceRevisionId,
    items: [],
    allocations: [],
    installedSnapshots: [],
    diagnostics: [
      "QUANTITY_SOURCE_NOT_AVAILABLE",
    ],
  };
}

function emptyContract(): ContractDocumentResult {
  return {
    sourceType: "pdf",
    pdf: null,
    docx: null,
    sections: [],
    clauses: [],
    appendices: [],
    duplicateIdentifiers: [],
    repeatedRawIdentifiers: [],
    references: [],
    amendmentActions: [],
    ignoredSpans: [],
    unclassifiedLines: [],
    semanticCoveragePercent: null,
    physicalComplete: false,
    semanticComplete: false,
    complete: false,
    diagnostics: [
      "CONTRACT_SOURCE_NOT_AVAILABLE",
    ],
  };
}

function emptyDelayClaims(
  context: ProjectAnalysisContext,
): DelayClaimsModel {
  return {
    projectId: context.projectId,
    evidenceRevisionId:
      context.evidenceRevisionId,
    events: [],
    notices: [],
    claims: [],
    noticeRequirements: [],
    diagnostics: [
      "DELAY_CLAIMS_EVIDENCE_NOT_AVAILABLE",
    ],
  };
}

function emptyContractTimeBasis(): ContractTimeBasis {
  return {
    contractualCompletionIso: null,
    contractualCompletionState: "missing",
    officialApprovedEotDays: null,
    officialApprovedEotState: "missing",
    eotDayBasis: "unknown",
    eotDayBasisState: "missing",
    sourceRefs: [],
  };
}

export class CMengProjectionExecutor
  implements ProjectionExecutor
{
  constructor(
    private readonly contexts:
      ProjectAnalysisContextStore,
    private readonly metadata:
      AnalysisMetadataStore,
    private readonly artifacts:
      ProjectionArtifactStore,
  ) {}

  private async context(
    job: ProjectionJob,
  ): Promise<ProjectAnalysisContext> {
    const context =
      await this.contexts.get(job.runId);

    if (!context) {
      throw new RetryableProjectionError(
        "Analysis context is not available for run " +
          job.runId,
      );
    }

    if (
      context.runId !== job.runId ||
      context.projectId !== job.projectId ||
      context.evidenceRevisionId !==
        job.evidenceRevisionId
    ) {
      throw new Error(
        "Projection job does not match immutable analysis context identity",
      );
    }

    return context;
  }

  private async dependency<T>(
    job: ProjectionJob,
    key: AnalysisProjectionKey,
  ): Promise<T> {
    const projection =
      await this.metadata.getProjection(
        job.runId,
        key,
      );

    if (
      !projection ||
      projection.state !== "ready" ||
      !projection.artifact ||
      !projection.dependencyReceiptId
    ) {
      throw new ProjectionDependencyNotReadyError(
        job.runId,
        job.projectionKey,
        key,
      );
    }

    const payload =
      await this.artifacts.get(
        projection.artifact,
      );

    if (!payload) {
      throw new RetryableProjectionError(
        "Projection artifact is temporarily unavailable: " +
          key,
      );
    }

    return decode<T>(payload);
  }

  async processChunk(input: {
    job: ProjectionJob;
    checkpoint: import("../../analysis-runtime/src").DurableCheckpoint | null;
    sliceBudgetMs: number;
  }): Promise<ProjectionChunkResult> {
    const context =
      await this.context(input.job);
    const schedule =
      currentSchedule(context);
    const history =
      scheduleHistory(
        context,
        schedule,
      );
    const resources =
      context.resources ??
      emptyResources(
        context,
        schedule,
      );
    const quantities =
      context.quantities ??
      emptyQuantities(
        context,
        schedule,
      );
    const contract =
      context.contract ??
      emptyContract();
    const delayModel =
      context.delayClaims ??
      emptyDelayClaims(context);
    const contractTime =
      context.contractTimeBasis ??
      emptyContractTimeBasis();

    const generatedAt =
      context.generatedAt;
    const version =
      producerVersion(
        context,
        input.job.projectionKey,
      );

    let projection: unknown;

    switch (input.job.projectionKey) {
      case "schedule_analytics":
        projection =
          buildScheduleAnalyticsProjection(
            schedule,
            {
              generatedAt,
              producerVersion: version,
              ...(context.scheduleConfig
                ? {
                    config:
                      context.scheduleConfig,
                  }
                : {}),
            },
          );
        break;

      case "activity_analytics":
        projection =
          buildActivityAnalyticsProjection(
            schedule,
            {
              generatedAt,
              producerVersion: version,
              ...(context.scheduleConfig
                ? {
                    config:
                      context.scheduleConfig,
                  }
                : {}),
            },
          );
        break;

      case "milestones":
        projection =
          buildMilestonesProjection(
            schedule,
            {
              generatedAt,
              producerVersion: version,
            },
          );
        break;

      case "near_critical":
        projection =
          buildNearCriticalProjection(
            schedule,
            {
              generatedAt,
              producerVersion: version,
              ...(context.scheduleConfig
                ? {
                    config:
                      context.scheduleConfig,
                  }
                : {}),
            },
          );
        break;

      case "lookahead_schedule":
        projection =
          buildLookAheadProjection(
            schedule,
            {
              generatedAt,
              producerVersion: version,
              ...(context.lookAheadReadiness
                ? {
                    readinessEvidence:
                      context.lookAheadReadiness,
                  }
                : {}),
            },
          );
        break;

      case "progress_breakdown":
        projection =
          buildProgressBreakdownProjection(
            schedule,
            {
              generatedAt,
              producerVersion: version,
              ...(context.scheduleConfig
                ? {
                    config:
                      context.scheduleConfig,
                  }
                : {}),
            },
          );
        break;

      case "progress_scurve":
        projection =
          buildProgressScurveProjection(
            schedule,
            {
              generatedAt,
              producerVersion: version,
            },
          );
        break;

      case "independent_forecast":
        projection =
          buildIndependentForecastProjection(
            schedule,
            {
              generatedAt,
              producerVersion: version,
              ...(context.cpmConfig
                ? {
                    cpmConfig:
                      context.cpmConfig,
                  }
                : {}),
            },
          );
        break;

      case "schedule_change_report":
        projection =
          buildScheduleChangeReportFromHistory(
            history,
            {
              generatedAt,
              producerVersion: version,
            },
          );
        break;

      case "revision_trend":
        projection =
          buildRevisionTrendProjection(
            history,
            {
              generatedAt,
              producerVersion: version,
            },
          );
        break;

      case "variance_trends":
        projection =
          buildVarianceTrendsProjection(
            history,
            {
              generatedAt,
              producerVersion: version,
            },
          );
        break;

      case "resource_utilization":
        projection =
          buildResourceUtilizationProjection(
            resources,
            schedule,
            {
              generatedAt,
              producerVersion: version,
            },
          );
        break;

      case "manhour_scurve":
        projection =
          buildManhourScurveProjection(
            resources,
            schedule,
            {
              generatedAt,
              producerVersion: version,
            },
          );
        break;

      case "quantity_scurve":
        projection =
          buildQuantityScurveProjection(
            quantities,
            schedule,
            {
              generatedAt,
              producerVersion: version,
            },
          );
        break;

      case "challenge_contract":
        projection =
          buildChallengeContractProjection(
            contract,
            {
              generatedAt,
              producerVersion: version,
            },
          );
        break;

      case "notices_claims":
        projection =
          buildNoticesClaimsProjection(
            delayModel,
            {
              generatedAt,
              producerVersion: version,
            },
          );
        break;

      case "windows_analysis":
        projection =
          buildWindowsAnalysisProjection(
            history,
            delayModel,
            {
              generatedAt,
              producerVersion: version,
              ...(context.cpmConfig
                ? {
                    cpmConfig:
                      context.cpmConfig,
                  }
                : {}),
            },
          );
        break;

      case "delay_claims": {
        const windows =
          await this.dependency<WindowsAnalysisProjection>(
            input.job,
            "windows_analysis",
          );

        projection =
          buildDelayClaimsProjection(
            windows,
            delayModel,
            {
              generatedAt,
              producerVersion: version,
            },
          );
        break;
      }

      case "eot_assessment": {
        const windows =
          await this.dependency<WindowsAnalysisProjection>(
            input.job,
            "windows_analysis",
          );
        const delay =
          await this.dependency<DelayClaimsProjection>(
            input.job,
            "delay_claims",
          );

        projection =
          buildEotAssessmentProjection(
            windows,
            delay,
            contractTime,
            {
              generatedAt,
              producerVersion: version,
            },
          );
        break;
      }

      case "forecast_history": {
        const current =
          await this.dependency<IndependentForecastProjection>(
            input.job,
            "independent_forecast",
          );

        const currentSnapshot =
          forecastSnapshotFromProjection(
            current,
            input.job.runId +
              ":independent_forecast",
          );

        const snapshots = [
          ...context.forecastHistory.filter(
            (snapshot) =>
              snapshot.snapshotId !==
              currentSnapshot.snapshotId,
          ),
          currentSnapshot,
        ];

        projection =
          buildForecastHistoryProjection(
            snapshots,
            {
              generatedAt,
              producerVersion: version,
            },
          );
        break;
      }

      case "progress_report": {
        const scheduleAnalytics =
          await this.dependency<ScheduleAnalyticsProjection>(
            input.job,
            "schedule_analytics",
          );
        const milestones =
          await this.dependency<MilestonesProjection>(
            input.job,
            "milestones",
          );
        const lookAhead =
          await this.dependency<LookAheadProjection>(
            input.job,
            "lookahead_schedule",
          );
        const progressScurve =
          await this.dependency<ProgressScurveProjection>(
            input.job,
            "progress_scurve",
          );
        const independentForecast =
          await this.dependency<IndependentForecastProjection>(
            input.job,
            "independent_forecast",
          );

        projection =
          buildProgressReportProjection({
            generatedAt,
            producerVersion: version,
            scheduleAnalytics,
            milestones,
            lookAhead,
            progressScurve,
            independentForecast,
          });
        break;
      }

      case "pmo_analysis": {
        const scheduleAnalytics =
          await this.dependency<ScheduleAnalyticsProjection>(
            input.job,
            "schedule_analytics",
          );
        const progressReport =
          await this.dependency<ProgressReportProjection>(
            input.job,
            "progress_report",
          );
        const revisionTrend =
          await this.dependency<RevisionTrendProjection>(
            input.job,
            "revision_trend",
          );
        const resourceUtilization =
          await this.dependency<ResourceUtilizationProjection>(
            input.job,
            "resource_utilization",
          );
        const manhourScurve =
          await this.dependency<ManhourScurveProjection>(
            input.job,
            "manhour_scurve",
          );
        const quantityScurve =
          await this.dependency<QuantityScurveProjection>(
            input.job,
            "quantity_scurve",
          );
        const independentForecast =
          await this.dependency<IndependentForecastProjection>(
            input.job,
            "independent_forecast",
          );
        const challengeContract =
          await this.dependency<ChallengeContractProjection>(
            input.job,
            "challenge_contract",
          );
        const noticesClaims =
          await this.dependency<NoticesClaimsProjection>(
            input.job,
            "notices_claims",
          );
        const delayClaims =
          await this.dependency<DelayClaimsProjection>(
            input.job,
            "delay_claims",
          );
        const eotAssessment =
          await this.dependency<EotAssessmentProjection>(
            input.job,
            "eot_assessment",
          );

        projection =
          buildPmoAnalysisProjection({
            generatedAt,
            producerVersion: version,
            evidenceRevisionId:
              context.evidenceRevisionId,
            scheduleAnalytics,
            progressReport,
            revisionTrend,
            resourceUtilization,
            manhourScurve,
            quantityScurve,
            independentForecast,
            challengeContract,
            noticesClaims,
            delayClaims,
            eotAssessment,
          });
        break;
      }

      default:
        throw new Error(
          "Projection executor has no implementation for " +
            input.job.projectionKey,
        );
    }

    const finalArtifact =
      encode(projection);

    return {
      done: true,
      nextCursor: null,
      checkpointPayload: encode({
        runId: input.job.runId,
        projectionKey:
          input.job.projectionKey,
        completed: true,
        sliceBudgetMs:
          input.sliceBudgetMs,
        artifactBytes:
          finalArtifact.byteLength,
      }),
      finalArtifact,
    };
  }
}
