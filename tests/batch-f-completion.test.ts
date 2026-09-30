import test from "node:test";
import assert from "node:assert/strict";
import { buildDelayEotEvidenceChain } from "../packages/runtime-api/src/delay-eot-evidence-chain";
import { moduleFeatureAvailability } from "../packages/runtime-api/src/feature-availability";
import { buildNoticesClaimsProjection } from "../packages/notices-claims/src";
import { cmengUatHtml } from "../packages/runtime-api/src/ui";
import type { DelayClaimsModel } from "../packages/delay-analysis-core/src";

const schedule:any={projectId:"F-TEST",source:"xer",sourceRevisionId:"R2",dataDateIso:"2026-08-31",
 activities:[
  {projectId:"F-TEST",activityId:"A1",nativeId:"1",name:"Late work",wbsId:"W1",calendarId:null,activityType:"task",status:"not_started",baselineStartIso:"2026-08-01",baselineFinishIso:"2026-08-10",currentStartIso:"2026-08-01",currentFinishIso:"2026-08-20",actualStartIso:null,actualFinishIso:null,forecastStartIso:"2026-08-01",forecastFinishIso:"2026-08-20",originalDurationHours:80,remainingDurationHours:80,totalFloatHours:-8,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]},
  {projectId:"F-TEST",activityId:"M1",nativeId:"2",name:"Handover",wbsId:"W1",calendarId:null,activityType:"finish_milestone",status:"not_started",baselineStartIso:"2026-08-25",baselineFinishIso:"2026-08-25",currentStartIso:"2026-08-30",currentFinishIso:"2026-08-30",actualStartIso:null,actualFinishIso:null,forecastStartIso:"2026-08-30",forecastFinishIso:"2026-08-30",originalDurationHours:0,remainingDurationHours:0,totalFloatHours:0,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]}
 ],relationships:[],wbs:[],calendars:[],diagnostics:[]};
const windows:any={schemaVersion:"1.0",projectionKey:"windows_analysis",generatedAt:"2026-09-30",producerVersion:"F",projectId:"F-TEST",revisionCount:2,windowCount:1,completeWindowCount:1,partialWindowCount:0,unresolvedWindowCount:0,positiveIndependentMovementDays:10,negativeIndependentMovementDays:0,grossAnalyticalMovementDays:10,analyticalRecoveryMovementDays:0,analyticalMovementAvailableWindowCount:1,analyticalVsNetDeltaDays:0,overlapCandidateDays:0,positiveProgrammeMovementDays:10,negativeProgrammeMovementDays:0,projectCompletionMovementDays:10,projectCompletionMovementBasis:"source_forecast",firstProjectCompletionIso:"2026-08-20",latestProjectCompletionIso:"2026-08-30",programmeMovementAvailableWindowCount:1,sourceReportedGrossPositiveMovementDays:null,sourceReportedGrossNegativeMovementDays:null,sourceMovementReconciliation:{state:"source_not_reported",positiveGapDays:null,negativeGapDays:null,sourceRefs:[]},windows:[],diagnostics:[]};

test("Task 36 canonical delay/EOT chain preserves the required eight-link order",()=>{
 const delay:any={projectId:"F-TEST",events:[{eventId:"E1",title:"Late access",responsibility:"employer",responsibilityState:"official",noticeTimeliness:"timely",linkedClaimIds:["C1"],relatedActivityIds:["A1"],activityCorrespondence:null,overlappingWindowIds:["W1"],noticeIds:["N1"],determinationIds:["D1"],evidenceChainState:"full_determination_chain",evidenceChainMissingLinks:[],observedNetIndependentMovementDays:10,observedPositiveIndependentMovementDays:10,observedNetProgrammeMovementDays:10,observedPositiveProgrammeMovementDays:10,programmeMovementBasis:"source_forecast",concurrencyCandidate:false,candidateClass:"employer_or_neutral_time_candidate",scheduleAttribution:"not_causally_attributed",describedImpactDays:10,describedImpactState:"candidate",diagnostics:[]}]};
 const notices:any={events:[{eventId:"E1",noticeTimeliness:"timely"}]};
 const chain=buildDelayEotEvidenceChain({schedule,windows,delay,notices,populationState:"established",sourceClaimCount:1,quarantinedClaimCount:0});
 assert.deepEqual(chain.linkOrder,["event","notice","activity","window","impact","responsibility","eot","determination"]);
 assert.deepEqual(chain.rows[0]!.links.map(link=>link.key),chain.linkOrder);
 assert.equal(chain.rows[0]!.links.find(link=>link.key==="eot")!.state,"candidate");
 assert.equal(chain.rows[0]!.links.find(link=>link.key==="determination")!.state,"established");
});
test("Task 37 keeps contextual programme intelligence when no formal delay-event population exists",()=>{
 const chain=buildDelayEotEvidenceChain({schedule,windows,delay:{projectId:"F-TEST",events:[]} as any,notices:{events:[]} as any,populationState:"missing",sourceClaimCount:null,quarantinedClaimCount:null});
 assert.equal(chain.populationState,"missing");assert.equal(chain.rows.length,0);assert.equal(chain.programmeContext.projectCompletionMovementDays,10);
 assert.equal(chain.programmeContext.delayedActivityCount,2);assert.equal(chain.programmeContext.negativeFloatActivityCount,1);assert.equal(chain.programmeContext.pressuredMilestoneCount,1);
});
test("Task 38 preserves six Notice Compliance dimensions as withheld when the population is not established",()=>{
 const model:DelayClaimsModel={projectId:"F-TEST",evidenceRevisionId:"R",dataDateIso:"2026-08-31",events:[],notices:[],claims:[],noticeRequirements:[],diagnostics:[]};
 const p=buildNoticesClaimsProjection(model,{generatedAt:"2026-09-30",producerVersion:"F",populationEstablished:false});
 assert.equal(p.claimCount,null);assert.equal(p.eventCount,null);assert.equal(p.timelyNoticeCount,null);assert.equal(p.lateNoticeCount,null);assert.equal(p.noticeEventDateMissingCount,null);assert.equal(p.noticeRequirementMissingCount,null);
});
test("Task 39 one comparable programme state is not rendered as zero windows",()=>{
 const a=moduleFeatureAvailability("windows-analysis",{windows:[],revisionLabels:{R1:"Current"}});
 assert.notEqual(a.state,"active");assert.match(a.reason,/another comparable programme revision is required/i);assert.equal(a.establishedResultCount,null);
});
test("Task 40 management UI exposes known facts first and the six entitlement requirements",()=>{
 const html=cmengUatHtml();
 for(const label of ["Contractual completion","Current submitted finish","Approved EOT","Amended contractual completion","Observed programme movement","Event evidence","Activity linkage","Causation","Notice compliance","Concurrency","Determination"])assert.match(html,new RegExp(label,"i"),label);
 assert.match(html,/Event → Notice → Activity → Window → Impact → Responsibility → EOT → Determination/);
 assert.match(html,/Schedule pressure is contextual programme intelligence, not a contractual delay event/i);
 assert.match(html,/Window analysis not yet available — another comparable programme revision is required/i);
 assert.match(html,/Review-state windows do not display a false zero entitlement/i);
});
