import test from "node:test";
import assert from "node:assert/strict";

import type {
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
} from "../packages/schedule-analysis-core/src";
import {
  buildLookAheadProjection,
  type LookAheadActivityReadinessEvidence,
} from "../packages/lookahead-schedule/src";
import {
  buildScheduleAnalyticsProjection,
} from "../packages/schedule-analytics/src";
import {
  buildMilestonesProjection,
} from "../packages/milestones-analysis/src";
import {
  buildProgressScurveProjection,
} from "../packages/progress-scurve/src";
import {
  buildIndependentForecastProjection,
} from "../packages/independent-forecast/src";
import {
  buildProgressReportProjection,
} from "../packages/progress-report/src";

function activity(
  activityId: string,
  overrides: Partial<CanonicalScheduleActivity> = {},
): CanonicalScheduleActivity {
  return {
    projectId: "P-ACCEPT",
    activityId,
    nativeId: null,
    name: activityId,
    wbsId: "W1",
    calendarId: null,
    activityType: "task",
    status: "not_started",
    baselineStartIso: "2026-01-01",
    baselineFinishIso: "2026-01-20",
    currentStartIso: "2026-01-01",
    currentFinishIso: "2026-01-20",
    actualStartIso: null,
    actualFinishIso: null,
    forecastStartIso: null,
    forecastFinishIso: null,
    originalDurationHours: 80,
    remainingDurationHours: 80,
    totalFloatHours: 40,
    freeFloatHours: 40,
    percentComplete: 0,
    sourceRefs: [],
    diagnostics: [],
    ...overrides,
  };
}

function model(): CanonicalScheduleModel {
  return {
    projectId: "P-ACCEPT",
    source: "xer",
    sourceRevisionId: "rev-progress",
    dataDateIso: "2026-01-10",
    activities: [
      activity("A100", {
        name: "Released predecessor",
        status: "completed",
        actualStartIso: "2026-01-01",
        actualFinishIso: "2026-01-05",
        currentStartIso: "2026-01-01",
        currentFinishIso: "2026-01-05",
        baselineStartIso: "2026-01-01",
        baselineFinishIso: "2026-01-05",
        remainingDurationHours: 0,
        percentComplete: 100,
      }),
      activity("A200", {
        name: "Upcoming ready except access",
        currentStartIso: "2026-01-12",
        currentFinishIso: "2026-01-18",
        baselineStartIso: "2026-01-10",
        baselineFinishIso: "2026-01-16",
      }),
      activity("A300", {
        name: "Blocked by predecessor",
        currentStartIso: "2026-01-15",
        currentFinishIso: "2026-01-20",
        baselineStartIso: "2026-01-12",
        baselineFinishIso: "2026-01-18",
      }),
      activity("A400", {
        name: "Fully evidenced ready",
        currentStartIso: "2026-01-11",
        currentFinishIso: "2026-01-14",
        baselineStartIso: "2026-01-11",
        baselineFinishIso: "2026-01-14",
      }),
    ],
    relationships: [
      {
        relationshipId: "R100-200",
        predecessorActivityId: "A100",
        successorActivityId: "A200",
        type: "FS",
        lagHours: 0,
        external: false,
        sourceRefs: [],
        diagnostics: [],
      },
      {
        relationshipId: "R200-300",
        predecessorActivityId: "A200",
        successorActivityId: "A300",
        type: "FS",
        lagHours: 0,
        external: false,
        sourceRefs: [],
        diagnostics: [],
      },
    ],
    wbs: [],
    calendars: [],
    diagnostics: [],
  };
}

function allReadyEvidence(
  overrides: LookAheadActivityReadinessEvidence = {},
): LookAheadActivityReadinessEvidence {
  const ready = (name: string) => ({
    state: "ready" as const,
    sourceRefs: ["evidence:" + name],
  });

  return {
    procurement: ready("procurement"),
    design_rfi_submittal:
      ready("design"),
    permit: ready("permit"),
    resource: ready("resource"),
    quality: ready("quality"),
    commercial_obligation:
      ready("commercial"),
    risk: ready("risk"),
    access: ready("access"),
    ...overrides,
  };
}

test("Look-Ahead readiness is evidence-driven and missing access never becomes ready", () => {
  const readinessEvidence: Record<
    string,
    LookAheadActivityReadinessEvidence
  > = {
    A200: {
      ...allReadyEvidence(),
      access: undefined,
    },
    A300: allReadyEvidence(),
    A400: allReadyEvidence(),
  };

  const projection =
    buildLookAheadProjection(
      model(),
      {
        generatedAt:
          "2026-09-18T20:30:00.000Z",
        producerVersion:
          "lookahead-acceptance-v1",
        windowDays: 42,
        readinessEvidence,
      },
    );

  const a200 = projection.rows.find(
    (row) => row.activityId === "A200",
  )!;
  assert.equal(
    a200.readiness.dimensions
      .predecessor.state,
    "ready",
  );
  assert.equal(
    a200.readiness.dimensions.access.state,
    "unknown",
  );
  assert.equal(
    a200.readiness.overall,
    "conditional",
  );
  assert.ok(
    a200.readiness.unknownDimensions
      .includes("access"),
  );

  const a300 = projection.rows.find(
    (row) => row.activityId === "A300",
  )!;
  assert.equal(
    a300.readiness.dimensions
      .predecessor.state,
    "blocked",
  );
  assert.equal(
    a300.readiness.overall,
    "blocked",
  );
  assert.ok(
    a300.readiness.blockingDimensions
      .includes("predecessor"),
  );

  const a400 = projection.rows.find(
    (row) => row.activityId === "A400",
  )!;
  assert.equal(
    a400.readiness.overall,
    "ready",
  );

  assert.equal(projection.readyCount, 1);
  assert.equal(projection.blockedCount, 1);
  assert.ok(
    projection.conditionalCount >= 1,
  );
});

