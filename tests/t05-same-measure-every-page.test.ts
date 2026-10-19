import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject,projectActionRegisterForState} from '../packages/runtime-api/src/project-projections';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';

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

test('T05 concurrent work fronts: Delivery challenge equals Resource utilisation and is never negative',()=>{
 // Every fixture activity is unfinished with a stored finish before the Data Date,
 // so no remaining work window is established: unknown on both pages, never -N or 0.
 const projectId=fixture();
 const challenge=data(projectId,'challenge-contract'),resources=data(projectId,'resource-utilization');
 const fronts=resources.averageConcurrentWorkFronts;
 for(const basis of ['scheduleChallenge','manpowerChallenge']){
  const row=challenge.deliveryChallenge?.[basis];
  assert.ok(row,basis+' present');
  assert.equal(row.averageConcurrentWorkFronts,fronts,basis+' average work fronts = Resource utilisation');
  assert.equal(row.peakConcurrentWorkFronts,resources.peakConcurrentWorkFronts,basis+' peak work fronts = Resource utilisation');
  assert.ok(row.averageConcurrentWorkFronts===null||row.averageConcurrentWorkFronts>=0,'a count of work fronts is never negative');
 }
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
