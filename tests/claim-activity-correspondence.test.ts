import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveClaimActivityCorrespondence,
} from "../packages/claim-activity-correspondence/src";
import type {
  CanonicalScheduleModel,
} from "../packages/schedule-analysis-core/src";

function schedule(): CanonicalScheduleModel {
  return {
    projectId: "P-CORR",
    source: "xer",
    sourceRevisionId: "U3",
    dataDateIso: "2026-08-31",
    relationships: [],
    calendars: [],
    diagnostics: [],
    wbs: [
      {
        wbsId: "W-A",
        parentWbsId: null,
        name: "Tower A Structural",
        sourceRefs: [],
      },
      {
        wbsId: "W-B",
        parentWbsId: null,
        name: "Tower B Structural",
        sourceRefs: [],
      },
      {
        wbsId: "W-M",
        parentWbsId: null,
        name: "Tower A MEP",
        sourceRefs: [],
      },
    ],
    activities: [
      {
        projectId: "P-CORR",
        activityId: "A-100",
        nativeId: "100",
        name: "Tower A concrete frame Level 13",
        wbsId: "W-A",
        calendarId: null,
        activityType: "task",
        status: "in_progress",
        baselineStartIso: null,
        baselineFinishIso: null,
        currentStartIso: null,
        currentFinishIso: "2027-04-01",
        actualStartIso: null,
        actualFinishIso: null,
        forecastStartIso: null,
        forecastFinishIso: "2027-04-01",
        originalDurationHours: 100,
        remainingDurationHours: 50,
        totalFloatHours: 8,
        freeFloatHours: null,
        percentComplete: 50,
        sourceRefs: [{ source: "xer", locator: "TASK:line:10" }],
        diagnostics: [],
      },
      {
        projectId: "P-CORR",
        activityId: "A-200",
        nativeId: "200",
        name: "Tower B concrete frame Level 13",
        wbsId: "W-B",
        calendarId: null,
        activityType: "task",
        status: "not_started",
        baselineStartIso: null,
        baselineFinishIso: null,
        currentStartIso: null,
        currentFinishIso: "2027-04-02",
        actualStartIso: null,
        actualFinishIso: null,
        forecastStartIso: null,
        forecastFinishIso: "2027-04-02",
        originalDurationHours: 100,
        remainingDurationHours: 100,
        totalFloatHours: 16,
        freeFloatHours: null,
        percentComplete: 0,
        sourceRefs: [{ source: "xer", locator: "TASK:line:20" }],
        diagnostics: [],
      },
      {
        projectId: "P-CORR",
        activityId: "A-300",
        nativeId: "300",
        name: "Tower A MEP first fix Level 13",
        wbsId: "W-M",
        calendarId: null,
        activityType: "task",
        status: "not_started",
        baselineStartIso: null,
        baselineFinishIso: null,
        currentStartIso: null,
        currentFinishIso: "2027-05-01",
        actualStartIso: null,
        actualFinishIso: null,
        forecastStartIso: null,
        forecastFinishIso: "2027-05-01",
        originalDurationHours: 100,
        remainingDurationHours: 100,
        totalFloatHours: 24,
        freeFloatHours: null,
        percentComplete: 0,
        sourceRefs: [{ source: "xer", locator: "TASK:line:30" }],
        diagnostics: [],
      },
    ],
  };
}

const refs = [
  {
    sourceType: "claim" as const,
    sourceId: "CL01",
    locator: "row:2",
  },
];

test("explicit governed activity link is accepted without AI", () => {
  const result = resolveClaimActivityCorrespondence({
    claimId: "C1",
    eventId: "E1",
    narrative: "Delay to activity A-100",
    claimEvidenceRefs: refs,
    schedule: schedule(),
    explicitActivityIds: ["A-100"],
  });
  assert.equal(result.classification, "accepted_explicit");
  assert.equal(result.aiStage, "not_required");
  assert.deepEqual(result.acceptedActivityIds, ["A-100"]);
  assert.equal(result.candidates[0]?.authority, "governed_explicit");
  assert.ok(result.candidates[0]?.activitySourceRefs.includes("xer:TASK:line:10"));
});

test("strong multi-signal semantic correspondence is deterministically accepted", () => {
  const result = resolveClaimActivityCorrespondence({
    claimId: "C2",
    eventId: "E2",
    narrative:
      "Late access stopped Tower A structural concrete frame works at Level 13.",
    claimEvidenceRefs: refs,
    schedule: schedule(),
  });
  assert.equal(result.classification, "accepted_deterministic");
  assert.deepEqual(result.acceptedActivityIds, ["A-100"]);
  assert.equal(result.aiStage, "not_configured");
  assert.ok(result.candidates[0]!.prefilterScore >= 0.78);
  assert.ok((result.candidates[0]!.marginToNext ?? 0) >= 0.16);
});

