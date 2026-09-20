import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type {
  CanonicalCalendar,
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
} from "../packages/schedule-analysis-core/src";
import type { ScheduleRevision } from "../packages/schedule-revision-core/src";
import { buildNearCriticalProjection } from "../packages/near-critical-analysis/src";
import { buildWindowsAnalysisProjection } from "../packages/windows-analysis/src";
import { projectScheduleControlBasis } from "../packages/runtime-api/src/schedule-control-basis";
import { sourceProductivityForecastEvidence } from "../packages/runtime-api/src/source-productivity-forecast";
import { canonicalTimeClaims } from "../packages/runtime-api/src/canonical-time-claims";
import { buildDelayClaimsProjection } from "../packages/delay-claims/src";
import { resolveProjectControlNumberMetric } from "../packages/runtime-api/src/project-control-source-metrics";
import { extractDocumentAssertions } from "../packages/module-challenge/src";

function calendar(
  calendarId: string,
  dayHours: number,
): CanonicalCalendar {
  return {
    calendarId,
    name: calendarId,
    semanticComplete: true,
    weeklyWorkMinutes: [
      0,
      dayHours * 60,
      dayHours * 60,
      dayHours * 60,
      dayHours * 60,
      dayHours * 60,
      0,
    ],
    weeklyWorkIntervals: [],
    exceptions: [],
    standardDayHours: dayHours,
    standardWeekHours: dayHours * 5,
    sourceRefs: [],
  };
}

function activity(
  activityId: string,
  calendarId: string,
  totalFloatHours: number,
  finish = "2030-01-01T00:00:00.000Z",
): CanonicalScheduleActivity {
  return {
    projectId: "SALES-BLOCKERS",
    activityId,
    nativeId: activityId,
    name: activityId,
    wbsId: "W1",
    calendarId,
    activityType: "task",
    status: "not_started",
    baselineStartIso: "2026-01-01T00:00:00.000Z",
    baselineFinishIso: finish,
    currentStartIso: "2026-01-01T00:00:00.000Z",
    currentFinishIso: finish,
    actualStartIso: null,
    actualFinishIso: null,
    forecastStartIso: "2026-01-01T00:00:00.000Z",
    forecastFinishIso: finish,
    originalDurationHours: 80,
    remainingDurationHours: 80,
    totalFloatHours,
    freeFloatHours: totalFloatHours,
    percentComplete: 0,
    sourceRefs: [],
    diagnostics: [],
  };
}

function model(
  revisionId = "U02",
  finish = "2030-01-01T00:00:00.000Z",
): CanonicalScheduleModel {
  return {
    projectId: "SALES-BLOCKERS",
    source: "xer",
    sourceRevisionId: revisionId,
    dataDateIso: "2026-08-31",
    activities: [
      activity("A10", "CAL10", 48, finish),
      activity("A8", "CAL8", 41, finish),
      activity("A0", "CAL8", 0, finish),
    ],
    relationships: [],
    wbs: [],
    calendars: [
      calendar("CAL10", 10),
      calendar("CAL8", 8),
    ],
    diagnostics: [],
  };
}

