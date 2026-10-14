import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProgressScurveProjection} from '../packages/progress-scurve/src/projector';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

test('T11 source S-curve keeps all snapshot dates, source calendars and gaps across 1200 activities',()=>{
 const projectId='FULL-SCURVE-DATES',scheduleId='REV-01';
 const calendar={...ELAPSED_24H_CALENDAR,calendarId:'C'};
 const model:CanonicalScheduleModel={projectId,source:'xer',sourceRevisionId:scheduleId,dataDateIso:'2031-06-01',
  activities:Array.from({length:1200},(_,i)=>({
   projectId,activityId:'A-'+i,nativeId:String(i),name:'Scope '+i,wbsId:'W',activityType:'task' as const,
   calendarId:i%19===0?'UNKNOWN-CALENDAR':'C',
   status:'not_started' as const,baselineStartIso:'2031-01-01',baselineFinishIso:'2031-09-01',
   currentStartIso:i%4===0?'2031-01-01':'2031-02-01',
   currentFinishIso:i%5===0?'2031-07-01':'2031-08-01',
   actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
   originalDurationHours:16,remainingDurationHours:16,totalFloatHours:null,
   freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[],
  })),
  relationships:[],wbs:[{wbsId:'W',name:'Work',parentWbsId:null,sourceRefs:[]}],
  calendars:[calendar],diagnostics:[],
 };
 const before=JSON.stringify(model);
 const snapshots=Array.from({length:120},(_,i)=>({
  asOfIso:new Date(Date.UTC(2031,0,1+i)).toISOString().slice(0,10),
  progressPercent:Number((i/2).toFixed(4)),sourceRevisionId:scheduleId,sourceRefs:['schedule:'+scheduleId+':update-'+i],
 }));
 const projection=buildProgressScurveProjection(model,{
  generatedAt:'2031-06-01T00:00:00Z',producerVersion:'source-coverage-test',
  intervalDays:7,actualHistory:snapshots,
 });
 assert.equal(projection.observationCount,snapshots.length);
 const dates=new Set(projection.points.map(p=>p.dateIso.slice(0,10)));
 for(const snap of snapshots)assert.ok(dates.has(snap.asOfIso),'every source observation retained '+snap.asOfIso);
 assert.ok(dates.has('2031-06-01'),'reporting date must be retained even without an observation');
 assert.ok(projection.diagnostics.some(d=>d.includes('PROGRESS_WORKING_CALENDAR_UNRESOLVED:')),'missing calendar cannot be assigned a default');
 assert.ok(projection.points.some(p=>p.currentSchedulePhasingPercent===null),'unsupported working pattern remains a gap');
 const known={...model,activities:model.activities.filter(row=>row.calendarId==='C')};
 const complete=buildProgressScurveProjection(known,{
  generatedAt:'2031-06-01T00:00:00Z',producerVersion:'source-coverage-test',
  intervalDays:7,actualHistory:snapshots,
 });
 assert.equal(complete.currentCoveragePercent,100);
 assert.equal(complete.points.filter(p=>p.currentSchedulePhasingPercent===null).length,0);
 const repeated=buildProgressScurveProjection(model,{
  generatedAt:'2031-06-01T00:00:00Z',producerVersion:'source-coverage-test',
  intervalDays:7,actualHistory:snapshots,
 });
 assert.deepEqual(projection,repeated,'same source version and dates are deterministic');
 assert.equal(JSON.stringify(model),before,'calendar/snapshot optimization never mutates original source');
});

test('T11 source S-curve keeps unknown if every reference calendar is unresolved',()=>{
 const projectId='UNSUPPORTED-CALENDAR';
 const model:CanonicalScheduleModel={projectId,source:'xer',sourceRevisionId:'REV',dataDateIso:'2031-04-01',
  activities:[{
   projectId,activityId:'A',nativeId:'1',name:'Scope',wbsId:'W',calendarId:'MISSING',activityType:'task',status:'not_started',
   baselineStartIso:'2031-01-01',baselineFinishIso:'2031-07-01',currentStartIso:'2031-01-01',
   currentFinishIso:'2031-07-01',actualStartIso:null,actualFinishIso:null,forecastStartIso:null,
   forecastFinishIso:null,originalDurationHours:8,remainingDurationHours:8,totalFloatHours:null,
   freeFloatHours:null,percentComplete:null,sourceRefs:[],diagnostics:[],
  }],relationships:[],wbs:[{wbsId:'W',name:'Work',parentWbsId:null,sourceRefs:[]}],
  calendars:[],diagnostics:[]};
 const projection=buildProgressScurveProjection(model,{
  generatedAt:'2031-04-01T00:00:00Z',producerVersion:'unknown-source-test'});
 assert.ok(projection.points.some(p=>p.currentSchedulePhasingPercent===null));
 assert.equal(projection.actualSnapshots.length,0,'missing progress cannot be manufactured');
 assert.equal(projection.actualHistoryMode,'missing');
});
