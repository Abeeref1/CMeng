import type {
  ScheduleAnalyticsProjection,
} from "../../schedule-analytics/src";
import type {
  MilestonesProjection,
} from "../../milestones-analysis/src";
import type {
  LookAheadProjection,
} from "../../lookahead-schedule/src";
import type {
  ProgressScurveProjection,
} from "../../progress-scurve/src";
import type {
  IndependentForecastProjection,
} from "../../independent-forecast/src";
import type {
  ExternalProgressBases,
  ExternalProgressBasisInput,
  ProgressBasisName,
  ProgressReportBasisValue,
  ProgressReportProjection,
} from "./types";

function latestActualSnapshot(
  scurve: ProgressScurveProjection,
): number | null {
  if (scurve.actualSnapshots.length === 0) {
    return null;
  }

  const ordered = [
    ...scurve.actualSnapshots,
  ].sort(
    (a, b) =>
      Date.parse(a.asOfIso) -
      Date.parse(b.asOfIso),
  );

  return ordered[ordered.length - 1]!
    .progressPercent;
}

function exactDataDatePoint(
  scurve: ProgressScurveProjection,
) {
  if (!scurve.dataDateIso) return null;
  return (
    scurve.points.find(
      (point) =>
        point.dateIso ===
        scurve.dataDateIso,
    ) ?? null
  );
}

function derivedBasis(
  input: {
    basis: ProgressBasisName;
    valuePercent: number | null;
    coveragePercent: number | null;
    dataDateIso: string | null;
    sourceRef: string;
    method: string;
  },
): ProgressReportBasisValue {
  const state =
    input.valuePercent === null
      ? "missing"
      : input.coveragePercent === 100
        ? "derived"
        : "partial";

  return {
    basis: input.basis,
    valuePercent: input.valuePercent,
    state,
    asOfIso: input.dataDateIso,
    coveragePercent:
      input.coveragePercent,
    sourceRefs: [input.sourceRef],
    method: input.method,
  };
}

function externalBasis(
  basis: ProgressBasisName,
  input: ExternalProgressBasisInput | undefined,
  dataDateIso: string | null,
): {
  value: ProgressReportBasisValue;
  diagnostics: string[];
} {
  const key =
    basis.toUpperCase();

  if (!input) {
    return {
      value: {
        basis,
        valuePercent: null,
        state: "missing",
        asOfIso: null,
        coveragePercent: null,
        sourceRefs: [],
        method:
          "governed_external_progress_evidence_required",
      },
      diagnostics: [
        key +
          "_PROGRESS_EVIDENCE_MISSING",
      ],
    };
  }

  const diagnostics: string[] = [];

  if (
    input.valuePercent !== null &&
    (
      !Number.isFinite(
        input.valuePercent,
      ) ||
      input.valuePercent < 0 ||
      input.valuePercent > 100
    )
  ) {
    diagnostics.push(
      key +
        "_PROGRESS_PERCENT_INVALID",
    );

    return {
      value: {
        basis,
        valuePercent: null,
        state: "conflicted",
        asOfIso: input.asOfIso,
        coveragePercent: null,
        sourceRefs: [
          ...input.sourceRefs,
        ],
        method: input.method,
      },
      diagnostics,
    };
  }

  if (
    input.valuePercent === null &&
    input.state !== "missing" &&
    input.state !== "conflicted"
  ) {
    diagnostics.push(
      key +
        "_PROGRESS_VALUE_MISSING_FOR_DECLARED_STATE",
    );

    return {
      value: {
        basis,
        valuePercent: null,
        state: "conflicted",
        asOfIso: input.asOfIso,
        coveragePercent: null,
        sourceRefs: [
          ...input.sourceRefs,
        ],
        method: input.method,
      },
      diagnostics,
    };
  }

  if (
    dataDateIso &&
    input.asOfIso &&
    Date.parse(input.asOfIso) >
      Date.parse(dataDateIso)
  ) {
    diagnostics.push(
      key +
        "_PROGRESS_AFTER_DATA_DATE",
    );

    return {
      value: {
        basis,
        valuePercent: null,
        state: "conflicted",
        asOfIso: input.asOfIso,
        coveragePercent: null,
        sourceRefs: [
          ...input.sourceRefs,
        ],
        method: input.method,
      },
      diagnostics,
    };
  }

  return {
    value: {
      basis,
      valuePercent:
        input.valuePercent,
      state: input.state,
      asOfIso: input.asOfIso,
      coveragePercent: null,
      sourceRefs: [
        ...input.sourceRefs,
      ],
      method: input.method,
    },
    diagnostics,
  };
}