test("similar candidates fail closed when margin is too small", () => {
  const result = resolveClaimActivityCorrespondence({
    claimId: "C3",
    eventId: "E3",
    narrative: "Concrete frame Level 13 structural delay.",
    claimEvidenceRefs: refs,
    schedule: schedule(),
  });
  assert.equal(result.acceptedActivityIds.length, 0);
  assert.ok(
    result.classification === "ambiguous" ||
      result.classification === "candidate",
  );
  assert.ok(
    result.diagnostics.includes(
      "ACTIVITY_CORRESPONDENCE_NOT_ESTABLISHED_FAIL_CLOSED",
    ),
  );
});

test("AI can only score bounded deterministic candidates and cannot inject an outside activity", () => {
  const result = resolveClaimActivityCorrespondence({
    claimId: "C4",
    eventId: "E4",
    narrative: "Tower A Level 13 works delayed.",
    claimEvidenceRefs: refs,
    schedule: schedule(),
    maxCandidates: 2,
    aiScores: [
      { activityId: "A-999", score: 0.99, rationale: "outside shortlist" },
    ],
  });
  assert.equal(result.boundedCandidateCount, 2);
  assert.equal(result.aiStage, "invalid_scores");
  assert.equal(result.acceptedActivityIds.length, 0);
  assert.ok(
    result.diagnostics.some((item) =>
      item.startsWith("INVALID_AI_ACTIVITY_SCORE:A-999"),
    ),
  );
});

test("bounded AI score may corroborate but never replace deterministic evidence", () => {
  const result = resolveClaimActivityCorrespondence({
    claimId: "C5",
    eventId: "E5",
    narrative:
      "Access issue Tower A Level 13 structural works concrete.",
    claimEvidenceRefs: refs,
    schedule: schedule(),
    aiScores: [
      { activityId: "A-100", score: 0.94, rationale: "same tower level discipline trade" },
      { activityId: "A-300", score: 0.41, rationale: "same tower level but wrong trade" },
    ],
  });
  assert.equal(result.aiStage, "scored");
  assert.deepEqual(result.acceptedActivityIds, ["A-100"]);
  assert.ok(
    ["accepted_deterministic", "accepted_ai_corroborated"].includes(
      result.classification,
    ),
  );
  assert.ok(
    result.diagnostics.includes(
      "ACTIVITY_CORRESPONDENCE_ESTABLISHED_NOT_CAUSATION_OR_ENTITLEMENT",
    ),
  );
});


test("multilingual Unicode narratives use the same bounded fail-closed resolver", () => {
  const input = schedule();
  input.wbs = [
    {
      wbsId: "W-AR-A",
      parentWbsId: null,
      name: "البرج أ إنشائي",
      sourceRefs: [],
    },
    {
      wbsId: "W-AR-B",
      parentWbsId: null,
      name: "البرج ب إنشائي",
      sourceRefs: [],
    },
  ];
  input.activities = [
    {
      ...input.activities[0]!,
      activityId: "AR-100",
      nativeId: "AR-100",
      name: "أعمال خرسانة البرج أ المستوى 13",
      wbsId: "W-AR-A",
    },
    {
      ...input.activities[1]!,
      activityId: "AR-200",
      nativeId: "AR-200",
      name: "أعمال خرسانة البرج ب المستوى 13",
      wbsId: "W-AR-B",
    },
  ];

  const result = resolveClaimActivityCorrespondence({
    claimId: "C-AR",
    eventId: "E-AR",
    narrative:
      "إشعار تأخير بسبب عدم إتاحة الوصول إلى أعمال خرسانة البرج أ المستوى 13 واستمرار أثر التأخير.",
    claimEvidenceRefs: refs,
    schedule: input,
  });

  assert.equal(result.activityPoolCount, 2);
  assert.ok(result.claimSignalCount > 0);
  assert.ok(result.retrievedCandidateCount > 0);
  assert.ok(result.preFilterCandidateCount > 0);
  assert.ok(result.boundedCandidateCount > 0);
  assert.equal(result.classification, "accepted_deterministic");
  assert.deepEqual(result.acceptedActivityIds, ["AR-100"]);
});
