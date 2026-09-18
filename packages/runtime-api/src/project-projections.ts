import {
  analyzeSchedule,
} from "../../schedule-analysis-core/src";
import {
  buildActivityAnalyticsProjection,
} from "../../activity-analytics/src";
import {
  buildChallengeContractProjection,
} from "../../challenge-contract/src";
import {
  extractContractLdTerms,
} from "../../contract-commercial/src";
import {
  buildDelayClaimsProjection,
} from "../../delay-claims/src";
import {
  buildEotAssessmentProjection,
} from "../../eot-assessment/src";
import {
  buildForecastHistoryProjection,
  forecastSnapshotFromProjection,
} from "../../forecast-history/src";
import {
  buildIndependentForecastProjection,
} from "../../independent-forecast/src";
import {
  buildLookAheadProjection,
} from "../../lookahead-schedule/src";
import {
  buildManhourScurveProjection,
} from "../../manhour-scurve/src";
import {
  buildMilestonesProjection,
} from "../../milestones-analysis/src";
import {
  buildNearCriticalProjection,
} from "../../near-critical-analysis/src";
import {
  buildNoticesClaimsProjection,
} from "../../notices-claims/src";
import {
  buildPmoAnalysisProjection,
} from "../../pmo-analysis/src";
import {
  buildProgressBreakdownProjection,
} from "../../progress-breakdown/src";
import {
  buildProgressReportProjection,
} from "../../progress-report/src";
import {
  buildProgressScurveProjection,
} from "../../progress-scurve/src";
import {
  buildProjectDirectorPosition,
} from "../../project-director/src";
import {
  buildQuantityScurveProjection,
} from "../../quantity-scurve/src";
import {
  buildResourceUtilizationProjection,
} from "../../resource-utilization/src";
import {
  buildRevisionTrendProjection,
} from "../../revision-trend/src";
import {
  buildScheduleAnalyticsProjection,
} from "../../schedule-analytics/src";
import {
  buildScheduleChangeReportProjection,
} from "../../schedule-change-report/src";
import {
  buildVarianceTrendsProjection,
} from "../../variance-trends/src";
import {
  buildWindowsAnalysisProjection,
} from "../../windows-analysis/src";
import {
  buildBoardReadyReport,
} from "../../board-report/src";
import type {
  ProjectRuntimeState,
  ModuleRuntimeResult,
  ProjectRuntimeOverview,
} from "./project-state-types";
import {
  runtimeProjects,
} from "./project-state";
import {
  scheduleModules,
} from "./registry";

interface ProjectionBundle {
  version: number;
  generatedAt: string;
  modules: Map<
    string,
    ModuleRuntimeResult
  >;
  director: ReturnType<
    typeof buildProjectDirectorPosition
  > | null;
  boardReport: ReturnType<
    typeof buildBoardReadyReport
  > | null;
}

const bundleCache =
  new Map<
    string,
    ProjectionBundle
  >();

function blocked(
  key: string,
  reason: string,
  dependencies: string[],
): ModuleRuntimeResult {
  return {
    key,
    status: "blocked",
    reason,
    dependencies,
    data: null,
  };
}

function available(
  key: string,
  data: unknown,
  dependencies: string[] = [],
  status:
    | "ready"
    | "partial" = "ready",
  reason: string | null = null,
): ModuleRuntimeResult {
  return {
    key,
    status,
    reason,
    dependencies,
    data,
  };
}

function actualHistory(
  state: ProjectRuntimeState,
) {
  return state.schedules
    .map((stored) => {
      const model =
        stored.revision.model;
      const progress =
        analyzeSchedule(model)
          .progress
          .durationWeightedPercentComplete
          .value;
      const asOfIso =
        model.dataDateIso ??
        stored.revision.effectiveAt;

      if (
        progress === null ||
        asOfIso === null
      ) {
        return null;
      }

      return {
        asOfIso,
        progressPercent: progress,
        sourceRevisionId:
          stored.revision
            .revisionId,
        sourceRefs: [
          "schedule-revision:" +
            stored.revision
              .revisionId,
        ],
      };
    })
    .filter(
      (
        item,
      ): item is NonNullable<
        typeof item
      > => item !== null,
    );
}

