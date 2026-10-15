import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {nearCriticalScreening} from '../packages/runtime-api/src/near-critical-screening';

test('T06 independent source-calendar distribution excludes completed, missing and nonfinite floats',t=>{
 const dir=mkdtempSync(join(tmpdir(),'cmeng-finite-floats-'));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:dir,durable:false});
 for(const hours of [8,12]){
  const projectId='ORACLE-'+hours, state=store.getOrCreate(projectId);
  const activity=(id:string,flt:number|null|undefined,status='in_progress')=>({
   projectId,activityId:id,nativeId:id,name:id,wbsId:'W',calendarId:'C',activityType:'task',
   status,totalFloatHours:flt,freeFloatHours:null,percentComplete:0,
   originalDurationHours:hours,remainingDurationHours:hours,
   currentStartIso:'2031-01-01',currentFinishIso:'2031-03-01',
   baselineStartIso:'2031-01-01',baselineFinishIso:'2031-03-01',
   actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
   sourceRefs:[],diagnostics:[]
  });
  const activities=[activity('REAL',-2*hours),activity('NULL',null),activity('ABSENT',undefined),
   activity('NAN',Number.NaN),activity('INF',Infinity),activity('FINISHED',-8,'completed')];
  const original=activities.map(a=>a.totalFloatHours);
  const model:any={projectId,source:'xer',sourceRevisionId:'REV-'+projectId,
   dataDateIso:'2031-02-01',activities,relationships:[],diagnostics:[],
   calendars:[{calendarId:'C',semanticComplete:true,standardDayHours:hours,sourceRefs:[]},
    {calendarId:'C',semanticComplete:true,standardDayHours:24,sourceRefs:[]}],
   wbs:[{wbsId:'W',name:'Work',parentWbsId:null,sourceRefs:[]}]};
  state.schedules.push({role:'update',format:'xer',sourceFilename:'original.xer',
   sourceHashSha256:'SHA-'+projectId,uploadedAt:'2031-02-01',
   revision:{revisionId:model.sourceRevisionId,label:'Unadopted source',sequence:1,
    effectiveAt:'2031-02-01',model}});
  store.touch(state);
  const result=nearCriticalScreening(state);
  assert.ok(result);
  assert.equal(result.populationCount,5);
  assert.equal(result.distributionUnresolvedCount,4);
  assert.deepEqual(result.floatDistribution,[{workingDays:-2,count:1}]);
  assert.equal(result.unresolvedActivityCount,4);
  assert.equal(result.nearCriticalCount,null);
  assert.equal(result.watchlistCount,null);
  assert.equal(result.nearCriticalPercent,null);
  for(let i=0;i<activities.length;i++)assert.ok(Object.is(activities[i]!.totalFloatHours,original[i]));
  assert.equal(model.calendars[1].standardDayHours,24);
 }
});
