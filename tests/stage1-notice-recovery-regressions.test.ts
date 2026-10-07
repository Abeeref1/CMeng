import test from "node:test";
import assert from "node:assert/strict";

import {
  assessEventNotice,
  type CanonicalDelayEvent,
  type CanonicalNoticeRecord,
  type DelayClaimsModel,
  type NoticeRequirement,
} from "../packages/delay-analysis-core/src";
import {buildNoticesClaimsProjection} from "../packages/notices-claims/src";
import {runtimeProjects} from "../packages/runtime-api/src/project-state";
import {changeDelivery,deliveryRecords,deliveryStore} from "../packages/runtime-api/src/delivery-records";
import {recoveryAccelerationIntelligence} from "../packages/runtime-api/src/recovery-acceleration";

const ref=(sourceType:any,sourceId:string)=>({sourceType,sourceId,locator:"row:1"});
const event=(overrides:Partial<CanonicalDelayEvent>={}):CanonicalDelayEvent=>({
  eventId:"E-1",
  title:"Late design information",
  category:"late_information",
  startIso:"2031-01-02",
  awarenessIso:"2031-01-05",
  endIso:null,
  responsibility:"employer",
  responsibilityState:"official",
  describedImpactDays:null,
  describedImpactState:"missing",
  relatedActivityIds:[],
  relatedClauseIdentifiers:["20.1"],
  evidenceRefs:[ref("other","E-1")],
  diagnostics:[],
  ...overrides,
});
const notice=(date:string|null,overrides:Partial<CanonicalNoticeRecord>={}):CanonicalNoticeRecord=>({
  noticeId:"N-1",
  kind:"claim_notice",
  eventId:"E-1",
  claimId:null,
  actualIssuedAt:date,
  actualReceivedAt:date,
  plannedAt:null,
  subject:"Notice",
  clauseIdentifiers:["20.1"],
  evidenceRefs:[ref("notice","N-1")],
  diagnostics:[],
  ...overrides,
});
const rule=(overrides:Partial<NoticeRequirement>={}):NoticeRequirement=>({
  requirementId:"R-1",
  noticeKind:"claim_notice",
  eventCategories:["late_information"],
  noticePeriodDays:7,
  effectiveFromIso:null,
  effectiveToIso:"2031-01-01",
  triggerBasis:"awareness",
  state:"official",
  clauseIdentifiers:["20.1"],
  evidenceRefs:[ref("contract","20.1")],
  ...overrides,
});

test("Stage 1 Notice Compliance uses the contractual trigger and effective version, not event start or whichever rule is shortest",()=>{
  const rules=[
    rule(),
    rule({requirementId:"R-AMD",noticePeriodDays:3,effectiveFromIso:"2031-01-01",effectiveToIso:null}),
  ];
  const timely=assessEventNotice(event(),[notice("2031-01-08")],rules);
  assert.equal(timely.requirementId,"R-AMD");
  assert.equal(timely.requiredNoticeDays,3);
  assert.equal(timely.elapsedDays,3);
  assert.equal(timely.timeliness,"timely");

  const late=assessEventNotice(event(),[notice("2031-01-09")],rules);
  assert.equal(late.elapsedDays,4);
  assert.equal(late.timeliness,"late");

  const missingAwareness=assessEventNotice(event({awarenessIso:null}),[notice("2031-01-08")],rules);
  assert.equal(missingAwareness.timeliness,"event_date_missing");
  assert.equal(missingAwareness.elapsedDays,null);
});

test("Stage 1 Notice Compliance excludes future notices and fails closed on competing applicable rules",()=>{
  const baseRule=rule({requirementId:"R-CURRENT",noticePeriodDays:3,effectiveFromIso:"2031-01-01",effectiveToIso:null});
  const model:DelayClaimsModel={
    projectId:"STAGE1-NOTICE-FUTURE",
    evidenceRevisionId:"stage1-notice",
    dataDateIso:"2031-01-10",
    events:[event()],
    notices:[notice("2031-01-12")],
    claims:[],
    noticeRequirements:[baseRule],
    diagnostics:[],
  };
  const projection=buildNoticesClaimsProjection(model,{generatedAt:"2031-01-10T00:00:00.000Z",producerVersion:"stage1-regression"});
  assert.equal(projection.timelyNoticeCount,0);
  assert.equal(projection.lateNoticeCount,0);
  assert.equal(projection.missingNoticeCount,1);
  assert.equal(projection.events[0]!.noticeTimeliness,"not_issued");

  const conflicted=assessEventNotice(
    event(),
    [notice("2031-01-07")],
    [baseRule,rule({requirementId:"R-CONFLICT",noticePeriodDays:5,effectiveFromIso:"2031-01-01",effectiveToIso:null})],
  );
  assert.equal(conflicted.timeliness,"requirement_conflicted");
  assert.equal(conflicted.requiredNoticeDays,null);
  assert.equal(conflicted.elapsedDays,null);
});

test("Stage 1 Recovery distinguishes absent supporting evidence from checked evidence with no eligible scenario",()=>{
  const empty=runtimeProjects.getOrCreate("STAGE1-RECOVERY-ABSENT");
  const absent=recoveryAccelerationIntelligence(empty);
  assert.equal(absent.scenarios.length,0);
  assert.equal(absent.eligibility.supportingBasisAvailable,false);
  assert.equal(absent.eligibilityAssessmentState,"supporting_basis_absent");
  assert.match(absent.managementPosition,/No recovery option currently meets the calculation criteria/);

  const state=runtimeProjects.getOrCreate("STAGE1-RECOVERY-CHECKED");
  changeDelivery(state,{
    expectedVersion:state.version,
    action:"create",
    kind:"package",
    fields:{
      "record reference":"PKG-ON-TIME",
      description:"On-time procurement package",
      "required on site date":"2031-02-10",
      "forecast delivery date":"2031-02-01",
    },
  } as any);
  runtimeProjects.touch(state);
  const created=deliveryRecords(state).records.find(row=>row.recordId===deliveryStore(state).manual.at(-1)!.recordId)!;
  changeDelivery(state,{
    expectedVersion:state.version,
    action:"review",
    recordId:created.recordId,
    sourceRevision:created.revision,
    state:"governed",
    fields:{},
    note:"Stage 1 governed recovery eligibility fixture.",
  } as any);
  runtimeProjects.touch(state);
  const checked=recoveryAccelerationIntelligence(state);
  assert.equal(checked.scenarios.length,0);
  assert.equal(checked.eligibility.supportingBasisAvailable,true);
  assert.ok(checked.eligibility.deliveryPackagePopulationCount>0);
  assert.equal(checked.eligibilityAssessmentState,"checked_no_eligible_basis");
  assert.match(checked.managementPosition,/no eligible scenario basis was found/i);
});