function buildBundle(
  state: ProjectRuntimeState,
): ProjectionBundle {
  const cached =
    bundleCache.get(
      state.projectId,
    );
  if (
    cached &&
    cached.version ===
      state.version
  ) {
    return cached;
  }

  const generatedAt =
    new Date().toISOString();
  const modules =
    new Map<
      string,
      ModuleRuntimeResult
    >();

  for (const module of scheduleModules) {
    modules.set(
      module.key,
      blocked(
        module.key,
        "No schedule evidence has been uploaded.",
        ["schedule"],
      ),
    );
  }

  const officialHistory =
    state.schedules.filter(
      (item) =>
        item.role === "baseline" ||
        item.role === "update" ||
        item.role ===
          "revised_baseline",
    );
  const ordered = [
    ...(officialHistory.length > 0
      ? officialHistory
      : state.schedules),
  ].sort(
    (a, b) =>
      a.revision.sequence -
      b.revision.sequence,
  );
  const current =
    runtimeProjects.latestSchedule(
      state.projectId,
    );

  let director:
    ProjectionBundle["director"] =
    null;
  let boardReport:
    ProjectionBundle["boardReport"] =
    null;

  if (!current) {
    const bundle = {
      version: state.version,
      generatedAt,
      modules,
      director,
      boardReport,
    };
    bundleCache.set(
      state.projectId,
      bundle,
    );
    return bundle;
  }

  const model =
    current.revision.model;
  const versions = {
    schedule:
      "uat-schedule-v1",
    activity:
      "uat-activity-v1",
    resource:
      "uat-resource-v1",
    lookAhead:
      "uat-lookahead-v1",
    progress:
      "uat-progress-v1",
    change:
      "uat-change-v1",
    revision:
      "uat-revision-v1",
    variance:
      "uat-variance-v1",
    scurve:
      "uat-scurve-v1",
    quantity:
      "uat-quantity-v1",
    breakdown:
      "uat-breakdown-v1",
    milestones:
      "uat-milestones-v1",
    nearCritical:
      "uat-near-critical-v1",
    manhours:
      "uat-manhours-v1",
    history:
      "uat-forecast-history-v1",
    forecast:
      "uat-forecast-v1",
    windows:
      "uat-windows-v1",
    delay:
      "uat-delay-v1",
    notices:
      "uat-notices-v1",
    eot:
      "uat-eot-v1",
    challenge:
      "uat-challenge-v1",
    pmo:
      "uat-pmo-v1",
  };

  const scheduleAnalytics =
    buildScheduleAnalyticsProjection(
      model,
      {
        generatedAt,
        producerVersion:
          versions.schedule,
      },
    );
  modules.set(
    "schedule-analytics",
    available(
      "schedule-analytics",
      scheduleAnalytics,
    ),
  );

  const activityAnalytics =
    buildActivityAnalyticsProjection(
      model,
      {
        generatedAt,
        producerVersion:
          versions.activity,
      },
    );
  modules.set(
    "activity-analytics",
    available(
      "activity-analytics",
      activityAnalytics,
    ),
  );

  const lookAhead =
    buildLookAheadProjection(
      model,
      {
        generatedAt,
        producerVersion:
          versions.lookAhead,
        readinessEvidence:
          state.controls
            .readinessEvidence,
      },
    );
  modules.set(
    "lookahead-schedule",
    available(
      "lookahead-schedule",
      lookAhead,
    ),
  );

  const progressScurve =
    buildProgressScurveProjection(
      model,
      {
        generatedAt,
        producerVersion:
          versions.scurve,
        actualHistory:
          actualHistory(state),
      },
    );
  modules.set(
    "progress-scurve",
    available(
      "progress-scurve",
      progressScurve,
    ),
  );

  const milestones =
    buildMilestonesProjection(
      model,
      {
        generatedAt,
        producerVersion:
          versions.milestones,
      },
    );
  modules.set(
    "milestones",
    available(
      "milestones",
      milestones,
    ),
  );

  const nearCritical =
    buildNearCriticalProjection(
      model,
      {
        generatedAt,
        producerVersion:
          versions.nearCritical,
      },
    );
  modules.set(
    "near-critical",
    available(
      "near-critical",
      nearCritical,
    ),
  );

  const progressBreakdown =
    buildProgressBreakdownProjection(
      model,
      {
        generatedAt,
        producerVersion:
          versions.breakdown,
      },
    );
  modules.set(
    "progress-breakdown",
    available(
      "progress-breakdown",
      progressBreakdown,
    ),
  );

  const independentForecast =
    buildIndependentForecastProjection(
      model,
      {
        generatedAt,
        producerVersion:
          versions.forecast,
      },
    );
  modules.set(
    "independent-forecast",
    available(
      "independent-forecast",
      independentForecast,
      [],
      independentForecast.complete
        ? "ready"
        : "partial",
      independentForecast.complete
        ? null
        : "Independent forecast contains unresolved schedule evidence.",
    ),
  );

  const progressReport =
    buildProgressReportProjection({
      generatedAt,
      producerVersion:
        versions.progress,
      scheduleAnalytics,
      milestones,
      lookAhead,
      progressScurve,
      independentForecast,
      progressEvidence:
        state.controls
          .progressEvidence,
    });
  modules.set(
    "progress-report",
    available(
      "progress-report",
      progressReport,
    ),
  );

  if (ordered.length >= 2) {
    const before =
      ordered.at(-2)!.revision;
    const after =
      current.revision;

    modules.set(
      "schedule-change-report",
      available(
        "schedule-change-report",
        buildScheduleChangeReportProjection(
          before,
          after,
          {
            generatedAt,
            producerVersion:
              versions.change,
          },
        ),
        ["two schedule revisions"],
      ),
    );

    modules.set(
      "revision-trend",
      available(
        "revision-trend",
        buildRevisionTrendProjection(
          ordered.map(
            (item) =>
              item.revision,
          ),
          {
            generatedAt,
            producerVersion:
              versions.revision,
          },
        ),
        ["schedule revision history"],
      ),
    );

    modules.set(
      "variance-trends",
      available(
        "variance-trends",
        buildVarianceTrendsProjection(
          ordered.map(
            (item) =>
              item.revision,
          ),
          {
            generatedAt,
            producerVersion:
              versions.variance,
          },
        ),
        ["schedule revision history"],
      ),
    );
  } else {
    for (const key of [
      "schedule-change-report",
      "revision-trend",
      "variance-trends",
    ]) {
      modules.set(
        key,
        blocked(
          key,
          "At least two schedule revisions are required.",
          ["second schedule revision"],
        ),
      );
    }
  }

  const forecastSnapshots =
    ordered.map((stored) =>
      forecastSnapshotFromProjection(
        buildIndependentForecastProjection(
          stored.revision.model,
          {
            generatedAt,
            producerVersion:
              versions.forecast +
              ":" +
              stored.revision
                .revisionId,
          },
        ),
        "forecast-" +
          stored.revision
            .revisionId,
      ),
    );

  modules.set(
    "forecast-history",
    available(
      "forecast-history",
      buildForecastHistoryProjection(
        forecastSnapshots,
        {
          generatedAt,
          producerVersion:
            versions.history,
        },
      ),
      ["schedule revision history"],
      ordered.length >= 2
        ? "ready"
        : "partial",
      ordered.length >= 2
        ? null
        : "Only one forecast snapshot is available.",
    ),
  );

  const resources =
    state.resourcesByRevision.get(
      current.revision
        .revisionId,
    ) ?? null;

  let resourceUtilization:
    ReturnType<
      typeof buildResourceUtilizationProjection
    > | null = null;
  let manhourScurve:
    ReturnType<
      typeof buildManhourScurveProjection
    > | null = null;

  if (resources) {
    resourceUtilization =
      buildResourceUtilizationProjection(
        resources,
        model,
        {
          generatedAt,
          producerVersion:
            versions.resource,
        },
      );
    manhourScurve =
      buildManhourScurveProjection(
        resources,
        model,
        {
          generatedAt,
          producerVersion:
            versions.manhours,
        },
      );

    modules.set(
      "resource-utilization",
      available(
        "resource-utilization",
        resourceUtilization,
        ["resource-loaded XER"],
      ),
    );
    modules.set(
      "manhour-scurve",
      available(
        "manhour-scurve",
        manhourScurve,
        ["resource-loaded XER"],
      ),
    );
  } else {
    modules.set(
      "resource-utilization",
      blocked(
        "resource-utilization",
        "The current schedule revision has no resource assignment evidence.",
        ["resource-loaded XER"],
      ),
    );
    modules.set(
      "manhour-scurve",
      blocked(
        "manhour-scurve",
        "The current schedule revision has no governed labour assignment evidence.",
        ["resource-loaded XER"],
      ),
    );
  }

  let quantityScurve:
    ReturnType<
      typeof buildQuantityScurveProjection
    > | null = null;

  if (
    state.quantities &&
    state.quantities
      .scheduleRevisionId ===
      current.revision
        .revisionId
  ) {
    quantityScurve =
      buildQuantityScurveProjection(
        state.quantities,
        model,
        {
          generatedAt,
          producerVersion:
            versions.quantity,
        },
      );
    modules.set(
      "quantity-scurve",
      available(
        "quantity-scurve",
        quantityScurve,
        ["BOQ", "quantity-to-activity mapping"],
        state.quantities
          .allocations.length > 0
          ? "ready"
          : "partial",
        state.quantities
          .allocations.length > 0
          ? null
          : "BOQ is loaded but quantities are not yet mapped to schedule activities.",
      ),
    );
  } else {
    modules.set(
      "quantity-scurve",
      blocked(
        "quantity-scurve",
        "A BOQ for the current schedule revision is required.",
        ["BOQ"],
      ),
    );
  }

  const delayModel =
    state.controls.delayClaims;
  let windows:
    ReturnType<
      typeof buildWindowsAnalysisProjection
    > | null = null;
  let delayClaims:
    ReturnType<
      typeof buildDelayClaimsProjection
    > | null = null;
  let noticesClaims:
    ReturnType<
      typeof buildNoticesClaimsProjection
    > | null = null;
  let eotAssessment:
    ReturnType<
      typeof buildEotAssessmentProjection
    > | null = null;

  if (
    delayModel &&
    ordered.length >= 2
  ) {
    windows =
      buildWindowsAnalysisProjection(
        ordered.map(
          (item) =>
            item.revision,
        ),
        delayModel,
        {
          generatedAt,
          producerVersion:
            versions.windows,
        },
      );
    modules.set(
      "windows-analysis",
      available(
        "windows-analysis",
        windows,
        ["schedule revision history", "delay events"],
      ),
    );

    delayClaims =
      buildDelayClaimsProjection(
        windows,
        delayModel,
        {
          generatedAt,
          producerVersion:
            versions.delay,
        },
      );
    modules.set(
      "delay-claims",
      available(
        "delay-claims",
        delayClaims,
        ["delay events", "schedule windows"],
      ),
    );

    noticesClaims =
      buildNoticesClaimsProjection(
        delayModel,
        {
          generatedAt,
          producerVersion:
            versions.notices,
        },
      );
    modules.set(
      "notices-claims",
      available(
        "notices-claims",
        noticesClaims,
        ["delay events", "notices", "claims"],
      ),
    );

    if (
      state.controls
        .contractTimeBasis
    ) {
      eotAssessment =
        buildEotAssessmentProjection(
          windows,
          delayClaims,
          state.controls
            .contractTimeBasis,
          {
            generatedAt,
            producerVersion:
              versions.eot,
          },
        );
      modules.set(
        "eot-assessment",
        available(
          "eot-assessment",
          eotAssessment,
          ["schedule windows", "delay events", "contract time basis"],
        ),
      );
    } else {
      modules.set(
        "eot-assessment",
        blocked(
          "eot-assessment",
          "A governed contract completion/EOT basis is required.",
          ["contract time basis"],
        ),
      );
    }
  } else {
    const reason =
      !delayModel
        ? "Delay-event and claim evidence has not been loaded."
        : "At least two schedule revisions are required for windows analysis.";

    for (const key of [
      "windows-analysis",
      "delay-claims",
      "notices-claims",
      "eot-assessment",
    ]) {
      modules.set(
        key,
        blocked(
          key,
          reason,
          [
            "schedule revision history",
            "delay/claim evidence",
          ],
        ),
      );
    }
  }

  let challengeContract:
    ReturnType<
      typeof buildChallengeContractProjection
    > | null = null;

  if (state.contract) {
    challengeContract =
      buildChallengeContractProjection(
        state.contract,
        {
          generatedAt,
          producerVersion:
            versions.challenge,
        },
      );
    modules.set(
      "challenge-contract",
      available(
        "challenge-contract",
        challengeContract,
        ["contract"],
        state.contract
          .semanticComplete
          ? "ready"
          : "partial",
        state.contract
          .semanticComplete
          ? null
          : "The contract semantic model is partial.",
      ),
    );
  } else {
    modules.set(
      "challenge-contract",
      blocked(
        "challenge-contract",
        "A contract PDF or DOCX is required.",
        ["contract"],
      ),
    );
  }

  if (
    ordered.length >= 2 &&
    resourceUtilization &&
    manhourScurve &&
    quantityScurve &&
    challengeContract &&
    noticesClaims &&
    delayClaims &&
    eotAssessment
  ) {
    const revisionTrend =
      (
        modules.get(
          "revision-trend",
        )!.data
      ) as ReturnType<
        typeof buildRevisionTrendProjection
      >;

    modules.set(
      "pmo-analysis",
      available(
        "pmo-analysis",
        buildPmoAnalysisProjection({
          generatedAt,
          producerVersion:
            versions.pmo,
          evidenceRevisionId:
            delayModel
              ?.evidenceRevisionId ??
            current.revision
              .revisionId,
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
        }),
        [
          "schedule",
          "resources",
          "BOQ",
          "contract",
          "delay/claims",
        ],
      ),
    );
  } else {
    modules.set(
      "pmo-analysis",
      blocked(
        "pmo-analysis",
        "PMO Analysis requires the complete governed cross-domain control set.",
        [
          "schedule revision history",
          "resources",
          "BOQ/quantity mapping",
          "contract",
          "delay/claims",
          "contract time basis",
        ],
      ),
    );
  }

  if (
    delayClaims &&
    noticesClaims &&
    eotAssessment &&
    state.contract
  ) {
    const ldTerms =
      extractContractLdTerms(
        state.contract,
      );

    director =
      buildProjectDirectorPosition({
        generatedAt,
        projectId:
          state.projectId,
        scheduleAnalytics,
        progressReport,
        independentForecast,
        delayClaims,
        noticesClaims,
        eotAssessment,
        ldTerms,
        ...(state.controls
          .contractValue
          ? {
              contractValue:
                state.controls
                  .contractValue,
            }
          : {}),
        variations:
          state.controls
            .variations,
        invoices:
          state.controls.invoices,
        retentions:
          state.controls
            .retentions,
        bonds:
          state.controls.bonds,
        claimCommercials:
          state.controls
            .claimCommercials,
        hseIncidents:
          state.controls
            .hseIncidents,
        ncrs:
          state.controls.ncrs,
        rfis:
          state.controls.rfis,
        permits:
          state.controls.permits,
        boardEvidence:
          state.controls
            .boardPublication
          ? {
              reportId:
                "board-" +
                state.projectId,
              state:
                state.controls
                  .boardPublication
                  .finalizedAt
                  ? "finalized"
                  : "draft",
              sourceManifestId:
                state.controls
                  .boardPublication
                  .sourceManifestId,
              evidenceReceiptIds:
                [
                  ...state.controls
                    .boardPublication
                    .evidenceReceiptIds,
                ],
              finalizedAt:
                state.controls
                  .boardPublication
                  .finalizedAt,
            }
          : null,
      });

    if (
      state.controls
        .boardPublication
    ) {
      boardReport =
        buildBoardReadyReport(
          director,
          state.controls
            .boardPublication,
        );
    }
  }

  const bundle:
    ProjectionBundle = {
    version: state.version,
    generatedAt,
    modules,
    director,
    boardReport,
  };

  bundleCache.set(
    state.projectId,
    bundle,
  );
  return bundle;
}

