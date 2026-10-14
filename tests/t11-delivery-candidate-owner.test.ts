import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {deliveryPosition} from '../packages/runtime-api/src/delivery-projections';
import {emptyLinks,type DeliveryRecord} from '../packages/delivery-core/src/types';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

// Shared-source regressions: no project answers or owners are supplied by the
// projection, and a candidate-only BOQ remains visible without promotion.
test('T11 Delivery skips unconsumable candidate BOQ mapping without losing source quantities',t=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-delivery-pending-boq-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false});
 const state=store.getOrCreate('TEST-SOURCE-BOQ');
 const activity={projectId:state.projectId,activityId:'A-1',nativeId:'1',
  name:'Install pipe',wbsId:'W',calendarId:'C',
  activityType:'task' as const,status:'not_started' as const,
  baselineStartIso:'2031-01-01',baselineFinishIso:'2031-03-01',
  currentStartIso:'2031-01-01',currentFinishIso:'2031-03-01',
  actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
  originalDurationHours:24,remainingDurationHours:24,totalFloatHours:0,
  freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]};
 const model:CanonicalScheduleModel={projectId:state.projectId,source:'xer',sourceRevisionId:'CURRENT',
  dataDateIso:'2031-02-01',activities:[activity],relationships:[],
  wbs:[{wbsId:'W',name:'Pipework',parentWbsId:null,sourceRefs:[]}],
  calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],diagnostics:[]};
 state.schedules.push({role:'update',format:'xer',sourceFilename:'submitted.xer',
  sourceHashSha256:'submitted',uploadedAt:'2031-02-01',
  revision:{revisionId:'CURRENT',label:'Submitted',sequence:1,effectiveAt:'2031-02-01',model}});
 state.quantities={projectId:state.projectId,boqRevisionId:'BOQ-CANDIDATE',
  scheduleRevisionId:'CURRENT',items:[{quantityItemId:'BOQ-1',itemNumber:'B.1',
   section:'Pipework',description:'Install pipe',unit:'m',contractQuantity:20,
   sourceRefs:[],diagnostics:[]}],allocations:[],installedSnapshots:[],diagnostics:[]};
 store.touch(state);
 const sourceBefore=JSON.stringify(state.quantities);
 const position=deliveryPosition(state);
 assert.equal(position.boqIntelligence.itemCount,null,'candidate-only BOQ cannot become adopted');
 assert.deepEqual(position.boqIntelligence.rows,[],'unadopted BOQ values remain outside governed BOQ totals');
 const item=position.itemMaterialRows.find(row=>row.recordId==='boq-item:BOQ-1');
 assert.equal(item?.required,20,'source BOQ quantity remains available at item level');
 assert.equal(item?.installed,null,'an unknown installed quantity must never be zero');
 assert.equal(JSON.stringify(state.quantities),sourceBefore,'source and recorded links stay immutable');
});

test('T08/T09 permits preserve missing accountable owner until sourced',t=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-permit-owner-source-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false});
 const state=store.getOrCreate('TEST-PERMIT-SOURCE');
 const permit:DeliveryRecord={recordId:'PERMIT-1',projectId:state.projectId,
  kind:'permit',reference:'WORK-PERMIT',description:'Permit required for site work',
  revision:'rev1',state:'governed',fields:{status:'open',owner:''},
  links:emptyLinks(),receipts:[],diagnostics:[],sourceActive:true};
 state.delivery={schemaVersion:1,manual:[permit],decisions:[],populations:[]};
 store.touch(state);
 const original=JSON.stringify(state.delivery);
 const missing=deliveryPosition(state).permitRows.find(row=>row.recordId===permit.recordId);
 assert.equal(missing?.owner,null,'an unassigned permit may not invent a management role');
 assert.equal(JSON.stringify(state.delivery),original,'reading must not change original permit evidence');
 permit.fields.owner='Permit Control Lead';
 store.touch(state);
 const sourced=deliveryPosition(state).permitRows.find(row=>row.recordId===permit.recordId);
 assert.equal(sourced?.owner,'Permit Control Lead','source-supplied owner must become visible');
 assert.equal(permit.fields.owner,'Permit Control Lead');
});
