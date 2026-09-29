import test from "node:test";
import assert from "node:assert/strict";

import { checkProjectionIntegrity } from "../packages/runtime-api/src/projection-integrity";
import { commercialIntegrityChecks } from "../packages/runtime-api/src/commercial-integrity";
import { buildNoticesClaimsProjection } from "../packages/notices-claims/src";
import { DEFAULT_SCHEDULE_ANALYSIS_CONFIG } from "../packages/schedule-analysis-core/src";
import type { DelayClaimsModel } from "../packages/delay-analysis-core/src";

const schedule:any = {
  projectId:"Q-CLAIMS",
  source:"xer",
  sourceRevisionId:"REV-1",
  dataDateIso:"2026-08-31",
  activities:[],
  relationships:[],
  wbs:[],
  calendars:[],
  diagnostics:[],
};


test("accepted non-quarantined Notice Compliance reconciles all six headline and timing checks",()=>{
  const ref=(sourceType:any,sourceId:string)=>({sourceType,sourceId,locator:"row:1"});
  const event=(eventId:string,category:any,startIso:string|null)=>({
    eventId,title:eventId,category,startIso,endIso:startIso,responsibility:"employer" as const,
    responsibilityState:"official" as const,describedImpactDays:1,describedImpactState:"candidate" as const,
    relatedActivityIds:[],relatedClauseIdentifiers:["8.4"],evidenceRefs:[ref("other",eventId)],diagnostics:[],
  });
  const notice=(noticeId:string,eventId:string,date:string|null)=>({
    noticeId,kind:"eot_notice" as const,eventId,claimId:null,actualIssuedAt:date,actualReceivedAt:date,plannedAt:null,
    subject:noticeId,clauseIdentifiers:["8.4"],evidenceRefs:[ref("notice",noticeId)],diagnostics:[],
  });
  const claim=(claimId:string,eventId:string)=>({
    claimId,title:claimId,state:"submitted" as const,eventIds:[eventId],submittedAt:"2026-08-20",claimedDays:1,claimedAmount:null,
    assessedDays:null,assessedDaysState:"missing" as const,assessedAmount:null,assessedAmountState:"missing" as const,
    clauseIdentifiers:["8.4"],evidenceRefs:[ref("claim",claimId)],diagnostics:[],
  });
  const source:DelayClaimsModel={
    projectId:"Q-CLAIMS",evidenceRevisionId:"canonical-evidence:accepted",dataDateIso:"2026-08-31",
    events:[
      event("E-TIMELY","late_information","2026-08-01"),
      event("E-LATE","late_information","2026-08-01"),
      event("E-NODATE","late_information",null),
      event("E-NORULE","weather","2026-08-01"),
    ],
    notices:[
      notice("N-TIMELY","E-TIMELY","2026-08-03"),
      notice("N-LATE","E-LATE","2026-08-10"),
      notice("N-NODATE","E-NODATE","2026-08-02"),
    ],
    claims:[
      claim("C-TIMELY","E-TIMELY"),claim("C-LATE","E-LATE"),claim("C-NODATE","E-NODATE"),claim("C-NORULE","E-NORULE"),
    ],
    noticeRequirements:[{
      requirementId:"NR-7",noticeKind:"eot_notice",eventCategories:["late_information"],noticePeriodDays:7,
      triggerBasis:"event_start",state:"official",clauseIdentifiers:["8.4"],evidenceRefs:[ref("contract","8.4")],
    }],
    diagnostics:[],
    integrity:{state:"accepted",sourceClaimCount:4,quarantinedClaimCount:0,linkedActivityEventCount:0,genericClaimEventPairCount:0,genericNoticePairCount:0,arithmeticClaimedDaysPrefixLength:0,sourceFilenames:["real-claims.csv"],reasons:[]},
  };
  const projection=buildNoticesClaimsProjection(source,{generatedAt:"2026-09-29T00:00:00.000Z",producerVersion:"qa-real-claims-v1"});
  assert.equal(projection.claimCount,4);
  assert.equal(projection.eventCount,4);
  assert.equal(projection.timelyNoticeCount,1);
  assert.equal(projection.lateNoticeCount,1);
  assert.equal(projection.noticeEventDateMissingCount,1);
  assert.equal(projection.noticeRequirementMissingCount,1);
  const result:any={key:"notices-claims",status:"ready",professionalState:"defensible",evidenceState:"established",dependencies:[],data:projection};
  const checked:any=checkProjectionIntegrity(result,schedule,DEFAULT_SCHEDULE_ANALYSIS_CONFIG,source);
  const six=[
    "claim_headline_matches_register","event_headline_matches_register","timely_notice_count",
    "late_notice_count","event_date_missing_count","requirement_missing_count",
  ];
  for(const metric of six){
    const check=checked.data.systemEvidenceContract.checks.find((row:any)=>row.metric===metric);
    assert.ok(check,metric);
    assert.equal(check.passed,true,metric+" must reconcile on accepted source data");
  }
  assert.equal(checked.data.systemEvidenceContract.state,"verified_for_checked_metrics");
  assert.deepEqual(checked.data.systemEvidenceContract.checks.filter((row:any)=>!row.passed),[]);
});

