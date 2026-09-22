import test from "node:test";
import assert from "node:assert/strict";

import type {
  CanonicalCalendar,
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
} from "../packages/schedule-analysis-core/src";
import type {
  ScheduleRevision,
} from "../packages/schedule-revision-core/src";
import type {
  CanonicalResourceModel,
} from "../packages/schedule-resource-core/src";
import type {
  CanonicalQuantityProgressModel,
} from "../packages/quantity-progress-core/src";
import type {
  DelayClaimsModel,
} from "../packages/delay-analysis-core/src";
import type {
  ContractDocumentResult,
  ContractSection,
} from "../packages/contract-parser/src";

import {
  buildScheduleAnalyticsProjection,
} from "../packages/schedule-analytics/src";
import {
  buildActivityAnalyticsProjection,
} from "../packages/activity-analytics/src";
import {
  buildResourceUtilizationProjection,
} from "../packages/resource-utilization/src";
import {
  buildLookAheadProjection,
} from "../packages/lookahead-schedule/src";
import {
  buildProgressReportProjection,
} from "../packages/progress-report/src";
import {
  buildScheduleChangeReportProjection,
} from "../packages/schedule-change-report/src";
import {
  buildRevisionTrendProjection,
} from "../packages/revision-trend/src";
import {
  buildVarianceTrendsProjection,
} from "../packages/variance-trends/src";
import {
  buildProgressScurveProjection,
} from "../packages/progress-scurve/src";
import {
  buildQuantityScurveProjection,
} from "../packages/quantity-scurve/src";
import {
  buildProgressBreakdownProjection,
} from "../packages/progress-breakdown/src";
import {
  buildMilestonesProjection,
} from "../packages/milestones-analysis/src";
import {
  buildNearCriticalProjection,
} from "../packages/near-critical-analysis/src";
import {
  buildManhourScurveProjection,
} from "../packages/manhour-scurve/src";
import {
  buildForecastHistoryProjection,
  forecastSnapshotFromProjection,
} from "../packages/forecast-history/src";
import {
  buildIndependentForecastProjection,
} from "../packages/independent-forecast/src";
import {
  buildWindowsAnalysisProjection,
} from "../packages/windows-analysis/src";
import {
  buildDelayClaimsProjection,
} from "../packages/delay-claims/src";
import {
  buildNoticesClaimsProjection,
} from "../packages/notices-claims/src";
import {
  buildEotAssessmentProjection,
} from "../packages/eot-assessment/src";
import {
  buildChallengeContractProjection,
} from "../packages/challenge-contract/src";
import {
  buildPmoAnalysisProjection,
} from "../packages/pmo-analysis/src";
import {
  scheduleModules,
} from "../packages/runtime-api/src/registry";
import {
  extractContractLdTerms,
} from "../packages/contract-commercial/src";
import {
  buildProjectDirectorPosition,
} from "../packages/project-director/src";
import {
  buildBoardReadyReport,
} from "../packages/board-report/src";

const GENERATED_AT =
  "2026-09-19T00:00:00.000Z";

function calendar(): CanonicalCalendar {
  return {
    calendarId: "CAL1",
    name: "Mon-Fri 8h",
    semanticComplete: true,
    weeklyWorkMinutes: [
      0, 480, 480, 480, 480, 480, 0,
    ],
    weeklyWorkIntervals: [
      { dayIndex: 1, intervals: [] },
      ...[2, 3, 4, 5, 6].map(
        (dayIndex) => ({
          dayIndex,
          intervals: [{
            start: "08:00",
            finish: "16:00",
            minutes: 480,
          }],
        }),
      ),
      { dayIndex: 7, intervals: [] },
    ],
    exceptions: [],
    standardDayHours: 8,
    standardWeekHours: 40,
    sourceRefs: [{ source: "xer", locator: "calendar:CAL1" }],
  };
}

