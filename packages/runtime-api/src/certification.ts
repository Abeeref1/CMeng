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

function requiredEqualityCheck(
  checkId: string,
  detail: string,
  values: Array<{
    source: string;
    value: unknown;
  }>,
): CrossModuleCertificationCheck {
  const sourceValue =
    values[0]?.value;
  if (
    sourceValue === null ||
    sourceValue === undefined
  ) {
    return {
      checkId,
      state:
        "not_applicable",
      detail,
      values,
    };
  }
  const sourceKey =
    normalized(sourceValue);
  const ok =
    values.every(
      (item) =>
        item.value !== null &&
        item.value !== undefined &&
        normalized(item.value) ===
          sourceKey,
    );
  return {
    checkId,
    state: ok
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
  const activity =
    data(
      modules,
      "activity-analytics",
    );
  const resources =
    data(
      modules,
      "resource-utilization",
    );
  const commercialOverview =
    data(
      modules,
      "commercial-overview",
    );

  const checks:
    CrossModuleCertificationCheck[] =
    [];

  checks.push(
    booleanCheck(
      "MODULE_COUNT_29",
      modules.size === 29,
      "The runtime must expose all 22 schedule modules plus 7 commercial control modules.",
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
    requiredEqualityCheck(
      "SOURCE_ACTIVITY_POPULATION_CONSISTENCY",
      "All schedule/activity/progress/PMO consumers must agree on the all-source activity population.",
      [
        {
          source: "schedule-analytics",
          value:
            scheduleAnalytics?.result
              ?.population
              ?.sourceActivityCount,
        },
        {
          source: "activity-analytics",
          value:
            activity?.population
              ?.sourceActivityCount,
        },
        {
          source: "progress-report",
          value:
            progress?.activityPopulation
              ?.sourceActivityCount,
        },
        {
          source: "pmo-analysis",
          value:
            pmo?.schedule
              ?.sourceActivityCount,
        },
      ],
    ),
  );

  checks.push(
    requiredEqualityCheck(
      "EXECUTABLE_ACTIVITY_POPULATION_CONSISTENCY",
      "Execution-status metrics must use the same executable activity population everywhere.",
      [
        {
          source: "schedule-analytics",
          value:
            scheduleAnalytics?.result
              ?.population
              ?.executableActivityCount,
        },
        {
          source: "activity-analytics",
          value:
            activity?.population
              ?.executableActivityCount,
        },
        {
          source: "progress-report",
          value:
            progress?.activityPopulation
              ?.executableActivityCount,
        },
        {
          source: "pmo-analysis",
          value:
            pmo?.schedule
              ?.executableActivityCount,
        },
      ],
    ),
  );

  const scheduleStatusTotal =
    scheduleAnalytics?.result
      ? (
          Number(
            scheduleAnalytics.result
              .status?.completed ?? 0,
          ) +
          Number(
            scheduleAnalytics.result
              .status?.inProgress ?? 0,
          ) +
          Number(
            scheduleAnalytics.result
              .status?.notStarted ?? 0,
          ) +
          Number(
            scheduleAnalytics.result
              .status?.unknown ?? 0,
          )
        )
      : null;
  checks.push(
    equalityCheck(
      "EXECUTION_STATUS_RECONCILIATION",
      "Completed, in-progress, not-started and unknown execution states must reconcile exactly to the executable population.",
      [
        {
          source:
            "schedule-analytics.executable-population",
          value:
            scheduleAnalytics?.result
              ?.population
              ?.executableActivityCount,
        },
        {
          source:
            "schedule-analytics.status-total",
          value:
            scheduleStatusTotal,
        },
        {
          source:
            "pmo.progress.status-total",
          value:
            pmo
              ? Number(
                  pmo.progress
                    ?.completedCount ?? 0,
                ) +
                Number(
                  pmo.progress
                    ?.inProgressCount ?? 0,
                ) +
                Number(
                  pmo.progress
                    ?.notStartedCount ?? 0,
                ) +
                Number(
                  pmo.progress
                    ?.unknownStatusCount ?? 0,
                )
              : null,
        },
      ],
    ),
  );

  checks.push(
    requiredEqualityCheck(
      "RESOURCE_COUNT_CONSISTENCY",
      "PMO and Resources must use the same distinct-resource population.",
      [
        {
          source: "resource-utilization",
          value:
            resources?.resourceCount,
        },
        {
          source: "pmo-analysis",
          value:
            pmo?.resources
              ?.resourceCount,
        },
      ],
    ),
  );
  checks.push(
    requiredEqualityCheck(
      "ASSIGNED_RESOURCE_COUNT_CONSISTENCY",
      "Assigned-resource count must mean distinct assigned resources, never assignment rows.",
      [
        {
          source: "resource-utilization",
          value:
            resources
              ?.assignedResourceCount,
        },
        {
          source: "pmo-analysis",
          value:
            pmo?.resources
              ?.assignedResourceCount,
        },
      ],
    ),
  );
  checks.push(
    requiredEqualityCheck(
      "RESOURCE_ASSIGNMENT_RECORD_COUNT_CONSISTENCY",
      "Resource assignment records must remain separate from distinct resource counts.",
      [
        {
          source: "resource-utilization",
          value:
            resources
              ?.assignmentRecordCount,
        },
        {
          source: "pmo-analysis",
          value:
            pmo?.resources
              ?.assignmentRecordCount,
        },
      ],
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
    requiredEqualityCheck(
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
            "pmo-analysis",
          value:
            pmo?.claims
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
    requiredEqualityCheck(
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
    requiredEqualityCheck(
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

  checks.push(
    requiredEqualityCheck(
      "CONTRACT_COMPLETION_BASIS_CONSISTENCY",
      "Contract completion must remain explicit and consistent between EOT and Project Director.",
      [
        {
          source: "eot-assessment",
          value:
            eot
              ?.contractualCompletionIso,
        },
        {
          source: "director",
          value:
            director?.schedule
              .contractualCompletionIso,
        },
      ],
    ),
  );
  checks.push(
    requiredEqualityCheck(
      "OFFICIAL_ADJUSTED_COMPLETION_BASIS_CONSISTENCY",
      "Official adjusted completion must never silently fall back to contract completion.",
      [
        {
          source: "eot-assessment",
          value:
            eot
              ?.officialAdjustedCompletionIso,
        },
        {
          source: "director",
          value:
            director?.schedule
              .officialAdjustedCompletionIso,
        },
      ],
    ),
  );
  checks.push(
    requiredEqualityCheck(
      "SUBMITTED_PROGRAMME_COMPLETION_BASIS_CONSISTENCY",
      "Submitted programme/source finish must remain separate from independent and contractual finishes.",
      [
        {
          source:
            "independent-forecast.source",
          value:
            forecast
              ?.sourceForecastCompletionIso,
        },
        {
          source: "director",
          value:
            director?.schedule
              .submittedProgrammeCompletionIso,
        },
      ],
    ),
  );

  checks.push(
    booleanCheck(
      "OFFICIAL_ADJUSTED_VARIANCE_REQUIRES_OFFICIAL_ADJUSTED_DATE",
      !director ||
      director.schedule
        .officialAdjustedCompletionIso !==
        null ||
      director.schedule
        .varianceDaysToOfficialAdjustedCompletion ===
        null,
      "Variance to official adjusted completion must be null whenever official adjusted completion is not established.",
      [
        {
          source:
            "director.officialAdjustedCompletion",
          value:
            director?.schedule
              .officialAdjustedCompletionIso,
        },
        {
          source:
            "director.varianceToOfficialAdjusted",
          value:
            director?.schedule
              .varianceDaysToOfficialAdjustedCompletion,
        },
      ],
    ),
  );

  const directorCurrencies =
    director?.commercialByCurrency ??
    [];
  const canonicalCurrencies =
    commercialOverview?.position
      ?.currencies ??
    commercialOverview?.focus
      ?.currencies ??
    commercialOverview?.currencies ??
    [];
  const canonicalByCurrency =
    new Map(
      canonicalCurrencies.map(
        (row: any) => [
          row.currency,
          row,
        ],
      ),
    );
  const commercialFields = [
    "pendingVariationAmount",
    "approvedVariationAmount",
    "certifiedUnpaidAmount",
    "retentionDeductedAmount",
    "retentionHeldAmount",
    "activeBondAmount",
  ] as const;
  const commercialMismatches:
    string[] = [];
  const falseZeroCommercial:
    string[] = [];
  for (
    const row of
      directorCurrencies
  ) {
    const canonical =
      canonicalByCurrency.get(
        row.currency,
      ) as any;
    if (!canonical) {
      commercialMismatches.push(
        row.currency +
          ":currency_missing_from_canonical",
      );
      continue;
    }
    for (
      const field of
        commercialFields
    ) {
      const management =
        (row as any)[field];
      const source =
        canonical[field];
      if (
        normalized(
          management?.value,
        ) !==
          normalized(
            source?.value,
          ) ||
        normalized(
          management?.state,
        ) !==
          normalized(
            source?.state,
          )
      ) {
        commercialMismatches.push(
          row.currency +
            ":" +
            field,
        );
      }
      if (
        management?.value === 0 &&
        management?.state !==
          "established"
      ) {
        falseZeroCommercial.push(
          row.currency +
            ":" +
            field,
        );
      }
    }
  }
  checks.push(
    booleanCheck(
      "DIRECTOR_COMMERCIAL_REUSES_CANONICAL_POSITION",
      commercialMismatches.length ===
        0,
      "Project Director commercial values/states must reuse canonical Commercial position without duplicate aggregation.",
      [{
        source:
          "commercial_mismatches",
        value:
          commercialMismatches.join(
            ",",
          ),
      }],
    ),
  );
  checks.push(
    booleanCheck(
      "MISSING_COMMERCIAL_IS_NOT_ZERO",
      falseZeroCommercial.length ===
        0,
      "A non-established commercial finding must never be exposed as numeric zero.",
      [{
        source:
          "false_zero_commercial_fields",
        value:
          falseZeroCommercial.join(
            ",",
          ),
      }],
    ),
  );

  const invalidProfessionalStates =
    [...modules.entries()]
      .filter(
        ([, result]) =>
          (
            result.status ===
              "ready" &&
            result.professionalState &&
            result.professionalState !==
              "defensible"
          ) ||
          (
            result.professionalState ===
              "defensible" &&
            result.status !==
              "ready"
          ),
      )
      .map(
        ([key]) => key,
      );
  checks.push(
    booleanCheck(
      "MODULE_STATUS_MATCHES_PROFESSIONAL_DEFENSIBILITY",
      invalidProfessionalStates
        .length === 0,
      "Visible ready/partial/blocked status must be derived from professional defensibility, not merely producer execution.",
      [{
        source:
          "invalid_module_states",
        value:
          invalidProfessionalStates.join(
            ",",
          ),
      }],
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
