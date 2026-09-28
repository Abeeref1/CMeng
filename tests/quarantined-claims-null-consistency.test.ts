import test from "node:test";
import assert from "node:assert/strict";

import { checkProjectionIntegrity } from "../packages/runtime-api/src/projection-integrity";
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