export function moduleForProject(
  projectId: string,
  key: string,
): ModuleRuntimeResult {
  const state =
    runtimeProjects.get(projectId);
  if (!state) {
    return blocked(
      key,
      "Project has not been created.",
      ["project"],
    );
  }

  const bundle =
    buildBundle(state);
  return (
    bundle.modules.get(key) ??
    blocked(
      key,
      "Unknown Schedule module.",
      [],
    )
  );
}

export function directorForProject(
  projectId: string,
) {
  const state =
    runtimeProjects.get(projectId);
  if (!state) return null;
  return buildBundle(state).director;
}

export function boardReportForProject(
  projectId: string,
) {
  const state =
    runtimeProjects.get(projectId);
  if (!state) return null;
  return buildBundle(state)
    .boardReport;
}

export function overviewForProject(
  projectId: string,
): ProjectRuntimeOverview | null {
  const state =
    runtimeProjects.get(projectId);
  if (!state) return null;

  const latest =
    runtimeProjects.latestSchedule(
      projectId,
    );
  const bundle =
    buildBundle(state);

  return {
    projectId,
    version: state.version,
    demo: state.demo,
    revisionCount:
      state.schedules.length,
    baselineRevisionCount:
      state.schedules.filter(
        (item) =>
          item.role === "baseline" ||
          item.role ===
            "revised_baseline",
      ).length,
    updateRevisionCount:
      state.schedules.filter(
        (item) =>
          item.role === "update",
      ).length,
    recoveryRevisionCount:
      state.schedules.filter(
        (item) =>
          item.role === "recovery",
      ).length,
    evidenceDocumentCount:
      state.evidenceDocuments.length,
    evidenceCategoryCounts:
      state.evidenceDocuments.reduce(
        (counts, document) => {
          counts[document.category] =
            (counts[
              document.category
            ] ?? 0) + 1;
          return counts;
        },
        {} as Record<string, number>,
      ),
    latestRevisionId:
      latest?.revision
        .revisionId ?? null,
    latestDataDateIso:
      latest?.revision.model
        .dataDateIso ?? null,
    boqState:
      state.boq?.state ?? null,
    contractLoaded:
      state.contract !== null,
    delayClaimsLoaded:
      state.controls
        .delayClaims !== null,
    moduleStates:
      scheduleModules.map(
        (module) => {
          const value =
            bundle.modules.get(
              module.key,
            );
          return {
            key: module.key,
            status:
              value?.status ??
              "blocked",
            reason:
              value?.reason ??
              null,
          };
        },
      ),
  };
}

export function invalidateProject(
  projectId: string,
): void {
  bundleCache.delete(projectId);
}
