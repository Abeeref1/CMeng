import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {scheduleCriticalityFacts} from '../packages/runtime-api/src/schedule-criticality-facts';
import {projectScheduleControlBasis} from '../packages/runtime-api/src/schedule-control-basis';
import {buildScheduleAnalyticsProjection} from '../packages/schedule-analytics/src';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

test('T11/T05 shared schedule float is identical to independent full source reading including known zero and missing float',t=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-criticality-shared-float-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false});
 const create=(id:string)=>{
  const state=store.getOrCreate(id);
  const model:CanonicalScheduleModel={
   projectId:id,source:'xer',sourceRevisionId:'CURRENT',dataDateIso:'2031-02-01',
   activities:Array.from({length:160},(_,i)=>({
    projectId:id,activityId:'A-'+i,nativeId:String(i),name:'Task '+i,
    wbsId:'W',calendarId:'C',activityType:'task' as const,
    status:i%17===0?'completed' as const:'not_started' as const,
    baselineStartIso:'2031-01-01',baselineFinishIso:'2031-03-01',
    currentStartIso:'2031-01-01',currentFinishIso:'2031-03-01',
    actualStartIso:null,actualFinishIso:i%17===0?'2031-01-20':null,
    forecastStartIso:null,forecastFinishIso:null,
    originalDurationHours:24,remainingDurationHours:i%17===0?0:24,
    totalFloatHours:i%11===0?null:i%3===0?-8:i%3===1?0:16,
    freeFloatHours:null,percentComplete:i%17===0?100:0,
    sourceRefs:[],diagnostics:[],
   })),
   relationships:[],wbs:[{wbsId:'W',name:'Work package',parentWbsId:null,sourceRefs:[]}],
   calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],diagnostics:[],
  };
  state.schedules.push({role:'update',format:'xer',sourceFilename:'current.xer',
   sourceHashSha256:'fixture-'+id,uploadedAt:'2031-02-01',
   revision:{revisionId:'CURRENT',label:'Current',sequence:1,effectiveAt:'2031-02-01',model}});
  store.touch(state);
  return {state,model};
 };
 const first=create('SHARED-CRITICALITY-1');
 const second=create('SHARED-CRITICALITY-2');
 const sourceBefore=JSON.stringify(first.model);
 const float=buildScheduleAnalyticsProjection(first.model,{
  generatedAt:'2031-02-01T00:00:00Z',producerVersion:'independent-test-source',
  config:projectScheduleControlBasis(first.state).analysisConfig,
 }).result.float;
 const shared=scheduleCriticalityFacts(first.state,float);
 const independentlyBuilt=scheduleCriticalityFacts(second.state);
 for(const key of ['submittedCritical','submittedNearCritical','submittedNegativeFloat',
  'independentCritical','independentNearCritical','independentNegativeFloat',
  'canonicalCritical','canonicalNearCritical','canonicalNegativeFloat',
  'floatBasis','floatLabel','authoritativeIndependent','reconciliation'] as const){
  assert.deepEqual(shared[key],independentlyBuilt[key],'source parity for '+key);
 }
 assert.equal(float.totalActivities,first.model.activities.filter(a=>a.status!=='completed').length);
 assert.ok(float.unknownFloatCount>0,'unknown submitted floats must remain unresolved');
 assert.equal(shared.submittedCritical.value,null,'partial float population may not report a confirmed zero');
 assert.equal(shared.submittedCritical.knownCount,float.knownClassifications.critical);
 assert.equal(shared.submittedCritical.unresolvedCount,float.unknownFloatCount);
 assert.equal(JSON.stringify(first.model),sourceBefore,'source programme remains immutable');
});

test('T11/T05 missing schedule criticality stays unknown, not a zero',t=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-missing-criticality-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false});
 const position=scheduleCriticalityFacts(store.getOrCreate('EMPTY-SCHEDULE'));
 assert.equal(position.canonicalCritical.value,null);
 assert.equal(position.canonicalNegativeFloat.value,null);
 assert.equal(position.floatBasis,'missing');
});
