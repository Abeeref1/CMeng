import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {deliveryPosition} from '../packages/runtime-api/src/delivery-projections';
import {crossDomainAccountability} from '../packages/runtime-api/src/accountability-intelligence';
import {activityFloatReconciliation} from '../packages/runtime-api/src/activity-float-reconciliation';
import {DEFAULT_SCHEDULE_ANALYSIS_CONFIG} from '../packages/schedule-analysis-core/src';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

test('R1 delivered source status does not raise false late-package action; open delivery still does',async t=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-procurement-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false}),state=store.getOrCreate('R1-SHARED-LATE');
 const model:CanonicalScheduleModel={projectId:state.projectId,source:'xer',sourceRevisionId:'CUR',dataDateIso:'2031-08-31',activities:[],relationships:[],wbs:[],calendars:[],diagnostics:[]};
 state.schedules.push({role:'update',format:'xer',sourceFilename:'Current.xer',sourceHashSha256:'R1',uploadedAt:'2031-08-31',revision:{revisionId:'CUR',label:'Current',sequence:1,effectiveAt:'2031-08-31',model}});
 store.touch(state);
 await store.ingestEvidenceFile({projectId:state.projectId,sourceFilename:'Procurement.csv',mediaType:'text/csv',uploadedAt:'2031-08-31',bytes:Buffer.from('Package ID,Description,Status,Required On Site,Forecast Delivery\nPKG-0073,Switchgear,Delivered,2031-08-10,2031-09-01\nPKG-OPEN,Cables,Ordered,2031-08-10,2031-09-01')});
 const packages=deliveryPosition(state).packageRows,delivered=packages.find(p=>p.reference==='PKG-0073')!,open=packages.find(p=>p.reference==='PKG-OPEN')!;
 assert.equal(delivered.deliveredStatusOnly,true);
 assert.equal(delivered.actualDelivery,null);
 assert.equal(delivered.forecastLate,false);
 assert.equal(open.forecastLate,true);
 const actions=crossDomainAccountability(state).recordActions;
 assert.ok(!actions.some(a=>a.recordKey==='procurement|pkg-0073'));
 assert.ok(actions.some(a=>a.recordKey==='procurement|pkg-open'));
 assert.equal(packages.length,2);
});

test('R5 two-hour numerical offset with unchanged criticality is not called a dispute',()=>{
 const activities=Array.from({length:12},(_,i)=>({projectId:'FLOAT-BASIS',activityId:'A'+i,nativeId:null,name:'Task '+i,wbsId:null,calendarId:'C',activityType:'task' as const,status:'not_started' as const,baselineStartIso:null,baselineFinishIso:null,currentStartIso:null,currentFinishIso:null,actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:8,remainingDurationHours:8,totalFloatHours:10,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]}));
 const model:CanonicalScheduleModel={projectId:'FLOAT-BASIS',source:'xer',sourceRevisionId:'CUR',dataDateIso:'2031-08-31',activities,relationships:[],wbs:[],calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],diagnostics:[]};
 const projection:any={complete:true,origin:'deterministic_source_calendar',sourceRevisionId:'CUR',activities:activities.map(a=>({activityId:a.activityId,status:'calculated',calendarMode:'source_calendar',independentTotalFloatHours:8}))};
 const r=activityFloatReconciliation(model,projection,DEFAULT_SCHEDULE_ANALYSIS_CONFIG);
 assert.equal(r.summary.differenceActivityCount,12);
 assert.equal(r.summary.disputedActivityCount,0);
 assert.equal(r.summary.numericDifferenceActivityCount,12);
 assert.equal(r.summary.commonOffsetHours,-2);
 assert.ok(r.summary.rows.every(row=>row.floatReviewLabel.includes('classification unchanged')));
 assert.ok(r.summary.rows.every(row=>row.floatDifferenceHours===-2));
 assert.equal(model.activities[0]?.totalFloatHours,10);
});
