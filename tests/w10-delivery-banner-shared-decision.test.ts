import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {changeDelivery,deliveryStore} from '../packages/runtime-api/src/delivery-records';
import {deliveryModule} from '../packages/runtime-api/src/delivery-projections';

// SW-38 / W10: a banner never says something is waiting after it is done.
// The Delivery page banner (managementPosition), its "Awaiting confirmation"
// count and its ready state must follow the shared population decision, not the
// per-record review flag that a register row keeps after the register is confirmed.

const calendar='(0||CalendarData()((0||DaysOfWeek()('+Array.from({length:7},(_,i)=>'(0||'+(i+1)+'()((0||0(s|08:00|f|16:00)())))').join('')+'))(0||Exceptions()())))';
const programme=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tDELIVERY\t2031-08-31','%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tWorking calendar\t'+calendar,'%T\tTASK','%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt','%R\t1\t1\t1\tA1\tEquipment installation 1\tTK_NotStart\t2031-09-30 08:00\t2031-10-10 16:00\t80\t80\t16','%E'].join('\n');

async function project(t:any){
 const dir=mkdtempSync(join(tmpdir(),'w10-banner-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate('W10-BANNER');
 await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(programme),mediaType:'text/plain',sourceFilename:'Current.xer',uploadedAt:'2031-09-01',uploadIntent:'replace_current_basis'});
 await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from('RFI ID,Subject,Discipline,Status,Raised Date,Due Date\nR1,Drawing,ARCH,Open,2031-08-01,2031-09-10\nR2,Detail,MEP,Closed,2031-07-01,2031-07-20'),mediaType:'text/csv',sourceFilename:'RFI.csv',uploadedAt:'2031-09-01'});
 const change=(input:any)=>{const result=changeDelivery(state,{expectedVersion:state.version,...input});store.touch(state);return result;};
 return {state,change};
}
const page=(state:any)=>{const result=deliveryModule(state,'delivery-design');return {status:result.status,data:result.data as any};};
const awaiting=(data:any)=>data.metrics.find((m:any)=>m.label==='Awaiting confirmation')?.value;
const WAITING=/await confirmation|still need confirmation|awaiting confirmation/i;

test('W10: confirming the register removes the "awaiting confirmation" banner and count',async t=>{
 const {state,change}=await project(t);
 let {data}=page(state);
 assert.equal(data.reviewRecords.length,2);
 assert.ok(data.reviewRecords.every((r:any)=>r.state==='extracted_candidate'),'source rows stay source candidates');
 assert.equal(data.population.state,'not_established');
 assert.match(data.managementPosition,WAITING,'before the decision the register really waits for confirmation');
 assert.equal(awaiting(data),2);

 change({action:'confirm_population',kind:'design',scopeId:null,note:'Complete RFI register reconciled.'});
 ({data}=page(state));
 assert.equal(data.population.state,'established','the shared decision is recorded');
 assert.ok(data.reviewRecords.every((r:any)=>r.state==='extracted_candidate'),'the per-record flag is unchanged by the population decision');
 assert.doesNotMatch(data.managementPosition,WAITING,'banner must not say records await confirmation after the register is confirmed');
 assert.equal(awaiting(data),0,'nothing is awaiting confirmation');
});

test('W10: a record that really waits keeps the banner after an earlier confirmation',async t=>{
 const {state,change}=await project(t);
 change({action:'confirm_population',kind:'design',scopeId:null,note:'Complete RFI register reconciled.'});
 assert.doesNotMatch(page(state).data.managementPosition,WAITING);
 // A new record typed in but not reviewed is a real pending item.
 change({action:'create',kind:'design',fields:{'record reference':'R3',description:'New query',status:'Open','raised date':'2031-08-15'}});
 const draft=deliveryStore(state).manual.at(-1)!;
 assert.equal(draft.state,'working');
 const {data,status}=page(state);
 assert.equal(data.population.state,'not_established','the earlier decision no longer covers the register');
 assert.match(data.managementPosition,WAITING,'banner stays while something is pending');
 assert.notEqual(status,'ready');
 assert.equal(awaiting(data),2,'the two unconfirmed source rows are counted; the draft is pending its own review');
});
