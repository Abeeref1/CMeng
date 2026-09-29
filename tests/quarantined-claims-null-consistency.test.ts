import test from "node:test";
import assert from "node:assert/strict";

import { checkProjectionIntegrity } from "../packages/runtime-api/src/projection-integrity";
import { commercialIntegrityChecks } from "../packages/runtime-api/src/commercial-integrity";
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



test("real non-quarantined notice population certifies headline and timeliness counts",()=>{
  const source:any={
    projectId:"Q-CLAIMS",evidenceRevisionId:"canonical-evidence:real",dataDateIso:"2026-08-31",
    events:[
      {eventId:"E1",noticeTimeliness:"timely",eventStartIso:"2026-08-01",noticeIssuedAt:"2026-08-05",requiredNoticeDays:7},
      {eventId:"E2",noticeTimeliness:"late",eventStartIso:"2026-08-01",noticeIssuedAt:"2026-08-12",requiredNoticeDays:7},
      {eventId:"E3",noticeTimeliness:"event_date_missing",eventStartIso:null,noticeIssuedAt:"2026-08-05",requiredNoticeDays:7},
      {eventId:"E4",noticeTimeliness:"requirement_missing",eventStartIso:"2026-08-01",noticeIssuedAt:"2026-08-05",requiredNoticeDays:null},
    ],
    notices:[],noticeRequirements:[],
    claims:[
      {claimId:"C1",claimedDays:4},{claimId:"C2",claimedDays:9}
    ],
    diagnostics:[],
    integrity:{state:"verified",sourceClaimCount:2,quarantinedClaimCount:0,reasons:[]},
  };
  const result:any={
    key:"notices-claims",status:"ready",professionalState:"defensible",evidenceState:"established",dependencies:[],
    data:{
      events:source.events.map((row:any)=>({...row})),
      claims:source.claims.map((row:any)=>({...row})),
      claimCount:2,eventCount:4,timelyNoticeCount:1,lateNoticeCount:1,
      noticeEventDateMissingCount:1,noticeRequirementMissingCount:1,
    },
  };
  const checked:any=checkProjectionIntegrity(result,schedule,{} as any,source);
  assert.equal(checked.data.systemEvidenceContract.state,"verified_for_checked_metrics");
  for(const metric of ["claim_headline_matches_register","event_headline_matches_register","timely_notice_count","late_notice_count","event_date_missing_count","requirement_missing_count"]){
    const check=checked.data.systemEvidenceContract.checks.find((row:any)=>row.metric===metric);
    assert.ok(check,metric);assert.equal(check.passed,true,metric);
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
