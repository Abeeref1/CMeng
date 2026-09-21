import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWindowsAnalysisProjection,
} from "../packages/windows-analysis/src";
import type {
  ScheduleRevision,
} from "../packages/schedule-revision-core/src";
import type {
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
} from "../packages/schedule-analysis-core/src";

function activity(
  id: string,
  finishIso: string,
): CanonicalScheduleActivity {
  return {
    projectId: "WINDOWS",
    activityId: id,
    nativeId: id,
    name: id,
    wbsId: "W1",
    calendarId: null,
    activityType: "task",
    status: "not_started",
    baselineStartIso: null,
    baselineFinishIso: null,
    currentStartIso: null,
    currentFinishIso: finishIso,
    actualStartIso: null,
    actualFinishIso: null,
    forecastStartIso: null,
    forecastFinishIso: finishIso,
    originalDurationHours: 8,
    remainingDurationHours: 8,
    totalFloatHours: 40,
    freeFloatHours: null,
    percentComplete: 0,
    sourceRefs: [],
    diagnostics: [],
  };
}

function revision(
  revisionId: string,
  sequence: number,
  dataDateIso: string,
  activities: CanonicalScheduleActivity[],
): ScheduleRevision {
  const model: CanonicalScheduleModel = {
    projectId: "WINDOWS",
    source: "xer",
    sourceRevisionId: revisionId,
    dataDateIso,
    activities,
    relationships: [],
    wbs: [],
    calendars: [],
    diagnostics: [],
  };
  return {
    revisionId,
    label: revisionId,
    sequence,
    effectiveAt: dataDateIso,
    model,
  };
}

const revisions: ScheduleRevision[] = [
  revision(
    "S01",
    1,
    "2026-01-01",
    [
      activity("A", "2027-01-01T00:00:00Z"),
      activity("B", "2027-03-01T00:00:00Z"),
    ],
  ),
  revision(
    "S02",
    2,
    "2026-04-01",
    [
      activity("A", "2027-05-23T22:04:48Z"),
      activity("B", "2027-03-01T00:00:00Z"),
    ],
  ),
  revision(
    "S03",
    3,
    "2026-08-31",
    [
      activity("A", "2027-05-23T22:04:48Z"),
      activity("B", "2027-04-30T06:00:00Z"),
    ],
  ),
];

const sourceForecasts = new Map([
  ["S01", "2029-12-31"],
  ["S02", "2030-04-30"],
  ["S03", "2030-06-30"],
]);

test("windows keep strongest activity movement separate from net project completion movement", () => {
  const projection =
    buildWindowsAnalysisProjection(
      revisions,
      {
        projectId: "WINDOWS",
        evidenceRevisionId: "test",
        events: [],
        claims: [],
        notices: [],
        noticeRequirements: [],
        diagnostics: [],
      } as any,
      {
        generatedAt:
          "2026-09-21T00:00:00.000Z",
        producerVersion:
          "window-gross-test",
        forecastResolver:
          (item) =>
            ({
              sourceForecastCompletionIso:
                sourceForecasts.get(
                  item.revisionId,
                ) ?? null,
              independentForecastCompletionIso:
                null,
              criticalActivityIds: [],
              assumptions: [],
              complete: false,
            }) as any,
      },
    );

  assert.equal(projection.windowCount, 2);
  assert.equal(
    projection.windows[0]!
      .strongestProgrammeMovementBasis,
    "matched_activity_finish_shift",
  );
  assert.equal(
    projection.windows[0]!
      .strongestPositiveActivityMovementDays,
    142.92,
  );
  assert.equal(
    projection.windows[0]!
      .strongestPositiveActivityId,
    "A",
  );
  assert.equal(
    projection.windows[1]!
      .strongestPositiveActivityMovementDays,
    60.25,
  );
  assert.equal(
    projection.windows[1]!
      .strongestPositiveActivityId,
    "B",
  );
  assert.equal(
    projection.positiveProgrammeMovementDays,
    203.17,
  );
  assert.equal(
    projection.projectCompletionMovementDays,
    181,
  );
  assert.equal(
    projection.projectCompletionMovementBasis,
    "source_forecast",
  );
  assert.equal(
    projection.negativeProgrammeMovementDays,
    0,
  );
  assert.equal(
    projection.windows[0]!
      .activityFinishShiftCoveragePercent,
    100,
  );
});

test("windows preserve strongest recovery separately from positive movement", () => {
  const recoveryRevisions = [
    revision(
      "R1",
      1,
      "2026-01-01",
      [
        activity(
          "A",
          "2027-06-01T00:00:00Z",
        ),
      ],
    ),
    revision(
      "R2",
      2,
      "2026-02-01",
      [
        activity(
          "A",
          "2027-05-22T00:00:00Z",
        ),
      ],
    ),
  ];

  const projection =
    buildWindowsAnalysisProjection(
      recoveryRevisions,
      {
        projectId: "WINDOWS",
        evidenceRevisionId: "test",
        events: [],
        claims: [],
        notices: [],
        noticeRequirements: [],
        diagnostics: [],
      } as any,
      {
        generatedAt:
          "2026-09-21T00:00:00.000Z",
        producerVersion:
          "window-recovery-test",
        forecastResolver:
          () =>
            ({
              sourceForecastCompletionIso:
                null,
              independentForecastCompletionIso:
                null,
              criticalActivityIds: [],
              assumptions: [],
              complete: false,
            }) as any,
      },
    );

  assert.equal(
    projection.positiveProgrammeMovementDays,
    0,
  );
  assert.equal(
    projection.negativeProgrammeMovementDays,
    -10,
  );
  assert.equal(
    projection.windows[0]!
      .strongestNegativeActivityMovementDays,
    -10,
  );
});
