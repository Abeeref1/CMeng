import {
  buildPmoAnalysisProjection,
} from "../../pmo-analysis/src";
import {
  buildScheduleAnalyticsProjection,
} from "../../schedule-analytics/src";
import {
  buildActivityAnalyticsProjection,
} from "../../activity-analytics/src";
import {
  buildResourceUtilizationProjection,
} from "../../resource-utilization/src";
import {
  buildLookAheadProjection,
} from "../../lookahead-schedule/src";
import {
  buildProgressReportProjection,
} from "../../progress-report/src";
import {
  buildScheduleChangeReportProjection,
} from "../../schedule-change-report/src";
import {
  buildRevisionTrendProjection,
} from "../../revision-trend/src";
import {
  buildVarianceTrendsProjection,
} from "../../variance-trends/src";
import {
  buildProgressScurveProjection,
} from "../../progress-scurve/src";
import {
  buildQuantityScurveProjection,
} from "../../quantity-scurve/src";
import {
  buildProgressBreakdownProjection,
} from "../../progress-breakdown/src";
import {
  buildMilestonesProjection,
} from "../../milestones-analysis/src";
import {
  buildNearCriticalProjection,
} from "../../near-critical-analysis/src";
import {
  buildManhourScurveProjection,
} from "../../manhour-scurve/src";
import {
  buildForecastHistoryProjection,
  forecastSnapshotFromProjection,
} from "../../forecast-history/src";
import {
  buildIndependentForecastProjection,
} from "../../independent-forecast/src";
import {
  buildWindowsAnalysisProjection,
} from "../../windows-analysis/src";
import {
  buildDelayClaimsProjection,
} from "../../delay-claims/src";
import {
  buildNoticesClaimsProjection,
} from "../../notices-claims/src";
import {
  buildEotAssessmentProjection,
} from "../../eot-assessment/src";
import {
  buildChallengeContractProjection,
} from "../../challenge-contract/src";
import type {
  ProjectModuleResult,
  ProjectScheduleRuntimeContext,
} from "./types";

function missing(
  moduleKey: string,
  values: string[],
): ProjectModuleResult {
  return {
    status: "evidence_required",
    moduleKey,
    missingEvidence: values,
    message:
      "Required governed evidence is not available for this module. Missing values are not treated as zero.",
  };
}

function available(
  moduleKey: string,
  projection: unknown,
): ProjectModuleResult {
  return {
    status: "available",
    moduleKey,
    projection,
  };
}

function orderedRevisions(
  context: ProjectScheduleRuntimeContext,
) {
  return [...context.revisions].sort(
    (a, b) =>
      a.sequence - b.sequence ||
      a.revisionId.localeCompare(
        b.revisionId,
      ),
  );
}

function common(
  context: ProjectScheduleRuntimeContext,
) {
  const revisions =
    orderedRevisions(context);
  const current =
    revisions.at(-1);
  if (!current) {
    return null;
  }

  const scheduleAnalytics =
    buildScheduleAnalyticsProjection(
      current.model,
      {
        generatedAt: context.generatedAt,
        producerVersion:
          context.producerVersion,
      },
    );
  const milestones =
    buildMilestonesProjection(
      current.model,
      {
        generatedAt: context.generatedAt,
        producerVersion:
          context.producerVersion,
      },
    );
  const lookAhead =
    buildLookAheadProjection(
      current.model,
      {
        generatedAt: context.generatedAt,
        producerVersion:
          context.producerVersion,
        ...(context.readinessEvidence
          ? {
              readinessEvidence:
                context.readinessEvidence,
            }
          : {}),
      },
    );
  const progressScurve =
    buildProgressScurveProjection(
      current.model,
      {
        generatedAt: context.generatedAt,
        producerVersion:
          context.producerVersion,
        intervalDays: 7,
        ...(context.progressSnapshots
          ? {
              actualHistory:
                context.progressSnapshots,
            }
          : {}),
      },
    );
  const independentForecast =
    buildIndependentForecastProjection(
      current.model,
      {
        generatedAt: context.generatedAt,
        producerVersion:
          context.producerVersion,
      },
    );
  const progressReport =
    buildProgressReportProjection({
      generatedAt: context.generatedAt,
      producerVersion:
        context.producerVersion,
      scheduleAnalytics,
      milestones,
      lookAhead,
      progressScurve,
      independentForecast,
      ...(context.progressEvidence
        ? {
            progressEvidence:
              context.progressEvidence,
          }
        : {}),
    });

  return {
    revisions,
    current,
    scheduleAnalytics,
    milestones,
    lookAhead,
    progressScurve,
    independentForecast,
    progressReport,
  };
}

