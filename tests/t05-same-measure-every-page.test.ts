import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject,projectActionRegisterForState} from '../packages/runtime-api/src/project-projections';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import {buildDeliveryChallengeProjection} from '../packages/delivery-challenge/src';

// T05 / N2, N4: one measure, one value on every page. Scaled-down copy of the
// ACCOUNTABILITY-SCALE fixture in scripts/release-latency.cjs (chained
// relationships, several calendars and controlled revisions).
let serial=0;
const fixture=(delayClaims?:any)=>{
 const projectId='T05-SAME-MEASURE-'+(++serial);
 const state:any=runtimeProjects.getOrCreate(projectId);
 const N=300;
 const activities=Array.from({length:N},(_,i)=>({projectId,activityId:'T05-'+i,nativeId:String(i),
  name:'Installation Zone '+Math.floor(i/100),wbsId:'AW'+Math.floor(i/100),calendarId:'C'+i%2,
  activityType:'task',status:'not_started',baselineStartIso:'2031-01-01',baselineFinishIso:'2031-02-01',
  currentStartIso:'2031-01-01',currentFinishIso:'2031-03-01',actualStartIso:null,actualFinishIso:null,
  forecastStartIso:null,forecastFinishIso:null,originalDurationHours:24,remainingDurationHours:24,
  totalFloatHours:i%17===0?-8:i%13,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]}));
 const relationships:any[]=[];
 for(let i=1;i<N;i++)if(i%100!==0)relationships.push({relationshipId:'R'+i,predecessorActivityId:activities[i-1]!.activityId,
  successorActivityId:activities[i]!.activityId,type:'FS',lagHours:0,sourceRefs:[],diagnostics:[]});
 const wbs=Array.from({length:3},(_,i)=>({wbsId:'AW'+i,name:'Area '+i,parentWbsId:null,sourceRefs:[]}));
 const calendars=[0,1].map(i=>({...ELAPSED_24H_CALENDAR,calendarId:'C'+i}));
 for(let revision=0;revision<3;revision++){
  const revisionId='T05-REV-'+revision;
  const model:any={projectId,source:'xer',sourceRevisionId:revisionId,dataDateIso:'2031-04-0'+(revision+1),
   activities:activities.map(row=>({...row,currentFinishIso:'2031-03-0'+(revision+1)})),relationships,wbs,calendars,diagnostics:[]};
  state.schedules.push({role:revision?'update':'baseline',format:'xer',sourceFilename:revisionId+'.xer',sourceHashSha256:revisionId,
   uploadedAt:model.dataDateIso,revision:{revisionId,label:revisionId,sequence:revision+1,effectiveAt:model.dataDateIso,model}});
 }
 if(delayClaims)state.controls.delayClaims={projectId,evidenceRevisionId:'T05-REV-2',...delayClaims};
 state.testProject=true;
 runtimeProjects.touch(state);
 return projectId;
};

const data=(projectId:string,key:string):any=>moduleForProject(projectId,key).data;
const claimsEot=(dashboard:any)=>dashboard.managementContext?.crossModule?.claimsEot;

test('T05 no contractor claim population: claim and event counts are unknown on every page, never 0',()=>{
 const projectId=fixture();
 const delay=data(projectId,'delay-claims'),notices=data(projectId,'notices-claims'),dashboard=data(projectId,'master-dashboard');
 assert.equal(delay.contractorClaimEvidenceSubmitted,false);
 assert.equal(notices.claimCount,null,'notices page withholds the unknown claim count');
 assert.equal(delay.claimCount,notices.claimCount,'delay-claims shows the same claim count as notices-claims');
 assert.equal(delay.eventCount,notices.eventCount,'delay-claims shows the same event count as notices-claims');
 assert.equal(delay.linkedClaimCount,null,'claim linkage is unknown, not 0');
 assert.equal(delay.unlinkedClaimCount,null,'claim gaps are unknown, not 0');
 for(const key of ['claimLinkedEventCount','activityLinkedEventCount','windowLinkedEventCount','noticeLinkedEventCount','determinationLinkedEventCount'])
  assert.equal(delay[key],null,key+' is unknown without an event population');
 assert.equal(typeof delay.windowCount,'number','CMeng schedule windows are still calculated');
 const ctx=claimsEot(dashboard);
 assert.ok(ctx,'dashboard carries the cross-module claims context');
 assert.equal(ctx.claimCount,notices.claimCount,'Dashboard claim count equals the claims register page');
 assert.equal(ctx.eventCount,notices.eventCount,'Dashboard event count equals the claims register page');
});

