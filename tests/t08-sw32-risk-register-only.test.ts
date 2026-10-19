import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {deliveryModule} from '../packages/runtime-api/src/delivery-projections';

// T08 SW-32: the Delivery Risks page never builds its risk list, counts or
// position from BOQ wording. Without read risk records the position is unknown
// (null with a reason); BOQ items appear only as labelled candidates, never counted.
const calendar='(0||CalendarData()((0||DaysOfWeek()('+Array.from({length:7},(_,i)=>'(0||'+(i+1)+'()((0||0(s|08:00|f|16:00)())))').join('')+'))(0||Exceptions()())))';
const programme=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tDELIVERY\t2031-08-31','%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tWorking calendar\t'+calendar,'%T\tTASK','%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt','%R\t1\t1\t1\tA1\tEquipment installation 1\tTK_NotStart\t2031-09-30 08:00\t2031-10-10 16:00\t80\t80\t16','%E'].join('\n');
const boq='Item No,Description,Unit,Quantity,Rate,Amount,Currency\nM1,MV Switchgear,No.,4,100000,400000,SAR\nM2,Chillers,No.,2,250000,500000,SAR\nM3,Concrete foundations,m3,1200,300,360000,SAR';
const BOQ_GROUP='Candidates from BOQ wording, not risks';
async function fixture(t:any){
 const dir=mkdtempSync(join(tmpdir(),'t08-sw32-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate('T08-SW32');
 const upload=(name:string,content:string,mediaType='text/csv',uploadIntent?:'replace_current_basis')=>store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(content),mediaType,sourceFilename:name,uploadedAt:'2031-09-01',...(uploadIntent?{uploadIntent}:{})});
 await upload('Current.xer',programme,'text/plain','replace_current_basis');
 return {state,upload};
}
const page=(state:any)=>{const result=deliveryModule(state,'delivery-risks');return {result,data:result.data as any};};
const metric=(data:any,label:string)=>data.metrics.find((m:any)=>m.label===label);

test('SW-32: with no risk register the risk position and counts are unknown; BOQ wording is a labelled candidate list that is never counted',async t=>{
 const f=await fixture(t);await f.upload('BOQ.csv',boq,'text/csv','replace_current_basis');
 const {result,data}=page(f.state);
 assert.equal(data.boqDerivedCandidate,false,'BOQ wording never becomes the risk list');
 assert.equal(data.rows.length,0);
 assert.ok(data.metrics.length>0);
 for(const m of data.metrics){assert.equal(m.value,null,m.label+' stays unknown, never 0');assert.match(m.basis,/No risk register read/);}
 assert.equal(data.metrics.some((m:any)=>/BOQ/i.test(m.label)),false,'no BOQ candidate count is shown as a risk figure');
 assert.equal(data.population.knownRecordCount,null);assert.equal(data.population.denominator,null);
 assert.equal(result.status,'blocked','nothing read: no risk position to show');
 assert.match(data.managementPosition,/^No risk register read\./);assert.match(String(result.reason),/risk population, counts and position are unknown/);
 const candidates=(data.derivedRiskCandidates??[]).filter((r:any)=>r.candidateGroup===BOQ_GROUP);
 assert.ok(candidates.length>0,'BOQ-derived items stay visible in their own labelled list');
 assert.ok(candidates.every((r:any)=>r.status==='Candidate'&&/not a risk/.test(r.currentStatus)));
});

test('SW-32: a risk register uploaded but not read is flagged and the position stays unknown',async t=>{
 const f=await fixture(t);
 await f.upload('Risk Register.txt','Project risk register. The register table will be issued by the contractor.','text/plain');
 const {result,data}=page(f.state);
 assert.equal(result.status,'partial','the unread upload is shown, not an empty page');assert.equal(data.empty,false);
 assert.match(data.managementPosition,/^Risk register uploaded but not read: 1 risk source document\(s\) produced no risk records\./);
 assert.equal(data.rows.length,0);
 for(const m of data.metrics){assert.equal(m.value,null,m.label);assert.match(m.basis,/Risk register uploaded but not read/);}
 assert.equal(data.population.knownRecordCount,null);
});

test('SW-32: a read risk register is the risk list; BOQ candidates stay separate',async t=>{
 const f=await fixture(t);await f.upload('BOQ.csv',boq,'text/csv','replace_current_basis');
 await f.upload('Risk.csv','Risk ID,Description,Status,Identified Date,Probability,Impact,Rating\nR1,Current risk,Open,2031-08-01,0.4,3,Medium\nR2,Future risk,Open,2031-09-10,0.2,2,Low');
 const {data}=page(f.state);
 assert.equal(data.boqDerivedCandidate,false);
 assert.deepEqual(data.rows.map((r:any)=>r.riskId).sort(),['R1','R2']);
 assert.equal(metric(data,'Supplied risk records').value,2);
 assert.equal(metric(data,'Open at reporting date').value,1);
 assert.match(data.managementPosition,/2 risk records are supplied: 1 current, 1 after/);
 assert.ok((data.derivedRiskCandidates??[]).some((r:any)=>r.candidateGroup===BOQ_GROUP));
 assert.equal(data.rows.some((r:any)=>r.candidateGroup),false,'no candidate is mixed into the register rows');
});