function storedDocument(
  dir: string,
  documentId: string,
  sourceFilename: string,
  category: string,
  documentType: string,
  text: string,
): any {
  const storedPath = join(dir, sourceFilename);
  writeFileSync(storedPath, text);
  const hash = createHash("sha256").update(Buffer.from(text)).digest("hex");
  return {
    documentId,
    category,
    documentType,
    sourceFilename,
    sourceRelativePath: null,
    mediaType: "text/csv",
    sourceHashSha256: hash,
    sizeBytes: Buffer.byteLength(text),
    uploadedAt: "2026-09-20T00:00:00.000Z",
    authority: "candidate_only",
    parserState: "parsed",
    storedPath,
    linkedArtifactId: null,
    scheduleRole: null,
    mapping: null,
    identification: {
      verifiedMediaType: "text/csv",
      detectedCategory: category,
      detectedDocumentType: documentType,
      confidence: 1,
      method: "tabular_content",
      ocrUsed: false,
      ocrConfidence: null,
      pageCount: null,
      extractedCharacterCount: text.length,
      detectedTitle: null,
      filenameHintCategory: category,
      filenameHintDocumentType: documentType,
      declaredCategory: null,
      declaredDocumentType: null,
      classificationConflict: false,
      needsReview: false,
      signals: [],
      diagnostics: [],
    },
    lineage: {
      effect: "original",
      predecessorDocumentIds: [],
      replacesEntireBasis: false,
      appliesAsDelta: false,
      inferred: true,
      confidence: 1,
      needsReview: false,
      diagnostics: [],
    },
    assertions: [],
    uploadIntent: "add_update",
    familyKey: category + ":" + documentType,
    logicalDocumentKey: category + ":" + documentType,
    basisState: "active",
    supersededByDocumentId: null,
    supersedesDocumentIds: [],
    diagnostics: [],
  };
}

function stateWithDocuments(documents: any[]): any {
  return {
    projectId: "SALES-BLOCKERS",
    version: 1,
    schedules: [{
      revision: {
        revisionId: "U02",
        label: "Current U02",
        sequence: 2,
        effectiveAt: "2026-08-31",
        model: model(),
      },
      format: "xer",
      sourceFilename: "S03_Current_U02.xer",
      sourceHashSha256: "schedule",
      uploadedAt: "2026-08-31T00:00:00.000Z",
      role: "update",
    }],
    evidenceDocuments: documents,
    activeEvidenceBasis: {},
    contractDocuments: [],
    controls: {
      delayClaims: null,
      contractTimeBasis: null,
      readinessEvidence: {},
      progressEvidence: {},
      contractValue: null,
      variations: [],
      invoices: [],
      retentions: [],
      bonds: [],
      claimCommercials: [],
      hseIncidents: [],
      ncrs: [],
      rfis: [],
      permits: [],
      risks: [],
      boardPublication: null,
    },
    delayEventHistory: [],
  };
}

test("P1-1 project control basis applies 0..+5 working days per activity calendar instead of generic 40h", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "cmeng-p1-1-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const control = [
    "Metric,Value,As Of",
    "Critical Definition,TF <= 0 h,2026-08-31",
    "Near Critical Definition,0..+5 working days,2026-08-31",
    "Data Date,2026-08-31,2026-08-31",
  ].join("\n");
  const state = stateWithDocuments([
    storedDocument(
      dir,
      "SCH01",
      "SCH01_Schedule_Control_Basis.csv",
      "schedule_control",
      "schedule_control_basis",
      control,
    ),
  ]);

  const basis = projectScheduleControlBasis(state);
  assert.equal(basis.state, "official");
  assert.equal(basis.nearCriticalWorkingDays, 5);
  assert.equal(basis.programmeDataDateIso, "2026-08-31");

  const projection = buildNearCriticalProjection(model(), {
    generatedAt: "2026-09-20T00:00:00.000Z",
    producerVersion: "sales-blocker-test",
    config: basis.analysisConfig,
  });

  assert.equal(projection.thresholdBasis, "activity_calendar_working_days");
  assert.equal(projection.nearCriticalThresholdWorkingDays, 5);
  assert.deepEqual(
    projection.rows.map((row) => row.activityId),
    ["A10"],
  );
  assert.equal(
    projection.rows.find((row) => row.activityId === "A10")
      ?.nearCriticalThresholdHours,
    50,
  );
  assert.deepEqual(
    projection.watchlistRows.map((row) => row.activityId),
    ["A0", "A10"],
  );
  assert.equal(projection.nearCriticalCount, 1);
  assert.equal(projection.floatRiskWatchlistCount, 2);
  assert.equal(projection.zeroFloatCount, 1);
});

