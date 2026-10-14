import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {lookAheadReadinessWithProcurement} from '../packages/runtime-api/src/project-projections';
import {deliveryPosition} from '../packages/runtime-api/src/delivery-projections';
import {emptyLinks} from '../packages/delivery-core/src/types';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
import type {DeliveryRecord} from '../packages/delivery-core/src/types';

test('T11 unrelated source package cannot trigger full driving-path procurement readiness',t=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-unlinked-procurement-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false});
 const state=store.getOrCreate('PROC-UNLINKED');
 const originalBlocked={state:'blocked' as const,sourceRefs:['source:prior'],note:'Established blocker from an unrelated source'};
 state.controls.readinessEvidence={DRIVE:{procurement_material:originalBlocked}};
 const links=emptyLinks();links.activityIds=['OTHER'];
 const packageRecord:DeliveryRecord={recordId:'P1',projectId:state.projectId,kind:'package',
  reference:'P1',description:'Unrelated current source package',revision:'r1',
  state:'governed',fields:{status:'Ordered','required on site':'2031-08-01',
   'forecast delivery':'2031-09-01'},links,receipts:[],diagnostics:[],sourceActive:true};
 state.delivery={schemaVersion:1,manual:[packageRecord],decisions:[],populations:[]};
 store.touch(state);
 const originalSource=JSON.stringify(state.delivery);
 const originalEvidence=state.controls.readinessEvidence;
 const result=lookAheadReadinessWithProcurement(state,['DRIVE']);
 assert.strictEqual(result,originalEvidence,'no package links a driving activity: retained evidence must remain exact');
 assert.deepEqual(result.DRIVE?.procurement_material,originalBlocked);
 assert.equal(JSON.stringify(state.delivery),originalSource,'all original source records and decisions remain unchanged');
});

test('T05 F12 source-linked blockers preserve an unknown owner and subsequently supplied named owner',t=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-linked-procurement-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false});
 const state=store.getOrCreate('PROC-LINKED');
 const activity={projectId:state.projectId,activityId:'DRIVE',nativeId:'1',name:'Install equipment',
  wbsId:'W1',calendarId:'C',activityType:'task' as const,status:'not_started' as const,
  baselineStartIso:'2031-08-01',baselineFinishIso:'2031-09-05',
  currentStartIso:'2031-08-01',currentFinishIso:'2031-09-05',
  actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
  originalDurationHours:24,remainingDurationHours:24,totalFloatHours:0,
  freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]};
 const model:CanonicalScheduleModel={projectId:state.projectId,source:'xer',sourceRevisionId:'CURRENT',
  dataDateIso:'2031-08-31',activities:[activity],relationships:[],
  wbs:[{wbsId:'W1',name:'Work',parentWbsId:null,sourceRefs:[]}],
  calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],diagnostics:[]};
 state.schedules.push({role:'update',format:'xer',sourceFilename:'current.xer',
  sourceHashSha256:'current',uploadedAt:'2031-08-31',
  revision:{revisionId:'CURRENT',label:'Current',sequence:1,effectiveAt:'2031-08-31',model}});
 const links=emptyLinks();links.activityIds=['DRIVE'];
 const pkg:DeliveryRecord={recordId:'PKG1',projectId:state.projectId,kind:'package',
  reference:'PKG-001',description:'Required equipment',revision:'r1',state:'governed',
  fields:{status:'Ordered','required on site':'2031-08-01','forecast delivery':'2031-09-30'},
  links,receipts:[],diagnostics:[],sourceActive:true};
 state.delivery={schemaVersion:1,manual:[pkg],decisions:[],populations:[]};
 store.touch(state);
 const originalProgramme=JSON.stringify(state.schedules);
 const position=deliveryPosition(state).packageRows.find(row=>row.recordId==='PKG1');
 assert.equal(position?.drivingBlockerScenario,true,'unresolved sourced delivery on a driving path remains a blocker');
 const withoutOwner=lookAheadReadinessWithProcurement(state,['DRIVE']).DRIVE?.procurement_material;
 assert.equal(withoutOwner?.state,'blocked');
 assert.equal(withoutOwner.records?.find(r=>r.recordId==='PKG1')?.owner,null,'unknown owner may not be fabricated');
 assert.equal(withoutOwner.records?.find(r=>r.recordId==='PKG1')?.dueIso,'2031-08-01');
 pkg.fields.owner='Procurement Lead';
 store.touch(state);
 const withOwner=lookAheadReadinessWithProcurement(state,['DRIVE']).DRIVE?.procurement_material;
 assert.equal(withOwner?.records?.find(r=>r.recordId==='PKG1')?.owner,'Procurement Lead');
 assert.equal(JSON.stringify(state.schedules),originalProgramme,'the original programme must not be modified by readiness');
});

test('T11 stale/superseded/ambiguous package links never establish a current driving blocker or erase retained evidence',t=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-source-package-authority-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false});
 const state=store.getOrCreate('PROC-HISTORICAL-AUTHORITY');
 const retained={state:'blocked' as const,sourceRefs:['source:already-reviewed'],note:'Existing user-reviewed readiness must remain'};
 state.controls.readinessEvidence={DRIVE:{procurement_material:retained}};
 const recorded=state.controls.readinessEvidence;
 const statuses=['stale','superseded','conflicted'] as const;
 const packages:DeliveryRecord[]=statuses.map((status,i)=>{
  const links=emptyLinks();links.activityIds=['DRIVE'];
  return {recordId:'PKG-'+i,projectId:state.projectId,kind:'package',
   reference:'REFERENCE-'+i,description:'Retained historical package '+i,revision:'R-'+i,
   state:status,fields:{status:'Ordered','forecast delivery':'2031-12-01',
    'required on site':'2031-01-01'},links,receipts:[],diagnostics:[],sourceActive:status==='conflicted'};
 });
 state.delivery={schemaVersion:1,manual:packages,decisions:[],populations:[]};
 store.touch(state);
 const originalSource=JSON.stringify(state.delivery);
 const found=lookAheadReadinessWithProcurement(state,['DRIVE']);
 assert.strictEqual(found,recorded,'only current package authority can change a driving path');
 assert.deepEqual(found.DRIVE?.procurement_material,retained);
 assert.equal(JSON.stringify(state.delivery),originalSource,'retained historical packages never deleted or promoted');
});
