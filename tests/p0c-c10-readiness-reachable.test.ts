import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {changeDelivery,deliveryRecords} from '../packages/runtime-api/src/delivery-records';
import {deliveryModule} from '../packages/runtime-api/src/delivery-projections';
import {currentReadinessEvidence} from '../packages/runtime-api/src/current-readiness';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {ProjectAskEngine} from '../packages/runtime-api/src/ask-engine';
import {AskStore} from '../packages/runtime-api/src/ask-store';

// P0-C (C10 with C11 and M8.2) invariant. Every readiness dimension has a
// document reader. A register row applies to the activities its record is
// linked to now (stated in any of the usual forms, reviewed, or proposed by
// CMeng's linker), whatever the upload order. An activity with no check listed
// in a held register has no listed check, not an unknown. So a project whose
// registers show everything ready reaches Ready, on Look-Ahead and on
// Construction Readiness alike; a corrected link moves the evidence at once; a
// blocking status blocks.

const DATA_DATE='2031-09-01';
const day=(iso:string,days:number)=>{const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
function programme(){
  const calendar='(0||CalendarData()((0||DaysOfWeek()('+Array.from({length:7},(_,i)=>'(0||'+(i+1)+'()((0||0(s|08:00|f|16:00)())))').join('')+'))(0||Exceptions()())))';
  const acts:[string,string,string][]=[['ACT-100','Pour raft slab zone A','11'],['ACT-101','Erect steel frame level 2','11'],['ACT-102','Install chilled water pumps plant room','12'],['ACT-103','Install cable trays level 3','12']];
  const lines=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tREADY\t'+DATA_DATE,
    '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\t10\t1\t\tMW\tMain Works','%R\t11\t1\t10\tSTR\tStructure','%R\t12\t1\t10\tMEP\tMEP services',
    '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tSeven day\t'+calendar,
    '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt'];
  // Independent activities: the predecessor dimension is not applicable, so the documents decide.
  acts.forEach(([code,name,wbs],i)=>{const s=day(DATA_DATE,1+i),f=day(DATA_DATE,5+i);lines.push(['%R',String(500+i),'1',wbs,'1',code,name,'TT_Task','TK_NotStart',s,f,s,f,'40','40'].join('\t'));});
  lines.push('%E');return lines.join('\n');
}
// No register carries a plain Activity ID column: the links come from a cited
// ID, a WBS code, a comma list, or a clear name match.
const registers=(permitStatus='Issued',extraPackage=''):Record<string,string>=>({
  'Procurement.csv':'Package ID,Description,Vendor,Status,Required On Site,Actual Delivery,Status Date\nP1,Raft slab rebar,Acme,Delivered,2031-09-05,2031-08-28,'+DATA_DATE+'\n'+extraPackage,
  'Submittals.csv':'Submittal ID,Description,Remarks,Status,Status Date\nS1,Shop drawing for slab reinforcement,For ACT-100,Approved,'+DATA_DATE+'\n',
  'RFI.csv':'RFI ID,Subject,Discipline,Status,Raised Date,Status Date\nR1,Raft slab construction joint,STR,Closed,2031-08-20,'+DATA_DATE+'\n',
  'NCR.csv':'NCR ID,Description,WBS,Status,Date Raised,Close Date\nN1,Honeycombing found,STR,Closed,2031-08-25,2031-08-30\n',
  'Permits.csv':'Permit ID,Permit Type,Description,Status,Status Date\nPT1,Excavation,Excavation permit raft slab,'+permitStatus+','+DATA_DATE+'\n',
  'Interfaces.csv':'Interface ID,Description,Linked Activity,Status,Status Date\nI1,Area handover from enabling contractor,"ACT-100, ACT-101",Closed,'+DATA_DATE+'\n',
  'Risk_Register.csv':'Risk ID,Description,Owner,Status,Status Date\nRK1,Raft slab pour weather window,Site Manager,Closed,'+DATA_DATE+'\n',
  'Resource_Register.csv':'Resource ID,Description,Status,Status Date\nRS1,Concrete gang raft slab pour,Mobilised,'+DATA_DATE+'\n',
  'Variation_Register.csv':'Variation ID,Description,Status,Status Date\nV1,Raft slab thickening,Approved,'+DATA_DATE+'\n',
});
const DIMENSIONS=['procurement_material','design_submittal','quality','permit','access','risk','resource','commercial'] as const;

