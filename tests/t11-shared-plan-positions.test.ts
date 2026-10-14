import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sharedProjectPlanPositions} from '../packages/runtime-api/src/shared-plan-positions';
import {schedulePlanPositions} from '../packages/progress-scurve/src/projector';
import {buildProgressBreakdownProjection,buildDeliveryWorkfrontBreakdown} from '../packages/progress-breakdown/src/projector';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

test('T11 versioned full-programme phasing is identical to a fresh independent calculation, and invalidates on edits',t=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-shared-phasing-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false});
 const state=store.getOrCreate('PHASING-SOURCE');
 const calendar={...ELAPSED_24H_CALENDAR,calendarId:'C'};
 const model:CanonicalScheduleModel={projectId:state.projectId,source:'xer',sourceRevisionId:'CURRENT',
  dataDateIso:'2031-04-01',
  activities:Array.from({length:1200},(_,i)=>({
   projectId:state.projectId,activityId:'A'+i,nativeId:String(i),name:'Work '+i,
   wbsId:'W'+(i%8),calendarId:'C',activityType:'task' as const,
   status:i%17===0?'completed' as const:'not_started' as const,
   baselineStartIso:'2031-01-01',baselineFinishIso:i%3===0?null:'2031-06-01',
   currentStartIso:'2031-01-01',currentFinishIso:i%5===0?null:'2031-05-01',
   actualStartIso:null,actualFinishIso:i%17===0?'2031-03-01':null,
   forecastStartIso:null,forecastFinishIso:null,
   originalDurationHours:i%19===0?null:16,remainingDurationHours:i%17===0?0:16,
   totalFloatHours:i%7===0?null:0,freeFloatHours:null,percentComplete:i%17===0?100:0,
   sourceRefs:[],diagnostics:[],
  })),
  relationships:[],wbs:Array.from({length:8},(_,i)=>({wbsId:'W'+i,name:'Zone '+i,parentWbsId:null,sourceRefs:[]})),
  calendars:[calendar],diagnostics:[]};
 const baseline:CanonicalScheduleModel={...model,sourceRevisionId:'BASE',activities:model.activities.map(row=>({
  ...row,currentFinishIso:'2031-06-01',baselineFinishIso:'2031-06-01',
 }))};
 const original=JSON.stringify({model,baseline});
 const first=sharedProjectPlanPositions(state,model,baseline),second=sharedProjectPlanPositions(state,model,baseline);
 assert.strictEqual(first,second,'unchanged source and baseline share the identical projection');
 assert.deepEqual(first,schedulePlanPositions(model,baseline),'the shared calculation must use the original reader and calendar mathematics');
 const directBreakdown=buildProgressBreakdownProjection(model,{
  generatedAt:'2031-04-01T00:00:00Z',producerVersion:'source-parity',baselineModel:baseline});
 const sharedBreakdown=buildProgressBreakdownProjection(model,{
  generatedAt:'2031-04-01T00:00:00Z',producerVersion:'source-parity',baselineModel:baseline,sharedPlanPositions:first});
 assert.deepEqual(sharedBreakdown,directBreakdown,'specialist WBS/dimensions and unknowns must not change');
 const subset={...model,activities:model.activities.filter(row=>row.wbsId==='W3')};
 const directDelivery=buildDeliveryWorkfrontBreakdown(subset,{
  generatedAt:'2031-04-01T00:00:00Z',producerVersion:'source-parity',baselineModel:baseline});
 const sharedDelivery=buildDeliveryWorkfrontBreakdown(subset,{
  generatedAt:'2031-04-01T00:00:00Z',producerVersion:'source-parity',baselineModel:baseline,sharedPlanPositions:first});
 assert.deepEqual(sharedDelivery,directDelivery,'delivery full/known/unknown WBS populations unchanged');
 assert.equal(JSON.stringify({model,baseline}),original,'reading must not change either source programme');
 const differentBaseline={...baseline,activities:baseline.activities.map(row=>({...row,currentFinishIso:'2031-07-01',baselineFinishIso:'2031-07-01'}))};
 const changedBaseline=sharedProjectPlanPositions(state,model,differentBaseline);
 assert.notStrictEqual(changedBaseline,first,'different baseline authority must invalidate sharing');
 assert.deepEqual(changedBaseline,schedulePlanPositions(model,differentBaseline));
 model.activities[3]!.currentFinishIso='2031-07-01';
 store.touch(state);
 const newer=sharedProjectPlanPositions(state,model,baseline);
 assert.notStrictEqual(newer,first,'project version changes invalidate the full calculation even when model object identity survives');
 assert.deepEqual(newer,schedulePlanPositions(model,baseline));
});
