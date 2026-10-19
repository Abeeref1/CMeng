import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {procurementTiming} from '../packages/truth-kernel/src/procurement-timing';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {deliveryPosition} from '../packages/runtime-api/src/delivery-projections';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

// F14: a delivered / received / completed status with no actual date is delivered
// with the date not stated. It is never counted late and never overdue.
const base={programmeNeedDate:null,sourceRequiredOnSite:'2031-08-10',forecastDelivery:'2031-09-01',actualDelivery:null};

test('F14 received and delivered-to-site statuses are delivery, never late or overdue',()=>{
 for(const status of ['Received','Delivered to Site','Delivered on site','Received on Site','Delivered','Completed']){
  const t=procurementTiming({...base,dataDateIso:'2031-08-31',status});
  assert.equal(t.deliveredStatusOnly,true,status+' is delivered with the date not stated');
  assert.equal(t.forecastLate,false,status+' is never counted late');
  assert.equal(t.overdueUndelivered,false,status+' is never overdue');
 }
 // A part delivery is not a delivery: it stays open and late against its need date.
 const partial=procurementTiming({...base,dataDateIso:'2031-08-31',status:'Partially Delivered'});
 assert.equal(partial.deliveredStatusOnly,false);
 assert.equal(partial.forecastLate,true);
});

test('F14 a delivered status with no actual date is not late when the Data Date is unknown',()=>{
 const t=procurementTiming({...base,dataDateIso:null,status:'Delivered'});
 assert.equal(t.deliveredStatusOnly,true);
 assert.equal(t.forecastLate,false,'the forecast date of a delivered package does not make it late');
 assert.equal(t.overdueUndelivered,false);
 // An open package with the same dates is still screened as late.
 assert.equal(procurementTiming({...base,dataDateIso:null,status:'Ordered'}).forecastLate,true);
});

test('F14 delivery position: received packages are excluded from known late and listed as delivered, date not stated',async t=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-f14-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false}),state=store.getOrCreate('F14-DELIVERED-NO-DATE');
 const model:CanonicalScheduleModel={projectId:state.projectId,source:'xer',sourceRevisionId:'CUR',dataDateIso:'2031-08-31',activities:[],relationships:[],wbs:[],calendars:[],diagnostics:[]};
 state.schedules.push({role:'update',format:'xer',sourceFilename:'Current.xer',sourceHashSha256:'F14',uploadedAt:'2031-08-31',revision:{revisionId:'CUR',label:'Current',sequence:1,effectiveAt:'2031-08-31',model}});
 store.touch(state);
 await store.ingestEvidenceFile({projectId:state.projectId,sourceFilename:'Procurement.csv',mediaType:'text/csv',uploadedAt:'2031-08-31',bytes:Buffer.from('Package ID,Description,Status,Required On Site,Forecast Delivery\nPKG-R1,Switchgear,Received,2031-08-10,2031-08-20\nPKG-R2,Chiller,Delivered to Site,2031-08-10,2031-08-20\nPKG-OPEN,Cables,Ordered,2031-08-10,2031-09-05\n')});
 // Forecasts sit before the Data Date (no status/date conflict) but after the need date.
 const position=deliveryPosition(state),rows=position.packageRows;
 for(const ref of ['PKG-R1','PKG-R2']){
  const row=rows.find(p=>p.reference===ref)!;
  assert.equal(row.deliveredStatusOnly,true,ref);
  assert.equal(row.forecastLate,false,ref);
  assert.equal(row.overdueUndelivered,false,ref);
  assert.equal(row.deliveryTimingBasis,'Delivered, date not stated',ref);
 }
 const open=rows.find(p=>p.reference==='PKG-OPEN')!;
 assert.equal(open.forecastLate,true);
 assert.equal(rows.filter(r=>!r.registerCleanup&&(r.overdueUndelivered||r.forecastLate)).map(r=>r.reference).join(','),'PKG-OPEN');
});
