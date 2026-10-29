import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {changeDelivery,deliveryRecords} from '../packages/runtime-api/src/delivery-records';
import {deliveryModule} from '../packages/runtime-api/src/delivery-projections';
import {projectActionRegisterForState} from '../packages/runtime-api/src/project-projections';
import {projectActions} from '../packages/runtime-api/src/project-actions';
import {summarizeControlIssues} from '../packages/truth-kernel/src';

// P0-C (C11, was M8.1) invariant. Real registers rarely carry the programme's
// Activity ID. CMeng links each register record to activities itself, through
// one rule set for every register type: a cited activity ID, a stated WBS code,
// or a clearly best name match. The basis is stated; equal candidates are left
// for a choice; a stated or reviewed link always stands. Linked records feed
// the pages (for example a package's programme need date).

const DATA_DATE='2031-09-01';
const day=(iso:string,days:number)=>{const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
function programme(){
  const calendar='(0||CalendarData()((0||DaysOfWeek()('+Array.from({length:7},(_,i)=>'(0||'+(i+1)+'()((0||0(s|08:00|f|16:00)())))').join('')+'))(0||Exceptions()())))';
  const acts:[string,string,string][]=[['ACT-100','Pour raft slab zone A','11'],['ACT-101','Erect steel frame level 2','11'],['ACT-102','Install chilled water pumps plant room','12'],
    ['ACT-103','Install cable trays level 3','12'],['ACT-104','Lobby ceiling installation','13'],['ACT-105','Corridor ceiling installation','13'],['ACT-106','Commission fire alarm system','12']];
  const lines=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tLINKER\t'+DATA_DATE,
    '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\t10\t1\t\tMW\tMain Works','%R\t11\t1\t10\tSTR\tStructure','%R\t12\t1\t10\tMEP\tMEP services','%R\t13\t1\t10\tFIN\tFinishes',
    '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tSeven day\t'+calendar,
    '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt'];
  acts.forEach(([code,name,wbs],i)=>{const s=day(DATA_DATE,i*5),f=day(DATA_DATE,i*5+4);lines.push(['%R',String(500+i),'1',wbs,'1',code,name,'TT_Task','TK_NotStart',s,f,s,f,'40','40'].join('\t'));});
  lines.push('%T\tTASKPRED','%F\ttask_pred_id\tproj_id\ttask_id\tpred_proj_id\tpred_task_id\tpred_type\tlag_hr_cnt');
  for(let i=1;i<acts.length;i++)lines.push(['%R',String(900+i),'1',String(500+i),'1',String(499+i),'PR_FS','0'].join('\t'));
  lines.push('%E');return lines.join('\n');
}
const registers:Record<string,string>={
  'Procurement.csv':'Package ID,Description,Vendor,Status,Required On Site\nP1,Chilled water pumps,Acme,Ordered,2031-09-05\nP2,Ceiling tiles,Beta,Ordered,2031-09-20\nP3,Steel frame bolts,Gamma,Ordered,2031-09-02\n',
  'Submittals.csv':'Submittal ID,Description,Remarks,Status\nS1,Shop drawing for slab reinforcement,For ACT-100,Open\n',
  'RFI.csv':'RFI ID,Subject,Discipline,Status,Raised Date\nR1,Steel frame connection detail,STR,Open,2031-08-20\n',
  'NCR.csv':'NCR ID,Description,WBS,Status,Date Raised\nN1,Honeycombing found,STR,Open,2031-08-25\n',
  'Permits.csv':'Permit ID,Permit Type,Description,Status\nPT1,Hot work,Hot works for cable trays,Issued\n',
  'Commissioning.csv':'Test ID,Description,System,Status\nT1,Fire alarm system test,Fire alarm,Planned\n',
};