test("P1-1 includes legacy SCH02 control evidence by verified source identity", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "cmeng-p1-1-legacy-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const sch02 = storedDocument(
    dir,
    "SCH02",
    "SCH02_Schedule_Metrics.csv",
    "schedule",
    "supporting_document",
    "Metric,Value,Definition,As Of\nNear Critical Watchlist,629,0 < TF <= +5 working days,2026-08-31",
  );
  const state = stateWithDocuments([sch02]);
  const basis = projectScheduleControlBasis(state);
  assert.equal(basis.state, "official");
  assert.equal(basis.nearCriticalWorkingDays, 5);
  assert.ok(
    basis.diagnostics.includes(
      "LEGACY_PROJECT_CONTROL_EVIDENCE_INCLUDED_BY_VERIFIED_SOURCE_IDENTITY",
    ),
  );
});

test("P1-1 source watchlist count never overrides an explicit project threshold and reconciles separately", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "cmeng-p1-1-count-over-hours-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const source = storedDocument(
    dir,
    "SCH02",
    "SCH02_Schedule_Metrics.csv",
    "schedule",
    "supporting_document",
    [
      "Metric,Value,Definition,As Of",
      "Near Critical Threshold Hours,40,,2026-08-31",
      "Near Critical Watchlist,1,,2026-08-31",
    ].join("\n"),
  );
  const state = stateWithDocuments([source]);
  const basis = projectScheduleControlBasis(state);
  assert.equal(basis.state, "official");
  assert.equal(basis.nearCriticalExplicitHours, 40);
  assert.equal(basis.nearCriticalSourceCount, 1);
  assert.equal(basis.nearCriticalWorkingDays, null);
  assert.equal(basis.nearCriticalThresholdMethod, "explicit_hours");
  assert.equal(basis.sourceCountReconcilesTo, "float_risk_watchlist");
});

test("P1-2 and P1-3 keep programme Data Date and four forecast positions source-distinct", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "cmeng-p1-23-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const control = [
    "Metric,Value,As Of",
    "Near Critical Definition,0..+5 working days,2026-08-31",
    "Data Date,2026-08-31,2026-08-31",
    "Source Productivity Forecast,2030-08-15,2026-08-31",
    "Source Productivity Forecast,2031-01-01,2026-09-20",
  ].join("\n");
  const state = stateWithDocuments([
    storedDocument(
      dir,
      "SCH01",
      "SCH01_Schedule_Control_Basis.csv",
      "schedule_control",
      "schedule_control_basis",
      control,
    ),
  ]);

  const basis = projectScheduleControlBasis(state);
  const productivity = sourceProductivityForecastEvidence(state);
  assert.equal(basis.programmeDataDateIso, "2026-08-31");
  assert.equal(productivity.completionIso, "2030-08-15");
  assert.equal(productivity.state, "official");
  assert.ok(
    productivity.diagnostics.some((item) =>
      item.startsWith("FUTURE_SOURCE_PRODUCTIVITY_FORECAST_NOT_APPLIED"),
    ),
  );
});

test("P1-3 reads productivity basis and completion from separate governed columns", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "cmeng-p1-3-layout-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const source = storedDocument(
    dir,
    "PDB01",
    "PDB01_Project_Data_Book.csv",
    "schedule",
    "supporting_document",
    [
      "Metric,Forecast Basis,Forecast Completion,As Of",
      "Completion Outlook,Measured Productivity,2030-08-15,2026-08-31",
    ].join("\n"),
  );
  const state = stateWithDocuments([source]);
  const productivity = sourceProductivityForecastEvidence(state);
  assert.equal(productivity.state, "official");
  assert.equal(productivity.completionIso, "2030-08-15");
});

