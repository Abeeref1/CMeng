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
  ExternalProgressEvidence,
  ProgressBasisValue,
  ProgressReportProjection,
} from "./types";


function latestActualSnapshotRecord(
  scurve: ProgressScurveProjection,
) {
  if (scurve.actualSnapshots.length === 0) {
    return null;
  }
  return [...scurve.actualSnapshots].sort(
    (a, b) =>
      Date.parse(a.asOfIso) -
      Date.parse(b.asOfIso),
  ).at(-1) ?? null;
}

function pointAtOrBeforeDataDate(
  scurve: ProgressScurveProjection,
) {
  if (!scurve.dataDateIso) return null;
  const cutoff = Date.parse(scurve.dataDateIso);
  if (!Number.isFinite(cutoff)) return null;
  return [...scurve.points]
    .filter((point) => {
      const value = Date.parse(point.dateIso);
      return Number.isFinite(value) && value <= cutoff;
    })
    .sort(
      (a, b) =>
        Date.parse(a.dateIso) -
        Date.parse(b.dateIso),
    )
    .at(-1) ?? null;
}

function progressBasis(
  valuePercent: number | null,
  authority: ProgressBasisValue["authority"],
  sourceRefs: string[],
  baselinePercent: number | null,
  input: {
    asOfIso?: string | null;
    coveragePercent?: number | null;
    basis?: string;
  } = {},
): ProgressBasisValue {
  return {
    ...(input.basis?{basis:input.basis}:{}),
    valuePercent,
    state:
      valuePercent === null
        ? "missing"
        : "established",
    authority:
      valuePercent === null ? "missing" : authority,
    sourceRefs:
      valuePercent === null ? [] : [...sourceRefs],
    asOfIso:
      valuePercent === null
        ? null
        : input.asOfIso ??
          null,
    coveragePercent:
      valuePercent === null
        ? null
        : input.coveragePercent ??
          null,
    varianceToBaselinePercentagePoints:
      valuePercent !== null &&
      baselinePercent !== null
        ? Number(
            (valuePercent - baselinePercent).toFixed(6),
          )
        : null,
  };
}

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

