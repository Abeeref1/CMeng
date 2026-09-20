import type {
  ProjectRuntimeState,
  ModuleRuntimeResult,
} from "./project-state-types";
import type {
  ProjectDirectorPosition,
} from "../../project-director/src";
import type {
  BoardReadyReport,
} from "../../board-report/src";
import {
  isProgrammeScheduleRevision,
} from "./project-state";

export interface CrossModuleCertificationCheck {
  checkId: string;
  state:
    | "pass"
    | "fail"
    | "not_applicable";
  detail: string;
  values: Array<{
    source: string;
    value: unknown;
  }>;
}

export interface CrossModuleCertification {
  schemaVersion: "1.0";
  state: "pass" | "fail";
  generatedAt: string;
  projectId: string;
  checkCount: number;
  failedCheckIds: string[];
  checks: CrossModuleCertificationCheck[];
}

function data(
  modules:
    Map<string, ModuleRuntimeResult>,
  key: string,
): any {
  return modules.get(key)?.data as any;
}

function normalized(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "__NULL__";
  }
  if (
    typeof value === "number"
  ) {
    return Number.isFinite(value)
      ? String(
          Number(
            value.toFixed(8),
          ),
        )
      : "__NONFINITE__";
  }
  return String(value);
}

function equalityCheck(
  checkId: string,
  detail: string,
  values: Array<{
    source: string;
    value: unknown;
  }>,
): CrossModuleCertificationCheck {
  const established =
    values.filter(
      (item) =>
        item.value !== null &&
        item.value !== undefined,
    );
  if (established.length < 2) {
    return {
      checkId,
      state:
        "not_applicable",
      detail,
      values,
    };
  }
  const keys =
    new Set(
      established.map(
        (item) =>
          normalized(
            item.value,
          ),
      ),
    );
  return {
    checkId,
    state:
      keys.size === 1
        ? "pass"
        : "fail",
    detail,
    values,
  };
}

function booleanCheck(
  checkId: string,
  ok: boolean,
  detail: string,
  values: CrossModuleCertificationCheck["values"] = [],
): CrossModuleCertificationCheck {
  return {
    checkId,
    state:
      ok ? "pass" : "fail",
    detail,
    values,
  };
}

