import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {changeDelivery,deliveryStore} from '../packages/runtime-api/src/delivery-records';
import {deliveryModule} from '../packages/runtime-api/src/delivery-projections';
import type {DeliveryKind} from '../packages/delivery-core/src/types';

// T08 SW-33, SW-34: one shared rule for Delivery pages. A supplied
// register is the page source; a fallback (programme names,
// generated package pairs) appears only as a labelled candidate and is never
// counted as the established figure.
const calendar='(0||CalendarData()((0||DaysOfWeek()('+Array.from({length:7},(_,i)=>'(0||'+(i+1)+'()((0||0(s|08:00|f|16:00)())))').join('')+'))(0||Exceptions()())))';
const programme=(names:string[])=>['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tDELIVERY\t2031-08-31','%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tWorking calendar\t'+calendar,'%T\tTASK','%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt',...names.map((name,i)=>'%R\t'+(i+1)+'\t1\t1\tA'+(i+1)+'\t'+name+'\tTK_NotStart\t2031-09-30 08:00\t2031-10-10 16:00\t80\t80\t16'),'%E'].join('\n');
async function fixture(t:any,names=['Equipment installation 1','Equipment installation 2']){
 const dir=mkdtempSync(join(tmpdir(),'t08-register-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate('T08-REGISTER');
 const upload=(name:string,content:string,uploadIntent?:'replace_current_basis')=>store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(content),mediaType:name.endsWith('.xer')?'text/plain':'text/csv',sourceFilename:name,uploadedAt:'2031-09-01',...(uploadIntent?{uploadIntent}:{})});
 await upload('Current.xer',programme(names),'replace_current_basis');
 const change=(input:any)=>{const result=changeDelivery(state,{expectedVersion:state.version,...input});store.touch(state);return result;};
 const create=(kind:DeliveryKind,reference:string,fields:any={},links:any={})=>{change({action:'create',kind,fields:{'record reference':reference,description:reference,...fields}});const r=deliveryStore(state).manual.at(-1)!;change({action:'review',recordId:r.recordId,sourceRevision:r.revision,state:'governed',fields:{},links,note:'Reviewed source and project applicability.'});};
 const population=(kind:DeliveryKind)=>change({action:'confirm_population',kind,scopeId:null,note:'Complete source register and applicable obligations reconciled.'});
 return {store,state,upload,create,population};
}

test('SW-33: Handover Readiness uses the supplied asset register; programme names are only the labelled fallback without one',async t=>{
 const f=await fixture(t,['Equipment installation 1','Equipment installation 2','Building handover']);
 let page:any=deliveryModule(f.state,'handover-readiness').data;
 assert.equal(page.programmeFallback,true,'no register: the programme name selection is the labelled fallback');
 assert.match(page.rows[0].authority,/Programme progress/);
 f.create('asset','AS-1',{system:'HVAC','taking over date':'2031-08-20'});
 f.create('asset','AS-2',{system:'HVAC'});
 page=deliveryModule(f.state,'handover-readiness').data;
 assert.notEqual(page.programmeFallback,true,'an asset register replaces the programme-name fallback');
 assert.deepEqual(page.rows.map((r:any)=>r.reference),['AS-1','AS-2']);
 assert.equal(page.rows.some((r:any)=>r.activityId),false,'no programme activity row is shown as a handover item');
 assert.equal(page.metrics.find((m:any)=>m.label==='Assets from register').value,2);
 assert.equal(page.metrics.find((m:any)=>m.label==='Taken over · known subset').value,1);
 assert.equal(page.metrics.find((m:any)=>m.label==='Handover readiness').value,null,'readiness stays unknown without the handover requirement population');
 assert.equal(page.metrics.some((m:any)=>m.label==='Programme tasks'),false);
 assert.match(page.managementPosition,/asset register/);
});

test('SW-34: generated package pairs stay labelled candidates and are never counted as interfaces',async t=>{
 const f=await fixture(t);
 f.create('interface','IF-1',{'current status':'Open','required date':'2031-09-20'},{activityIds:['A1']});
 f.create('package','P1',{},{activityIds:['A2']});f.create('package','P2',{},{activityIds:['A2']});
 f.population('interface');
 const data:any=deliveryModule(f.state,'delivery-interfaces').data;
 const pair=data.rows.find((r:any)=>String(r.interfaceId).startsWith('candidate:'));
 assert.ok(pair,'the package pair remains visible for review');assert.equal(pair.authority,'candidate');assert.match(pair.currentStatus,/Candidate interface/);
 assert.equal(data.candidateCount,1);assert.equal(data.knownCount,1);assert.equal(data.openCount,1);
 assert.equal(data.knownLinkedActivityCount,1,'only the register interface link counts; the package-pair activity A2 does not');
 assert.equal(data.linkedActivityCount,1);
});