export function buildProgressReportProjection(
  input: {
    generatedAt: string;
    producerVersion: string;
    scheduleAnalytics: ScheduleAnalyticsProjection;
    milestones: MilestonesProjection;
    lookAhead: LookAheadProjection;
    progressScurve: ProgressScurveProjection;
    independentForecast: IndependentForecastProjection;
    progressEvidence?: {
      physical?: ExternalProgressEvidence;
      contractorReported?: ExternalProgressEvidence;
      certified?: ExternalProgressEvidence;
      earnedValue?: ExternalProgressEvidence;
    };
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
    pointAtOrBeforeDataDate(
      input.progressScurve,
    );
  const baselinePercent =
    dataDatePoint?.baselinePlannedPercent ??
    null;
  const currentPlannedPercent =
    dataDatePoint?.currentSchedulePhasingPercent ??
    dataDatePoint?.currentForecastPercent ??
    null;
  const latestActual =
    latestActualSnapshotRecord(
      input.progressScurve,
    );
  const physicalPercent =
    input.progressEvidence?.physical
      ?.valuePercent ??
    null;
  const physicalRefs =
    input.progressEvidence?.physical
      ?.sourceRefs ??
    [];

  const currentPlanned = progressBasis(
    currentPlannedPercent,
    "deterministic_schedule",
    ["progress-scurve:current-plan:" + (dataDatePoint?.dateIso ?? "unestablished")],
    baselinePercent,
    { asOfIso: dataDatePoint?.dateIso ?? schedule.dataDateIso, coveragePercent: input.progressScurve.currentCoveragePercent },
  );

  const progressBases = {
    scheduleSnapshot: progressBasis(latestActual?.progressPercent ?? null, "progress_snapshot", latestActual?.sourceRefs ?? [], baselinePercent,
      { asOfIso: latestActual?.asOfIso ?? null, coveragePercent: input.progressScurve.actualSnapshotCoveragePercent }),
    baselinePlanned: progressBasis(
      baselinePercent,
      "deterministic_schedule",
      [
        "progress-scurve:baseline:" +
          (dataDatePoint?.dateIso ?? "unestablished"),
      ],
      baselinePercent,
      {
        asOfIso:
          dataDatePoint
            ?.dateIso ??
          schedule.dataDateIso,
        coveragePercent:
          input.progressScurve
            .baselineCoveragePercent,
      },
    ),
    currentPlanned,
    currentSchedule: currentPlanned,
    physical: progressBasis(
      physicalPercent,
      input.progressEvidence?.physical
        ? "source_evidence"
        : "missing",
      physicalRefs,
      baselinePercent,
      {
        asOfIso:
          input.progressEvidence
            ?.physical
            ?.asOfIso ??
          schedule.dataDateIso,
        coveragePercent:
          input.progressEvidence
            ?.physical
            ?.coveragePercent ??
          null,
      },
    ),
    contractorReported: progressBasis(
      input.progressEvidence?.contractorReported
        ?.valuePercent ?? null,
      input.progressEvidence?.contractorReported
        ? "source_evidence"
        : "missing",
      input.progressEvidence?.contractorReported
        ?.sourceRefs ?? [],
      baselinePercent,
      {
        asOfIso:
          input.progressEvidence
            ?.contractorReported
            ?.asOfIso ??
          schedule.dataDateIso,
        coveragePercent:
          input.progressEvidence
            ?.contractorReported
            ?.coveragePercent ??
          null,
      },
    ),
    certified: progressBasis(
      input.progressEvidence?.certified
        ?.valuePercent ?? null,
      input.progressEvidence?.certified
        ? "source_evidence"
        : "missing",
      input.progressEvidence?.certified
        ?.sourceRefs ?? [],
      baselinePercent,
      {
        asOfIso:
          input.progressEvidence
            ?.certified
            ?.asOfIso ??
          schedule.dataDateIso,
        coveragePercent:
          input.progressEvidence
            ?.certified
            ?.coveragePercent ??
          null,
      },
    ),
    earnedValue: progressBasis(
      input.progressEvidence?.earnedValue?.valuePercent ?? null,
      input.progressEvidence?.earnedValue ? "earned_value" : "missing",
      input.progressEvidence?.earnedValue?.sourceRefs ?? [],
      baselinePercent,
      {
        asOfIso: input.progressEvidence?.earnedValue?.asOfIso ?? schedule.dataDateIso,
        coveragePercent: input.progressEvidence?.earnedValue?.coveragePercent ?? null,
      },
    ),
  };
  const headlineCandidates = [
    {key:"physical" as const,label:"Physical measured progress",basis:progressBases.physical},
    {key:"certified" as const,label:"Certified progress",basis:progressBases.certified},
    {key:"contractor_reported" as const,label:"Contractor reported progress",basis:progressBases.contractorReported},
    {key:"earned_value" as const,label:"Earned-value progress",basis:progressBases.earnedValue},
    {key:"schedule_snapshot" as const,label:"Schedule progress snapshot",basis:progressBases.scheduleSnapshot},
  ];
  const headlineSelected = headlineCandidates.find(row => row.basis.valuePercent !== null) ?? null;
  const headlineProgress = headlineSelected
    ? {
        key: headlineSelected.key,
        label: headlineSelected.label,
        valuePercent: headlineSelected.basis.valuePercent,
        authority: headlineSelected.basis.authority,
        basis: headlineSelected.key === "schedule_snapshot"
          ? "Submitted activity percentage-complete snapshot; not certified physical progress."
          : headlineSelected.basis.basis??"Best available achieved-progress evidence; current planned phasing remains a separate comparator.",
      }
    : {
        key: "missing" as const,
        label: "Achieved progress",
        valuePercent: null,
        authority: "missing" as const,
        basis: "No achieved-progress evidence is established.",
      };
  const externalProgressEvidenceEstablished =
    progressBases.contractorReported
      .valuePercent !== null ||
    progressBases.certified
      .valuePercent !== null ||
    progressBases.earnedValue
      .valuePercent !== null ||
    (
      progressBases.physical
        .valuePercent !== null &&
      progressBases.physical
        .authority ===
        "source_evidence"
    );

  return {
    schemaVersion: "1.0",
    scheduleSnapshotOnly:
      !externalProgressEvidenceEstablished,
    externalProgressEvidenceState:
      externalProgressEvidenceEstablished
        ? "established"
        : "missing",
    projectionKey: "progress_report",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    projectId:
      schedule.projectId,
    sourceRevisionId:
      schedule.sourceRevisionId,
    dataDateIso:
      schedule.dataDateIso,
    progressBases,
    headlineProgress,
    scopeComparison:input.progressScurve.scopeComparison??null,
    activityPopulation: {
      ...schedule.population,
      excludedByType: {
        ...schedule.population.excludedByType,
      },
    },
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
      basisRevisionId:
        input.independentForecast
          .sourceRevisionId,
      activityCoveragePercent:
        input.independentForecast
          .activityCoveragePercent,
      authority:
        input.independentForecast.origin ===
          "deterministic_source_calendar"
          ? "deterministic"
          : input.independentForecast.origin ===
              "scenario_with_assumptions"
            ? "scenario"
            : "unresolved",
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
    },
    diagnostics: [
      ...schedule.diagnostics,
      ...input.independentForecast
        .diagnostics,
      ...input.progressScurve
        .diagnostics,
    ],
  };
}