function activity(
  activityId: string,
  overrides:
    Partial<CanonicalScheduleActivity> = {},
): CanonicalScheduleActivity {
  return {
    projectId: "P22",
    activityId,
    nativeId: activityId,
    name: activityId,
    wbsId: "W1",
    calendarId: "CAL1",
    activityType: "task",
    status: "not_started",
    baselineStartIso:
      "2026-01-05T08:00:00.000Z",
    baselineFinishIso:
      "2026-01-06T16:00:00.000Z",
    currentStartIso:
      "2026-01-05T08:00:00.000Z",
    currentFinishIso:
      "2026-01-06T16:00:00.000Z",
    actualStartIso: null,
    actualFinishIso: null,
    forecastStartIso: null,
    forecastFinishIso: null,
    originalDurationHours: 16,
    remainingDurationHours: 16,
    totalFloatHours: 16,
    freeFloatHours: 8,
    percentComplete: 0,
    sourceRefs: [{ source: "xer", locator: "activity:" + activityId }],
    diagnostics: [],
    ...overrides,
  };
}

function model(
  revisionId: string,
  dataDateIso: string,
  delayed: boolean,
): CanonicalScheduleModel {
  return {
    projectId: "P22",
    source: "xer",
    sourceRevisionId: revisionId,
    dataDateIso,
    activities: [
      activity("A100", {
        name: "Mobilisation",
        status: "completed",
        baselineStartIso:
          "2026-01-01T08:00:00.000Z",
        baselineFinishIso:
          "2026-01-02T16:00:00.000Z",
        currentStartIso:
          "2026-01-01T08:00:00.000Z",
        currentFinishIso:
          "2026-01-02T16:00:00.000Z",
        actualStartIso:
          "2026-01-01T08:00:00.000Z",
        actualFinishIso:
          "2026-01-02T16:00:00.000Z",
        originalDurationHours: 16,
        remainingDurationHours: 0,
        totalFloatHours: 0,
        freeFloatHours: 0,
        percentComplete: 100,
      }),
      activity("A200", {
        name: "Excavation",
        status:
          delayed ? "in_progress" : "not_started",
        baselineStartIso:
          "2026-01-05T08:00:00.000Z",
        baselineFinishIso:
          "2026-01-08T16:00:00.000Z",
        currentStartIso:
          "2026-01-05T08:00:00.000Z",
        currentFinishIso:
          delayed
            ? "2026-01-12T16:00:00.000Z"
            : "2026-01-08T16:00:00.000Z",
        actualStartIso:
          delayed
            ? "2026-01-05T08:00:00.000Z"
            : null,
        forecastStartIso:
          delayed
            ? "2026-01-05T08:00:00.000Z"
            : null,
        forecastFinishIso:
          delayed
            ? "2026-01-12T16:00:00.000Z"
            : null,
        originalDurationHours: 32,
        remainingDurationHours:
          delayed ? 16 : 32,
        totalFloatHours:
          delayed ? 8 : 24,
        freeFloatHours:
          delayed ? 4 : 16,
        percentComplete:
          delayed ? 50 : 0,
      }),
      activity("M300", {
        name: "Foundation Complete",
        activityType: "finish_milestone",
        baselineStartIso:
          "2026-01-08T16:00:00.000Z",
        baselineFinishIso:
          "2026-01-08T16:00:00.000Z",
        currentStartIso:
          delayed
            ? "2026-01-13T08:00:00.000Z"
            : "2026-01-09T08:00:00.000Z",
        currentFinishIso:
          delayed
            ? "2026-01-13T08:00:00.000Z"
            : "2026-01-09T08:00:00.000Z",
        forecastStartIso:
          delayed
            ? "2026-01-13T08:00:00.000Z"
            : null,
        forecastFinishIso:
          delayed
            ? "2026-01-13T08:00:00.000Z"
            : null,
        originalDurationHours: 0,
        remainingDurationHours: 0,
        totalFloatHours: 16,
        freeFloatHours: 16,
        percentComplete: 0,
      }),
    ],
    relationships: [
      {
        relationshipId: "R1",
        predecessorActivityId: "A100",
        successorActivityId: "A200",
        type: "FS",
        lagHours: 0,
        external: false,
        sourceRefs: [{ source: "xer", locator: "relationship:R1" }],
        diagnostics: [],
      },
      {
        relationshipId: "R2",
        predecessorActivityId: "A200",
        successorActivityId: "M300",
        type: "FS",
        lagHours: 0,
        external: false,
        sourceRefs: [{ source: "xer", locator: "relationship:R2" }],
        diagnostics: [],
      },
    ],
    wbs: [{
      wbsId: "W1",
      parentWbsId: null,
      name: "Civil",
      sourceRefs: [{ source: "xer", locator: "wbs:W1" }],
    }],
    calendars: [calendar()],
    diagnostics: [],
  };
}

