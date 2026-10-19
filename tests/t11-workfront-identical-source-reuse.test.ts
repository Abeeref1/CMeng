import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {deliveryPosition,deliveryDashboard} from '../packages/runtime-api/src/delivery-projections';
import {projectScopeClassification} from '../packages/runtime-api/src/location-review';
import {buildDeliveryWorkfrontBreakdown} from '../packages/progress-breakdown/src/projector';
import {projectScheduleControlBasis} from '../packages/runtime-api/src/schedule-control-basis';
import {emptyLinks,type DeliveryRecord} from '../packages/delivery-core/src/types';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

test('T11 workfront discipline and location with exactly the same complete source population share only identical results',t=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-workfront-duplicate-scope-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false});
 const state=store.getOrCreate('WORKFRONT-PARITY-SCOPE');
 const activities:CanonicalScheduleModel['activities']=Array.from({length:800},(_,i)=>({
  projectId:state.projectId,activityId:'ACT-'+i,nativeId:String(i),name:'Work '+i,
  wbsId:i<400?'E':'M',calendarId:'C',activityType:'task' as const,
  status:i%13===0?'completed' as const:'in_progress' as const,
  baselineStartIso:'2031-01-01',baselineFinishIso:'2031-08-01',
  currentStartIso:'2031-01-01',currentFinishIso:'2031-08-01',
  actualStartIso:null,actualFinishIso:i%13===0?'2031-03-01':null,
  forecastStartIso:null,forecastFinishIso:null,
  originalDurationHours:40,remainingDurationHours:i%13===0?0:20,
  totalFloatHours:i%17===0?null:i%3===0?-8:i%3===1?0:24,
  freeFloatHours:null,percentComplete:i%19===0?null:i%13===0?100:50,
  sourceRefs:[],diagnostics:[],
 }));
 const model:CanonicalScheduleModel={
  projectId:state.projectId,source:'xer',sourceRevisionId:'CURRENT',dataDateIso:'2031-04-01',
  activities,relationships:[],wbs:[{wbsId:'E',name:'Electrical',parentWbsId:null,sourceRefs:[]},
   {wbsId:'M',name:'Mechanical',parentWbsId:null,sourceRefs:[]}],
  calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],diagnostics:[],
 };
 state.schedules.push({role:'update',format:'xer',sourceFilename:'submitted.xer',
  sourceHashSha256:'source-800-activities',uploadedAt:'2031-04-01',
  revision:{revisionId:'CURRENT',label:'Current',sequence:1,effectiveAt:'2031-04-01',model}});
 const workfront=(id:string,discipline:string,site:string,lo:number,hi:number):DeliveryRecord=>{
  const links=emptyLinks();links.activityIds=activities.slice(lo,hi).map(a=>a.activityId);
  links.locationIds=[site];return {
   recordId:id,projectId:state.projectId,kind:'workfront',
   reference:id,description:'Source '+discipline+' workfront',revision:'R1',
   state:'governed',fields:{discipline,status:'open'},links,
   receipts:[],diagnostics:[],sourceActive:true,
  };
 };
 const electrical=workfront('WF-E','Electrical','SITE-E',0,400);
 const mechanical=workfront('WF-M','Mechanical','SITE-M',400,800);
 state.delivery={schemaVersion:1,manual:[electrical,mechanical],decisions:[],populations:[]};
 store.touch(state);
 const before=JSON.stringify({schedules:state.schedules,delivery:state.delivery});
 const result=deliveryPosition(state);
 // A cold management summary must not calculate the specialist workfront
 // breakdown; reading that specialist matrix still returns its complete data.
 const workfrontProperty=Object.getOwnPropertyDescriptor(result,'workfrontMatrix');
 assert.equal(typeof workfrontProperty?.get,'function','source workfront rows remain available as a deferred producer');
 let workfrontConsumerReads=0;
 Object.defineProperty(result,'workfrontMatrix',{
  ...workfrontProperty,configurable:true,enumerable:true,
  get(){workfrontConsumerReads++;return workfrontProperty!.get!.call(result);}
 });
 const management=deliveryDashboard(state);
 assert.equal(management.projectId,state.projectId,'source management summary remains available');
 assert.equal(workfrontConsumerReads,0,'a management summary does not need the full specialist WBS progress population');
 assert.equal(result.workfrontMatrix.length,4);
 const dimension=(type:string,label:string)=>{
  const group=result.workfrontMatrix.find(r=>r.dimension===type&&r.label===label);
  assert.ok(group,'original source scope must remain accessible '+type+':'+label);
  return group;
 };
 const eDiscipline=dimension('discipline','Electrical'),eLocation=dimension('location','SITE-E');
 const mDiscipline=dimension('discipline','Mechanical'),mLocation=dimension('location','SITE-M');
 assert.equal(eDiscipline.activityCount,400);
 assert.equal(mDiscipline.activityCount,400);
 assert.deepEqual(eDiscipline.activityIds,eLocation.activityIds);
 assert.deepEqual(mDiscipline.activityIds,mLocation.activityIds);
 assert.strictEqual(eDiscipline.wbsRows,eLocation.wbsRows,'identical ordered source membership reuses the same complete WBS calculation');
 assert.strictEqual(mDiscipline.wbsRows,mLocation.wbsRows,'second complete source scope is also reusable');
 assert.notStrictEqual(eDiscipline.wbsRows,mDiscipline.wbsRows,'different complete source scopes cannot reuse each other');
 for(const [group,start,end] of [[eDiscipline,0,400],[mLocation,400,800]] as const){
  const expected=buildDeliveryWorkfrontBreakdown({...model,activities:activities.slice(start,end)},{
   baselineModel:null,generatedAt:'2031-04-01T00:00:00Z',
   producerVersion:'source-independent-expected',
   config:projectScheduleControlBasis(state).analysisConfig,
  });
  assert.deepEqual(group.wbsRows,expected.rows,'every source WBS row and unknown/zero position must equal independent producer');
  const overall=expected.overallSummary!;
  assert.ok(overall,'independent full-source summary must be present');
  assert.equal(group.completedActivityCount,overall.completedCount);
  // SW-27: the group total is the independent producer's known-member total;
  // partial coverage is shown as an unknown count, not by blanking the total.
  assert.equal(group.scheduleProgressPercent,overall.durationWeightedProgressPercent);
  assert.equal(group.plannedPercent,overall.currentPlanPercent);
 }
 assert.equal(JSON.stringify({schedules:state.schedules,delivery:state.delivery}),before,
  'shared Delivery calculation may not mutate source files, review decisions or programmes');
});