export function certifyCrossModuleConsistency(
  input: {
    generatedAt: string;
    state: ProjectRuntimeState;
    modules:
      Map<
        string,
        ModuleRuntimeResult
      >;
    director:
      ProjectDirectorPosition | null;
    boardReport:
      BoardReadyReport | null;
  },
): CrossModuleCertification {
  const {
    state,
    modules,
    director,
    boardReport,
  } = input;

  const forecast =
    data(
      modules,
      "independent-forecast",
    );
  const progress =
    data(
      modules,
      "progress-report",
    );
  const scheduleAnalytics =
    data(
      modules,
      "schedule-analytics",
    );
  const progressScurve =
    data(
      modules,
      "progress-scurve",
    );
  const challenge =
    data(
      modules,
      "challenge-contract",
    );
  const pmo =
    data(
      modules,
      "pmo-analysis",
    );
  const windows =
    data(
      modules,
      "windows-analysis",
    );
  const delay =
    data(
      modules,
      "delay-claims",
    );
  const eot =
    data(
      modules,
      "eot-assessment",
    );
  const quantity =
    data(
      modules,
      "quantity-scurve",
    );
  const nearCritical =
    data(
      modules,
      "near-critical",
    );
  const resources =
    data(
      modules,
      "resource-utilization",
    );
  const manhours =
    data(
      modules,
      "manhour-scurve",
    );

  const checks:
    CrossModuleCertificationCheck[] =
    [];

  checks.push(
    booleanCheck(
      "MODULE_COUNT_22",
      modules.size === 22,
      "The runtime must expose all 22 specialist modules.",
      [{
        source:
          "runtime.modules",
        value: modules.size,
      }],
    ),
  );

  const challengeMissing =
    [...modules.entries()]
      .filter(
        ([, result]) =>
          !(
            result.data &&
            typeof result.data ===
              "object" &&
            "challenge" in
              (
                result.data as
                  Record<
                    string,
                    unknown
                  >
              )
          ),
      )
      .map(([key]) => key);

  checks.push(
    booleanCheck(
      "SHARED_CHALLENGE_ENVELOPE_ALL_MODULES",
      challengeMissing.length ===
        0,
      "Every specialist module must expose the shared submitted/independent/gap/consequence/action envelope.",
      [{
        source:
          "modules_without_challenge",
        value:
          challengeMissing.join(
            ",",
          ),
      }],
    ),
  );

  checks.push(
    equalityCheck(
      "INDEPENDENT_COMPLETION_CONSISTENCY",
      "Independent completion must remain consistent from Forecast through Progress, Challenge, PMO, Director and Board unless a module declares another basis.",
      [
        {
          source:
            "independent-forecast",
          value:
            forecast
              ?.independentForecastCompletionIso,
        },
        {
          source:
            "progress-report",
          value:
            progress
              ?.forecast
              ?.independentForecastCompletionIso,
        },
        {
          source:
            "challenge-contract",
          value:
            challenge
              ?.deliveryChallenge
              ?.scheduleChallenge
              ?.independentCompletionIso,
        },
        {
          source:
            "pmo-analysis",
          value:
            pmo?.forecast
              ?.independentCompletionIso,
        },
        {
          source:
            "director",
          value:
            director?.schedule
              .independentForecastCompletionIso,
        },
        {
          source:
            "board-report",
          value:
            boardReport
              ?.sections
              .executivePosition
              .independentForecastCompletionIso,
        },
      ],
    ),
  );

  checks.push(
    equalityCheck(
      "PROGRAMME_MOVEMENT_PROPAGATION",
      "Programme movement calculated in Windows must propagate to Delay, EOT, Director and Board without disappearing.",
      [
        {
          source:
            "windows-analysis",
          value:
            windows
              ?.positiveProgrammeMovementDays,
        },
        {
          source:
            "delay-claims",
          value:
            delay
              ?.observedPositiveProgrammeMovementDays,
        },
        {
          source:
            "eot-assessment",
          value:
            eot
              ?.observedProgrammeMovementDays,
        },
        {
          source:
            "director",
          value:
            director?.claims
              .observedProgrammeMovementDays,
        },
        {
          source:
            "board-report",
          value:
            boardReport
              ?.sections
              .claims
              ?.observedProgrammeMovementDays,
        },
      ],
    ),
  );

  const programmeSchedules =
    state.schedules.filter(
      isProgrammeScheduleRevision,
    );
  const latest =
    programmeSchedules
      .filter(
        (item) =>
          item.role !==
          "recovery",
      )
      .sort(
        (a, b) =>
          (
            a.revision.model
              .dataDateIso ??
            a.revision
              .effectiveAt ??
            ""
          ).localeCompare(
            b.revision.model
              .dataDateIso ??
            b.revision
              .effectiveAt ??
            "",
          ),
      )
      .at(-1) ??
    null;

  checks.push(
    equalityCheck(
      "DATA_DATE_CONSISTENCY",
      "The current analytical Data Date must be consistent across Forecast, Progress and Director.",
      [
        {
          source:
            "active-schedule",
          value:
            latest?.revision.model
              .dataDateIso,
        },
        {
          source:
            "independent-forecast",
          value:
            forecast?.dataDateIso,
        },
        {
          source:
            "progress-report",
          value:
            progress?.dataDateIso,
        },
        {
          source:
            "director",
          value:
            director?.schedule
              .dataDateIso,
        },
      ],
    ),
  );

  const governedScheduleArtifactId =
    state.activeEvidenceBasis[
      "schedule:control"
    ]?.activeArtifactId ??
    state.activeEvidenceBasis[
      "schedule:baseline"
    ]?.activeArtifactId ??
    null;
  const governedProgrammeSchedule =
    governedScheduleArtifactId
      ? programmeSchedules.find(
          (item) =>
            item.revision
              .revisionId ===
            governedScheduleArtifactId,
        ) ??
        null
      : null;
  const activeScheduleRevisionId =
    governedProgrammeSchedule
      ?.revision.revisionId ??
    latest?.revision.revisionId ??
    null;

  checks.push(
    equalityCheck(
      "ACTIVE_SCHEDULE_REVISION_CONSISTENCY",
      "The active schedule revision must remain the same across Schedule Analytics, Forecast, Progress, Progress S-Curve, Challenge and Quantity analysis.",
      [
        {
          source:
            "active-evidence-basis",
          value:
            activeScheduleRevisionId,
        },
        {
          source:
            "schedule-analytics",
          value:
            scheduleAnalytics
              ?.result
              ?.sourceRevisionId,
        },
        {
          source:
            "independent-forecast",
          value:
            forecast
              ?.sourceRevisionId,
        },
        {
          source:
            "progress-report",
          value:
            progress
              ?.sourceRevisionId,
        },
        {
          source:
            "progress-scurve",
          value:
            progressScurve
              ?.sourceRevisionId,
        },
        {
          source:
            "challenge-contract",
          value:
            challenge
              ?.deliveryChallenge
              ?.sourceRevisionId,
        },
        {
          source:
            "quantity-scurve",
          value:
            quantity
              ?.scheduleRevisionId,
        },
        {
          source:
            "director",
          value:
            director?.schedule
              .independentForecastBasisRevisionId,
        },
        {
          source:
            "board-report",
          value:
            boardReport
              ?.sections
              .executivePosition
              .independentForecastBasisRevisionId,
        },
      ],
    ),
  );

  checks.push(
    equalityCheck(
      "PROGRESS_VALUE_CONSISTENCY",
      "Duration-weighted progress must remain consistent from Schedule Analytics through Progress Report and PMO Analysis.",
      [
        {
          source:
            "schedule-analytics",
          value:
            scheduleAnalytics
              ?.result
              ?.progress
              ?.durationWeightedPercentComplete
              ?.value,
        },
        {
          source:
            "progress-report",
          value:
            progress
              ?.progress
              ?.durationWeightedProgressPercent,
        },
        {
          source:
            "pmo-analysis",
          value:
            pmo?.progress
              ?.durationWeightedProgressPercent,
        },
      ],
    ),
  );

  checks.push(
    equalityCheck(
      "PROGRESS_COVERAGE_CONSISTENCY",
      "Duration-weighted progress coverage must remain consistent from Schedule Analytics through Progress Report and PMO Analysis.",
      [
        {
          source:
            "schedule-analytics",
          value:
            scheduleAnalytics
              ?.result
              ?.progress
              ?.durationWeightedPercentComplete
              ?.coveragePercent,
        },
        {
          source:
            "progress-report",
          value:
            progress
              ?.progress
              ?.durationWeightedProgressCoveragePercent,
        },
        {
          source:
            "pmo-analysis",
          value:
            pmo?.progress
              ?.progressCoveragePercent,
        },
      ],
    ),
  );

  checks.push(
    equalityCheck(
      "FORECAST_COVERAGE_CONSISTENCY",
      "Independent forecast activity coverage must remain consistent from Forecast through Progress, PMO, Director and Board.",
      [
        {
          source:
            "independent-forecast",
          value:
            forecast
              ?.activityCoveragePercent,
        },
        {
          source:
            "progress-report",
          value:
            progress
              ?.forecast
              ?.activityCoveragePercent,
        },
        {
          source:
            "pmo-analysis",
          value:
            pmo?.forecast
              ?.activityCoveragePercent,
        },
        {
          source:
            "director",
          value:
            director?.schedule
              .independentForecastCoveragePercent,
        },
        {
          source:
            "board-report",
          value:
            boardReport
              ?.sections
              .executivePosition
              .independentForecastCoveragePercent,
        },
      ],
    ),
  );

  checks.push(
    equalityCheck(
      "FORECAST_AUTHORITY_CONSISTENCY",
      "Independent forecast authority must remain consistent from Progress through PMO, Director and Board.",
      [
        {
          source:
            "progress-report",
          value:
            progress
              ?.forecast
              ?.authority,
        },
        {
          source:
            "pmo-analysis",
          value:
            pmo?.forecast
              ?.authority,
        },
        {
          source:
            "director",
          value:
            director?.schedule
              .independentForecastAuthority,
        },
        {
          source:
            "board-report",
          value:
            boardReport
              ?.sections
              .executivePosition
              .independentForecastAuthority,
        },
      ],
    ),
  );

  const progressCurveContractOk =
    !progressScurve ||
    (
      progressScurve
        .seriesContract
        ?.seriesKey ===
        "progress_percent" &&
      progressScurve
        .seriesContract
        ?.unit === "%" &&
      progressScurve
        .seriesContract
        ?.authority ===
        "derived_schedule" &&
      progressScurve
        .seriesContract
        ?.basisRevisionId ===
        progressScurve
          .sourceRevisionId &&
      Array.isArray(
        progressScurve
          .seriesContract
          ?.sourceRefs,
      ) &&
      progressScurve
        .seriesContract
        .sourceRefs.length > 0
    );

  checks.push(
    booleanCheck(
      "PROGRESS_CURVE_CONTRACT",
      progressCurveContractOk,
      "Progress S-Curve must carry a percent unit, schedule-derived authority, revision basis and evidence references.",
      [
        {
          source:
            "progress-scurve.seriesContract",
          value:
            progressScurve
              ?.seriesContract ??
            null,
        },
      ],
    ),
  );

  const quantitySeries =
    Array.isArray(
      quantity?.series,
    )
      ? quantity.series
      : [];
  const quantityUnitKeys =
    quantitySeries.map(
      (series: any) =>
        series.unitKey,
    );
  const quantityCurveContractOk =
    !quantity ||
    (
      quantity.unitKeyed ===
        true &&
      quantitySeries.every(
        (series: any) =>
          typeof series
            .seriesKey ===
            "string" &&
          typeof series
            .unitKey ===
            "string" &&
          series.unitKey.length >
            0 &&
          (
            series.authority ===
              "governed_mapping" ||
            series.authority ===
              "scenario_mapping"
          ) &&
          Array.isArray(
            series.sourceRefs,
          )
      ) &&
      new Set(
        quantityUnitKeys,
      ).size ===
        quantityUnitKeys.length
    );

  checks.push(
    booleanCheck(
      "QUANTITY_CURVE_UNIT_AUTHORITY_CONTRACT",
      quantityCurveContractOk,
      "Quantity S-Curve must remain unit-keyed, keep one series per unit key and declare governed versus scenario mapping authority.",
      [
        {
          source:
            "quantity-scurve.unitKeyed",
          value:
            quantity?.unitKeyed ??
            null,
        },
        {
          source:
            "quantity-scurve.unitKeys",
          value:
            quantityUnitKeys.join(
              ",",
            ),
        },
      ],
    ),
  );

  checks.push(
    equalityCheck(
      "BOQ_ACTIVE_DOCUMENT_CONSISTENCY",
      "The active BOQ evidence artifact must match the runtime BOQ ingestion that owns the current quantity basis.",
      [
        {
          source:
            "active-evidence-basis",
          value:
            state.activeEvidenceBasis[
              "boq:quantity"
            ]?.activeArtifactId ??
            null,
        },
        {
          source:
            "boq-runtime-ingestion",
          value:
            state.boq
              ?.ingestionId,
        },
      ],
    ),
  );

  checks.push(
    equalityCheck(
      "BOQ_BASIS_CONSISTENCY",
      "The canonical quantity model and Quantity S-Curve must use the same BOQ evidence revision as the active runtime BOQ.",
      [
        {
          source:
            "boq-runtime-revision",
          value:
            state.boq
              ?.evidenceReceipt
              ?.revisionId,
        },
        {
          source:
            "quantity-model",
          value:
            state.quantities
              ?.boqRevisionId,
        },
        {
          source:
            "quantity-scurve",
          value:
            quantity
              ?.boqRevisionId,
        },
      ],
    ),
  );

  checks.push(
    equalityCheck(
      "SOURCE_DATA_DATE_RECONCILIATION",
      "When a governed/source schedule metric register publishes a Data Date, it must match the active programme Data Date and the value presented by Schedule Analytics.",
      [
        {
          source:
            "active-programme",
          value:
            latest?.revision.model
              .dataDateIso,
        },
        {
          source:
            "source-metric-register",
          value:
            scheduleAnalytics
              ?.scheduleControlPolicy
              ?.sourceDataDateIso,
        },
        {
          source:
            "schedule-analytics",
          value:
            scheduleAnalytics
              ?.result
              ?.dataDateIso,
        },
      ],
    ),
  );

  checks.push(
    equalityCheck(
      "SOURCE_NEAR_CRITICAL_RECONCILIATION",
      "When the source control basis/register establishes a near-critical population, the calculated watchlist must reconcile to that source-controlled policy rather than a global default.",
      [
        {
          source:
            "source-reported-near-critical",
          value:
            nearCritical
              ?.sourceReportedNearCriticalCount ??
            scheduleAnalytics
              ?.scheduleControlPolicy
              ?.sourceReportedNearCriticalCount,
        },
        {
          source:
            "near-critical-calculation",
          value:
            nearCritical
              ?.nearCriticalCount,
        },
      ],
    ),
  );

  checks.push(
    equalityCheck(
      "RESOURCE_SOURCE_POPULATION_RECONCILIATION",
      "Canonical resource support population must propagate to the Resources module without becoming schedule-only demand.",
      [
        {
          source:
            "canonical-resource-support",
          value:
            state.resourceSupport
              ?.utilizationApplicableResourceCount,
        },
        {
          source:
            "resource-module",
          value:
            resources
              ?.sourceUtilizationApplicableResourceCount,
        },
      ],
    ),
  );

  checks.push(
    equalityCheck(
      "RESOURCE_WEEK_ROWS_RECONCILIATION",
      "Weekly resource-capacity row population must remain identical from canonical source evidence to the Resources module.",
      [
        {
          source:
            "canonical-resource-support",
          value:
            state.resourceSupport
              ?.weeklyRowCount,
        },
        {
          source:
            "resource-module",
          value:
            resources
              ?.weeklyCapacityEvidence
              ?.rowCount,
        },
      ],
    ),
  );

  checks.push(
    equalityCheck(
      "RESOURCE_PLANNED_UTILIZATION_RECONCILIATION",
      "Planned utilization from governed weekly resource evidence must propagate without unit mixing or silent recalculation on another basis.",
      [
        {
          source:
            "canonical-resource-support",
          value:
            state.resourceSupport
              ?.averagePlannedUtilizationToDataDatePercent,
        },
        {
          source:
            "resource-module",
          value:
            resources
              ?.sourceAveragePlannedUtilizationPercent,
        },
      ],
    ),
  );

  checks.push(
    equalityCheck(
      "RESOURCE_ACTUAL_UTILIZATION_RECONCILIATION",
      "Approved actual utilization from governed weekly resource evidence must propagate without being replaced by planned demand.",
      [
        {
          source:
            "canonical-resource-support",
          value:
            state.resourceSupport
              ?.averageActualUtilizationToDataDatePercent,
        },
        {
          source:
            "resource-module",
          value:
            resources
              ?.sourceAverageActualUtilizationPercent,
        },
      ],
    ),
  );

  checks.push(
    equalityCheck(
      "CONTRACT_TIME_BASIS_RECONCILIATION",
      "The governed contractual completion from the active contract/amendment family must propagate unchanged to EOT assessment.",
      [
        {
          source:
            "canonical-contract-time-basis",
          value:
            state.controls
              .contractTimeBasis
              ?.contractualCompletionIso,
        },
        {
          source:
            "eot-assessment",
          value:
            eot
              ?.contractualCompletionIso,
        },
      ],
    ),
  );

  const contractTimeSourceBound =
    !state.controls
      .contractTimeBasis
      ?.contractualCompletionIso ||
    (
      state.controls
        .contractTimeBasis
        .contractualCompletionState !==
        "missing" &&
      state.controls
        .contractTimeBasis
        .sourceRefs.length > 0
    );
  checks.push(
    booleanCheck(
      "CONTRACT_TIME_SOURCE_RECEIPT",
      contractTimeSourceBound,
      "An established contractual completion must retain contract/amendment source references and authority state.",
      [{
        source:
          "contract-time.sourceRefs",
        value:
          state.controls
            .contractTimeBasis
            ?.sourceRefs
            ?.join(",") ??
          null,
      }],
    ),
  );

  checks.push(
    equalityCheck(
      "ENGINEER_DETERMINATION_COUNT_RECONCILIATION",
      "Engineer determination register population must propagate to EOT without being collapsed into a generic approved-EOT number.",
      [
        {
          source:
            "canonical-contract-time-basis",
          value:
            state.controls
              .contractTimeBasis
              ?.engineerDeterminationCount,
        },
        {
          source:
            "eot-assessment",
          value:
            eot
              ?.engineerDeterminationCount,
        },
      ],
    ),
  );

  checks.push(
    equalityCheck(
      "ENGINEER_DETERMINATION_DAYS_RECONCILIATION",
      "The determination-register awarded-day total must remain a separate source fact and must not be silently added to incorporated amendment days.",
      [
        {
          source:
            "canonical-contract-time-basis",
          value:
            state.controls
              .contractTimeBasis
              ?.engineerDeterminationAwardedDaysTotal,
        },
        {
          source:
            "eot-assessment",
          value:
            eot
              ?.engineerDeterminationAwardedDaysTotal,
        },
      ],
    ),
  );

  checks.push(
    equalityCheck(
      "DELAY_EVENT_IDENTITY_RECONCILIATION",
      "Registered delay-event identities must reconcile from the merged claims/EOT evidence model to the Delay Events module.",
      [
        {
          source:
            "canonical-delay-model",
          value:
            state.controls
              .delayClaims
              ?.events.length,
        },
        {
          source:
            "delay-events-module",
          value:
            delay
              ?.registeredEventIdentityCount,
        },
      ],
    ),
  );

  checks.push(
    equalityCheck(
      "SOURCE_PRODUCTIVITY_FORECAST_RECONCILIATION",
      "A source productivity forecast must remain distinct and propagate unchanged into the forecast taxonomy.",
      [
        {
          source:
            "canonical-source-productivity",
          value:
            state.sourceProductivityForecast
              ?.independentForecastCompletionIso,
        },
        {
          source:
            "forecast-taxonomy",
          value:
            forecast
              ?.forecastTaxonomy
              ?.sourceProductivityForecastIso,
        },
      ],
    ),
  );

  checks.push(
    equalityCheck(
      "APPROVED_MANHOUR_HISTORY_AUTHORITY",
      "When approved source resource-week history is present, the Man-Hour S-Curve must expose that authority rather than label the curve as reconstructed schedule history.",
      [
        {
          source:
            "canonical-approved-resource-usage",
          value:
            state.resourceSupport
              ?.actualUsageRowCount
              ? "approved_source_register"
              : null,
        },
        {
          source:
            "manhour-scurve",
          value:
            manhours
              ?.actualHistoryAuthority,
        },
      ],
    ),
  );

  const invalidChallengeValues:
    string[] = [];
  const invalidAuthorityValues:
    string[] = [];
  const invalidCoverageValues:
    string[] = [];
  const invalidConfidenceValues:
    string[] = [];
  const unresolvedConflictOutputs:
    string[] = [];
  for (
    const [
      moduleKey,
      result,
    ] of modules.entries()
  ) {
    const envelope =
      (
        result.data as
          | any
          | null
      )?.challenge;
    for (
      const item of
        envelope?.items ?? []
    ) {
      for (
        const [side, value] of [
          [
            "submitted",
            item.submitted,
          ],
          [
            "independent",
            item.independent,
          ],
        ] as const
      ) {
        if (
          value &&
          value.state !==
            "not_submitted" &&
          value.state !==
            "not_derivable" &&
          value.value !== null
        ) {
          const valueKey =
            moduleKey +
            ":" +
            item.metric +
            ":" +
            side;

          if (
            !Array.isArray(
              value.sourceRefs,
            ) ||
            value.sourceRefs
              .length === 0
          ) {
            invalidChallengeValues.push(
              valueKey,
            );
          }

          if (
            !value.authority ||
            value.authority ===
              "missing"
          ) {
            invalidAuthorityValues.push(
              valueKey,
            );
          }

          if (
            value.coveragePercent !==
              null &&
            value.coveragePercent !==
              undefined &&
            (
              typeof value
                .coveragePercent !==
                "number" ||
              !Number.isFinite(
                value
                  .coveragePercent,
              ) ||
              value
                .coveragePercent <
                0 ||
              value
                .coveragePercent >
                100
            )
          ) {
            invalidCoverageValues.push(
              valueKey,
            );
          }

          if (
            value.confidence !==
              null &&
            value.confidence !==
              undefined &&
            (
              typeof value
                .confidence !==
                "number" ||
              !Number.isFinite(
                value.confidence,
              ) ||
              value.confidence <
                0 ||
              value.confidence >
                1
            )
          ) {
            invalidConfidenceValues.push(
              valueKey,
            );
          }
        }
      }
    }

    for (
      const item of
        envelope?.items ?? []
    ) {
      if (
        item.submitted?.state ===
        "conflicted"
      ) {
        const recommendation =
          item
            .conflictRecommendation;
        const comparisons =
          item
            .candidateComparisons;
        if (
          !recommendation ||
          recommendation
            .userDecisionRequired !==
            true ||
          !Array.isArray(
            comparisons,
          ) ||
          comparisons.length < 2
        ) {
          unresolvedConflictOutputs.push(
            moduleKey +
              ":" +
              item.metric,
          );
        }
      }
    }
  }

  checks.push(
    booleanCheck(
      "EVIDENCE_LINKS_ON_ESTABLISHED_VALUES",
      invalidChallengeValues
        .length === 0,
      "Established submitted and independent challenge values must retain evidence/source references.",
      [{
        source:
          "values_missing_source_refs",
        value:
          invalidChallengeValues.join(
            ",",
          ),
      }],
    ),
  );

  checks.push(
    booleanCheck(
      "AUTHORITY_ON_ESTABLISHED_VALUES",
      invalidAuthorityValues
        .length === 0,
      "Every established challenge value must carry a non-missing authority.",
      [{
        source:
          "values_missing_authority",
        value:
          invalidAuthorityValues.join(
            ",",
          ),
      }],
    ),
  );

  checks.push(
    booleanCheck(
      "COVERAGE_RANGE_ON_EVIDENCE_VALUES",
      invalidCoverageValues
        .length === 0,
      "Coverage on evidence-safe values must be null or within 0..100 percent.",
      [{
        source:
          "invalid_coverage_values",
        value:
          invalidCoverageValues.join(
            ",",
          ),
      }],
    ),
  );

  checks.push(
    booleanCheck(
      "CONFIDENCE_RANGE_ON_EVIDENCE_VALUES",
      invalidConfidenceValues
        .length === 0,
      "Confidence on evidence-safe values must be null or within 0..1.",
      [{
        source:
          "invalid_confidence_values",
        value:
          invalidConfidenceValues.join(
            ",",
          ),
      }],
    ),
  );

  checks.push(
    booleanCheck(
      "CONTRADICTIONS_REMAIN_CALCULABLE_AND_USER_GOVERNED",
      unresolvedConflictOutputs
        .length === 0,
      "Contradictory submitted values must retain at least two candidate calculations and require a user decision; CMeng may recommend but must not silently govern one.",
      [{
        source:
          "invalid_conflict_outputs",
        value:
          unresolvedConflictOutputs.join(
            ",",
          ),
      }],
    ),
  );

  if (
    boardReport &&
    state.controls
      .boardPublication
  ) {
    const expectedReceipts = [
      ...new Set(
        state.controls
          .boardPublication
          .evidenceReceiptIds,
      ),
    ].sort();
    const actualReceipts = [
      ...new Set(
        boardReport
          .evidenceReceiptIds,
      ),
    ].sort();

    checks.push(
      booleanCheck(
        "BOARD_EXPORT_PUBLICATION_BASIS",
        boardReport
          .sourceManifestId ===
          state.controls
            .boardPublication
            .sourceManifestId &&
        boardReport
          .publicationReceipt
          .finalizedAt ===
          state.controls
            .boardPublication
            .finalizedAt &&
        JSON.stringify(
          actualReceipts,
        ) ===
          JSON.stringify(
            expectedReceipts,
          ),
        "Board/export output must reference exactly the active publication source manifest, evidence receipts and finalization timestamp.",
        [
          {
            source:
              "board.sourceManifestId",
            value:
              boardReport
                .sourceManifestId,
          },
          {
            source:
              "controls.sourceManifestId",
            value:
              state.controls
                .boardPublication
                .sourceManifestId,
          },
          {
            source:
              "board.evidenceReceiptIds",
            value:
              actualReceipts.join(
                ",",
              ),
          },
          {
            source:
              "controls.evidenceReceiptIds",
            value:
              expectedReceipts.join(
                ",",
              ),
          },
        ],
      ),
    );
  } else {
    checks.push({
      checkId:
        "BOARD_EXPORT_PUBLICATION_BASIS",
      state:
        "not_applicable",
      detail:
        "Board/export publication basis check applies when a current board report and publication input both exist.",
      values: [],
    });
  }

  const staleFinalized =
    state.boardPublicationHistory
      .filter(
        (item) =>
          item.stale,
      );
  const currentFinalized =
    state.boardPublicationHistory
      .filter(
        (item) =>
          !item.stale,
      );
  const boardHistoryValid =
    !(
      staleFinalized.length > 0 &&
      currentFinalized.some(
        (item) =>
          staleFinalized.some(
            (stale) =>
              stale.publicationId ===
              item.publicationId,
          ),
      )
    );

  checks.push(
    booleanCheck(
      "BOARD_PUBLICATION_VERSION_GOVERNANCE",
      boardHistoryValid,
      "Finalized board publications must be versioned and become stale rather than silently mutating after evidence changes.",
      [
        {
          source:
            "stale_publication_count",
          value:
            staleFinalized.length,
        },
        {
          source:
            "current_publication_count",
          value:
            currentFinalized.length,
        },
      ],
    ),
  );

  const failed =
    checks.filter(
      (check) =>
        check.state ===
        "fail",
    );

  return {
    schemaVersion: "1.0",
    state:
      failed.length === 0
        ? "pass"
        : "fail",
    generatedAt:
      input.generatedAt,
    projectId:
      state.projectId,
    checkCount:
      checks.length,
    failedCheckIds:
      failed.map(
        (check) =>
          check.checkId,
      ),
    checks,
  };
}
