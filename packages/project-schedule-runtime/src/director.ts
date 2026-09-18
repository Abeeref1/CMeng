import {
  buildScheduleAnalyticsProjection,
} from "../../schedule-analytics/src";
import {
  buildMilestonesProjection,
} from "../../milestones-analysis/src";
import {
  buildLookAheadProjection,
} from "../../lookahead-schedule/src";
import {
  buildProgressScurveProjection,
} from "../../progress-scurve/src";
import {
  buildIndependentForecastProjection,
} from "../../independent-forecast/src";
import {
  buildProgressReportProjection,
} from "../../progress-report/src";
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
  extractContractLdTerms,
} from "../../contract-commercial/src";
import {
  buildProjectDirectorPosition,
} from "../../project-director/src";
import type {
  ProjectDirectorRuntimeEvidence,
  ProjectDirectorRuntimeResult,
  ProjectScheduleRuntimeContext,
} from "./types";

export function buildProjectDirectorFromRuntime(
  projectId: string,
  context: ProjectScheduleRuntimeContext,
  evidence: ProjectDirectorRuntimeEvidence,
): ProjectDirectorRuntimeResult {
  const revisions = [
    ...context.revisions,
  ].sort(
    (a, b) =>
      a.sequence - b.sequence,
  );
  const current = revisions.at(-1);
  const missingEvidence: string[] = [];

  if (!current) {
    missingEvidence.push(
      "schedule_revision",
    );
  }
  if (revisions.length < 2) {
    missingEvidence.push(
      "second_schedule_revision",
    );
  }
  if (!context.delayClaimsModel) {
    missingEvidence.push(
      "delay_event_notice_claim_register",
    );
  }
  if (!context.eotContractContext) {
    missingEvidence.push(
      "contractual_completion_and_eot_context",
    );
  }
  if (!context.contract) {
    missingEvidence.push(
      "contract_document",
    );
  }

  if (
    !current ||
    revisions.length < 2 ||
    !context.delayClaimsModel ||
    !context.eotContractContext ||
    !context.contract
  ) {
    return {
      status: "evidence_required",
      missingEvidence,
      position: null,
    };
  }

  const scheduleAnalytics =
    buildScheduleAnalyticsProjection(
      current.model,
      {
        generatedAt:
          context.generatedAt,
        producerVersion:
          context.producerVersion,
      },
    );
  const milestones =
    buildMilestonesProjection(
      current.model,
      {
        generatedAt:
          context.generatedAt,
        producerVersion:
          context.producerVersion,
      },
    );
  const lookAhead =
    buildLookAheadProjection(
      current.model,
      {
        generatedAt:
          context.generatedAt,
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
        generatedAt:
          context.generatedAt,
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
        generatedAt:
          context.generatedAt,
        producerVersion:
          context.producerVersion,
      },
    );
  const progressReport =
    buildProgressReportProjection({
      generatedAt:
        context.generatedAt,
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
  const delayClaims =
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
  const noticesClaims =
    buildNoticesClaimsProjection(
      context.delayClaimsModel,
      {
        generatedAt:
          context.generatedAt,
        producerVersion:
          context.producerVersion,
      },
    );
  const eotAssessment =
    buildEotAssessmentProjection(
      windows,
      delayClaims,
      context.eotContractContext,
      {
        generatedAt:
          context.generatedAt,
        producerVersion:
          context.producerVersion,
      },
    );

  const position =
    buildProjectDirectorPosition({
      generatedAt:
        context.generatedAt,
      projectId,
      scheduleAnalytics,
      progressReport,
      independentForecast,
      delayClaims,
      noticesClaims,
      eotAssessment,
      ldTerms:
        extractContractLdTerms(
          context.contract,
        ),
      ...(evidence.contractValue
        ? {
            contractValue:
              evidence.contractValue,
          }
        : {}),
      variations: [
        ...evidence.variations,
      ],
      invoices: [
        ...evidence.invoices,
      ],
      retentions: [
        ...evidence.retentions,
      ],
      bonds: [
        ...evidence.bonds,
      ],
      claimCommercials: [
        ...evidence.claimCommercials,
      ],
      hseIncidents: [
        ...evidence.hseIncidents,
      ],
      ncrs: [...evidence.ncrs],
      rfis: [...evidence.rfis],
      permits: [...evidence.permits],
      boardEvidence:
        evidence.boardEvidence,
    });

  return {
    status: "available",
    missingEvidence: [],
    position,
  };
}
