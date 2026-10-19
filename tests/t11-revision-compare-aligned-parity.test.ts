import test from 'node:test';
import assert from 'node:assert/strict';
import type {CanonicalScheduleActivity,CanonicalScheduleModel,CanonicalScheduleRelationship} from '../packages/schedule-analysis-core/src';
import {compareScheduleRevisions,type ScheduleRevision} from '../packages/schedule-revision-core/src';

const activity=(id:string,nativeId:string,finish:string|null,float:number|null,progress:number|null):CanonicalScheduleActivity=>({
  projectId:'ALIGNED',activityId:id,nativeId,name:'Work '+nativeId,wbsId:'W',calendarId:null,
  activityType:'task',status:'not_started',baselineStartIso:null,baselineFinishIso:null,
  currentStartIso:'2031-02-01',currentFinishIso:finish,forecastStartIso:null,forecastFinishIso:null,
  actualStartIso:null,actualFinishIso:null,originalDurationHours:16,remainingDurationHours:16,
  totalFloatHours:float,freeFloatHours:null,percentComplete:progress,sourceRefs:[],diagnostics:[],
});
const rel=(id:string,from:string,to:string,lag:number|null):CanonicalScheduleRelationship=>({
  relationshipId:id,predecessorActivityId:from,successorActivityId:to,type:'FS',lagHours:lag,external:false,sourceRefs:[],diagnostics:[],
});
const revision=(revisionId:string,sequence:number,activities:CanonicalScheduleActivity[],relationships:CanonicalScheduleRelationship[]):ScheduleRevision=>{
  const model:CanonicalScheduleModel={projectId:'ALIGNED',source:'xer',sourceRevisionId:revisionId,dataDateIso:'2031-02-01',
    activities,relationships,wbs:[{wbsId:'W',name:'Work',parentWbsId:null,sourceRefs:[]}],calendars:[],diagnostics:[]};
  return {revisionId,label:revisionId,sequence,effectiveAt:'2031-02-01',model};
};
const rows=(finish:(i:number)=>string|null,float:(i:number)=>number|null,progress:(i:number)=>number|null)=>
  Array.from({length:300},(_,i)=>activity('A'+i,String(i),finish(i),float(i),progress(i)));
const links=(lag:(i:number)=>number|null)=>Array.from({length:299},(_,i)=>rel('R'+i,'A'+i,'A'+(i+1),lag(i)));
// Equal values, moved values, unknown values and invalid dates in one population.
const before=revision('R1',1,rows(i=>i%11===0?null:i%13===0?'bad-date':'2031-03-01',i=>i%7===0?null:i%5,i=>i%9===0?null:10),links(i=>i%4===0?null:0));
const after=revision('R2',2,rows(i=>i%11===0?null:i%13===0?'bad-date':i%3===0?'2031-03-04':'2031-03-01',i=>i%7===0?null:i%2===0?i%5:(i%5)-8,i=>i%9===0?null:i%2===0?10:35),links(i=>i%4===0?null:i%6===0?8:0));

function withoutMatchOrder(result:ReturnType<typeof compareScheduleRevisions>){
  const {identityMatches,...rest}=result;
  return {...rest,identityMatches:[...identityMatches].sort((a,b)=>a.toActivityId<b.toActivityId?-1:a.toActivityId>b.toActivityId?1:0)};
}

test('T11 aligned revision comparison equals the ID-lookup comparison of the same source records',()=>{
  const aligned=compareScheduleRevisions(before,after);
  // Same records in another source order: position no longer equals identity,
  // so the comparison must address every record through its activity ID.
  const reordered=revision('R2',2,[...after.model.activities].reverse(),after.model.relationships);
  const lookedUp=compareScheduleRevisions(before,reordered);
  assert.deepEqual(withoutMatchOrder(aligned),withoutMatchOrder(lookedUp));
  assert.equal(aligned.matchedActivityCount,300);
  assert.deepEqual(aligned.addedActivityIds,[]);
  assert.deepEqual(aligned.removedActivityIds,[]);
  const a3=aligned.activityChanges.find(c=>c.activityId==='A3')!;
  assert.equal(a3.finishShiftDays,3);
  const a4=aligned.activityChanges.find(c=>c.activityId==='A4')!;
  assert.equal(a4.finishShiftDays,0);
  assert.equal(a4.floatShiftHours,0);
  assert.equal(a4.progressShiftPercent,0);
  assert.equal(aligned.activityChanges.find(c=>c.activityId==='A13')!.finishShiftDays,null);
  assert.equal(aligned.activityChanges.find(c=>c.activityId==='A11')!.finishShiftDays,null);
  assert.equal(aligned.activityChanges.find(c=>c.activityId==='A7')!.floatShiftHours,null);
  assert.equal(aligned.activityChanges.find(c=>c.activityId==='A9')!.progressShiftPercent,null);
  // Lag 0 -> 8 on every sixth link is a removed plus an added relationship; null lag stays null.
  const changedLinks=Array.from({length:299},(_,i)=>i).filter(i=>i%4!==0&&i%6===0).length;
  assert.equal(aligned.addedRelationships.length,changedLinks);
  assert.equal(aligned.removedRelationships.length,changedLinks);
});

test('T11 a renamed activity ID still translates its relationships through the identity match',()=>{
  const renamed=after.model.activities.map(a=>a.activityId==='A5'?{...a,activityId:'A5-NEW'}:a);
  const renamedLinks=after.model.relationships.map(r=>({...r,
    predecessorActivityId:r.predecessorActivityId==='A5'?'A5-NEW':r.predecessorActivityId,
    successorActivityId:r.successorActivityId==='A5'?'A5-NEW':r.successorActivityId}));
  const result=compareScheduleRevisions(before,revision('R2',2,renamed,renamedLinks));
  const match=result.identityMatches.find(m=>m.toActivityId==='A5-NEW')!;
  assert.equal(match.fromActivityId,'A5');
  assert.equal(match.method,'native_id');
  const baseline=compareScheduleRevisions(before,after);
  assert.equal(result.addedRelationships.length,baseline.addedRelationships.length);
  assert.equal(result.removedRelationships.length,baseline.removedRelationships.length);
  assert.deepEqual(result.addedActivityIds,[]);
  assert.deepEqual(result.removedActivityIds,[]);
});