export function buildProjectScheduleModule(
  moduleKey: string,
  context: ProjectScheduleRuntimeContext,
): ProjectModuleResult {
  const c = common(context);
  if (!c) {
    return missing(
      moduleKey,
      ["schedule_revision"],
    );
  }

  const {
    revisions,
    current,
    scheduleAnalytics,
    milestones,
    lookAhead,
    progressScurve,
    independentForecast,
    progressReport,
  } = c;

  switch (moduleKey) {
    case "schedule-analytics":
      return available(
        moduleKey,
        scheduleAnalytics,
      );

    case "activity-analytics":
      return available(
        moduleKey,
        buildActivityAnalyticsProjection(
          current.model,
          {
            generatedAt:
              context.generatedAt,
            producerVersion:
              context.producerVersion,
          },
        ),
      );

    case "lookahead-schedule":
      return available(
        moduleKey,
        lookAhead,
      );

    case "progress-report":
      return available(
        moduleKey,
        progressReport,
      );

    case "progress-scurve":
      return available(
        moduleKey,
        progressScurve,
      );

    case "progress-breakdown":
      return available(
        moduleKey,
        buildProgressBreakdownProjection(
          current.model,
          {
            generatedAt:
              context.generatedAt,
            producerVersion:
              context.producerVersion,
          },
        ),
      );

    case "milestones":
      return available(
        moduleKey,
        milestones,
      );

    case "near-critical":
      return available(
        moduleKey,
        buildNearCriticalProjection(
          current.model,
          {
            generatedAt:
              context.generatedAt,
            producerVersion:
              context.producerVersion,
          },
        ),
      );

    case "independent-forecast":
      return available(
        moduleKey,
        independentForecast,
      );

    case "resource-utilization":
      if (!context.resourceModel) {
        return missing(
          moduleKey,
          ["resource_assignments"],
        );
      }
      return available(
        moduleKey,
        buildResourceUtilizationProjection(
          context.resourceModel,
          current.model,
          {
            generatedAt:
              context.generatedAt,
            producerVersion:
              context.producerVersion,
          },
        ),
      );

    case "manhour-scurve":
      if (!context.resourceModel) {
        return missing(
          moduleKey,
          ["resource_assignments"],
        );
      }
      return available(
        moduleKey,
        buildManhourScurveProjection(
          context.resourceModel,
          current.model,
          {
            generatedAt:
              context.generatedAt,
            producerVersion:
              context.producerVersion,
            intervalDays: 7,
          },
        ),
      );

    case "quantity-scurve":
      if (!context.quantityModel) {
        return missing(
          moduleKey,
          [
            "boq_quantity_mapping",
            "installed_quantity_evidence",
          ],
        );
      }
      return available(
        moduleKey,
        buildQuantityScurveProjection(
          context.quantityModel,
          current.model,
          {
            generatedAt:
              context.generatedAt,
            producerVersion:
              context.producerVersion,
            intervalDays: 7,
          },
        ),
      );

    case "schedule-change-report":
      if (revisions.length < 2) {
        return missing(
          moduleKey,
          ["second_schedule_revision"],
        );
      }
      return available(
        moduleKey,
        buildScheduleChangeReportProjection(
          revisions[
            revisions.length - 2
          ]!,
          current,
          {
            generatedAt:
              context.generatedAt,
            producerVersion:
              context.producerVersion,
          },
        ),
      );

    case "revision-trend":
      if (revisions.length < 2) {
        return missing(
          moduleKey,
          ["second_schedule_revision"],
        );
      }
      return available(
        moduleKey,
        buildRevisionTrendProjection(
          revisions,
          {
            generatedAt:
              context.generatedAt,
            producerVersion:
              context.producerVersion,
          },
        ),
      );

    case "variance-trends":
      if (revisions.length < 2) {
        return missing(
          moduleKey,
          ["second_schedule_revision"],
        );
      }
      return available(
        moduleKey,
        buildVarianceTrendsProjection(
          revisions,
          {
            generatedAt:
              context.generatedAt,
            producerVersion:
              context.producerVersion,
          },
        ),
      );

    case "forecast-history":
      if (revisions.length < 2) {
        return missing(
          moduleKey,
          ["second_schedule_revision"],
        );
      }
      return available(
        moduleKey,
        buildForecastHistoryProjection(
          revisions.map(
            (revision, index) =>
              forecastSnapshotFromProjection(
                buildIndependentForecastProjection(
                  revision.model,
                  {
                    generatedAt:
                      context.generatedAt,
                    producerVersion:
                      context.producerVersion,
                  },
                ),
                "forecast-" +
                  String(index + 1),
              ),
          ),
          {
            generatedAt:
              context.generatedAt,
            producerVersion:
              context.producerVersion,
          },
        ),
      );

    case "windows-analysis":
      if (
        revisions.length < 2 ||
        !context.delayClaimsModel
      ) {
        return missing(
          moduleKey,
          [
            ...(revisions.length < 2
              ? [
                  "second_schedule_revision",
                ]
              : []),
            ...(!context.delayClaimsModel
              ? ["delay_event_register"]
              : []),
          ],
        );
      }
      return available(
        moduleKey,
        buildWindowsAnalysisProjection(
          revisions,
          context.delayClaimsModel,
          {
            generatedAt:
              context.generatedAt,
            producerVersion:
              context.producerVersion,
          },
        ),
      );

    case "delay-claims":
      if (
        revisions.length < 2 ||
        !context.delayClaimsModel
      ) {
        return missing(
          moduleKey,
          [
            ...(revisions.length < 2
              ? [
                  "second_schedule_revision",
                ]
              : []),
            ...(!context.delayClaimsModel
              ? ["delay_event_register"]
              : []),
          ],
        );
      }
      return available(
        moduleKey,
        buildDelayClaimsProjection(
          buildWindowsAnalysisProjection(
            revisions,
            context.delayClaimsModel,
            {
              generatedAt:
                context.generatedAt,
              producerVersion:
                context.producerVersion,
            },
          ),
          context.delayClaimsModel,
          {
            generatedAt:
              context.generatedAt,
            producerVersion:
              context.producerVersion,
          },
        ),
      );

    case "notices-claims":
      if (!context.delayClaimsModel) {
        return missing(
          moduleKey,
          [
            "delay_event_notice_claim_register",
          ],
        );
      }
      return available(
        moduleKey,
        buildNoticesClaimsProjection(
          context.delayClaimsModel,
          {
            generatedAt:
              context.generatedAt,
            producerVersion:
              context.producerVersion,
          },
        ),
      );

    case "eot-assessment":
      if (
        revisions.length < 2 ||
        !context.delayClaimsModel ||
        !context.eotContractContext
      ) {
        return missing(
          moduleKey,
          [
            ...(revisions.length < 2
              ? [
                  "second_schedule_revision",
                ]
              : []),
            ...(!context.delayClaimsModel
              ? ["delay_event_register"]
              : []),
            ...(!context.eotContractContext
              ? [
                  "contractual_completion_and_eot_context",
                ]
              : []),
          ],
        );
      } {
        const windows =
          buildWindowsAnalysisProjection(
            revisions,
            context.delayClaimsModel,
            {
              generatedAt:
                context.generatedAt,
              producerVersion:
                context.producerVersion,
            },
          );
        const delays =
          buildDelayClaimsProjection(
            windows,
            context.delayClaimsModel,
            {
              generatedAt:
                context.generatedAt,
              producerVersion:
                context.producerVersion,
            },
          );
        return available(
          moduleKey,
          buildEotAssessmentProjection(
            windows,
            delays,
            context.eotContractContext,
            {
              generatedAt:
                context.generatedAt,
              producerVersion:
                context.producerVersion,
            },
          ),
        );
      }

    case "challenge-contract":
      if (!context.contract) {
        return missing(
          moduleKey,
          ["contract_document"],
        );
      }
      return available(
        moduleKey,
        buildChallengeContractProjection(
          context.contract,
          {
            generatedAt:
              context.generatedAt,
            producerVersion:
              context.producerVersion,
          },
        ),
      );

    case "pmo-analysis":
      if (
        !context.resourceModel ||
        !context.quantityModel ||
        !context.delayClaimsModel ||
        !context.eotContractContext ||
        !context.contract ||
        revisions.length < 2
      ) {
        return missing(
          moduleKey,
          [
            ...(!context.resourceModel
              ? ["resource_assignments"]
              : []),
            ...(!context.quantityModel
              ? [
                  "boq_quantity_mapping",
                  "installed_quantity_evidence",
                ]
              : []),
            ...(!context.delayClaimsModel
              ? [
                  "delay_event_notice_claim_register",
                ]
              : []),
            ...(!context.eotContractContext
              ? [
                  "contractual_completion_and_eot_context",
                ]
              : []),
            ...(!context.contract
              ? ["contract_document"]
              : []),
            ...(revisions.length < 2
              ? [
                  "second_schedule_revision",
                ]
              : []),
          ],
        );
      } {
        const resource =
          buildResourceUtilizationProjection(
            context.resourceModel,
            current.model,
            {
              generatedAt:
                context.generatedAt,
              producerVersion:
                context.producerVersion,
            },
          );
        const manhours =
          buildManhourScurveProjection(
            context.resourceModel,
            current.model,
            {
              generatedAt:
                context.generatedAt,
              producerVersion:
                context.producerVersion,
              intervalDays: 7,
            },
          );
        const quantity =
          buildQuantityScurveProjection(
            context.quantityModel,
            current.model,
            {
              generatedAt:
                context.generatedAt,
              producerVersion:
                context.producerVersion,
              intervalDays: 7,
            },
          );
        const windows =
          buildWindowsAnalysisProjection(
            revisions,
            context.delayClaimsModel,
            {
              generatedAt:
                context.generatedAt,
              producerVersion:
                context.producerVersion,
            },
          );
        const delays =
          buildDelayClaimsProjection(
            windows,
            context.delayClaimsModel,
            {
              generatedAt:
                context.generatedAt,
              producerVersion:
                context.producerVersion,
            },
          );
        const notices =
          buildNoticesClaimsProjection(
            context.delayClaimsModel,
            {
              generatedAt:
                context.generatedAt,
              producerVersion:
                context.producerVersion,
            },
          );
        const eot =
          buildEotAssessmentProjection(
            windows,
            delays,
            context.eotContractContext,
            {
              generatedAt:
                context.generatedAt,
              producerVersion:
                context.producerVersion,
            },
          );
        const challenge =
          buildChallengeContractProjection(
            context.contract,
            {
              generatedAt:
                context.generatedAt,
              producerVersion:
                context.producerVersion,
            },
          );
        const trend =
          buildRevisionTrendProjection(
            revisions,
            {
              generatedAt:
                context.generatedAt,
              producerVersion:
                context.producerVersion,
            },
          );
        return available(
          moduleKey,
          buildPmoAnalysisProjection({
            generatedAt:
              context.generatedAt,
            producerVersion:
              context.producerVersion,
            evidenceRevisionId:
              context.delayClaimsModel
                .evidenceRevisionId,
            scheduleAnalytics,
            progressReport,
            revisionTrend: trend,
            resourceUtilization:
              resource,
            manhourScurve: manhours,
            quantityScurve: quantity,
            independentForecast,
            challengeContract:
              challenge,
            noticesClaims: notices,
            delayClaims: delays,
            eotAssessment: eot,
          }),
        );
      }

    default:
      return missing(
        moduleKey,
        ["unsupported_module_key"],
      );
  }
}