function revisions(): ScheduleRevision[] {
  return [
    {
      revisionId: "rev-1",
      label: "Update 1",
      sequence: 1,
      effectiveAt: "2026-01-04",
      model: model(
        "rev-1",
        "2026-01-04",
        false,
      ),
    },
    {
      revisionId: "rev-2",
      label: "Update 2",
      sequence: 2,
      effectiveAt: "2026-01-09",
      model: model(
        "rev-2",
        "2026-01-09",
        true,
      ),
    },
  ];
}

function resources(): CanonicalResourceModel {
  return {
    projectId: "P22",
    sourceRevisionId: "rev-2",
    units: [{
      unitId: "H",
      name: "Hour",
      abbreviation: "hr",
      sourceRefs: [{
        source: "xer",
        locator: "UMEASURE:H",
      }],
    }],
    financialPeriods: [{
      periodId: "FP1",
      name: "Jan W1",
      startIso: "2026-01-01",
      endIso: "2026-01-09",
      sourceRefs: [{
        source: "xer",
        locator: "FINDATES:FP1",
      }],
    }],
    resources: [{
      resourceId: "LAB1",
      nativeId: "LAB1",
      shortName: "LAB1",
      name: "Civil Labour",
      parentResourceId: null,
      resourceType: "labor",
      unitId: "H",
      unitName: "Hour",
      unitAbbreviation: "hr",
      calendarId: "CAL1",
      priceTimeUnit: "hour",
      rates: [{
        effectiveDateIso: "2026-01-01",
        maxUnitsPerHour: 4,
        sourceRefs: [{
          source: "xer",
          locator: "RSRCRATE:LAB1",
        }],
      }],
      sourceRefs: [{
        source: "xer",
        locator: "RSRC:LAB1",
      }],
    }],
    assignments: [{
      assignmentId: "AS1",
      projectId: "P22",
      activityId: "A200",
      nativeTaskId: "A200",
      resourceId: "LAB1",
      roleId: null,
      resourceType: "labor",
      plannedUnits: 80,
      actualRegularUnits: 20,
      actualOvertimeUnits: 0,
      remainingUnits: 60,
      atCompletionUnits: 80,
      plannedUnitsPerHour: 2,
      remainingUnitsPerHour: 2,
      plannedStartIso: "2026-01-05",
      plannedFinishIso: "2026-01-12",
      actualStartIso: "2026-01-05",
      actualFinishIso: null,
      remainingStartIso: "2026-01-09",
      remainingFinishIso: "2026-01-12",
      curveId: null,
      sourceRefs: [{
        source: "xer",
        locator: "TASKRSRC:AS1",
      }],
      diagnostics: [],
    }],
    periodActuals: [{
      assignmentId: "AS1",
      projectId: "P22",
      activityId: "A200",
      resourceId: "LAB1",
      periodId: "FP1",
      periodName: "Jan W1",
      periodStartIso: "2026-01-01",
      periodEndIso: "2026-01-09",
      actualUnits: 20,
      sourceRefs: [{
        source: "xer",
        locator: "TRSRCFIN:AS1:FP1",
      }],
      diagnostics: [],
    }],
    diagnostics: [],
  };
}

function quantities():
  CanonicalQuantityProgressModel {
  return {
    projectId: "P22",
    boqRevisionId: "boq-1",
    scheduleRevisionId: "rev-2",
    items: [{
      quantityItemId: "Q1",
      itemNumber: "1.1",
      section: "Civil",
      description: "Excavation",
      unit: "m3",
      contractQuantity: 100,
      sourceRefs: [{
        source: "boq_xlsx",
        locator: "BOQ!D2",
      }],
      diagnostics: [],
    }],
    allocations: [{
      allocationId: "QA1",
      quantityItemId: "Q1",
      activityId: "A200",
      allocatedQuantity: 100,
      sourceRefs: [{
        source: "governed_mapping",
        locator: "Q1->A200",
      }],
    }],
    installedSnapshots: [
      {
        snapshotId: "QS1",
        asOfIso: "2026-01-04",
        quantityItemId: "Q1",
        installedQuantity: 20,
        sourceRefs: [{
          source: "progress_record",
          locator: "progress:2026-01-04:Q1",
        }],
      },
      {
        snapshotId: "QS2",
        asOfIso: "2026-01-09",
        quantityItemId: "Q1",
        installedQuantity: 55,
        sourceRefs: [{
          source: "progress_record",
          locator: "progress:2026-01-09:Q1",
        }],
      },
    ],
    diagnostics: [],
  };
}