test('T11 no workfront source does not create a phantom delivery-ready count',t=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-workfront-missing-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false});
 const state=store.getOrCreate('MISSING-WORKFRONT');
 const original=JSON.stringify(state.delivery);
 const result=deliveryPosition(state);
 assert.equal(result.workfrontMatrix.length,0);
 assert.equal(result.populations.workfront?.state,'not_established');
 assert.equal(JSON.stringify(state.delivery),original);
});

test('T11 source-only 900-activity fallback retains every source-classified discipline and location',t=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-source-fallback-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false});
 const state=store.getOrCreate('SOURCE-ONLY-CLASSIFICATION');
 const activities:CanonicalScheduleModel['activities']=Array.from({length:900},(_,i)=>({
  projectId:state.projectId,activityId:'SRC-'+i,nativeId:String(i),
  name:(i%2?'Electrical':'Civil')+' installation Zone '+(i%3+1),
  wbsId:'Z'+(i%3),calendarId:'C',activityType:'task' as const,
  status:i%17===0?'completed' as const:'in_progress' as const,
  baselineStartIso:'2032-01-01',baselineFinishIso:'2032-06-01',
  currentStartIso:'2032-01-01',currentFinishIso:'2032-06-01',
  actualStartIso:null,actualFinishIso:i%17===0?'2032-02-01':null,
  forecastStartIso:null,forecastFinishIso:null,
  originalDurationHours:24,remainingDurationHours:i%17===0?0:12,
  totalFloatHours:i%13===0?null:i%7-3,
  freeFloatHours:null,percentComplete:i%17===0?100:50,
  sourceRefs:[],diagnostics:[],
 }));
 const model:CanonicalScheduleModel={
  projectId:state.projectId,source:'xer',sourceRevisionId:'SUBMITTED',
  dataDateIso:'2032-03-01',activities,relationships:[],
  wbs:Array.from({length:3},(_,i)=>({wbsId:'Z'+i,name:'Workfront Zone '+(i+1),parentWbsId:null,sourceRefs:[]})),
  calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],diagnostics:[],
 };
 state.schedules.push({role:'update',format:'xer',sourceFilename:'source.xer',
  sourceHashSha256:'source-only-900',uploadedAt:'2032-03-01',
  revision:{revisionId:'SUBMITTED',label:'Source submission',sequence:1,effectiveAt:'2032-03-01',model}});
 store.touch(state);
 const retained=JSON.stringify({schedules:state.schedules,delivery:state.delivery,controls:state.controls});
 const source=projectScopeClassification(state,model).rows;
 assert.equal(source.length,activities.length);
 const expected=new Map<string,string[]>();
 for(const dimension of ['discipline','location'] as const)for(const row of source){
  // SW-27: workfront groups follow the shared source groups (activity code,
  // then WBS level for location, then labelled name match), not keywords only.
  const key=dimension+'|'+((dimension==='discipline'?row.disciplineGroup:row.locationGroup)??'Unclassified');
  const list=expected.get(key)??[];list.push(row.activityId);expected.set(key,list);
 }
 const result=deliveryPosition(state);
 assert.equal(result.workfrontMatrix.length,expected.size,'no source-classified dimension omitted');
 for(const group of result.workfrontMatrix){
  const ids=expected.get(group.dimension+'|'+group.label);
  assert.ok(ids,'group comes from source classification only');
  assert.deepEqual(group.activityIds,ids,'full source population and original source order');
  assert.equal(group.activityCount,ids.length,'full group counts, not HTTP previews');
  assert.equal(group.recordIds.length,0,'never invent a workfront register');
  assert.equal(group.authority,'Calculated from programme classifications');
 }
 assert.equal(result.populations.workfront?.state,'not_established','source classification is not population adoption');
 assert.equal(JSON.stringify({schedules:state.schedules,delivery:state.delivery,controls:state.controls}),retained,
  'no source, decision or authority mutation during calculations');
});
