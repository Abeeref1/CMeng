import test from 'node:test';
import assert from 'node:assert/strict';
import type {CanonicalScheduleActivity,CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
import {compareScheduleRevisions,type ScheduleRevision} from '../packages/schedule-revision-core/src';

const makeActivity=(projectId:string,id:string,finish:string|null):CanonicalScheduleActivity=>({
  projectId,activityId:id,nativeId:id,name:id,wbsId:'W',calendarId:null,
  activityType:'task',status:'not_started',
  baselineStartIso:null,baselineFinishIso:null,currentStartIso:'2031-02-01',
  currentFinishIso:finish,forecastStartIso:null,forecastFinishIso:null,
  actualStartIso:null,actualFinishIso:null,
  originalDurationHours:16,remainingDurationHours:16,totalFloatHours:null,
  freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[],
});
function revision(projectId:string,revisionId:string,finish:(index:number)=>string|null,count=12000):ScheduleRevision{
  const activities=Array.from({length:count},(_,i)=>makeActivity(projectId,'SRC-'+i,finish(i)));
  const model:CanonicalScheduleModel={
    projectId,source:'schedule_xlsx',sourceRevisionId:revisionId,dataDateIso:'2031-02-01',
    activities,relationships:[],wbs:[{wbsId:'W',name:'Source work',parentWbsId:null,sourceRefs:[]}],
    calendars:[],diagnostics:[],
  };
  return {revisionId,label:revisionId,sequence:revisionId==='R1'?1:2,effectiveAt:'2031-02-01',model};
}
const oldFinish=(i:number)=>i%19===0?'not-a-date':i%17===0?null:'2031-02-10';
const newFinish=(i:number)=>i%19===0?'not-a-date':i%17===0?null:'2031-02-13';
test('T11 original 12,000-row date comparisons preserve every source identity, invalid/unknown date and signed day movement',()=>{
  const before=revision('SOURCE-DATE-ONE','R1',oldFinish);
  const after=revision('SOURCE-DATE-ONE','R2',newFinish);
  const frozen=JSON.stringify([before,after]);
  const result=compareScheduleRevisions(before,after);
  assert.equal(result.activityChanges.length,12000);
  assert.equal(result.matchedActivityCount,12000);
  assert.deepEqual(result.addedActivityIds,[]);
  assert.deepEqual(result.removedActivityIds,[]);
  const byId=new Map(result.activityChanges.map(row=>[row.activityId,row]));
  for(let i=0;i<12000;i++){
    const record=byId.get('SRC-'+i);
    assert.ok(record,'source activity '+i+' must be retained');
    const from=oldFinish(i),to=newFinish(i);
    const expected=from===null||to===null||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))
      ?null:(Date.parse(to)-Date.parse(from))/86400000;
    assert.equal(record.finishShiftDays,expected,'independent source date comparison for '+i);
    assert.equal(record.identityMethod,'activity_id');
  }
  assert.equal(JSON.stringify([before,after]),frozen,'source and decisions are not mutated');
  after.model.activities[3]!.currentFinishIso='2031-02-20';
  assert.equal(compareScheduleRevisions(before,after).activityChanges.find(r=>r.activityId==='SRC-3')!.finishShiftDays,10,
    'subsequent revision edits must never reuse stale timestamps');
});
test('T11 date comparisons do not share cached values across unrelated projects with identical activity codes',()=>{
  const before=revision('SECOND-SOURCE','R1',()=> '2031-08-19',71);
  const after=revision('SECOND-SOURCE','R2',i=>i%7===0?null:'2031-08-18',71);
  const result=compareScheduleRevisions(before,after);
  assert.equal(result.matchedActivityCount,71);
  assert.equal(result.activityChanges.filter(r=>r.finishShiftDays===-1).length,60);
  assert.equal(result.activityChanges.filter(r=>r.finishShiftDays===null).length,11);
});
