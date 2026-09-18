import type {
  CanonicalCalendar,
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";
import type {
  ProjectRuntimeState,
} from "./project-state-types";
import {
  runtimeProjects,
} from "./project-state";
import {
  invalidateProject,
} from "./project-projections";

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
      {
        dayIndex: 2,
        intervals: [{
          start: "08:00",
          finish: "16:00",
          minutes: 480,
        }],
      },
      {
        dayIndex: 3,
        intervals: [{
          start: "08:00",
          finish: "16:00",
          minutes: 480,
        }],
      },
      {
        dayIndex: 4,
        intervals: [{
          start: "08:00",
          finish: "16:00",
          minutes: 480,
        }],
      },
      {
        dayIndex: 5,
        intervals: [{
          start: "08:00",
          finish: "16:00",
          minutes: 480,
        }],
      },
      {
        dayIndex: 6,
        intervals: [{
          start: "08:00",
          finish: "16:00",
          minutes: 480,
        }],
      },
      { dayIndex: 7, intervals: [] },
    ],
    exceptions: [],
    standardDayHours: 8,
    standardWeekHours: 40,
    sourceRefs: [{
      source: "xer",
      locator: "demo:calendar:CAL1",
    }],
  };
}

function activity(
  projectId: string,
  activityId: string,
  overrides:
    Partial<CanonicalScheduleActivity> = {},
): CanonicalScheduleActivity {
  return {
    projectId,
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
    sourceRefs: [{
      source: "xer",
      locator:
        "demo:activity:" +
        activityId,
    }],
    diagnostics: [],
    ...overrides,
  };
}

function schedule(
  projectId: string,
  revisionId: string,
  dataDateIso: string,
  delayed: boolean,
): CanonicalScheduleModel {
  return {
    projectId,
    source: "xer",
    sourceRevisionId:
      revisionId,
    dataDateIso,
    activities: [
      activity(
        projectId,
        "A100",
        {
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
        },
      ),
      activity(
        projectId,
        "A200",
        {
          name: "Excavation",
          status:
            delayed
              ? "in_progress"
              : "not_started",
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
        },
      ),
      activity(
        projectId,
        "M300",
        {
          name: "Foundation Complete",
          activityType:
            "finish_milestone",
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
        },
      ),
    ],
    relationships: [
      {
        relationshipId: "R1",
        predecessorActivityId: "A100",
        successorActivityId: "A200",
        type: "FS",
        lagHours: 0,
        external: false,
        sourceRefs: [{
          source: "xer",
          locator: "demo:R1",
        }],
        diagnostics: [],
      },
      {
        relationshipId: "R2",
        predecessorActivityId: "A200",
        successorActivityId: "M300",
        type: "FS",
        lagHours: 0,
        external: false,
        sourceRefs: [{
          source: "xer",
          locator: "demo:R2",
        }],
        diagnostics: [],
      },
    ],
    wbs: [{
      wbsId: "W1",
      parentWbsId: null,
      name: "Civil Works",
      sourceRefs: [{
        source: "xer",
        locator: "demo:W1",
      }],
    }],
    calendars: [calendar()],
    diagnostics: [],
  };
}

