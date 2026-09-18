import test from "node:test";
import assert from "node:assert/strict";

import type {
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
} from "../packages/schedule-analysis-core/src";
import type {
  ScheduleRevision,
} from "../packages/schedule-revision-core/src";
import type {
  DelayClaimsModel,
} from "../packages/delay-analysis-core/src";
import {
  buildWindowsAnalysisProjection,
} from "../packages/windows-analysis/src";
import {
  buildNoticesClaimsProjection,
} from "../packages/notices-claims/src";
import {
  buildDelayClaimsProjection,
} from "../packages/delay-claims/src";
import {
  buildEotAssessmentProjection,
} from "../packages/eot-assessment/src";
import {
  buildChallengeContractProjection,
} from "../packages/challenge-contract/src";
import {
  segmentContractPages,
} from "../packages/contract-parser/src";
import type {
  PdfDocumentResult,
  PdfPageResult,
} from "../packages/pdf-document-parser/src";
import {
  projectionDefinition,
} from "../packages/analysis-runtime/src";

function activity(
  revision: string,
  dataDate: string,
  finish: string,
  remainingHours: number,
  progress: number,
): CanonicalScheduleActivity {
  return {
    projectId: "P88",
    activityId: "A100",
    nativeId: null,
    name: "Completion Activity",
    wbsId: "W1",
    calendarId: null,
    activityType: "task",
    status:
      progress > 0
        ? "in_progress"
        : "not_started",
    baselineStartIso: "2026-01-01",
    baselineFinishIso: "2026-01-10",
    currentStartIso: dataDate,
    currentFinishIso: finish,
    actualStartIso:
      progress > 0 ? dataDate : null,
    actualFinishIso: null,
    forecastStartIso: dataDate,
    forecastFinishIso: finish,
    originalDurationHours: remainingHours,
    remainingDurationHours: remainingHours,
    totalFloatHours: 0,
    freeFloatHours: 0,
    percentComplete: progress,
    sourceRefs: [
      {
        source: "schedule_xlsx",
        locator: revision + ":A100",
      },
    ],
    diagnostics: [],
  };
}

function scheduleModel(
  revisionId: string,
  dataDateIso: string,
  sourceFinishIso: string,
  remainingHours: number,
  progress: number,
): CanonicalScheduleModel {
  return {
    projectId: "P88",
    source: "schedule_xlsx",
    sourceRevisionId: revisionId,
    dataDateIso,
    activities: [
      activity(
        revisionId,
        dataDateIso,
        sourceFinishIso,
        remainingHours,
        progress,
      ),
    ],
    relationships: [],
    wbs: [],
    calendars: [],
    diagnostics: [],
  };
}

function revisions(): ScheduleRevision[] {
  return [
    {
      revisionId: "rev-1",
      label: "Update 1",
      sequence: 1,
      effectiveAt: "2026-01-01",
      model: scheduleModel(
        "rev-1",
        "2026-01-01",
        "2026-01-10",
        216,
        10,
      ),
    },
    {
      revisionId: "rev-2",
      label: "Update 2",
      sequence: 2,
      effectiveAt: "2026-01-05",
      model: scheduleModel(
        "rev-2",
        "2026-01-05",
        "2026-01-15",
        240,
        20,
      ),
    },
    {
      revisionId: "rev-3",
      label: "Update 3",
      sequence: 3,
      effectiveAt: "2026-01-10",
      model: scheduleModel(
        "rev-3",
        "2026-01-10",
        "2026-01-18",
        192,
        30,
      ),
    },
  ];
}