test("Progress Report preserves five distinct bases and four baseline variances", () => {
  const source = model();
  const generatedAt =
    "2026-09-18T20:31:00.000Z";

  const scheduleAnalytics =
    buildScheduleAnalyticsProjection(
      source,
      {
        generatedAt,
        producerVersion: "schedule-v1",
      },
    );
  const milestones =
    buildMilestonesProjection(
      source,
      {
        generatedAt,
        producerVersion:
          "milestones-v1",
      },
    );
  const lookAhead =
    buildLookAheadProjection(
      source,
      {
        generatedAt,
        producerVersion:
          "lookahead-v1",
      },
    );
  const progressScurve =
    buildProgressScurveProjection(
      source,
      {
        generatedAt,
        producerVersion:
          "scurve-v1",
        intervalDays: 7,
      },
    );
  const independentForecast =
    buildIndependentForecastProjection(
      source,
      {
        generatedAt,
        producerVersion:
          "forecast-v1",
      },
    );

  const dataDatePoint =
    progressScurve.points.find(
      (point) =>
        point.dateIso ===
        source.dataDateIso,
    );

  assert.ok(
    dataDatePoint,
    "Progress S-Curve must contain the exact Data Date",
  );

  dataDatePoint.baselinePlannedPercent =
    59.5;
  dataDatePoint.currentForecastPercent =
    56.08;
  progressScurve.baselineCoveragePercent =
    100;
  progressScurve.currentCoveragePercent =
    100;

  const report =
    buildProgressReportProjection({
      generatedAt,
      producerVersion:
        "progress-report-v2",
      scheduleAnalytics,
      milestones,
      lookAhead,
      progressScurve,
      independentForecast,
      progressBases: {
        physical: {
          valuePercent: 54.8,
          state: "verified",
          asOfIso: "2026-01-10",
          sourceRefs: [
            "progress:physical:rev-1",
          ],
          method:
            "governed_physical_measurement",
        },
        contractorReported: {
          valuePercent: 55.6,
          state: "provisional",
          asOfIso: "2026-01-10",
          sourceRefs: [
            "progress:contractor:rev-1",
          ],
          method:
            "contractor_progress_report",
        },
        certified: {
          valuePercent: 53.9,
          state: "official",
          asOfIso: "2026-01-10",
          sourceRefs: [
            "progress:certificate:ipc-1",
          ],
          method:
            "approved_progress_certificate",
        },
      },
    });

  assert.equal(
    report.progress.bases
      .baselinePlanned.valuePercent,
    59.5,
  );
  assert.equal(
    report.progress.bases
      .currentSchedule.valuePercent,
    56.08,
  );
  assert.equal(
    report.progress.bases
      .physical.valuePercent,
    54.8,
  );
  assert.equal(
    report.progress.bases
      .contractorReported.valuePercent,
    55.6,
  );
  assert.equal(
    report.progress.bases
      .certified.valuePercent,
    53.9,
  );

  assert.equal(
    report.progress.variancesToBaseline
      .currentSchedule,
    -3.42,
  );
  assert.equal(
    report.progress.variancesToBaseline
      .physical,
    -4.7,
  );
  assert.equal(
    report.progress.variancesToBaseline
      .contractorReported,
    -3.9,
  );
  assert.equal(
    report.progress.variancesToBaseline
      .certified,
    -5.6,
  );
});

test("future certified progress is conflicted and never used as a Data Date value", () => {
  const source = model();
  const generatedAt =
    "2026-09-18T20:32:00.000Z";

  const scheduleAnalytics =
    buildScheduleAnalyticsProjection(
      source,
      {
        generatedAt,
        producerVersion: "schedule-v1",
      },
    );
  const milestones =
    buildMilestonesProjection(
      source,
      {
        generatedAt,
        producerVersion:
          "milestones-v1",
      },
    );
  const lookAhead =
    buildLookAheadProjection(
      source,
      {
        generatedAt,
        producerVersion:
          "lookahead-v1",
      },
    );
  const progressScurve =
    buildProgressScurveProjection(
      source,
      {
        generatedAt,
        producerVersion:
          "scurve-v1",
      },
    );
  const independentForecast =
    buildIndependentForecastProjection(
      source,
      {
        generatedAt,
        producerVersion:
          "forecast-v1",
      },
    );

  const report =
    buildProgressReportProjection({
      generatedAt,
      producerVersion:
        "progress-report-v2",
      scheduleAnalytics,
      milestones,
      lookAhead,
      progressScurve,
      independentForecast,
      progressBases: {
        certified: {
          valuePercent: 60,
          state: "official",
          asOfIso: "2026-01-11",
          sourceRefs: [
            "progress:certificate:future",
          ],
          method:
            "approved_progress_certificate",
        },
      },
    });

  assert.equal(
    report.progress.bases
      .certified.state,
    "conflicted",
  );
  assert.equal(
    report.progress.bases
      .certified.valuePercent,
    null,
  );
  assert.equal(
    report.progress.variancesToBaseline
      .certified,
    null,
  );
  assert.ok(
    report.diagnostics.includes(
      "CERTIFIED_PROGRESS_AFTER_DATA_DATE",
    ),
  );
});
