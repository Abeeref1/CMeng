import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {changeDelivery,deliveryRecords} from '../packages/runtime-api/src/delivery-records';
// Same small programme as tests/delivery-authority.test.ts (copied: importing that file would run its tests here).
const calendar='(0||CalendarData()((0||DaysOfWeek()('+Array.from({length:7},(_,i)=>'(0||'+(i+1)+'()((0||0(s|08:00|f|16:00)())))').join('')+'))(0||Exceptions()())))';
function deliveryProgramme(date='2031-08-31',count=2){return ['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tDELIVERY\t'+date,'%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tWorking calendar\t'+calendar,'%T\tTASK','%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt',...Array.from({length:count},(_,i)=>'%R\t'+(i+1)+'\t1\t1\tA'+(i+1)+'\tEquipment installation '+(i+1)+'\tTK_NotStart\t2031-09-30 08:00\t2031-10-10 16:00\t80\t80\t16'),'%E'].join('\n');}

// P0-A R2 (M3.4) invariant. A Delivery record that states its own reference is
// the same record in every revision of its register. A reviewed decision stays
// in force when a new revision of the register arrives (and after a restart)
// while that record's content is unchanged. It goes stale only for the record
// whose content changed. A repeated reference keeps file-and-row identity.

const header='Package ID,Description,Vendor,Status,Required On Site,Forecast Delivery\n';
const revA=header+'P1,Pump,Acme,Ordered,2031-08-29,2031-09-05\nP2,Cable,Acme,Ordered,2031-09-10,2031-09-09\nP3,Steel,Beta,Ordered,2031-09-10,2031-09-09\n';
// Revision B: same records in a different row order; only P3's forecast changes.
const revB=header+'P3,Steel,Beta,Ordered,2031-09-10,2031-09-20\nP1,Pump,Acme,Ordered,2031-08-29,2031-09-05\nP2,Cable,Acme,Ordered,2031-09-10,2031-09-09\n';

test('M3.4: a reviewed Delivery record keeps its decision through a new register revision and a restart; only a changed record goes stale',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-m34-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate('M34-IDENTITY');
  await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(deliveryProgramme()),mediaType:'text/plain',sourceFilename:'Current.xer',uploadedAt:'2031-09-01',uploadIntent:'replace_current_basis'});
  await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(revA),mediaType:'text/csv',sourceFilename:'Procurement_RevA.csv',uploadedAt:'2031-09-01'});
  const byRef=(s=state)=>new Map(deliveryRecords(s).records.filter(r=>r.kind==='package'&&r.state!=='superseded').map(r=>[r.reference,r]));
  for(const ref of ['P1','P3']){
    const r=byRef().get(ref)!;assert.ok(r,'package '+ref+' not read');
    changeDelivery(state,{expectedVersion:state.version,action:'review',recordId:r.recordId,sourceRevision:r.revision,state:'governed',note:'Checked against the PO register.'});store.touch(state);
  }
  assert.equal(byRef().get('P1')!.state,'governed');assert.equal(byRef().get('P3')!.state,'governed');

  // A new revision of the register replaces the current one.
  await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(revB),mediaType:'text/csv',sourceFilename:'Procurement_RevB.csv',uploadedAt:'2031-09-15',uploadIntent:'replace_current_basis'});
  let current=byRef();
  assert.equal(current.get('P1')!.state,'governed','an unchanged record must keep its decision in the new register revision');
  assert.equal(current.get('P3')!.state,'stale','a record whose content changed must be re-offered for review');
  assert.notEqual(current.get('P2')!.state,'governed','an unreviewed record is not made governed');

  // Restart: the same answer from the stored state.
  const reloaded=new RuntimeProjectStore({dataDir:dir,durable:false}).get(state.projectId)!;
  current=byRef(reloaded);
  assert.equal(current.get('P1')!.state,'governed','after restart');
  assert.equal(current.get('P3')!.state,'stale','after restart');
});

test('M3.4: a reference repeated within a register keeps file-and-row identity (never merged)',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-m34-dup-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate('M34-DUPLICATE');
  await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(deliveryProgramme()),mediaType:'text/plain',sourceFilename:'Current.xer',uploadedAt:'2031-09-01',uploadIntent:'replace_current_basis'});
  await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(header+'P9,Pump,Acme,Ordered,2031-08-29,2031-09-05\nP9,Pump spare,Acme,Ordered,2031-08-29,2031-09-06\n'),mediaType:'text/csv',sourceFilename:'Procurement_Dup.csv',uploadedAt:'2031-09-01'});
  const rows=deliveryRecords(state).records.filter(r=>r.kind==='package'&&r.reference==='P9');
  assert.equal(rows.length,2);assert.notEqual(rows[0]!.recordId,rows[1]!.recordId,'two rows sharing a reference must stay two records');
});