test("quarantined claim population is certified as withheld rather than false zero",()=>{
  const source:DelayClaimsModel={
    projectId:"Q-CLAIMS",
    evidenceRevisionId:"canonical-evidence:test",
    dataDateIso:"2026-08-31",
    events:[],
    notices:[],
    claims:[],
    noticeRequirements:[],
    diagnostics:["CLAIM_POPULATION_QUARANTINED_SYNTHETIC_SEQUENCE:180"],
    integrity:{
      state:"quarantined",
      sourceClaimCount:180,
      quarantinedClaimCount:180,
      linkedActivityEventCount:0,
      genericClaimEventPairCount:180,
      genericNoticePairCount:180,
      arithmeticClaimedDaysPrefixLength:180,
      sourceFilenames:["CL01_Claims_Register_180.csv"],
      reasons:[
        "GENERIC_SEQUENTIAL_CLAIM_EVENT_IDENTITIES",
        "GENERIC_SEQUENTIAL_NOTICE_REFERENCES",
        "NO_SCHEDULE_ACTIVITY_LINKS",
        "GENERATED_ARITHMETIC_CLAIM_DAY_PATTERN",
      ],
    },
  };
  const result:any={
    key:"notices-claims",
    status:"partial",
    professionalState:"review_required",
    evidenceState:"partial",
    dependencies:[],
    data:{
      events:[],
      claims:[],
      claimCount:null,
      eventCount:null,
      timelyNoticeCount:null,
      lateNoticeCount:null,
      noticeEventDateMissingCount:null,
      noticeRequirementMissingCount:null,
      claimPopulationIntegrity:source.integrity,
    },
  };
  const checked:any=checkProjectionIntegrity(result,schedule,{} as any,source);
  assert.equal(checked.data.systemEvidenceContract.state,"verified_for_checked_metrics");
  assert.deepEqual(checked.data.systemEvidenceContract.checks.filter((row:any)=>row.passed===false),[]);
  for(const metric of [
    "claim_headline_matches_register",
    "event_headline_matches_register",
    "timely_notice_count",
    "late_notice_count",
    "event_date_missing_count",
    "requirement_missing_count",
  ]){
    const check=checked.data.systemEvidenceContract.checks.find((row:any)=>row.metric===metric);
    assert.ok(check,metric);
    assert.equal(check.expected,null,metric+" expected must be withheld");
    assert.equal(check.actual,null,metric+" actual must be withheld");
    assert.equal(check.passed,true,metric);
  }
});


test("quarantined commercial claims integrity treats withheld notice dimensions as null, not zero",()=>{
  const position:any={
    sourceLedger:{},
    claimsNotices:{
      evidenceRevisionId:"canonical-evidence:quarantined-commercial",
      diagnostics:["CLAIM_POPULATION_QUARANTINED_SOURCE_RETAINED_COUNTS_WITHHELD"],
      dimensionalEvidenceGaps:{requirementMissing:null,eventDateMissing:null,noticeDateMissing:null},
      noticeTimelinessCounts:{
        timely:null,late:null,not_issued:null,requirement_missing:null,
        requirement_conflicted:null,event_date_missing:null,notice_date_missing:null,
      },
      noticeAssessments:[],
    },
  };
  const checks=commercialIntegrityChecks("commercial-claims-notices",position);
  assert.equal(checks.find(row=>row.metric==="notice_outcome_population")?.passed,true);
  assert.equal(checks.find(row=>row.metric==="notice_missing_rules_are_not_unselected_rules")?.passed,true);
  assert.equal(checks.find(row=>row.metric==="notice_date_gap_population")?.passed,true);
  assert.equal(checks.filter(row=>!row.passed).length,0);
});

test("established empty commercial notice population remains verified zero",()=>{
  const position:any={
    sourceLedger:{},
    claimsNotices:{
      evidenceRevisionId:"canonical-evidence:empty-commercial",
      diagnostics:[],
      dimensionalEvidenceGaps:{requirementMissing:0,eventDateMissing:0,noticeDateMissing:0},
      noticeTimelinessCounts:{
        timely:0,late:0,not_issued:0,requirement_missing:0,
        requirement_conflicted:0,event_date_missing:0,notice_date_missing:0,
      },
      noticeAssessments:[],
    },
  };
  const checks=commercialIntegrityChecks("commercial-claims-notices",position);
  assert.equal(checks.filter(row=>!row.passed).length,0);
});

test("duplicate source activity IDs stay a source-quality defect, not a false schedule-change engine failure",()=>{
  const duplicateSchedule:any={
    ...schedule,
    activities:[
      {projectId:"Q-CLAIMS",activityId:"DUP-1",nativeId:"1",name:"First",wbsId:null,calendarId:null,activityType:"task",status:"not_started",baselineStartIso:null,baselineFinishIso:null,currentStartIso:null,currentFinishIso:null,actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:8,remainingDurationHours:8,totalFloatHours:0,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]},
      {projectId:"Q-CLAIMS",activityId:"DUP-1",nativeId:"2",name:"Duplicate code",wbsId:null,calendarId:null,activityType:"task",status:"not_started",baselineStartIso:null,baselineFinishIso:null,currentStartIso:null,currentFinishIso:null,actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:8,remainingDurationHours:8,totalFloatHours:0,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:["SCHEDULE_GRAPH_DUPLICATE_ACTIVITY_IDS:DUP-1"]},
    ],
  };
  const result:any={
    key:"schedule-change-report",
    status:"partial",
    professionalState:"review_required",
    evidenceState:"partial",
    dependencies:[],
    data:{
      state:"ready",
      toActivityCount:2,
      matchedActivityCount:1,
      addedActivityCount:0,
      modifiedActivityCount:1,
      unchangedActivityCount:0,
      removedActivityCount:0,
      changedActivities:[{activityId:"DUP-1",changeKind:"modified"}],
      addedRelationshipCount:0,
      removedRelationshipCount:0,
      addedRelationships:[],
      removedRelationships:[],
    },
  };
  const checked:any=checkProjectionIntegrity(result,duplicateSchedule,{} as any,null);
  const partition=checked.data.systemEvidenceContract.checks.find((row:any)=>row.metric==="current_activity_partition");
  assert.ok(partition);
  assert.equal(partition.expected,1);
  assert.equal(partition.actual,1);
  assert.equal(partition.passed,true);
});