function delayModel(): DelayClaimsModel {
  return {
    projectId: "P22",
    evidenceRevisionId: "evidence-2",
    events: [{
      eventId: "E1",
      title: "Late design information",
      category: "late_information",
      startIso: "2026-01-05",
      endIso: "2026-01-08",
      responsibility: "employer",
      responsibilityState: "official",
      describedImpactDays: 3,
      describedImpactState: "candidate",
      relatedActivityIds: ["A200"],
      relatedClauseIdentifiers: ["8.4"],
      evidenceRefs: [
        {
          sourceType: "schedule",
          sourceId: "rev-2",
          locator: "activity:A200",
        },
        {
          sourceType: "correspondence",
          sourceId: "RFI-22",
          locator: "page:1",
        },
      ],
      diagnostics: [],
    }],
    notices: [{
      noticeId: "N1",
      kind: "eot_notice",
      eventId: "E1",
      claimId: "C1",
      actualIssuedAt: "2026-01-06",
      actualReceivedAt: "2026-01-06",
      plannedAt: null,
      subject: "EOT notice for late information",
      clauseIdentifiers: ["8.4"],
      evidenceRefs: [{
        sourceType: "notice",
        sourceId: "N1",
        locator: "page:1",
      }],
      diagnostics: [],
    }],
    claims: [{
      claimId: "C1",
      title: "EOT claim - late information",
      state: "submitted",
      eventIds: ["E1"],
      submittedAt: "2026-01-08",
      claimedDays: 3,
      claimedAmount: 125000,
      assessedDays: null,
      assessedDaysState: "missing",
      assessedAmount: null,
      assessedAmountState: "missing",
      clauseIdentifiers: ["8.4"],
      evidenceRefs: [{
        sourceType: "claim",
        sourceId: "C1",
        locator: "page:1",
      }],
      diagnostics: [],
    }],
    noticeRequirements: [{
      requirementId: "NR1",
      noticeKind: "eot_notice",
      eventCategories: [
        "late_information",
      ],
      noticePeriodDays: 7,
      state: "official",
      clauseIdentifiers: ["8.4"],
      evidenceRefs: [{
        sourceType: "contract",
        sourceId: "contract-1",
        locator: "clause:8.4",
      }],
    }],
    diagnostics: [],
  };
}

function contractSection(
  text: string,
): ContractSection {
  return {
    sectionKey: "clause-8.4",
    kind: "clause",
    identifier: "8.4",
    contextKey: "contract",
    parentIdentifier: null,
    instanceOrdinal: 1,
    heading: "Extension of Time and Delay Damages",
    text,
    startPage: 10,
    endPage: 10,
    startBlock: null,
    endBlock: null,
    sourceSpans: [{
      sourceKind: "pdf_page",
      sourceIndex: 10,
      page: 10,
      block: null,
      start: 0,
      end: text.length,
      text,
    }],
    sourceMode: "deterministic",
    status: "verified",
    diagnostics: [],
  };
}

function contract(): ContractDocumentResult {
  const section = contractSection(
    "Clause 8.4 Extension of Time. The Contractor shall give notice within 7 calendar days. Liquidated damages are USD 10,000 per day and are capped at 10% of the Contract Amount. Claims require contemporary records.",
  );
  return {
    sourceType: "pdf",
    pdf: null,
    docx: null,
    sections: [section],
    clauses: [section],
    appendices: [],
    duplicateIdentifiers: [],
    repeatedRawIdentifiers: [],
    references: [],
    amendmentActions: [],
    ignoredSpans: [],
    unclassifiedLines: [],
    semanticCoveragePercent: 100,
    physicalComplete: true,
    semanticComplete: true,
    complete: true,
    diagnostics: [],
  };
}

