import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {changeDelivery,deliveryRecords,deliveryStore} from '../packages/runtime-api/src/delivery-records';
import {deliveryModule,deliveryPosition} from '../packages/runtime-api/src/delivery-projections';
import {deliveryScript} from '../packages/runtime-api/src/ui-delivery';
import {projectControlSchedule} from '../packages/runtime-api/src/canonical-time-claims';
import type {DeliveryKind} from '../packages/delivery-core/src/types';

// SW-42 (T08): a procurement package whose linked programme work is all complete must stay listed and counted,
// in its own close-out group, and the groups must add up to the packages on the page.
const calendar='(0||CalendarData()((0||DaysOfWeek()('+Array.from({length:7},(_,i)=>'(0||'+(i+1)+'()((0||0(s|08:00|f|16:00)())))').join('')+'))(0||Exceptions()())))';
const programme=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tDELIVERY\t2031-08-31','%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tWorking calendar\t'+calendar,'%T\tTASK','%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt',...[1,2].map(i=>'%R\t'+i+'\t1\t1\tA'+i+'\tEquipment installation '+i+'\tTK_NotStart\t2031-09-30 08:00\t2031-10-10 16:00\t80\t80\t16'),'%E'].join('\n');

async function fixture(t:any){
 const dir=mkdtempSync(join(tmpdir(),'sw42-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate('SW42-CLOSEOUT');
 await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(programme),mediaType:'text/plain',sourceFilename:'Current.xer',uploadedAt:'2031-09-01',uploadIntent:'replace_current_basis'});
 const change=(input:any)=>{const result=changeDelivery(state,{expectedVersion:state.version,...input});store.touch(state);return result;};
 const create=(kind:DeliveryKind,reference:string,fields:any={},links:any={})=>{
  change({action:'create',kind,fields:{'record reference':reference,description:reference,...fields}});const r=deliveryStore(state).manual.at(-1)!;
  change({action:'review',recordId:r.recordId,sourceRevision:r.revision,state:'governed',fields:{},links,note:'Reviewed source and project applicability.'});
  return deliveryRecords(state).records.find(q=>q.recordId===r.recordId)!;
 };
 return {store,state,create};
}

test('SW-42: packages on finished work stay listed and counted in a "Linked work complete" close-out group',async t=>{
 const f=await fixture(t),model=projectControlSchedule(f.state)!.revision.model;
 model.activities[0]!.status='completed';model.activities[0]!.actualFinishIso='2031-08-01';f.store.touch(f.state);
 f.create('package','DONE-OPEN',{status:'Manufacturing','long lead':'yes','required on site':'2031-08-10','forecast delivery':'2031-09-05'},{activityIds:['A1']});
 f.create('package','DONE-DELIVERED',{status:'Delivered','actual delivery':'2031-08-01'},{activityIds:['A1']});
 f.create('package','LIVE-LATE',{status:'Ordered','required on site':'2031-08-10','forecast delivery':'2031-09-05'},{activityIds:['A2']});
 f.create('package','NO-LINK',{status:'Awarded'});
 const sourcePackages=deliveryRecords(f.state).records.filter(r=>r.kind==='package'&&!['superseded','scenario'].includes(r.state));
 assert.equal(sourcePackages.length,4);

 const data=deliveryModule(f.state,'procurement-packages').data as any;
 const refs=(ids:string[])=>ids.map(id=>data.rows.find((r:any)=>r.recordId===id)?.reference).sort();
 assert.equal(data.rows.length,sourcePackages.length,'every source package is listed on the page');
 const groups=data.packageLinkedWork;
 assert.ok(groups,'the procurement page carries the linked-work groups');
 assert.equal(groups.total,sourcePackages.length,'page total equals the source total');
 assert.equal(groups.groups.reduce((n:number,g:any)=>n+g.count,0),groups.total,'groups add up to the page total');
 const byKey=Object.fromEntries(groups.groups.map((g:any)=>[g.key,g]));
 assert.equal(byKey.completed_work.label,'Linked work complete');
 assert.deepEqual(refs(byKey.completed_work.recordIds),['DONE-DELIVERED','DONE-OPEN']);
 assert.equal(groups.closeoutCount,2);
 assert.deepEqual(groups.closeoutRows.map((r:any)=>r.reference).sort(),['DONE-DELIVERED','DONE-OPEN']);
 assert.deepEqual(refs(byKey.unfinished_work.recordIds),['LIVE-LATE']);
 assert.equal(byKey.links_incomplete.count,0);
 assert.deepEqual(refs(byKey.unlinked.recordIds),['NO-LINK']);
 for(const row of data.rows){
  assert.equal(row.registerCleanup,row.linkedWorkState==='completed_work','one rule drives both the close-out flag and the group');
  assert.equal(row.linkedWorkGroup,groups.groups.find((g:any)=>g.recordIds.includes(row.recordId)).label);
 }

 // Figures for unfinished packages are unchanged: the late count still covers live work only.
 assert.equal(data.metrics.find((m:any)=>m.label==='Late delivery · known subset').value,1);
 assert.equal(data.metrics.find((m:any)=>/packages/i.test(m.label)&&m.unit==='records').value,4);
 const dateExceptions=data.findings.filter((x:any)=>['DELIVERY_AFTER_PROGRAMME_NEED','PACKAGE_REQUIRED_DATE_MISSED'].includes(x.code));
 assert.deepEqual([...new Set(refs(dateExceptions.map((x:any)=>x.recordId)))],['LIVE-LATE'],'close-out packages raise no live programme date exception');

 // The same rule serves every package page.
 for(const key of ['delivery-control','long-lead']){
  const page=deliveryModule(f.state,key).data as any,g=page.packageLinkedWork;
  assert.ok(g,key+' carries the linked-work groups');
  assert.equal(g.total,page.rows.filter((r:any)=>deliveryPosition(f.state).packageRows.some(p=>p.recordId===r.recordId)).length);
  assert.equal(g.groups.reduce((n:number,x:any)=>n+x.count,0),g.total);
 }
 assert.equal((deliveryModule(f.state,'delivery-control').data as any).packageLinkedWork.total,4);
 const longLead=(deliveryModule(f.state,'long-lead').data as any).packageLinkedWork;
 assert.equal(longLead.total,1);assert.equal(longLead.closeoutCount,1,'a finished long-lead package stays on the long-lead page in close-out');

 // The screen gives package rows their group in the State filter, so finished packages are never in "no group".
 const ui=runInNewContext(deliveryScript()+';({state:deliveryRowState({linkedWorkGroup:"Linked work complete"}),kept:deliveryRowState({state:"ready",linkedWorkGroup:"Linked work complete"})})',{Intl});
 assert.equal(ui.state,'Linked work complete');assert.equal(ui.kept,'ready');
});