async function project(t:any,id:string,order:'programme_first'|'registers_first'='programme_first',permitStatus='Issued',shared=false,extraPackage=''){
  const dir=mkdtempSync(join(tmpdir(),'cmeng-c10-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  // Pages are read through the shared runtime store; the restart case uses its own store.
  const store=shared?runtimeProjects:new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate(id);
  const xer=()=>store.ingestEvidenceFile({projectId:id,bytes:Buffer.from(programme()),mediaType:'text/plain',sourceFilename:'Current.xer',uploadedAt:DATA_DATE,uploadIntent:'replace_current_basis'});
  if(order==='programme_first')await xer();
  for(const [name,body] of Object.entries(registers(permitStatus,extraPackage)))await store.ingestEvidenceFile({projectId:id,bytes:Buffer.from(body),mediaType:'text/csv',sourceFilename:name,uploadedAt:DATA_DATE});
  if(order==='registers_first')await xer();
  return {dir,store,state};
}
const lookAheadRow=(state:any,activityId:string)=>((moduleForProject(state.projectId,'lookahead-schedule').data as any)?.rows??[]).find((r:any)=>r.activityId===activityId);
const readinessRow=(state:any,activityId:string)=>((deliveryModule(state,'construction-readiness').data as any)?.rows??[]).find((r:any)=>(r.activityId??r.reference)===activityId);
function dimensionFailures(state:any,activityId:string,want:'ready'|'not_applicable'){
  const evidence=currentReadinessEvidence(state)[activityId]??{},out:string[]=[];
  for(const key of DIMENSIONS){const e=(evidence as any)[key];if(e?.state!==want)out.push(activityId+' '+key+': '+(e?.state??'no evidence')+(e?.note?' ('+e.note+')':''));}
  return out;
}

test('C10: every dimension is read from its register and reaches Ready on Look-Ahead and Construction Readiness alike',async t=>{
  const {state}=await project(t,'C10-READY-'+Date.now(),'programme_first','Issued',true);
  const types=state.evidenceDocuments.map(d=>d.sourceFilename+'='+d.documentType);
  assert.deepEqual(dimensionFailures(state,'ACT-100','ready'),[],'every dimension of ACT-100 is read as ready from its register. Documents: '+types.join(', '));
  // ACT-103 is listed in no register (no WBS, name or ID points to it): every dimension has no listed check.
  assert.deepEqual(dimensionFailures(state,'ACT-103','not_applicable'),[],'an activity no register lists has no listed checks');
  const la=lookAheadRow(state,'ACT-100'),cr=readinessRow(state,'ACT-100');
  assert.ok(la,'ACT-100 is on the Look-Ahead');assert.equal(la.readiness?.state,'ready','Look-Ahead: '+JSON.stringify(la.readiness?.dimensions?.filter((d:any)=>d.state!=='ready'&&d.state!=='not_applicable')));
  assert.ok(cr,'ACT-100 is on Construction Readiness');assert.equal(cr.readiness?.state??cr.state,'ready','Construction Readiness agrees with Look-Ahead');
  // Ask CMeng answers a readiness question from the same reader (no paid model).
  const root=mkdtempSync(join(tmpdir(),'cmeng-c10-ask-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const engine=new ProjectAskEngine(new AskStore(root),{plan:async()=>{throw new Error('Unexpected paid planning');},explain:async()=>{throw new Error('Unexpected paid explanation');}});
  const answer=await engine.ask(state.projectId,{userId:'c10',workspaceId:'cmeng-projects',name:null,title:null,company:null,allowModel:false},{question:'Which activities are ready to start?'});
  assert.ok(answer.plan.authorities.includes('lookahead'),'answered from the readiness reader: '+answer.plan.authorities.join(','));
  assert.match(answer.narrative[0]!.text,/Look-ahead readiness.*\b[1-9]\d* ready/,answer.narrative[0]!.text);
  assert.match(answer.narrative[0]!.text,/ACT-100/,'the ready activity is named');
});

test('C10: the register order does not matter; a corrected link moves the evidence at once; a restart gives the same answer',async t=>{
  const {dir,store,state}=await project(t,'C10-ORDER','registers_first');
  assert.deepEqual(dimensionFailures(state,'ACT-100','ready'),[],'registers uploaded before the programme are linked once it arrives');
  // The user corrects the permit's link to ACT-102.
  const permit=deliveryRecords(state).records.find(r=>r.reference==='PT1')!;
  changeDelivery(state,{expectedVersion:state.version,action:'review',recordId:permit.recordId,sourceRevision:permit.revision,state:'governed',note:'Permit is for the plant room.',links:{...permit.links,activityIds:['ACT-102']}});store.touch(state);
  const after=currentReadinessEvidence(state);
  assert.equal((after['ACT-102'] as any)?.permit?.state,'ready','the corrected link carries the permit to ACT-102');
  assert.equal((after['ACT-100'] as any)?.permit?.state,'not_applicable','ACT-100 no longer has a listed permit');
  const reloaded=new RuntimeProjectStore({dataDir:dir,durable:false}).get('C10-ORDER')!;
  const again=currentReadinessEvidence(reloaded);
  assert.equal((again['ACT-102'] as any)?.permit?.state,'ready','after restart');assert.equal((again['ACT-100'] as any)?.permit?.state,'not_applicable','after restart');
});

test('C10: a blocking status blocks the activity on both pages',async t=>{
  const {state}=await project(t,'C10-BLOCKED-'+Date.now(),'programme_first','Expired',true);
  assert.equal((currentReadinessEvidence(state)['ACT-100'] as any)?.permit?.state,'blocked');
  assert.equal(lookAheadRow(state,'ACT-100')?.readiness?.state,'blocked');
  const cr=readinessRow(state,'ACT-100');assert.equal(cr?.readiness?.state??cr?.state,'blocked');
});

test('C10: a held register with a record linked to no activity keeps that dimension unknown (never "no listed check")',async t=>{
  const {state}=await project(t,'C10-UNLINKED','programme_first','Issued',false,'P9,Office furniture,Delta,Ordered,2031-09-20,,'+DATA_DATE+'\n');
  const evidence=currentReadinessEvidence(state) as any;
  assert.equal(evidence['ACT-100']?.procurement_material?.state,'ready','the linked package still counts');
  assert.equal(evidence['ACT-103']?.procurement_material?.state,'unknown','an unlinked package may belong to any activity');
  assert.ok((evidence['ACT-103']?.procurement_material?.diagnostics??[]).includes('READINESS_REGISTER_RECORDS_NOT_LINKED:1'));
  assert.equal(evidence['ACT-103']?.permit?.state,'not_applicable','other fully linked registers are unaffected');
});