test("all 22 Schedule modules execute coherently from governed cross-domain evidence", () => {
  const history = revisions();
  const current = history[1]!.model;
  const resourceModel = resources();
  const quantityModel = quantities();
  const delays = delayModel();

  const scheduleAnalytics =
    buildScheduleAnalyticsProjection(
      current,
      {
        generatedAt: GENERATED_AT,
        producerVersion: "schedule-final-v1",
      },
    );
  const activityAnalytics =
    buildActivityAnalyticsProjection(
      current,
      {
        generatedAt: GENERATED_AT,
        producerVersion: "activity-final-v1",
      },
    );
  const resourceUtilization =
    buildResourceUtilizationProjection(
      resourceModel,
      current,
      {
        generatedAt: GENERATED_AT,
        producerVersion: "resource-final-v1",
      },
    );
  const lookAhead =
    buildLookAheadProjection(
      current,
      {
        generatedAt: GENERATED_AT,
        producerVersion: "lookahead-final-v1",
        readinessEvidence: {
          A200: {
            procurement_material: {
              state: "ready",
              sourceRefs: ["procurement:PO-1"],
            },
            design_submittal: {
              state: "blocked",
              sourceRefs: ["rfi:RFI-22"],
            },
            permit: {
              state: "ready",
              sourceRefs: ["permit:P-1"],
            },
            resource: {
              state: "ready",
              sourceRefs: ["resource:LAB1"],
            },
            quality: {
              state: "ready",
              sourceRefs: ["quality:ITP-1"],
            },
            commercial: {
              state: "ready",
              sourceRefs: ["contract:8.4"],
            },
            risk: {
              state: "ready",
              sourceRefs: ["risk:R-1"],
            },
          },
        },
      },
    );
  const progressScurve =
    buildProgressScurveProjection(
      current,
      {
        generatedAt: GENERATED_AT,
        producerVersion: "progress-scurve-final-v1",
        intervalDays: 1,
        actualHistory: [
          {
            asOfIso: "2026-01-04",
            progressPercent: 30,
            sourceRevisionId: "rev-1",
            sourceRefs: ["progress:rev-1"],
          },
          {
            asOfIso: "2026-01-09",
            progressPercent: 55,
            sourceRevisionId: "rev-2",
            sourceRefs: ["progress:rev-2"],
          },
        ],
      },
    );
  const milestones =
    buildMilestonesProjection(
      current,
      {
        generatedAt: GENERATED_AT,
        producerVersion: "milestones-final-v1",
      },
    );
  const independentForecast =
    buildIndependentForecastProjection(
      current,
      {
        generatedAt: GENERATED_AT,
        producerVersion: "forecast-final-v1",
        probabilisticConfig: {
          iterations: 1000,
          seed: 42,
          minFactor: 0.9,
          modeFactor: 1,
          maxFactor: 1.25,
        },
      },
    );
  const progressReport =
    buildProgressReportProjection({
      generatedAt: GENERATED_AT,
      producerVersion: "progress-report-final-v1",
      scheduleAnalytics,
      milestones,
      lookAhead,
      progressScurve,
      independentForecast,
      progressEvidence: {
        physical: {
          valuePercent: 54.8,
          sourceRefs: ["physical:certificate:1"],
        },
        contractorReported: {
          valuePercent: 55.6,
          sourceRefs: ["contractor:report:1"],
        },
        certified: {
          valuePercent: 53.9,
          sourceRefs: ["engineer:certificate:1"],
        },
      },
    });

  const scheduleChange =
    buildScheduleChangeReportProjection(
      history[0]!,
      history[1]!,
      {
        generatedAt: GENERATED_AT,
        producerVersion: "change-final-v1",
      },
    );
  const revisionTrend =
    buildRevisionTrendProjection(
      history,
      {
        generatedAt: GENERATED_AT,
        producerVersion: "revision-final-v1",
      },
    );
  const varianceTrends =
    buildVarianceTrendsProjection(
      history,
      {
        generatedAt: GENERATED_AT,
        producerVersion: "variance-final-v1",
      },
    );
  const quantityScurve =
    buildQuantityScurveProjection(
      quantityModel,
      current,
      {
        generatedAt: GENERATED_AT,
        producerVersion: "quantity-final-v1",
        intervalDays: 1,
      },
    );
  const progressBreakdown =
    buildProgressBreakdownProjection(
      current,
      {
        generatedAt: GENERATED_AT,
        producerVersion: "breakdown-final-v1",
      },
    );
  const nearCritical =
    buildNearCriticalProjection(
      current,
      {
        generatedAt: GENERATED_AT,
        producerVersion: "near-critical-final-v1",
      },
    );
  const manhourScurve =
    buildManhourScurveProjection(
      resourceModel,
      current,
      {
        generatedAt: GENERATED_AT,
        producerVersion: "manhour-final-v1",
        intervalDays: 1,
      },
    );

  const firstForecast =
    buildIndependentForecastProjection(
      history[0]!.model,
      {
        generatedAt: GENERATED_AT,
        producerVersion: "forecast-history-source-v1",
      },
    );
  const forecastHistory =
    buildForecastHistoryProjection(
      [
        forecastSnapshotFromProjection(
          firstForecast,
          "FH1",
        ),
        forecastSnapshotFromProjection(
          independentForecast,
          "FH2",
        ),
      ],
      {
        generatedAt: GENERATED_AT,
        producerVersion: "forecast-history-final-v1",
      },
    );

  const windows =
    buildWindowsAnalysisProjection(
      history,
      delays,
      {
        generatedAt: GENERATED_AT,
        producerVersion: "windows-final-v1",
      },
    );
  const delayClaims =
    buildDelayClaimsProjection(
      windows,
      delays,
      {
        generatedAt: GENERATED_AT,
        producerVersion: "delay-final-v1",
      },
    );
  const noticesClaims =
    buildNoticesClaimsProjection(
      delays,
      {
        generatedAt: GENERATED_AT,
        producerVersion: "notices-final-v1",
      },
    );
  const eotAssessment =
    buildEotAssessmentProjection(
      windows,
      delayClaims,
      {
        contractualCompletionIso:
          "2026-01-09",
        contractualCompletionState:
          "official",
        officialApprovedEotDays: 0,
        officialApprovedEotState:
          "official",
        eotDayBasis: "calendar_days",
        eotDayBasisState: "official",
        sourceRefs: ["contract:8.4"],
      },
      {
        generatedAt: GENERATED_AT,
        producerVersion: "eot-final-v1",
      },
    );
  const challengeContract =
    buildChallengeContractProjection(
      contract(),
      {
        generatedAt: GENERATED_AT,
        producerVersion: "challenge-final-v1",
      },
    );


  const ldTerms =
    extractContractLdTerms(
      contract(),
    );

  assert.equal(
    ldTerms.rateState,
    "candidate",
  );
  assert.equal(
    ldTerms.rate?.currency,
    "USD",
  );
  assert.equal(
    ldTerms.rate?.amount,
    10000,
  );
  assert.equal(
    ldTerms.cap?.percent,
    10,
  );

  const director =
    buildProjectDirectorPosition({
      generatedAt: GENERATED_AT,
      projectId: "P22",
      scheduleAnalytics,
      progressReport,
      independentForecast,
      delayClaims,
      noticesClaims,
      eotAssessment,
      ldTerms,
      contractValue: {
        amount: 5_000_000,
        currency: "USD",
        sourceRefs: [
          "contract:value:USD",
        ],
      },
      bonds: [
        {
          bondId: "B1",
          kind: "performance",
          status: "active",
          amount: 500_000,
          currency: "USD",
          expiryIso:
            "2026-10-01T00:00:00.000Z",
          sourceRefs: ["bond:B1"],
        },
      ],
      commercialByCurrency: [
        {
          currency: "AED",
          pendingVariationAmount: {
            value: 250_000,
            state: "established" as const,
            sourceRefs: ["test:canonical-commercial"],
            diagnostics: [],
          },
          approvedVariationAmount: {
            value: null,
            state: "not_submitted" as const,
            sourceRefs: ["test:canonical-commercial"],
            diagnostics: [],
          },
          certifiedUnpaidAmount: {
            value: null,
            state: "not_submitted" as const,
            sourceRefs: ["test:canonical-commercial"],
            diagnostics: [],
          },
          retentionDeductedAmount: {
            value: 75_000,
            state: "established" as const,
            sourceRefs: ["test:canonical-commercial"],
            diagnostics: [],
          },
          retentionHeldAmount: {
            value: 75_000,
            state: "established" as const,
            sourceRefs: ["test:canonical-commercial"],
            diagnostics: [],
          },
          activeBondAmount: {
            value: null,
            state: "not_submitted" as const,
            sourceRefs: ["test:canonical-commercial"],
            diagnostics: [],
          },
          claimClaimedAmount: {
            value: null,
            state: "not_submitted" as const,
            sourceRefs: ["test:canonical-commercial"],
            diagnostics: [],
          },
          claimAssessedAmount: {
            value: null,
            state: "not_submitted" as const,
            sourceRefs: ["test:canonical-commercial"],
            diagnostics: [],
          },
          ldScenarioAmount: {
            value: null,
            state: "not_applicable" as const,
            sourceRefs: ["test:canonical-commercial"],
            diagnostics: [],
          },
        },
        {
          currency: "USD",
          pendingVariationAmount: {
            value: null,
            state: "not_submitted" as const,
            sourceRefs: ["test:canonical-commercial"],
            diagnostics: [],
          },
          approvedVariationAmount: {
            value: 50_000,
            state: "established" as const,
            sourceRefs: ["test:canonical-commercial"],
            diagnostics: [],
          },
          certifiedUnpaidAmount: {
            value: 100_000,
            state: "established" as const,
            sourceRefs: ["test:canonical-commercial"],
            diagnostics: [],
          },
          retentionDeductedAmount: {
            value: null,
            state: "not_submitted" as const,
            sourceRefs: ["test:canonical-commercial"],
            diagnostics: [],
          },
          retentionHeldAmount: {
            value: null,
            state: "not_submitted" as const,
            sourceRefs: ["test:canonical-commercial"],
            diagnostics: [],
          },
          activeBondAmount: {
            value: 500_000,
            state: "established" as const,
            sourceRefs: ["test:canonical-commercial"],
            diagnostics: [],
          },
          claimClaimedAmount: {
            value: 125_000,
            state: "established" as const,
            sourceRefs: ["test:canonical-commercial"],
            diagnostics: [],
          },
          claimAssessedAmount: {
            value: null,
            state: "not_submitted" as const,
            sourceRefs: ["test:canonical-commercial"],
            diagnostics: [],
          },
          ldScenarioAmount: {
            value: null,
            state: "not_applicable" as const,
            sourceRefs: ["test:canonical-commercial"],
            diagnostics: [],
          },
        },
      ],
      hseIncidents: [{
        incidentId: "H1",
        severity: "lti",
        status: "open",
        sourceRefs: ["hse:H1"],
      }],
      ncrs: [{
        ncrId: "NCR1",
        severity: "major",
        status: "open",
        sourceRefs: ["ncr:NCR1"],
      }],
      rfis: [{
        rfiId: "RFI-22",
        status: "open",
        dueIso:
          "2026-01-07T00:00:00.000Z",
        sourceRefs: ["rfi:RFI-22"],
      }],
      permits: [{
        permitId: "PER1",
        status: "submitted",
        dueIso:
          "2026-01-08T00:00:00.000Z",
        sourceRefs: ["permit:PER1"],
      }],
      boardEvidence: {
        reportId: "BR1",
        state: "finalized",
        sourceManifestId: "manifest-1",
        evidenceReceiptIds: [
          "receipt-1",
          "receipt-2",
        ],
        finalizedAt:
          "2026-09-19T00:00:00.000Z",
      },
    });

  assert.deepEqual(
    director.commercialByCurrency.map(
      (row) => row.currency,
    ),
    ["AED", "USD"],
  );
  assert.equal(
    director.claims.fullyLinkedClaimCount,
    1,
  );
  assert.equal(
    director.claims.unlinkedClaimIds.length,
    0,
  );
  assert.equal(
    director.ld.state,
    "scenario_candidate",
  );
  assert.equal(
    director.ld.currency,
    "USD",
  );
  assert.equal(
    director.controls.openLtiOrWorseCount,
    1,
  );
  assert.equal(
    director.controls
      .openCriticalMajorNcrCount,
    1,
  );
  assert.equal(
    director.controls.overdueRfiCount,
    1,
  );
  assert.equal(
    director.controls.overduePermitCount,
    1,
  );

  const boardReport =
    buildBoardReadyReport(
      director,
      {
        sourceManifestId: "manifest-1",
        evidenceReceiptIds: [
          "receipt-1",
          "receipt-2",
        ],
        finalizedAt:
          "2026-09-19T00:00:00.000Z",
      },
    );

  assert.equal(
    boardReport.state,
    "board_ready",
  );
  assert.ok(
    boardReport.publicationReceipt
      .sourceFingerprint.length > 20,
  );
  assert.ok(
    boardReport.evidenceRefs.includes(
      "source-manifest:manifest-1",
    ),
  );

  const pmoAnalysis =
    buildPmoAnalysisProjection({
      generatedAt: GENERATED_AT,
      producerVersion: "pmo-final-v1",
      evidenceRevisionId: "evidence-2",
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
    });

  const projections = [
    pmoAnalysis,
    scheduleAnalytics,
    activityAnalytics,
    resourceUtilization,
    lookAhead,
    progressReport,
    scheduleChange,
    revisionTrend,
    varianceTrends,
    progressScurve,
    quantityScurve,
    progressBreakdown,
    milestones,
    nearCritical,
    manhourScurve,
    forecastHistory,
    independentForecast,
    delayClaims,
    noticesClaims,
    windows,
    eotAssessment,
    challengeContract,
  ];

  assert.equal(projections.length, 22);
  assert.equal(
    new Set(
      projections.map(
        (projection) =>
          projection.projectionKey,
      ),
    ).size,
    22,
  );

  assert.equal(scheduleModules.length, 22);

  const runtimeKeys = scheduleModules
    .map((module) =>
      module.key.replace(/-/g, "_"),
    )
    .sort();
  const projectionKeys = projections
    .map(
      (projection) =>
        projection.projectionKey,
    )
    .sort();

  assert.deepEqual(
    projectionKeys,
    runtimeKeys,
  );

  const excavation = lookAhead.rows.find(
    (row) => row.activityId === "A200",
  )!;
  assert.equal(
    excavation.readiness.state,
    "blocked",
  );
  assert.equal(
    excavation.readiness.dimensions
      .find(
        (dimension) =>
          dimension.key ===
          "design_submittal",
      )!
      .state,
    "blocked",
  );
  assert.equal(
    excavation.readiness.dimensions
      .find(
        (dimension) =>
          dimension.key === "access",
      )!
      .state,
    "unknown",
  );

  assert.equal(
    progressReport.progressBases
      .physical.valuePercent,
    54.8,
  );
  assert.equal(
    progressReport.progressBases
      .contractorReported.valuePercent,
    55.6,
  );
  assert.equal(
    progressReport.progressBases
      .certified.valuePercent,
    53.9,
  );
  assert.notEqual(
    progressReport.progressBases
      .contractorReported.valuePercent,
    progressReport.progressBases
      .certified.valuePercent,
  );

  assert.equal(
    independentForecast
      .probabilistic.authority,
    "non_official",
  );
  assert.equal(
    independentForecast
      .probabilistic.status,
    "available",
  );
  assert.ok(
    independentForecast
      .probabilistic.p50CompletionIso,
  );
  assert.ok(
    independentForecast
      .probabilistic.p80CompletionIso,
  );
  assert.ok(
    independentForecast
      .probabilistic.p90CompletionIso,
  );

  const event = delayClaims.events.find(
    (row) => row.eventId === "E1",
  )!;
  assert.deepEqual(
    event.linkedClaimIds,
    ["C1"],
  );
  assert.ok(
    windows.windows.some(
      (window) =>
        window.delayEvents.some(
          (delayEvent) =>
            delayEvent.eventId === "E1",
        ),
    ),
  );

  assert.equal(
    noticesClaims.timelyNoticeCount,
    1,
  );
  assert.equal(
    eotAssessment.basis,
    "analytical_candidate_not_contractual_determination",
  );
  assert.equal(
    pmoAnalysis.projectId,
    "P22",
  );
});