function varianceToBaseline(
  baseline: ProgressReportBasisValue,
  other: ProgressReportBasisValue,
): number | null {
  if (
    baseline.valuePercent === null ||
    other.valuePercent === null
  ) {
    return null;
  }

  return Number(
    (
      other.valuePercent -
      baseline.valuePercent
    ).toFixed(6),
  );
}

export function buildProgressReportProjection(
  input: {
    generatedAt: string;
    producerVersion: string;
    scheduleAnalytics: ScheduleAnalyticsProjection;
    milestones: MilestonesProjection;
    lookAhead: LookAheadProjection;
    progressScurve: ProgressScurveProjection;
    independentForecast: IndependentForecastProjection;
    progressBases?: ExternalProgressBases;
  },
): ProgressReportProjection {
  const schedule =
    input.scheduleAnalytics.result;

  const projectIds = new Set(
    [
      schedule.projectId,
      input.milestones.projectId,
      input.lookAhead.projectId,
      input.progressScurve.projectId,
      input.independentForecast.projectId,
    ].filter(
      (value): value is string =>
        value !== null,
    ),
  );

  if (projectIds.size > 1) {
    throw new Error(
      "Progress Report inputs belong to different projects",
    );
  }

  const revisions = new Set([
    schedule.sourceRevisionId,
    input.milestones.sourceRevisionId,
    input.lookAhead.sourceRevisionId,
    input.progressScurve.sourceRevisionId,
    input.independentForecast.sourceRevisionId,
  ]);

  if (revisions.size !== 1) {
    throw new Error(
      "Progress Report inputs belong to different schedule revisions",
    );
  }

  const dataDatePoint =
    exactDataDatePoint(
      input.progressScurve,
    );

  const baselinePlanned =
    derivedBasis({
      basis: "baseline_planned",
      valuePercent:
        dataDatePoint
          ?.baselinePlannedPercent ??
        null,
      coveragePercent:
        input.progressScurve
          .baselineCoveragePercent,
      dataDateIso:
        schedule.dataDateIso,
      sourceRef:
        "projection:progress_scurve:" +
        input.progressScurve
          .producerVersion +
        ":baseline:data-date",
      method:
        "duration_weighted_baseline_curve_at_data_date",
    });

  const currentSchedule =
    derivedBasis({
      basis: "current_schedule",
      valuePercent:
        dataDatePoint
          ?.currentForecastPercent ??
        null,
      coveragePercent:
        input.progressScurve
          .currentCoveragePercent,
      dataDateIso:
        schedule.dataDateIso,
      sourceRef:
        "projection:progress_scurve:" +
        input.progressScurve
          .producerVersion +
        ":current:data-date",
      method:
        "duration_weighted_current_schedule_curve_at_data_date",
    });

  const physical =
    externalBasis(
      "physical",
      input.progressBases?.physical,
      schedule.dataDateIso,
    );

  const contractorReported =
    externalBasis(
      "contractor_reported",
      input.progressBases
        ?.contractorReported,
      schedule.dataDateIso,
    );

  const certified =
    externalBasis(
      "certified",
      input.progressBases?.certified,
      schedule.dataDateIso,
    );

  const progressDiagnostics = [
    ...physical.diagnostics,
    ...contractorReported.diagnostics,
    ...certified.diagnostics,
    ...(
      dataDatePoint
        ? []
        : [
            "PROGRESS_SCURVE_DATA_DATE_POINT_MISSING",
          ]
    ),
    "SCHEDULE_PROGRESS_SNAPSHOT_NOT_AUTOMATICALLY_PHYSICAL_CONTRACTOR_REPORTED_OR_CERTIFIED",
  ];

  return {
    schemaVersion: "1.0",
    projectionKey: "progress_report",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    projectId:
      schedule.projectId,
    sourceRevisionId:
      schedule.sourceRevisionId,
    dataDateIso:
      schedule.dataDateIso,
    sourceProjections: [
      {
        projectionKey:
          "schedule_analytics",
        producerVersion:
          input.scheduleAnalytics
            .producerVersion,
      },
      {
        projectionKey: "milestones",
        producerVersion:
          input.milestones.producerVersion,
      },
      {
        projectionKey:
          "lookahead_schedule",
        producerVersion:
          input.lookAhead.producerVersion,
      },
      {
        projectionKey:
          "progress_scurve",
        producerVersion:
          input.progressScurve
            .producerVersion,
      },
      {
        projectionKey:
          "independent_forecast",
        producerVersion:
          input.independentForecast
            .producerVersion,
      },
    ],
    schedule: {
      activityCount:
        schedule.activityCount,
      relationshipCount:
        schedule.relationshipCount,
      graphComplete:
        schedule.graph.complete,
      openStartCount:
        schedule.graph
          .openStartActivityIds.length,
      openFinishCount:
        schedule.graph
          .openFinishActivityIds.length,
      criticalCount:
        schedule.float.criticalCount,
      nearCriticalCount:
        schedule.float
          .nearCriticalCount,
      negativeFloatCount:
        schedule.float
          .negativeFloatCount,
      floatCoveragePercent:
        schedule.float
          .coveragePercent,
    },
    progress: {
      completedCount:
        schedule.status.completed,
      inProgressCount:
        schedule.status.inProgress,
      notStartedCount:
        schedule.status.notStarted,
      unknownStatusCount:
        schedule.status.unknown,
      durationWeightedProgressPercent:
        schedule.progress
          .durationWeightedPercentComplete
          .value,
      durationWeightedProgressCoveragePercent:
        schedule.progress
          .durationWeightedPercentComplete
          .coveragePercent,
      scurveActualSnapshotPercent:
        latestActualSnapshot(
          input.progressScurve,
        ),
      scurveActualSnapshotCoveragePercent:
        input.progressScurve
          .actualSnapshotCoveragePercent,
      bases: {
        baselinePlanned,
        currentSchedule,
        physical: physical.value,
        contractorReported:
          contractorReported.value,
        certified: certified.value,
      },
      variancesToBaseline: {
        currentSchedule:
          varianceToBaseline(
            baselinePlanned,
            currentSchedule,
          ),
        physical:
          varianceToBaseline(
            baselinePlanned,
            physical.value,
          ),
        contractorReported:
          varianceToBaseline(
            baselinePlanned,
            contractorReported.value,
          ),
        certified:
          varianceToBaseline(
            baselinePlanned,
            certified.value,
          ),
      },
    },
    forecast: {
      sourceForecastCompletionIso:
        input.independentForecast
          .sourceForecastCompletionIso,
      independentForecastCompletionIso:
        input.independentForecast
          .independentForecastCompletionIso,
      forecastVarianceDays:
        input.independentForecast
          .forecastVarianceDays,
      independentForecastOrigin:
        input.independentForecast.origin,
      independentForecastComplete:
        input.independentForecast.complete,
    },
    milestones: {
      milestoneCount:
        input.milestones.milestoneCount,
      completedCount:
        input.milestones.completedCount,
      openCount:
        input.milestones.openCount,
      lateOpenCount:
        input.milestones.lateOpenCount,
    },
    lookAhead: {
      windowDays:
        input.lookAhead.windowDays,
      incompleteActivityCount:
        input.lookAhead
          .incompleteActivityCount,
      datedIncompleteActivityCount:
        input.lookAhead
          .datedIncompleteActivityCount,
      currentDateCoveragePercent:
        input.lookAhead
          .currentDateCoveragePercent,
      overdueCount:
        input.lookAhead.overdueCount,
      readyCount:
        input.lookAhead.readyCount,
      blockedCount:
        input.lookAhead.blockedCount,
      conditionalCount:
        input.lookAhead.conditionalCount,
    },
    diagnostics: [
      ...schedule.diagnostics,
      ...input.independentForecast
        .diagnostics,
      ...input.progressScurve
        .diagnostics,
      ...progressDiagnostics,
    ],
  };
}