test('T05 established empty claim register: 0 is a real zero and equal on every page',()=>{
 const projectId=fixture({events:[],notices:[],claims:[],noticeRequirements:[],diagnostics:[]});
 const delay=data(projectId,'delay-claims'),notices=data(projectId,'notices-claims'),dashboard=data(projectId,'master-dashboard');
 assert.equal(delay.contractorClaimEvidenceSubmitted,true);
 assert.equal(notices.claimCount,0);
 assert.equal(delay.claimCount,0);
 assert.equal(delay.eventCount,notices.eventCount);
 assert.equal(delay.linkedClaimCount,0);
 assert.equal(delay.unlinkedClaimCount,0);
 assert.equal(claimsEot(dashboard).claimCount,0);
});

test('T05 schedule float measures are identical on Dashboard, PMO analysis and Near-critical pages',()=>{
 const projectId=fixture();
 const dashboard=data(projectId,'master-dashboard'),near=data(projectId,'near-critical'),pmo=data(projectId,'pmo-analysis');
 const programme=dashboard.managementContext?.crossModule?.programme;
 assert.ok(programme,'dashboard carries the programme facts');
 assert.equal(typeof near.negativeFloatCount,'number');
 assert.equal(programme.negativeFloatCount,near.negativeFloatCount,'negative float: Dashboard = Near-critical');
 assert.equal(dashboard.visualControl.changes.latestRevision.negativeFloatCount,near.negativeFloatCount,'negative float: Dashboard chart = Near-critical');
 assert.equal(pmo.schedule.negativeFloatCount,near.negativeFloatCount,'negative float: PMO = Near-critical');
 assert.equal(typeof programme.criticalCount,'number');
 assert.equal(programme.criticalCount,pmo.schedule.criticalCount,'critical: Dashboard = PMO');
 assert.equal(dashboard.visualControl.schedule.criticalCount,pmo.schedule.criticalCount,'critical: Dashboard chart = PMO');
});

test('T05 concurrent work fronts: overdue open work is counted from its remaining duration, never 0 or negative',()=>{
 // Fixture: 300 not-started tasks, stored finish 2031-03-0x before the Data Date 2031-04-03,
 // remaining 24 h each on 24-hour calendars. All are open work in the next 24 h from the Data Date.
 const projectId=fixture();
 const challenge=data(projectId,'challenge-contract'),resources=data(projectId,'resource-utilization');
 for(const basis of ['scheduleChallenge','manpowerChallenge']){
  const row=challenge.deliveryChallenge?.[basis];
  assert.ok(row,basis+' present');
  assert.equal(row.averageConcurrentWorkFronts,300,basis+': 300 open activities in one 24 h window');
  assert.equal(row.peakConcurrentWorkFronts,300,basis+': peak 300');
 }
 assert.equal(challenge.deliveryChallenge.scheduleChallenge.workFrontActivityCount,300,'all 300 open activities are work fronts');
 // Resource utilisation withholds every figure without resource-loaded evidence; when it shows one it is the same producer value.
 if(resources.averageConcurrentWorkFronts!==null)assert.equal(resources.averageConcurrentWorkFronts,challenge.deliveryChallenge.manpowerChallenge.averageConcurrentWorkFronts);
});