function delayModel(): DelayClaimsModel {
  return {
    projectId: "P88",
    evidenceRevisionId: "evidence-rev-1",
    events: [
      {
        eventId: "E1",
        title: "Late access",
        category: "late_access",
        startIso: "2026-01-02",
        endIso: "2026-01-04",
        responsibility: "employer",
        responsibilityState: "official",
        describedImpactDays: 5,
        describedImpactState: "provisional",
        relatedActivityIds: ["A100"],
        relatedClauseIdentifiers: ["20.1"],
        evidenceRefs: [],
        diagnostics: [],
      },
      {
        eventId: "E2",
        title: "Late design information",
        category: "late_information",
        startIso: "2026-01-06",
        endIso: "2026-01-08",
        responsibility: "employer",
        responsibilityState: "provisional",
        describedImpactDays: 3,
        describedImpactState: "candidate",
        relatedActivityIds: ["A100"],
        relatedClauseIdentifiers: ["20.2"],
        evidenceRefs: [],
        diagnostics: [],
      },
      {
        eventId: "C1",
        title: "Contractor productivity",
        category: "contractor_performance",
        startIso: "2026-01-07",
        endIso: "2026-01-09",
        responsibility: "contractor",
        responsibilityState: "official",
        describedImpactDays: 2,
        describedImpactState: "provisional",
        relatedActivityIds: ["A100"],
        relatedClauseIdentifiers: [],
        evidenceRefs: [],
        diagnostics: [],
      },
    ],
    notices: [
      {
        noticeId: "N1",
        kind: "eot_notice",
        eventId: "E1",
        claimId: "CL1",
        actualIssuedAt: "2026-01-03",
        actualReceivedAt: "2026-01-03",
        plannedAt: "2026-01-02",
        subject: "Late access notice",
        clauseIdentifiers: ["20.1"],
        evidenceRefs: [],
        diagnostics: [],
      },
      {
        noticeId: "N2",
        kind: "eot_notice",
        eventId: "E2",
        claimId: "CL2",
        actualIssuedAt: "2026-01-07",
        actualReceivedAt: "2026-01-07",
        plannedAt: null,
        subject: "Late design notice",
        clauseIdentifiers: ["20.1"],
        evidenceRefs: [],
        diagnostics: [],
      },
    ],
    claims: [
      {
        claimId: "CL1",
        title: "Late access EOT",
        state: "determined",
        eventIds: ["E1"],
        submittedAt: "2026-01-04",
        claimedDays: 5,
        claimedAmount: null,
        assessedDays: 2,
        assessedDaysState: "official",
        assessedAmount: null,
        assessedAmountState: "missing",
        clauseIdentifiers: ["20.2"],
        evidenceRefs: [],
        diagnostics: [],
      },
      {
        claimId: "CL2",
        title: "Late design EOT",
        state: "submitted",
        eventIds: ["E2"],
        submittedAt: "2026-01-08",
        claimedDays: 3,
        claimedAmount: null,
        assessedDays: null,
        assessedDaysState: "missing",
        assessedAmount: null,
        assessedAmountState: "missing",
        clauseIdentifiers: ["20.2"],
        evidenceRefs: [],
        diagnostics: [],
      },
    ],
    noticeRequirements: [
      {
        requirementId: "REQ-1",
        noticeKind: "eot_notice",
        eventCategories: [],
        noticePeriodDays: 7,
        state: "official",
        clauseIdentifiers: ["20.1"],
        evidenceRefs: [],
      },
    ],
    diagnostics: [],
  };
}

function page(
  pageNumber: number,
  text: string,
): PdfPageResult {
  return {
    pageNumber,
    method: "native",
    text,
    nativeCharacterCount: text.length,
    ocrConfidence: null,
    aiReview: null,
    diagnostics: [],
  };
}

function contractPdf(): PdfDocumentResult {
  const pages = [
    page(
      1,
      [
        "20.1 Notices",
        "The Contractor shall give notice within 7 calendar days as a condition precedent to an extension of time.",
        "20.2 Extension of Time",
        "Extension of time may be considered for Employer delay. Concurrent delay shall be reviewed.",
        "21 Variations",
        "A variation or change order may adjust the Works.",
      ].join("\n"),
    ),
  ];

  return {
    totalPages: 1,
    processedPages: 1,
    nativePages: 1,
    ocrPages: 0,
    blankPages: 0,
    failedPages: 0,
    unresolvedPages: 0,
    coveragePercent: 100,
    complete: true,
    pages,
    diagnostics: [],
  };
}

