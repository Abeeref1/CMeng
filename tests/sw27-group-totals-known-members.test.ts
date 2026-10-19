import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {deliveryPosition} from '../packages/runtime-api/src/delivery-projections';
import {scheduleScopeClassification,scopeClassificationGroups} from '../packages/runtime-api/src/schedule-scope-classification';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

// SW-27: one activity with an unknown plan/progress value must not blank its
// group. The group total uses its known members and the unknown count is shown
// beside it; activities that match no group are an explicit counted bucket.
test('SW-27 group totals use known members, count unknowns, and count Not grouped activities',t=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-sw27-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false});
 const state=store.getOrCreate('SW27-GROUP-TOTALS');
 const activities:CanonicalScheduleModel['activities']=Array.from({length:10},(_,i)=>({
  projectId:state.projectId,activityId:'ACT-'+i,nativeId:String(i),name:'Work '+i,
  // ACT-9 has no resolvable calendar (plan unknown) and no percent complete.
  wbsId:'E',calendarId:i===9?'MISSING':'C',activityType:'task' as const,status:'in_progress' as const,
  baselineStartIso:'2031-01-01',baselineFinishIso:'2031-08-01',currentStartIso:'2031-01-01',currentFinishIso:'2031-08-01',
  actualStartIso:'2031-01-01',actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
  originalDurationHours:40,remainingDurationHours:20,totalFloatHours:24,freeFloatHours:null,
  percentComplete:i===9?null:50,sourceRefs:[],diagnostics:[],
 }));
 const model:CanonicalScheduleModel={projectId:state.projectId,source:'xer',sourceRevisionId:'CURRENT',dataDateIso:'2031-04-01',
  activities,relationships:[],wbs:[{wbsId:'E',name:'Electrical',parentWbsId:null,sourceRefs:[]}],
  calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],diagnostics:[]};
 state.schedules.push({role:'update',format:'xer',sourceFilename:'submitted.xer',sourceHashSha256:'sw27-source',uploadedAt:'2031-04-01',
  revision:{revisionId:'CURRENT',label:'Current',sequence:1,effectiveAt:'2031-04-01',model}});
 store.touch(state);
 const before=JSON.stringify(state.schedules);
 const matrix=deliveryPosition(state).workfrontMatrix as any[];
 const electrical=matrix.find(row=>row.dimension==='discipline'&&row.label==='Electrical');
 assert.ok(electrical,'discipline group present');
 assert.equal(electrical.activityCount,10,'every member stays in the group');
 // 90 of 212 elapsed days on the 9 known members; ACT-9 is counted, not zeroed.
 assert.equal(electrical.plannedPercent,Number((90/212*100).toFixed(6)),'one unknown member does not blank the planned total');
 assert.equal(electrical.plannedUnknownActivityCount,1);
 assert.equal(electrical.scheduleProgressPercent,50,'progress total from known members');
 assert.equal(electrical.scheduleProgressUnknownActivityCount,1);
 assert.equal(electrical.eligibleActivityCount,10);
 assert.equal(electrical.variancePercentagePoints,null,'variance stays withheld while plan and progress populations differ');
 const ungrouped=matrix.find(row=>row.dimension==='location');
 assert.equal(ungrouped?.activityCount,10,'activities without a location stay in a counted bucket');
 const groups=scopeClassificationGroups(scheduleScopeClassification(model)) as any;
 assert.deepEqual(groups.zone.notGrouped,{label:'Not grouped',activityCount:10});
 assert.deepEqual(groups.discipline.notGrouped,{label:'Not grouped',activityCount:0});
 assert.equal(groups.discipline.rows[0].activityCount+groups.discipline.notGrouped.activityCount,10,'grouped plus Not grouped is the full population');
 assert.equal(JSON.stringify(state.schedules),before,'source programme unchanged');
});