test('T05 claims counts on commercial, dashboard and PMO pages equal the claims register pages',()=>{
 const projectId=fixture();
 const notices=data(projectId,'notices-claims'),delay=data(projectId,'delay-claims'),eot=data(projectId,'eot-assessment');
 const commercial=data(projectId,'commercial-claims-notices'),dashboard=data(projectId,'master-dashboard'),pmo=data(projectId,'pmo-analysis');
 for(const part of ['position','focus']){
  const cn=commercial[part]?.claimsNotices;
  assert.ok(cn,part+'.claimsNotices present');
  assert.equal(cn.eventCount,notices.eventCount,part+': commercial event count = Notices & Claims');
  assert.equal(cn.noticeCount,notices.noticeCount,part+': commercial notice count = Notices & Claims');
  assert.equal(cn.lifecycleClaimCount,notices.claimCount,part+': commercial lifecycle claim count = Notices & Claims');
  assert.equal(cn.sourceClaimCount,delay.delayEotEvidenceChain.sourceClaimCount,part+': commercial source claim count = evidence chain');
 }
 assert.equal(notices.eventCount,null,'no claim population: unknown, not 0');
 assert.equal(dashboard.visualControl.claims.quarantinedClaimCount,delay.delayEotEvidenceChain.quarantinedClaimCount,'Dashboard quarantined claim rows = evidence chain');
 assert.equal(dashboard.visualControl.claims.quarantinedClaimCount,null,'nothing submitted, so nothing quarantined is unknown, not 0');
 assert.equal(pmo.claims.analyticalTimeImpactCandidateDays,eot.analyticalTimeImpactCandidateDays,'PMO time-impact candidate = EOT page');
 assert.equal(dashboard.visualControl.claims.analyticalTimeImpactCandidateDays,eot.analyticalTimeImpactCandidateDays,'Dashboard time-impact candidate = EOT page');
});

test('T05 established empty claim register: commercial pages show a real 0, equal to the claims register',()=>{
 const projectId=fixture({events:[],notices:[],claims:[],noticeRequirements:[],diagnostics:[]});
 const notices=data(projectId,'notices-claims'),commercial=data(projectId,'commercial-claims-notices');
 const cn=commercial.position.claimsNotices;
 assert.equal(notices.eventCount,0);
 assert.equal(cn.eventCount,0);
 assert.equal(cn.lifecycleClaimCount,notices.claimCount);
 assert.equal(cn.noticeCount,notices.noticeCount);
});

test('T05 Dashboard completion position never keeps a day difference without its recalculated finish',()=>{
 const projectId=fixture();
 const dashboard=data(projectId,'master-dashboard');
 const position=dashboard.completionPosition;
 assert.ok(position,'dashboard completion position present');
 if(position.independentFinishIso===null){
  assert.equal(position.differenceElapsedDays,null,'difference is withheld with the finish');
  assert.deepEqual(position.differenceRows,[],'difference rows are withheld with the finish');
  assert.doesNotMatch(String(position.interpretation),/days later|days earlier/,'interpretation does not restate the withheld difference');
 }
 const diagnosis=dashboard.projectDiagnosis?.completion;
 if(diagnosis){
  assert.equal(position.independentFinishIso,diagnosis.independentFinishIso,'Dashboard finish = project diagnosis');
  assert.equal(position.differenceElapsedDays,diagnosis.differenceElapsedDays,'Dashboard difference = project diagnosis');
 }
});

test('T05 forecastCompletionIso states its basis where the same key means different dates',()=>{
 const projectId=fixture();
 const dashboard=data(projectId,'master-dashboard'),trend=data(projectId,'revision-trend');
 const latest=dashboard.visualControl.changes.latestRevision;
 assert.ok(latest,'latest revision point present');
 assert.equal(latest.forecastCompletionBasis,'submitted_programme');
 assert.equal(latest.forecastCompletionIso,trend.points.at(-1).forecastCompletionIso,'latest revision forecast = revision trend point (submitted programme)');
});

test('T05 Accountability action count names its populations: team groups plus your decisions',()=>{
 const projectId=fixture();
 const accountability=data(projectId,'cross-domain-accountability');
 const register=projectActionRegisterForState(runtimeProjects.getOrCreate(projectId));
 assert.equal(accountability.teamActionCount,accountability.actions.length,'team action count = listed team actions');
 assert.equal(accountability.userDecisionCount,register.workflow.userDecisionCount,'decision count = Project Review decisions');
 assert.equal(accountability.actionCount,accountability.teamActionCount+accountability.userDecisionCount,'all actions = team groups + decisions');
 assert.equal(accountability.actionCount,register.actions.length,'all actions = shared action register');
 assert.match(accountability.actionCountBasis,/decisions/);
});