test("generic metric/value/unit/source register resolves governed near-critical, productivity and gross movement semantics", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "cmeng-generic-control-register-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const register = storedDocument(
    dir,
    "SCH02",
    "SCH02_Schedule_Metrics.csv",
    "schedule_control",
    "schedule_metric_register",
    [
      "Metric,Value,Unit,Source",
      "Near Critical Activity Population,1,activities,Schedule control",
      "Near Critical Threshold,40,hours,Legacy hour equivalent",
      "Completion Outlook,2030-08-15,date,Measured Productivity Forecast",
      "Gross Positive Window Movement,203.17,days,Controlled window register",
    ].join("\n"),
  );
  const state = stateWithDocuments([register]);

  const basis = projectScheduleControlBasis(state);
  assert.equal(basis.nearCriticalSourceCount, 1);
  assert.equal(basis.nearCriticalWorkingDays, null);
  assert.equal(basis.nearCriticalThresholdMethod, "explicit_hours");
  assert.equal(basis.sourceCountReconcilesTo, "float_risk_watchlist");

  const productivity = sourceProductivityForecastEvidence(state);
  assert.equal(productivity.completionIso, "2030-08-15");
  assert.equal(productivity.state, "official");

  const gross = resolveProjectControlNumberMetric(
    state,
    "gross_positive_programme_movement",
  );
  assert.equal(gross.value, 203.17);
  assert.equal(gross.state, "official");
});

test("document assertion extractor recognizes productivity-based completion from PDF-style text", () => {
  const assertions = extractDocumentAssertions(
    "Project Data Book. Source Productivity Forecast Completion: 15 Aug 2030. Data Date: 31 Aug 2026.",
    "evidence:PDB:full-document",
  );
  assert.equal(
    assertions.find((item) => item.metric === "source_productivity_forecast_completion")?.value,
    "2030-08-15",
  );
});

test("delay lineage derives exact narrative activity and notice-date window without claiming causation", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "cmeng-derived-delay-lineage-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const claim = [
    "Claim ID,Event,Notice Date,Days Claimed,Status",
    "CL-001,Delay affecting A10 access,2030-01-16,12,Submitted",
  ].join("\n");
  const state = stateWithDocuments([
    storedDocument(
      dir,
      "CL01",
      "CL01_Claims.csv",
      "risk_claims_procurement",
      "delay_eot_claims_register",
      claim,
    ),
  ]);
  state.schedules = [
    {
      ...state.schedules[0],
      revision: revision("R1", 1, 0),
      role: "baseline",
    },
    {
      ...state.schedules[0],
      revision: revision("R2", 2, 20),
      role: "update",
    },
  ];

  const canonical = canonicalTimeClaims(state, true);
  const event = canonical.delayClaims?.events[0]!;
  assert.deepEqual(event.relatedActivityIds, ["A10"]);
  assert.deepEqual(event.relatedWindowReferences, ["R1->R2"]);
  assert.ok(
    event.diagnostics.includes(
      "ACTIVITY_LINK_DERIVED_FROM_EXACT_SCHEDULE_REFERENCE_OR_UNIQUE_ACTIVITY_NAME",
    ),
  );
  assert.ok(
    event.diagnostics.includes(
      "WINDOW_ASSOCIATION_FROM_VERIFIED_NOTICE_DATE_NOT_CAUSATION",
    ),
  );
});

function addDays(days: number): string {
  const start = Date.parse("2030-01-01T00:00:00.000Z");
  return new Date(start + days * 86_400_000).toISOString();
}

function revision(
  revisionId: string,
  sequence: number,
  completionOffsetDays: number,
): ScheduleRevision {
  const m = model(revisionId, addDays(completionOffsetDays));
  m.dataDateIso = addDays(sequence * 10).slice(0, 10);
  return {
    revisionId,
    label: revisionId,
    sequence,
    effectiveAt: m.dataDateIso,
    model: m,
  };
}

