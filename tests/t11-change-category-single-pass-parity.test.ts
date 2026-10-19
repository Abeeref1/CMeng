import test from 'node:test';
import assert from 'node:assert/strict';
import type {CanonicalScheduleActivity,CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
import {classifyScheduleChanges} from '../packages/schedule-revision-core/src';

// The per-category filters used before the single pass, kept here as the reference answer.
function referenceClassification(changes:readonly {fromActivityId:string|null;toActivityId:string|null;fieldChanges:{field:string}[]}[],from:CanonicalScheduleModel,to:CanonicalScheduleModel){
  const before=new Map(from.activities.map(a=>[a.activityId,a])),after=new Map(to.activities.map(a=>[a.activityId,a]));
  const fields:Record<string,string[]>={
    structural:['activityType','wbsId','calendarId','originalDurationHours'],
    forecast:['currentStartIso','currentFinishIso','forecastStartIso','forecastFinishIso','totalFloatHours','freeFloatHours'],
    progress:['status','actualStartIso','actualFinishIso','remainingDurationHours','percentComplete'],metadata:['name'],
  };
  const rows=Object.entries(fields).map(([category,names])=>({category,activityCount:changes.filter(r=>r.fieldChanges.some(c=>names.includes(c.field))).length}));
  const dates=changes.filter(r=>r.fieldChanges.some(c=>['baselineStartIso','baselineFinishIso'].includes(c.field)));
  const basis=(r:typeof dates[number])=>{
    const a=before.get(r.fromActivityId??'')?.baselineDateBasis,b=after.get(r.toActivityId??'')?.baselineDateBasis;
    return a==='xer_target_dates'||b==='xer_target_dates'?'source_target':a&&b?'baseline':'date_basis_review';
  };
  for(const category of ['baseline','source_target','date_basis_review'])rows.push({category,activityCount:dates.filter(r=>basis(r)===category).length});
  return rows;
}

const ALL=['name','activityType','wbsId','calendarId','status','baselineStartIso','baselineFinishIso','currentStartIso','currentFinishIso','forecastStartIso','forecastFinishIso','actualStartIso','actualFinishIso','originalDurationHours','remainingDurationHours','totalFloatHours','freeFloatHours','percentComplete'];
const bases=[undefined,'xer_target_dates','controlled_baseline'] as const;
const model=(id:string,offset:number):CanonicalScheduleModel=>({projectId:'CAT',source:'xer',sourceRevisionId:id,dataDateIso:'2031-02-01',
  activities:Array.from({length:400},(_,i)=>({activityId:'A'+i,baselineDateBasis:bases[(i+offset)%3]} as unknown as CanonicalScheduleActivity)),
  relationships:[],wbs:[],calendars:[],diagnostics:[]});

test('T11 change categories from one pass equal the per-category filters for every field mix and date basis',()=>{
  const from=model('R1',0),to=model('R2',0);
  const changes=Array.from({length:400},(_,i)=>({
    fromActivityId:i%37===0?null:'A'+i,
    toActivityId:i%41===0?null:'A'+i,
    // Deterministic mixes: none, one, several, and repeated fields per activity.
    fieldChanges:ALL.filter((_,f)=>((i*7+f*3)%11)<(i%5)).concat(i%13===0?[ALL[5]!,ALL[5]!]:[]).map(field=>({field})),
  }));
  const actual=classifyScheduleChanges(changes as never,from,to);
  assert.deepEqual(actual,referenceClassification(changes,from,to));
  assert.ok(actual.find(r=>r.category==='source_target')!.activityCount>0);
  assert.ok(actual.find(r=>r.category==='baseline')!.activityCount>0);
  assert.ok(actual.find(r=>r.category==='date_basis_review')!.activityCount>0);
  // No baseline-named date change: every date row is zero, every category row is still present.
  const noDates=changes.map(r=>({...r,fieldChanges:r.fieldChanges.filter(c=>!c.field.startsWith('baseline'))}));
  assert.deepEqual(classifyScheduleChanges(noDates as never,from,to),referenceClassification(noDates,from,to));
  assert.deepEqual(classifyScheduleChanges([],from,to).map(r=>r.activityCount),[0,0,0,0,0,0,0]);
});
