import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {deliveryRecords} from '../packages/runtime-api/src/delivery-records';
import type {ProjectRuntimeState} from '../packages/runtime-api/src/project-state-types';

// Cold Dashboard cost invariant: a reporting view copies the programme activities
// (to restate their baseline date basis). Delivery records for that copy are the
// same records, so they are reused, not read again from every register row. A copy
// that changes what the activity linker reads (an activity name) is read again.
const calendar='(0||CalendarData()((0||DaysOfWeek()('+Array.from({length:7},(_,i)=>'(0||'+(i+1)+'()((0||0(s|08:00|f|16:00)())))').join('')+'))(0||Exceptions()())))';
const programme=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tCOPY\t2031-08-31','%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tWorking calendar\t'+calendar,'%T\tTASK','%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt','%R\t1\t1\t1\tA1\tPump installation\tTK_NotStart\t2031-09-30 08:00\t2031-10-10 16:00\t80\t80\t16','%R\t2\t1\t1\tA2\tCable pulling\tTK_NotStart\t2031-09-30 08:00\t2031-10-10 16:00\t80\t80\t16','%E'].join('\n');
const register='Package ID,Description,Vendor,Status,Required On Site,Forecast Delivery\nP1,Pump installation,Acme,Ordered,2031-08-29,2031-09-05\nP2,Cable pulling,Acme,Ordered,2031-09-10,2031-09-09\n';

function copyWith(state:ProjectRuntimeState,activity:(a:any)=>any):ProjectRuntimeState{
  return {...state,schedules:state.schedules.map(s=>({...s,revision:{...s.revision,model:{...s.revision.model,activities:s.revision.model.activities.map(a=>activity({...a}))}}}))} as ProjectRuntimeState;
}

test('Delivery records are reused for a value-identical programme copy and read again when the linker input changes',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-copy-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate('COPY-REUSE');
  await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(programme),mediaType:'text/plain',sourceFilename:'Current.xer',uploadedAt:'2031-09-01',uploadIntent:'replace_current_basis'});
  await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(register),mediaType:'text/csv',sourceFilename:'Procurement.csv',uploadedAt:'2031-09-01'});
  const stored=deliveryRecords(state);
  assert.ok(stored.records.some(r=>r.kind==='package'),'packages read');
  const restated=deliveryRecords(copyWith(state,a=>({...a,baselineDateBasis:'restated_for_reporting'})));
  assert.equal(restated,stored,'a copy that only restates the baseline date basis reuses the same Delivery records');
  const renamed=deliveryRecords(copyWith(state,a=>({...a,name:a.name+' (renamed)'})));
  assert.notEqual(renamed,stored,'a copy whose activity names changed is read again');
});