test("P1-4 gross positive window movement is never conflated with net Project Completion movement", () => {
  const revisions = [
    revision("R1", 1, 0),
    revision("R2", 2, 100),
    revision("R3", 3, 78),
    revision("R4", 4, 181),
  ];
  const forecastByRevision = new Map(
    revisions.map((item) => [
      item.revisionId,
      item.model.activities[0]!.forecastFinishIso!,
    ]),
  );
  const windows = buildWindowsAnalysisProjection(
    revisions,
    {
      projectId: "SALES-BLOCKERS",
      evidenceRevisionId: "D1",
      events: [],
      notices: [],
      claims: [],
      noticeRequirements: [],
      diagnostics: [],
    },
    {
      generatedAt: "2026-09-20T00:00:00.000Z",
      producerVersion: "sales-blocker-test",
      forecastResolver: (item) => ({
        schemaVersion: "1.0",
        projectionKey: "independent_forecast",
        generatedAt: "2026-09-20T00:00:00.000Z",
        producerVersion: "source-only-test",
        projectId: "SALES-BLOCKERS",
        sourceRevisionId: item.revisionId,
        dataDateIso: item.model.dataDateIso,
        origin: "unresolved",
        durationBasis: "remaining",
        calculationMode: "elapsed_time_fallback",
        sourceForecastCompletionIso:
          forecastByRevision.get(item.revisionId) ?? null,
        independentForecastCompletionIso: null,
        forecastVarianceDays: null,
        requiredFinishIso: null,
        requiredFinishVarianceDays: null,
        calculatedActivityCount: 0,
        unresolvedActivityCount: item.model.activities.length,
        activityCoveragePercent: 0,
        criticalActivityIds: [],
        assumptions: [],
        diagnostics: [],
        probabilistic: {
          status: "unavailable",
          method: "limited_triangular_duration_factor",
          authority: "non_official",
          iterations: 0,
          seed: 0,
          minFactor: 0.9,
          modeFactor: 1,
          maxFactor: 1.25,
          p50CompletionIso: null,
          p80CompletionIso: null,
          p90CompletionIso: null,
          assumptions: [],
        },
        activities: [],
        complete: false,
      }),
    },
  );

  assert.equal(windows.positiveProgrammeMovementDays, 203);
  assert.equal(windows.negativeProgrammeMovementDays, -22);
  assert.equal(windows.projectCompletionMovementDays, 181);
  assert.equal(windows.projectCompletionMovementBasis, "source_forecast");
  assert.notEqual(
    windows.positiveProgrammeMovementDays,
    windows.projectCompletionMovementDays,
  );
});

test("P0-3 merges EOT activity and explicit window references into the governed CL01 event", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "cmeng-p0-3-supplemental-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const claim = [
    "Claim ID,Event ID,Event,Notice Date,Linked Letter,Days Claimed,Status",
    "CL-001,EV-001,Late access,2026-06-02,L-NOTICE-001,12,Submitted",
  ].join("\n");
  const assessment = [
    "Claim ID,Event ID,Schedule Activity ID,Window ID,Assessed Days",
    "CL-001,EV-001,A10,Window 1,7",
  ].join("\n");
  const determination = [
    "Determination ID,Claim ID,Awarded EOT Days,Determination Date,Status,Authority,Source Letter,Governance State",
    "DET-001,CL-001,7,2026-07-01,Determined,Engineer,L-DET-001,Immutable",
  ].join("\n");
  const letters = [
    "Letter ID,Letter Date,Subject,Claim ID,Event ID",
    "L-NOTICE-001,2026-06-02,Notice of delay,CL-001,EV-001",
    "L-DET-001,2026-07-01,Engineer determination,CL-001,EV-001",
  ].join("\n");
  const state = stateWithDocuments([
    storedDocument(dir,"CL01","CL01_Claims.csv","risk_claims_procurement","delay_eot_claims_register",claim),
    storedDocument(dir,"EOT01","EOT01_Assessment.csv","risk_claims_procurement","delay_eot_claims_register",assessment),
    storedDocument(dir,"EOT03","EOT03_Determinations.csv","risk_claims_procurement","delay_eot_claims_register",determination),
    storedDocument(dir,"L01","L01_Letters.csv","correspondence","letters_notices",letters),
  ]);
  const canonical = canonicalTimeClaims(state, true);
  const event = canonical.delayClaims?.events[0]!;
  assert.deepEqual(event.relatedActivityIds, ["A10"]);
  assert.deepEqual(event.relatedWindowReferences, ["Window 1"]);

  const revisions = [
    revision("R1", 1, 0),
    revision("R2", 2, 20),
  ];
  const windows = buildWindowsAnalysisProjection(
    revisions,
    canonical.delayClaims!,
    {
      generatedAt: "2026-09-20T00:00:00.000Z",
      producerVersion: "sales-blocker-test",
    },
  );
  assert.equal(windows.windows[0]!.delayEvents[0]?.eventId, "EV-001");
  const delay = buildDelayClaimsProjection(
    windows,
    canonical.delayClaims!,
    {
      generatedAt: "2026-09-20T00:00:00.000Z",
      producerVersion: "sales-blocker-test",
    },
  );
  assert.equal(delay.activityLinkedEventCount, 1);
  assert.equal(delay.windowLinkedEventCount, 1);
  assert.equal(delay.noticeLinkedEventCount, 1);
  assert.equal(delay.determinationLinkedEventCount, 1);
  assert.equal(delay.fullDeterminationChainEventCount, 1);
});

