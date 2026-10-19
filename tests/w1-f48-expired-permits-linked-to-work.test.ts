import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {deliveryPosition} from '../packages/runtime-api/src/delivery-projections';
import type {CanonicalScheduleModel,CanonicalActivityStatus} from '../packages/schedule-analysis-core/src';

// F48: each expired permit is linked to the open or finished work it covers. A permit
// with no stated activity is linked through the register only by an exact single match
// (one record citing the permit reference, else one workfront in the same area).
const activity=(activityId:string,status:CanonicalActivityStatus)=>({projectId:'F48',activityId,nativeId:null,name:activityId,wbsId:null,calendarId:'C',activityType:'task' as const,status,baselineStartIso:null,baselineFinishIso:null,currentStartIso:'2031-07-01',currentFinishIso:'2031-10-01',actualStartIso:status==='not_started'?null:'2031-07-01',actualFinishIso:status==='completed'?'2031-08-01':null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:80,remainingDurationHours:status==='completed'?0:40,totalFloatHours:10,freeFloatHours:null,percentComplete:status==='completed'?100:50,sourceRefs:[],diagnostics:[]});

test('F48 expired permits link to open or finished work by single register match; open work is raised, finished work is not',async t=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-f48-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false}),state=store.getOrCreate('F48-PERMITS');
 const model:CanonicalScheduleModel={projectId:state.projectId,source:'xer',sourceRevisionId:'CUR',dataDateIso:'2031-08-31',activities:[activity('ACT-OPEN','in_progress'),activity('ACT-DONE','completed'),activity('ACT-C1','in_progress'),activity('ACT-C2','completed')] as any,relationships:[],wbs:[],calendars:[],diagnostics:[]};
 state.schedules.push({role:'update',format:'xer',sourceFilename:'Current.xer',sourceHashSha256:'F48',uploadedAt:'2031-08-31',revision:{revisionId:'CUR',label:'Current',sequence:1,effectiveAt:'2031-08-31',model}});
 store.touch(state);
 const upload=(name:string,csv:string)=>store.ingestEvidenceFile({projectId:state.projectId,sourceFilename:name,mediaType:'text/csv',uploadedAt:'2031-08-31',bytes:Buffer.from(csv)});
 await upload('Permits.csv','Permit ID,Permit Type,Issue Date,Expiry Date,Area,Linked Activity\n'+
  'P-REF,Hot work,2031-06-01,2031-08-15,,\n'+
  'P-AREA,Work at height,2031-06-01,2031-08-15,Zone B,\n'+
  'P-AMBIG,Confined space,2031-06-01,2031-08-15,Zone C,\n'+
  'P-STATED,Excavation,2031-06-01,2031-08-15,,ACT-DONE\n'+
  'P-NONE,Lifting,2031-06-01,2031-08-15,Zone Z,\n');
 await upload('Workfronts.csv','Delivery Record Type,Workfront ID,Description,Area,Permit ID,Linked Activity\n'+
  'workfront,WF-1,Level 3 welding,Zone A,P-REF,ACT-OPEN\n'+
  'workfront,WF-2,Roof works,Zone B,,ACT-DONE\n'+
  'workfront,WF-3,Tank entry north,Zone C,,ACT-C1\n'+
  'workfront,WF-4,Tank entry south,Zone C,,ACT-C2\n');
 const position=deliveryPosition(state),rows=position.permitRows,row=(ref:string)=>rows.find(r=>r.reference===ref)!;
 assert.equal(rows.length,5);
 assert.ok(rows.every(r=>r.permitStatus==='expired'));
 // By permit reference: exactly one workfront cites P-REF, and its work is open.
 assert.equal(row('P-REF').workLinkBasis,'permit_reference');
 assert.deepEqual(row('P-REF').workLinkActivityIds,['ACT-OPEN']);
 assert.equal(row('P-REF').affectsOpenWork,true);
 // By area: exactly one workfront in Zone B, and its work is finished.
 assert.equal(row('P-AREA').workLinkBasis,'area');
 assert.equal(row('P-AREA').affectsOpenWork,false);
 // Two workfronts share Zone C: no link is guessed.
 assert.equal(row('P-AMBIG').workLinkBasis,'not_linked');
 assert.equal(row('P-AMBIG').affectsOpenWork,null);
 assert.match(row('P-AMBIG').workLinkNote??'',/2 workfronts share this area/);
 // A stated activity link is used as stated.
 assert.equal(row('P-STATED').workLinkBasis,'stated_activity');
 assert.equal(row('P-STATED').affectsOpenWork,false);
 assert.equal(row('P-NONE').workLinkBasis,'not_linked');
 assert.equal(row('P-NONE').affectsOpenWork,null);
 const raised=position.findings.filter(f=>f.code==='PERMIT_EXPIRED_OPEN_WORK').map(f=>rows.find(r=>r.recordId===f.recordId)?.reference).sort();
 assert.deepEqual(raised,['P-REF'],'only the expired permit on open work is raised');
});