test('C11: every register type gets CMeng activity links with their basis; equal candidates stay unlinked; stated and reviewed links stand',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-c11-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate('C11-LINKER');
  await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(programme()),mediaType:'text/plain',sourceFilename:'Current.xer',uploadedAt:'2031-09-01',uploadIntent:'replace_current_basis'});
  for(const [name,body] of Object.entries(registers))await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(body),mediaType:'text/csv',sourceFilename:name,uploadedAt:'2031-09-01'});
  const byRef=()=>new Map(deliveryRecords(state).records.map(r=>[r.reference,r]));
  const expect:Record<string,{basis:string;ids:string[]}>={
    P1:{basis:'name_match',ids:['ACT-102']},S1:{basis:'cited_activity_id',ids:['ACT-100']},R1:{basis:'name_match',ids:['ACT-101']},
    N1:{basis:'wbs_code',ids:['ACT-100','ACT-101']},PT1:{basis:'name_match',ids:['ACT-103']},T1:{basis:'name_match',ids:['ACT-106']}};
  const records=byRef(),failures:string[]=[];
  for(const [ref,want] of Object.entries(expect)){
    const r=records.get(ref);if(!r){failures.push(ref+': not read');continue;}
    if(r.activityLink?.state!=='proposed'||r.activityLink.basis!==want.basis)failures.push(ref+' ('+r.kind+'): link '+r.activityLink?.state+'/'+r.activityLink?.basis+', expected proposed/'+want.basis);
    if(JSON.stringify([...r.links.activityIds].sort())!==JSON.stringify(want.ids))failures.push(ref+': linked to '+r.links.activityIds.join(',')+', expected '+want.ids.join(','));
    if(!r.activityLink?.reason)failures.push(ref+': the basis is not stated');
  }
  // Two equally good activities: no guess, both offered.
  const p2=records.get('P2')!;
  if(p2.activityLink?.state!=='ambiguous'||p2.links.activityIds.length)failures.push('P2: expected an unlinked ambiguous match, got '+p2.activityLink?.state+' '+p2.links.activityIds.join(','));
  if(!(p2.activityLink?.candidates??[]).some(c=>c.activityId==='ACT-104')||!(p2.activityLink?.candidates??[]).some(c=>c.activityId==='ACT-105'))failures.push('P2: both ceiling activities must be offered');
  assert.deepEqual(failures,[],failures.join('\n'));

  // The linked package now has a programme need date from its activity.
  const packages=(deliveryModule(state,'procurement-packages').data as any)?.rows??(deliveryModule(state,'delivery-procurement').data as any)?.rows??[];
  const p1=packages.find((row:any)=>row.reference==='P1');
  assert.ok(p1,'package P1 is not on the procurement page');
  assert.ok(p1.programmeNeedDate,'a linked package must get its programme need date');
  assert.equal(p1.activityLink?.basis,'name_match','the page states how the link was made');

  // One Project Review item: CMeng's links are listed with their basis; the unclear one asks a choice.
  const review=projectActions(state,summarizeControlIssues([],0));
  const items=review.actions.filter(a=>a.id==='delivery-activity-links');
  assert.equal(items.length,1,'one Project Review item lists CMeng\'s activity links, once');
  assert.equal(items[0]!.category,'confirmation','an unclear match asks the user to choose');
  assert.ok((items[0]!.evidenceSummary??[]).some(line=>line.startsWith('P2:')&&/ACT-104/.test(line)&&/ACT-105/.test(line)),'the unclear record shows both candidates');
  assert.ok((projectActionRegisterForState(state) as any).actions.some((a:any)=>a.actionId==='delivery-activity-links'),'the same item is on the management action register');

  // A reviewed link stands: the user corrects P3 to ACT-100 and it is kept.
  const p3=byRef().get('P3')!;
  changeDelivery(state,{expectedVersion:state.version,action:'review',recordId:p3.recordId,sourceRevision:p3.revision,state:'governed',note:'Bolts are for the raft slab.',links:{...p3.links,activityIds:['ACT-100']}});store.touch(state);
  const reviewed=byRef().get('P3')!;
  assert.deepEqual(reviewed.links.activityIds,['ACT-100']);assert.equal(reviewed.activityLink?.state,'reviewed');
});

test('C11: the linker reads cited IDs whatever separates them, takes the longest ID, and scales to a large programme',async()=>{
  const {registerActivityLinker}=await import('../packages/runtime-api/src/register-activity-linker');
  const names=['Pour raft slab','Erect steel frame','Install chilled water pumps','Install cable trays','Paint stair core'];
  const activities=Array.from({length:8900},(_,i)=>({activityId:'A'+(10000+i),name:names[i%names.length]+' block '+Math.floor(i/names.length),wbsId:'W'+(i%40),activityType:'task_dependent'}));
  activities.push({activityId:'ACT-100',name:'Short id',wbsId:'W1',activityType:'task_dependent'},{activityId:'ACT-100-A',name:'Longer id',wbsId:'W1',activityType:'task_dependent'});
  const model:any={activities,wbs:Array.from({length:40},(_,i)=>({wbsId:'W'+i,code:'WBS'+i,parentWbsId:null}))};
  const link=registerActivityLinker(model);
  const rec=(fields:Record<string,string>)=>({reference:fields.id??null,description:fields.description??null,fields});
  assert.deepEqual(link(rec({id:'X1',remarks:'see A10001/A10002, and (A10003).'})).activityIds.sort(),['A10001','A10002','A10003']);
  assert.deepEqual(link(rec({id:'X2',remarks:'for ACT-100-A only'})).activityIds,['ACT-100-A'],'the longest cited ID wins, not its prefix');
  assert.deepEqual(link(rec({id:'X3',remarks:'ref xA10001 is not an ID'})).activityIds,[],'an ID inside a longer word is not cited');
  assert.equal(registerActivityLinker(model),link,'one linker per programme model');
  // Scale: 29,300 register rows against 8,900 activities.
  const started=Date.now();
  for(let i=0;i<29300;i++)link(rec({id:'R'+i,description:names[i%names.length]+' block '+(i%1780)+' level '+(i%9),remarks:i%7?'':'A'+(10000+i%8900)}));
  const ms=Date.now()-started;
  // About 4 s alone on the 2-CPU test machine; the full parallel run can double it.
  assert.ok(ms<12000,'29,300 records linked in '+ms+' ms; the budget is 12,000 ms on the shared test machine');
});