// Hand-checked work-front cases on the producer itself. Data Date 2031-04-01 00:00,
// 24-hour calendar C24. Expected values are worked out by hand in each comment.
const wfActivity=(id:string,over:any)=>({projectId:'WF',activityId:id,nativeId:id,name:id,wbsId:null,calendarId:'C24',
 activityType:'task',status:'not_started',baselineStartIso:null,baselineFinishIso:null,currentStartIso:null,currentFinishIso:null,
 actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:48,
 remainingDurationHours:48,totalFloatHours:0,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[],...over});
const wfFronts=(activities:any[])=>{
 const schedule:any={projectId:'WF',source:'xer',sourceRevisionId:'R',dataDateIso:'2031-04-01',activities,relationships:[],wbs:[],
  calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C24'}],diagnostics:[]};
 const result:any=buildDeliveryChallengeProjection({generatedAt:'2031-04-01',producerVersion:'WF',schedule,quantities:null,resources:null,
  independentForecast:{sourceForecastCompletionIso:'2031-04-03',independentForecastCompletionIso:'2031-04-03',requiredFinishIso:'2031-04-03',origin:'deterministic_source_calendar',assumptions:[]} as any,contractTimeBasis:null,submittedManpowerPlan:null});
 return result.scheduleChallenge;
};
const inProgress=wfActivity('IP',{status:'in_progress',actualStartIso:'2031-03-25',currentStartIso:'2031-03-25',currentFinishIso:'2031-04-03',remainingDurationHours:48});
const overdueNotStarted=wfActivity('OD',{currentStartIso:'2031-01-01',currentFinishIso:'2031-03-01',remainingDurationHours:48});
const finished=wfActivity('FIN',{status:'completed',actualStartIso:'2031-01-01',actualFinishIso:'2031-02-01',currentStartIso:'2031-01-01',currentFinishIso:'2031-02-01',remainingDurationHours:0});

test('T05 work fronts hand check: in progress + overdue not started + finished',()=>{
 // IP: Data Date to its finish 04-03 = [04-01, 04-03]. OD: stale finish 03-01, remaining 48 h from the
 // Data Date on a 24 h calendar = [04-01, 04-03]. FIN: completed, not a work front.
 // Two fronts open together for the whole 2-day span: average 2, peak 2, 2 activities.
 const fronts=wfFronts([inProgress,overdueNotStarted,finished]);
 assert.equal(fronts.averageConcurrentWorkFronts,2);
 assert.equal(fronts.peakConcurrentWorkFronts,2);
 assert.equal(fronts.workFrontActivityCount,2);
 assert.equal(fronts.workFrontUnresolvedActivityCount,0);
 assert.equal(fronts.workFrontNotEstablishedReason,null);
});

test('T05 work fronts hand check: overdue open work with unknown remaining duration is not established, never 0',()=>{
 const unknown=wfActivity('UNK',{currentStartIso:'2031-01-01',currentFinishIso:'2031-03-01',remainingDurationHours:null});
 const fronts=wfFronts([inProgress,unknown]);
 assert.equal(fronts.averageConcurrentWorkFronts,null);
 assert.equal(fronts.peakConcurrentWorkFronts,null);
 assert.equal(fronts.workFrontActivityCount,null,'count is not established, not 0');
 assert.equal(fronts.workFrontUnresolvedActivityCount,1);
 assert.match(fronts.workFrontNotEstablishedReason,/1 open activities .* not established/);
});

test('T05 work fronts hand check: overdue work on an unknown calendar is not established (no assumed day length)',()=>{
 const noCalendar=wfActivity('NOCAL',{calendarId:'MISSING',currentStartIso:'2031-01-01',currentFinishIso:'2031-03-01',remainingDurationHours:48});
 const fronts=wfFronts([noCalendar]);
 assert.equal(fronts.workFrontActivityCount,null);
 assert.equal(fronts.averageConcurrentWorkFronts,null);
 assert.equal(fronts.workFrontUnresolvedActivityCount,1);
});

test('T05 work fronts hand check: only finished work gives 0 work fronts with no figure invented',()=>{
 const fronts=wfFronts([finished]);
 assert.equal(fronts.workFrontActivityCount,0);
 assert.equal(fronts.averageConcurrentWorkFronts,null);
 assert.equal(fronts.peakConcurrentWorkFronts,null);
});