test("Challenge Contract extracts source-grounded signals and notice-period candidates without making them official", () => {
  const contract =
    segmentContractPages(
      contractPdf(),
    );

  const projection =
    buildChallengeContractProjection(
      contract,
      {
        generatedAt:
          "2026-09-18T20:30:00.000Z",
        producerVersion:
          "challenge-contract-v1",
      },
    );

  assert.ok(
    projection.categoriesPresent.includes(
      "notice_time_bar",
    ),
  );
  assert.ok(
    projection.categoriesPresent.includes(
      "extension_of_time",
    ),
  );
  assert.ok(
    projection.categoriesPresent.includes(
      "concurrency",
    ),
  );
  assert.ok(
    projection.categoriesPresent.includes(
      "variation_change",
    ),
  );

  assert.equal(
    projection.noticeRequirementCandidates.length,
    1,
  );
  assert.equal(
    projection.noticeRequirementCandidates[0]!
      .noticePeriodDays,
    7,
  );
  assert.equal(
    projection.noticeRequirementCandidates[0]!
      .dayBasis,
    "calendar_days",
  );
  assert.equal(
    projection.noticeRequirementCandidates[0]!
      .candidateState,
    "candidate",
  );
});

test("Notices Claims uses actual notice timestamps and keeps claim/assessment states separate", () => {
  const projection =
    buildNoticesClaimsProjection(
      delayModel(),
      {
        generatedAt:
          "2026-09-18T20:30:00.000Z",
        producerVersion:
          "notices-claims-v1",
      },
    );

  assert.equal(
    projection.timelyNoticeCount,
    2,
  );
  assert.equal(
    projection.missingNoticeCount,
    1,
  );
  assert.equal(
    projection.officialAssessedDaysTotal,
    2,
  );
  assert.equal(
    projection.provisionalOrCandidateAssessedDaysTotal,
    null,
  );

  const e1 = projection.events.find(
    (event) => event.eventId === "E1",
  )!;
  assert.equal(
    e1.elapsedNoticeDays,
    1,
  );
  assert.equal(
    e1.noticeTimeliness,
    "timely",
  );

  const c1 = projection.events.find(
    (event) => event.eventId === "C1",
  )!;
  assert.equal(
    c1.noticeTimeliness,
    "not_issued",
  );
});

test("Windows Analysis calculates schedule movement but leaves causation un-attributed", () => {
  const projection =
    buildWindowsAnalysisProjection(
      revisions(),
      delayModel(),
      {
        generatedAt:
          "2026-09-18T20:30:00.000Z",
        producerVersion:
          "windows-v1",
      },
    );

  assert.equal(
    projection.windowCount,
    2,
  );
  assert.equal(
    projection.windows[0]!
      .independentForecastMovementDays,
    5,
  );
  assert.equal(
    projection.windows[1]!
      .independentForecastMovementDays,
    3,
  );

  assert.deepEqual(
    projection.windows[0]!
      .employerEventIds,
    ["E1"],
  );
  assert.equal(
    projection.windows[0]!
      .concurrentEventCandidate,
    false,
  );

  assert.equal(
    projection.windows[1]!
      .concurrentEventCandidate,
    true,
  );
  assert.deepEqual(
    projection.windows[1]!
      .contractorEventIds,
    ["C1"],
  );
  assert.equal(
    projection.windows[0]!
      .attributionState,
    "not_attributed",
  );
});

test("Delay Claims separates employer candidate movement from concurrency review and never labels window movement causation", () => {
  const windows =
    buildWindowsAnalysisProjection(
      revisions(),
      delayModel(),
      {
        generatedAt:
          "2026-09-18T20:30:00.000Z",
        producerVersion:
          "windows-v1",
      },
    );

  const projection =
    buildDelayClaimsProjection(
      windows,
      delayModel(),
      {
        generatedAt:
          "2026-09-18T20:30:00.000Z",
        producerVersion:
          "delay-claims-v1",
      },
    );

  assert.equal(
    projection.observedPositiveIndependentMovementDays,
    8,
  );
  assert.equal(
    projection.employerOrNeutralCandidateWindowMovementDays,
    5,
  );
  assert.equal(
    projection.concurrentReviewWindowMovementDays,
    3,
  );

  const e1 = projection.events.find(
    (event) => event.eventId === "E1",
  )!;
  assert.equal(
    e1.candidateClass,
    "employer_or_neutral_time_candidate",
  );
  assert.equal(
    e1.scheduleAttribution,
    "not_causally_attributed",
  );

  const e2 = projection.events.find(
    (event) => event.eventId === "E2",
  )!;
  assert.equal(
    e2.candidateClass,
    "concurrency_review",
  );
});