export function loadCertifiedDemoProject(
  projectId: string,
): ProjectRuntimeState {
  const revision1 =
    schedule(
      projectId,
      "demo-rev-1",
      "2026-01-04",
      false,
    );
  const revision2 =
    schedule(
      projectId,
      "demo-rev-2",
      "2026-01-09",
      true,
    );

  const contractText =
    "Clause 8.4 Extension of Time. The Contractor shall give notice within 7 calendar days. Liquidated damages are USD 10,000 per day and are capped at 10% of the Contract Amount. Claims require contemporary records.";

  const contractSection = {
    sectionKey: "demo-clause-8.4",
    kind: "clause" as const,
    identifier: "8.4",
    contextKey: "contract",
    parentIdentifier: null,
    instanceOrdinal: 1,
    heading:
      "Extension of Time and Delay Damages",
    text: contractText,
    startPage: 10,
    endPage: 10,
    startBlock: null,
    endBlock: null,
    sourceSpans: [{
      sourceKind: "pdf_page" as const,
      sourceIndex: 10,
      page: 10,
      block: null,
      start: 0,
      end: contractText.length,
      text: contractText,
    }],
    sourceMode:
      "deterministic" as const,
    status: "verified" as const,
    diagnostics: [],
  };

  const state:
    ProjectRuntimeState = {
    projectId,
    version: 1,
    demo: true,
    evidenceDocuments: [],\n    schedules: [
      {
        revision: {
          revisionId:
            "demo-rev-1",
          label: "Baseline Update",
          sequence: 1,
          effectiveAt:
            "2026-01-04",
          model: revision1,
        },
        format: "xer",
        sourceFilename:
          "demo-baseline.xer",
        sourceHashSha256:
          "demo".padEnd(64, "1"),
        uploadedAt:
          "2026-01-04T18:00:00.000Z",
        role: "baseline",
      },
      {
        revision: {
          revisionId:
            "demo-rev-2",
          label: "Current Update",
          sequence: 2,
          effectiveAt:
            "2026-01-09",
          model: revision2,
        },
        format: "xer",
        sourceFilename:
          "demo-current.xer",
        sourceHashSha256:
          "demo".padEnd(64, "2"),
        uploadedAt:
          "2026-01-09T18:00:00.000Z",
        role: "update",
      },
    ],
    resourcesByRevision:
      new Map([
        [
          "demo-rev-2",
          {
            projectId,
            sourceRevisionId:
              "demo-rev-2",
            units: [{
              unitId: "H",
              name: "Hour",
              abbreviation: "hr",
              sourceRefs: [{
                source: "xer",
                locator:
                  "demo:unit:H",
              }],
            }],
            financialPeriods: [{
              periodId: "FP1",
              name: "Jan W1",
              startIso:
                "2026-01-01",
              endIso:
                "2026-01-09",
              sourceRefs: [{
                source: "xer",
                locator:
                  "demo:FP1",
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
                effectiveDateIso:
                  "2026-01-01",
                maxUnitsPerHour: 4,
                sourceRefs: [{
                  source: "xer",
                  locator:
                    "demo:rate:LAB1",
                }],
              }],
              sourceRefs: [{
                source: "xer",
                locator:
                  "demo:resource:LAB1",
              }],
            }],
            assignments: [{
              assignmentId: "AS1",
              projectId,
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
              plannedStartIso:
                "2026-01-05",
              plannedFinishIso:
                "2026-01-12",
              actualStartIso:
                "2026-01-05",
              actualFinishIso: null,
              remainingStartIso:
                "2026-01-09",
              remainingFinishIso:
                "2026-01-12",
              curveId: null,
              sourceRefs: [{
                source: "xer",
                locator:
                  "demo:AS1",
              }],
              diagnostics: [],
            }],
            periodActuals: [{
              assignmentId: "AS1",
              projectId,
              activityId: "A200",
              resourceId: "LAB1",
              periodId: "FP1",
              periodName: "Jan W1",
              periodStartIso:
                "2026-01-01",
              periodEndIso:
                "2026-01-09",
              actualUnits: 20,
              sourceRefs: [{
                source: "xer",
                locator:
                  "demo:period:AS1",
              }],
              diagnostics: [],
            }],
            diagnostics: [],
          },
        ],
      ]),
    boq: null,
    quantities: {
      projectId,
      boqRevisionId:
        "demo-boq-1",
      scheduleRevisionId:
        "demo-rev-2",
      items: [{
        quantityItemId: "Q1",
        itemNumber: "1.1",
        section: "Civil",
        description: "Excavation",
        unit: "m3",
        contractQuantity: 100,
        sourceRefs: [{
          source: "boq_xlsx",
          locator:
            "demo:BOQ!D2",
        }],
        diagnostics: [],
      }],
      allocations: [{
        allocationId: "QA1",
        quantityItemId: "Q1",
        activityId: "A200",
        allocatedQuantity: 100,
        sourceRefs: [{
          source:
            "governed_mapping",
          locator:
            "demo:Q1->A200",
        }],
      }],
      installedSnapshots: [
        {
          snapshotId: "QS1",
          asOfIso:
            "2026-01-04",
          quantityItemId: "Q1",
          installedQuantity: 20,
          sourceRefs: [{
            source:
              "progress_record",
            locator:
              "demo:Q1:2026-01-04",
          }],
        },
        {
          snapshotId: "QS2",
          asOfIso:
            "2026-01-09",
          quantityItemId: "Q1",
          installedQuantity: 55,
          sourceRefs: [{
            source:
              "progress_record",
            locator:
              "demo:Q1:2026-01-09",
          }],
        },
      ],
      diagnostics: [],
    },
    contractDocuments: [],\n    contractFamily: null,\n    contract: {
      sourceType: "pdf",
      pdf: null,
      docx: null,
      sections: [
        contractSection,
      ],
      clauses: [
        contractSection,
      ],
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
    },
    controls: {
      delayClaims: {
        projectId,
        evidenceRevisionId:
          "demo-evidence-2",
        events: [{
          eventId: "E1",
          title:
            "Late design information",
          category:
            "late_information",
          startIso:
            "2026-01-05",
          endIso:
            "2026-01-08",
          responsibility:
            "employer",
          responsibilityState:
            "official",
          describedImpactDays: 3,
          describedImpactState:
            "candidate",
          relatedActivityIds: [
            "A200",
          ],
          relatedClauseIdentifiers: [
            "8.4",
          ],
          evidenceRefs: [
            {
              sourceType:
                "schedule",
              sourceId:
                "demo-rev-2",
              locator:
                "activity:A200",
            },
            {
              sourceType:
                "correspondence",
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
          actualIssuedAt:
            "2026-01-06",
          actualReceivedAt:
            "2026-01-06",
          plannedAt: null,
          subject:
            "EOT notice for late information",
          clauseIdentifiers: [
            "8.4",
          ],
          evidenceRefs: [{
            sourceType: "notice",
            sourceId: "N1",
            locator: "page:1",
          }],
          diagnostics: [],
        }],
        claims: [{
          claimId: "C1",
          title:
            "EOT claim - late information",
          state: "submitted",
          eventIds: ["E1"],
          submittedAt:
            "2026-01-08",
          claimedDays: 3,
          claimedAmount: 125000,
          assessedDays: null,
          assessedDaysState:
            "missing",
          assessedAmount: null,
          assessedAmountState:
            "missing",
          clauseIdentifiers: [
            "8.4",
          ],
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
          clauseIdentifiers: [
            "8.4",
          ],
          evidenceRefs: [{
            sourceType: "contract",
            sourceId:
              "demo-contract",
            locator: "clause:8.4",
          }],
        }],
        diagnostics: [],
      },
      contractTimeBasis: {
        contractualCompletionIso:
          "2026-01-09",
        contractualCompletionState:
          "official",
        officialApprovedEotDays: 0,
        officialApprovedEotState:
          "official",
        eotDayBasis:
          "calendar_days",
        eotDayBasisState:
          "official",
        sourceRefs: [
          "demo:contract:completion",
        ],
      },
      readinessEvidence: {
        A200: {
          procurement_material: {
            state: "ready",
            sourceRefs: [
              "demo:procurement:PO1",
            ],
          },
          design_submittal: {
            state: "blocked",
            sourceRefs: [
              "demo:rfi:RFI-22",
            ],
            note:
              "RFI response is outstanding.",
          },
          permit: {
            state: "ready",
            sourceRefs: [
              "demo:permit:PER1",
            ],
          },
          resource: {
            state: "ready",
            sourceRefs: [
              "demo:resource:LAB1",
            ],
          },
          quality: {
            state: "ready",
            sourceRefs: [
              "demo:quality:ITP1",
            ],
          },
          commercial: {
            state: "ready",
            sourceRefs: [
              "demo:contract:8.4",
            ],
          },
          risk: {
            state: "ready",
            sourceRefs: [
              "demo:risk:R1",
            ],
          },
        },
      },
      progressEvidence: {
        physical: {
          valuePercent: 54.8,
          sourceRefs: [
            "demo:physical:1",
          ],
        },
        contractorReported: {
          valuePercent: 55.6,
          sourceRefs: [
            "demo:contractor:1",
          ],
        },
        certified: {
          valuePercent: 53.9,
          sourceRefs: [
            "demo:certified:1",
          ],
        },
      },
      contractValue: {
        amount: 5_000_000,
        currency: "USD",
        sourceRefs: [
          "demo:contract:value",
        ],
      },
      variations: [
        {
          variationId: "V1",
          state: "pending",
          amount: 250_000,
          currency: "AED",
          sourceRefs: [
            "demo:variation:V1",
          ],
        },
        {
          variationId: "V2",
          state: "approved",
          amount: 50_000,
          currency: "USD",
          sourceRefs: [
            "demo:variation:V2",
          ],
        },
      ],
      invoices: [{
        invoiceId: "INV1",
        currency: "USD",
        certifiedAmount: 400_000,
        paidAmount: 300_000,
        sourceRefs: [
          "demo:invoice:INV1",
        ],
      }],
      retentions: [{
        retentionId: "RET1",
        state: "held",
        amount: 75_000,
        currency: "AED",
        sourceRefs: [
          "demo:retention:RET1",
        ],
      }],
      bonds: [{
        bondId: "B1",
        kind: "performance",
        status: "active",
        amount: 500_000,
        currency: "USD",
        expiryIso:
          "2026-10-01T00:00:00.000Z",
        sourceRefs: [
          "demo:bond:B1",
        ],
      }],
      claimCommercials: [{
        claimId: "C1",
        currency: "USD",
        claimedAmount: 125_000,
        assessedAmount: null,
        sourceRefs: [
          "demo:claim:C1",
        ],
      }],
      hseIncidents: [{
        incidentId: "H1",
        severity: "lti",
        status: "open",
        sourceRefs: [
          "demo:hse:H1",
        ],
      }],
      ncrs: [{
        ncrId: "NCR1",
        severity: "major",
        status: "open",
        sourceRefs: [
          "demo:ncr:NCR1",
        ],
      }],
      rfis: [{
        rfiId: "RFI-22",
        status: "open",
        dueIso:
          "2026-01-07T00:00:00.000Z",
        sourceRefs: [
          "demo:rfi:RFI-22",
        ],
      }],
      permits: [{
        permitId: "PER1",
        status: "submitted",
        dueIso:
          "2026-01-08T00:00:00.000Z",
        sourceRefs: [
          "demo:permit:PER1",
        ],
      }],
      boardPublication: {
        sourceManifestId:
          "demo-manifest-1",
        evidenceReceiptIds: [
          "demo-receipt-1",
          "demo-receipt-2",
        ],
        finalizedAt:
          "2026-09-19T00:00:00.000Z",
      },
    },
  };

  runtimeProjects.replace(state);
  invalidateProject(projectId);
  return state;
}
