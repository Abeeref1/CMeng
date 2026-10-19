import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {procurementTiming} from '../packages/truth-kernel/src';
import {deriveReadinessFromCsv} from '../packages/runtime-api/src/evidence-readiness';
import {readinessForActivity,type ReadinessDimensionKey,type ReadinessEvidence} from '../packages/lookahead-schedule/src';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';

// SW-18 readiness rules: "Not applicable" is its own state; a date is a blocker
// only when it has passed and the item is not done; a status that contradicts
// its dates is raised as a conflict.
test('SW-18 procurement timing: not applicable is never overdue or late, and pending with a past actual date is a conflict',()=>{
 const base={dataDateIso:'2036-08-31',programmeNeedDate:'2036-08-29',sourceRequiredOnSite:null,forecastDelivery:'2036-09-05',actualDelivery:null};
 const na=procurementTiming({...base,status:'Not applicable'});
 assert.equal(na.notApplicable,true);
 assert.equal(na.overdueUndelivered,false,'a passed need date cannot make a not-applicable package overdue');
 assert.equal(na.forecastLate,false,'a not-applicable package is not late');
 const pending=procurementTiming({...base,forecastDelivery:null,actualDelivery:'2036-08-28',status:'Pending'});
 assert.equal(pending.openStatusDeliveredConflict,true,'pending status with an actual delivery before the Data Date is a conflict');
 assert.equal(pending.deliveredAtDataDate,true,'the dated actual itself is retained');
 const ordered=procurementTiming({...base,status:'Ordered'});
 assert.equal(ordered.overdueUndelivered,true,'passed need date on an open package stays a blocker');
 assert.equal(ordered.openStatusDeliveredConflict,false);
 const delivered=procurementTiming({...base,forecastDelivery:'2036-09-05',status:'Delivered'});
 assert.equal(delivered.deliveryDateConflict,true,'delivered with a future forecast stays a conflict');
});

test('SW-18 register readiness: N/A is its own state, a future forecast is not a blocker, status/date conflicts are raised',()=>{
 const state=loadCertifiedDemoProject('SW18-'+randomUUID()),model=state.schedules.at(-1)!.revision.model;
 model.dataDateIso='2036-08-31';
 model.activities=[{...model.activities[0]!,activityId:'FIRE',activityType:'task',status:'not_started',actualStartIso:null,actualFinishIso:null,currentStartIso:'2036-09-13',currentFinishIso:'2036-09-24',forecastFinishIso:null,totalFloatHours:0}];
 model.relationships=[];
 const document={documentType:'procurement_register',documentId:'PACKAGES'} as any;
 const read=(row:string)=>deriveReadinessFromCsv({state,document,dataDateIso:'2036-08-31',
  bytes:Buffer.from('Package ID,Linked Activity,Required On Site,Forecast Delivery,Actual Delivery,Status\n'+row)}).FIRE!.procurement_material!;
 const na=read('PUMP,FIRE,2036-08-29,,,Not applicable');
 assert.equal(na.state,'not_applicable','a passed date on a not-applicable package is not a blocker or a known state');
 const future=read('PUMP,FIRE,2036-09-10,2036-09-20,,Ordered');
 assert.notEqual(future.state,'blocked','a forecast after a future need date is a risk, not a confirmed blocker');
 assert.ok(future.diagnostics?.includes('PROCUREMENT_FORECAST_AFTER_NEED'));
 const passed=read('PUMP,FIRE,2036-08-29,2036-09-20,,Ordered');
 assert.equal(passed.state,'blocked','a passed need date on an undelivered package remains a blocker');
 const conflict=read('PUMP,FIRE,2036-08-29,,2036-08-28,Pending');
 assert.equal(conflict.state,'unknown','pending status contradicting a dated actual delivery is not ready');
 assert.ok(conflict.diagnostics?.includes('PROCUREMENT_DELIVERY_DATE_CONFLICT'),'the conflict is raised');

 // Not applicable is not counted as ready (known); it is counted separately.
 const keys:ReadinessDimensionKey[]=['procurement_material','design_submittal','permit','resource','quality','commercial','risk','access'];
 const evidence=Object.fromEntries(keys.map(k=>[k,{state:'ready',sourceRefs:['ref:'+k]} satisfies ReadinessEvidence]));
 const activity=model.activities[0]!;
 const readiness=readinessForActivity(model,activity,[],new Map([[activity.activityId,activity]]),evidence);
 assert.equal(readiness.dimensions.find(d=>d.key==='predecessor')!.state,'not_applicable');
 assert.equal(readiness.readyCount,8,'only ready dimensions are counted as ready');
 assert.equal(readiness.notApplicableCount,1);
 assert.equal(readiness.state,'ready');
});