test("EOT Assessment keeps official EOT separate from analytical candidate and excludes concurrent window", () => {
  const windows =
    buildWindowsAnalysisProjection(
      revisions(),
      delayModel(),
      {
        generatedAt:
          "2026-09-18T20:30:00.000Z",
        producerVersion:
          "windows-v1",
      },
    );
  const delay =
    buildDelayClaimsProjection(
      windows,
      delayModel(),
      {
        generatedAt:
          "2026-09-18T20:30:00.000Z",
        producerVersion:
          "delay-claims-v1",
      },
    );

  const projection =
    buildEotAssessmentProjection(
      windows,
      delay,
      {
        contractualCompletionIso:
          "2026-01-31",
        contractualCompletionState:
          "official",
        officialApprovedEotDays: 2,
        officialApprovedEotState:
          "official",
        eotDayBasis: "calendar_days",
        eotDayBasisState: "official",
        sourceRefs: [
          "contract:completion",
          "determination:eot-2-days",
        ],
      },
      {
        generatedAt:
          "2026-09-18T20:30:00.000Z",
        producerVersion:
          "eot-v1",
      },
    );

  assert.equal(
    projection.officialApprovedEotDays,
    2,
  );
  assert.equal(
    projection.officialAdjustedCompletionIso,
    "2026-02-02",
  );
  assert.equal(
    projection.candidateAdditionalEotDays,
    5,
  );
  assert.equal(
    projection.scenarioAdjustedCompletionIso,
    "2026-02-07",
  );
  assert.equal(
    projection.includedWindowCount,
    1,
  );
  assert.equal(
    projection.reviewWindowCount,
    1,
  );
  assert.equal(
    projection.basis,
    "analytical_candidate_not_contractual_determination",
  );
});

test("EOT scenario does not treat missing approved EOT as official zero even when it calculates a scenario", () => {
  const windows =
    buildWindowsAnalysisProjection(
      revisions(),
      delayModel(),
      {
        generatedAt:
          "2026-09-18T20:30:00.000Z",
        producerVersion:
          "windows-v1",
      },
    );
  const delay =
    buildDelayClaimsProjection(
      windows,
      delayModel(),
      {
        generatedAt:
          "2026-09-18T20:30:00.000Z",
        producerVersion:
          "delay-claims-v1",
      },
    );

  const projection =
    buildEotAssessmentProjection(
      windows,
      delay,
      {
        contractualCompletionIso:
          "2026-01-31",
        contractualCompletionState:
          "official",
        officialApprovedEotDays: null,
        officialApprovedEotState:
          "missing",
        eotDayBasis: "calendar_days",
        eotDayBasisState: "official",
        sourceRefs: [
          "contract:completion",
        ],
      },
      {
        generatedAt:
          "2026-09-18T20:30:00.000Z",
        producerVersion:
          "eot-v1",
      },
    );

  assert.equal(
    projection.officialAdjustedCompletionIso,
    null,
  );
  assert.equal(
    projection.candidateAdditionalEotDays,
    5,
  );
  assert.ok(
    projection.assumptions.includes(
      "OFFICIAL_APPROVED_EOT_NOT_ESTABLISHED_ASSUMED_ZERO_FOR_SCENARIO_ONLY",
    ),
  );
});

test("delay/EOT durable projections declare their governed upstream dependencies", () => {
  assert.deepEqual(
    [...projectionDefinition(
      "windows_analysis",
    ).dependencies].sort(),
    [
      "independent_forecast",
      "schedule_change_report",
    ].sort(),
  );

  assert.deepEqual(
    [...projectionDefinition(
      "delay_claims",
    ).dependencies].sort(),
    [
      "challenge_contract",
      "notices_claims",
      "windows_analysis",
    ].sort(),
  );

  assert.deepEqual(
    [...projectionDefinition(
      "eot_assessment",
    ).dependencies].sort(),
    [
      "challenge_contract",
      "delay_claims",
      "notices_claims",
      "windows_analysis",
    ].sort(),
  );
});