test("P0-3 claim-event-activity-window-notice-determination chain uses verified L01 correspondence rows", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "cmeng-p0-3-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const claim = [
    "Claim ID,Event ID,Event,Event Start,Event End,Activity ID,Notice Date,Linked Letter,Days Claimed,Status",
    "CL-001,EV-001,Late access,2026-06-01,2026-06-10,A10,2026-06-02,L-NOTICE-001,12,Submitted",
  ].join("\n");
  const determination = [
    "Determination ID,Claim ID,Awarded EOT Days,Determination Date,Status,Authority,Source Letter,Governance State",
    "DET-001,CL-001,7,2026-07-01,Determined,Engineer,L-DET-001,Immutable",
  ].join("\n");
  const letters = [
    "Letter ID,Letter Date,Subject,Claim ID,Event ID",
    "L-NOTICE-001,2026-06-02,Notice of delay,CL-001,EV-001",
    "L-DET-001,2026-07-01,Engineer determination,CL-001,EV-001",
  ].join("\n");
  const state = stateWithDocuments([
    storedDocument(
      dir,
      "CL01",
      "CL01_Claims.csv",
      "risk_claims_procurement",
      "delay_eot_claims_register",
      claim,
    ),
    storedDocument(
      dir,
      "EOT03",
      "EOT03_Determinations.csv",
      "risk_claims_procurement",
      "delay_eot_claims_register",
      determination,
    ),
    storedDocument(
      dir,
      "L01",
      "L01_Letters.csv",
      "correspondence",
      "letters_notices",
      letters,
    ),
  ]);

  const canonical = canonicalTimeClaims(state, true);
  assert.equal(canonical.delayClaims?.events.length, 1);
  const event = canonical.delayClaims?.events[0]!;
  assert.deepEqual(event.relatedActivityIds, ["A10"]);
  assert.ok(
    event.diagnostics.includes(
      "LINKED_CORRESPONDENCE_VERIFIED:L-NOTICE-001",
    ),
  );
  assert.ok(
    event.evidenceRefs.some(
      (ref) =>
        ref.sourceType === "correspondence" &&
        ref.sourceId === "L01",
    ),
  );
  assert.equal(canonical.determinations.length, 1);
  assert.equal(canonical.determinations[0]!.state, "source_immutable");
  assert.ok(
    canonical.delayClaims?.notices.some(
      (notice) =>
        notice.kind === "determination" &&
        notice.claimId === "CL-001" &&
        notice.eventId === "EV-001",
    ),
  );
});
