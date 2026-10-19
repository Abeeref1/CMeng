import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
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
