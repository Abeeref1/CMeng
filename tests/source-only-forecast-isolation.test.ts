import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceOnlyForecast} from '../packages/runtime-api/src/project-projections';
import type {ProjectRuntimeState} from '../packages/runtime-api/src/project-state-types';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

function sources(id:string,revisionId:string,finish:string|null):CanonicalScheduleModel {
 return {projectId:id,source:'xer',sourceRevisionId:revisionId,dataDateIso:'2031-01-10',
  activities:Array.from({length:1200},(_,i)=>({
   projectId:id,activityId:'ACT-'+i,nativeId:String(i),name:'Installation '+i,
   wbsId:'W',calendarId:'C',activityType:'task' as const,
   status:i%27===0?'completed' as const:'not_started' as const,
   baselineStartIso:null,baselineFinishIso:null,
   currentStartIso:'2031-01-10',currentFinishIso:i===1199?finish:'2031-02-01',
   actualStartIso:null,actualFinishIso:i%27===0?'2031-02-03':null,
   forecastStartIso:null,forecastFinishIso:null,
   originalDurationHours:8,remainingDurationHours:i%27===0?0:8,
   totalFloatHours:null,freeFloatHours:null,percentComplete:i%27===0?100:0,
   sourceRefs:[],diagnostics:[],
  })),
  relationships:[],wbs:[{wbsId:'W',name:'Work',parentWbsId:null,sourceRefs:[]}],
  calendars:[],diagnostics:[]};
}
const state=(id:string)=>({projectId:id,version:1}) as ProjectRuntimeState;

test('SW-07 same revision name in two projects cannot reuse another project source finish or fact identity',()=>{
 const first=state('PROJECT-A'),second=state('PROJECT-B');
 const one=sources(first.projectId,'REVISION-1','2031-03-01');
 const two=sources(second.projectId,'REVISION-1','2031-08-01');
 const before=JSON.stringify({one,two});
 const a=sourceOnlyForecast(first,one,'2031-01-11T00:00:00Z');
 const b=sourceOnlyForecast(second,two,'2031-01-11T00:00:00Z');
 assert.equal(a.projectId,first.projectId);
 assert.equal(b.projectId,second.projectId);
 assert.equal(a.sourceRevisionId,'REVISION-1');
 assert.equal(b.sourceRevisionId,'REVISION-1');
 assert.equal(a.sourceForecastCompletionIso,'2031-03-01');
 assert.equal(b.sourceForecastCompletionIso,'2031-08-01');
 assert.equal(a.independentForecastCompletionIso,null);
 assert.equal(b.independentForecastCompletionIso,null);
 assert.equal(JSON.stringify({one,two}),before,'source facts and decisions never mutate when reading');
 const again=sourceOnlyForecast(first,one,'2031-01-12T00:00:00Z');
 assert.equal(again.projectId,a.projectId);
 assert.equal(again.sourceForecastCompletionIso,a.sourceForecastCompletionIso);
 assert.equal(again.generatedAt,'2031-01-12T00:00:00Z');
});

test('SW-07 project version and changed source model invalidate source-only forecast without inventing finish',()=>{
 const first=state('PROJECT-VERSION'),model=sources(first.projectId,'REVISION-1','2031-03-01');
 assert.equal(sourceOnlyForecast(first,model,'2031-01-10T00:00:00Z').sourceForecastCompletionIso,'2031-03-01');
 model.activities[1199]!.currentFinishIso='2031-09-01';
 first.version++;
 assert.equal(sourceOnlyForecast(first,model,'2031-01-10T00:00:00Z').sourceForecastCompletionIso,'2031-09-01');
 const changedModel=sources(first.projectId,'REVISION-1','2031-12-01');
 assert.equal(sourceOnlyForecast(first,changedModel,'2031-01-10T00:00:00Z').sourceForecastCompletionIso,'2031-12-01');
});

test('SW-04 unknown source finish stays null rather than fabricated zero',()=>{
 const first=state('EMPTY-SOURCE'),model=sources(first.projectId,'REV-NULL',null);
 for(const row of model.activities){row.currentFinishIso=null;row.actualFinishIso=null;}
 const projection=sourceOnlyForecast(first,model,'2031-01-10T00:00:00Z');
 assert.equal(projection.sourceForecastCompletionIso,null);
 assert.equal(projection.independentForecastCompletionIso,null);
 assert.equal(projection.complete,false);
});
