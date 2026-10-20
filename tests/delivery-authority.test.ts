import test from 'node:test';
import {createHash} from 'node:crypto';
import {deliveryAuthorityCatalog} from '../packages/runtime-api/src/delivery-authorities';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Script,runInNewContext} from 'node:vm';
import ExcelJS from 'exceljs';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {changeDelivery,classifyDeliveryRowKind,deliveryRecords,deliveryStore} from '../packages/runtime-api/src/delivery-records';
import {deliveryDashboard,deliveryModule,deliveryPosition,deliveryPages,deliveryExportResult} from '../packages/runtime-api/src/delivery-projections';
import {deliveryScript} from '../packages/runtime-api/src/ui-delivery';
import {STATUS_LABELS} from '../packages/runtime-api/src/position-review';
import {resolveBoqSource} from '../packages/runtime-api/src/boq-source';
import {projectControlSchedule} from '../packages/runtime-api/src/canonical-time-claims';
import {buildDeliveryWorkbook,deliveryColumnKeys} from '../packages/runtime-api/src/delivery-export';
import {moduleRegistry} from '../packages/runtime-api/src/registry';
import type {DeliveryKind,DeliveryRecord} from '../packages/delivery-core/src/types';
import {crossDomainAccountability} from '../packages/runtime-api/src/accountability-intelligence';
import {registerProgrammeContext} from '../packages/runtime-api/src/register-programme-context';

const calendar='(0||CalendarData()((0||DaysOfWeek()('+Array.from({length:7},(_,i)=>'(0||'+(i+1)+'()((0||0(s|08:00|f|16:00)())))').join('')+'))(0||Exceptions()())))';
export function deliveryProgramme(date='2031-08-31',count=2){return ['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tDELIVERY\t'+date,'%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tWorking calendar\t'+calendar,'%T\tTASK','%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt',...Array.from({length:count},(_,i)=>'%R\t'+(i+1)+'\t1\t1\tA'+(i+1)+'\tEquipment installation '+(i+1)+'\tTK_NotStart\t2031-09-30 08:00\t2031-10-10 16:00\t80\t80\t16'),'%E'].join('\n');}
async function fixture(t:any){const dir=mkdtempSync(join(tmpdir(),'delivery-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate('DELIVERY-A');
 await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(deliveryProgramme()),mediaType:'text/plain',sourceFilename:'Current.xer',uploadedAt:'2031-09-01',uploadIntent:'replace_current_basis'});
 async function upload(name:string,content:string){return store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(content),mediaType:'text/csv',sourceFilename:name,uploadedAt:'2031-09-01'});}
 function change(input:any){const result=changeDelivery(state,{expectedVersion:state.version,...input});store.touch(state);return result;}
 function create(kind:DeliveryKind,reference:string,fields:any={},links:any={}){change({action:'create',kind,fields:{'record reference':reference,description:reference,...fields}});const r=deliveryStore(state).manual.at(-1)!;change({action:'review',recordId:r.recordId,sourceRevision:r.revision,state:'governed',fields:{},links,note:'Reviewed source and project applicability.'});return deliveryRecords(state).records.find(q=>q.recordId===r.recordId)!;}
 function review(r:DeliveryRecord,fields:any={},other:any={}){change({action:'review',recordId:r.recordId,sourceRevision:r.revision,state:'governed',fields,note:'Reviewed amendment.',...other});return deliveryRecords(state).records.find(q=>q.recordId===r.recordId)!;}
 function population(kind:DeliveryKind,scopeId:string|null=null){change({action:'confirm_population',kind,scopeId,note:'Complete source register and applicable obligations reconciled.'});}
 return {dir,store,state,upload,change,create,review,population};
}

test('supplier headlines use the same vendor population as their table and preserve links after formal registration',async t=>{
 const f=await fixture(t);
 await f.upload('Procurement.csv','Package ID,Description,Vendor,Status,Required On Site,Forecast Delivery\nP1,Pump,Acme,Ordered,2031-08-29,2031-09-05\nP2,Cable,ACME,Ordered,2031-09-10,2031-09-09\nP3,Steel,Beta,Ordered,2031-09-10,2031-09-09');
 const check=()=>{const data=deliveryModule(f.state,'delivery-suppliers').data as any;
  assert.equal(data.rows.length,2);assert.equal(data.metrics.find((m:any)=>m.label==='Suppliers in available records').value,2);
  assert.equal(data.metrics.find((m:any)=>m.label==='Linked procurement packages').value,3);
  assert.equal(data.metrics.find((m:any)=>m.label==='Suppliers with known late packages').value,1);
  assert.equal(data.rows.reduce((n:number,r:any)=>n+r.packageCount,0),3);
 };check();f.create('supplier','S1',{company:'Acme'});check();
});

test('register owners come from responsibility columns and never from a discipline code',async t=>{
 const f=await fixture(t);
 await f.upload('RFI.csv','RFI ID,Subject,Discipline,Status,Raised Date,Due Date\nR1,Drawing,ARCH,Open,2031-08-01,2031-09-01');
 await f.upload('NCR.csv','NCR ID,Description,Responsible,Status,Date Raised,Due Date\nN1,Weld,QA Manager,Open,2031-08-01,2031-09-01');
 assert.equal((deliveryModule(f.state,'delivery-design').data as any).rows[0].owner,null);
 assert.equal((deliveryModule(f.state,'delivery-design').data as any).rows[0].discipline,'ARCH');
 assert.equal((deliveryModule(f.state,'delivery-quality').data as any).rows[0].owner,'QA Manager');
});

test('RFI and NCR close-out follows every linked activity without hiding the open record',async t=>{
 const f=await fixture(t),model=projectControlSchedule(f.state)!.revision.model;
 model.activities[0]!.status='completed';model.activities[0]!.actualFinishIso='2031-08-01';model.activities[0]!.totalFloatHours=null;
 model.activities[1]!.totalFloatHours=-24;f.store.touch(f.state);
 await f.upload('RFI.csv','RFI ID,Subject,Status,Raised Date,Due Date,Linked Activity,Owner\nR-DONE,As built drawing,Open,2031-07-01,2031-07-10,A1,Design lead\nR-LIVE,Open work detail,Open,2031-08-01,2031-09-01,A2,Design lead\nR-UNKNOWN,Link needed,Open,2031-08-01,2031-09-01,,Design lead');
 await f.upload('NCR.csv','NCR ID,Description,Responsible,Status,Date Raised,Due Date,Linked Activity\nN-DONE,Completed inspection,QA Manager,Open,2031-07-01,2031-07-10,A1\nN-LIVE,Weld,QA Manager,Open,2031-08-01,2031-09-01,A2');
 const before=JSON.stringify(f.state.controls);
 const design=deliveryModule(f.state,'delivery-design').data as any,quality=deliveryModule(f.state,'delivery-quality').data as any;
 assert.equal(design.programmeFollowUp.openOnUnfinishedWork,1);assert.equal(design.programmeFollowUp.closeoutCount,1);assert.equal(design.programmeFollowUp.linksNeedReview,1);
 assert.deepEqual(design.programmeFollowUp.closeoutRows.map((r:any)=>r.reference),['R-DONE']);assert.equal(design.rows[0].reference,'R-LIVE');
 assert.equal(design.rows[0].programmeContext.linkedFloatHours,-24);assert.equal(quality.programmeFollowUp.closeoutCount,1);assert.equal(quality.rows[0].reference,'N-LIVE');
 assert.equal(design.rows.find((r:any)=>r.reference==='R-DONE').currentStatus,'open','completed programme work does not close the source RFI');
 const actions=crossDomainAccountability(f.state).recordActions;
 for(const ref of ['r-done','n-done']){const action=actions.find(a=>a.recordKey?.endsWith('|'+ref))!;assert.equal(action.severity,'low');assert.match(action.requiredAction,/close-out decision/);assert.doesNotMatch(action.requiredAction,/downstream release|recovery date/);}
 assert.equal(JSON.stringify(f.state.controls),before,'the classification is read-only');
 const map=new Map(model.activities.map(a=>[a.activityId,a]));
 assert.equal(registerProgrammeContext(['A1','A2'],map).state,'unfinished_work');
 assert.equal(registerProgrammeContext(['A1','MISSING'],map).state,'links_incomplete');
 assert.equal(registerProgrammeContext([],map).state,'unlinked');
 const ui=runInNewContext(deliveryScript()+';({columns:deliveryColumns("delivery-design"),completedFloat:deliveryCell({programmeContext:{state:"completed_work",linkedFloatHours:null}},"programmeContext.linkedFloatHours")})',{Intl});
 assert.ok(ui.columns.some(([key]:string[])=>key==='programmeContext.label'));assert.equal(ui.completedFloat,'Not applicable');
});

test('programme scope and look-ahead remain usable without a workfront register',async t=>{
 const f=await fixture(t),model=projectControlSchedule(f.state)!.revision.model;
 model.activities[0]!.name='Electrical installation - Plot C 81';model.activities[1]!.name='Concrete foundations - Plot C 82';f.store.touch(f.state);
 const locations=deliveryModule(f.state,'construction-locations').data as any;
 assert.deepEqual(locations.rows.map((row:any)=>row.label).sort(),['Plot C 81','Plot C 82']);
 assert.equal(locations.rows.reduce((n:number,row:any)=>n+row.activityCount,0),2);
 const disciplines=deliveryModule(f.state,'construction-discipline').data as any;
 assert.deepEqual(disciplines.rows.map((row:any)=>row.label).sort(),['Electrical','Structural']);
 const readiness=deliveryModule(f.state,'construction-readiness').data as any;
 assert.equal(readiness.programmeReadiness,true);assert.equal(readiness.rows.length,2);
 assert.ok(readiness.rows.every((row:any)=>row.state==='unknown'),'missing external prerequisites cannot become a ready workfront');
});

test('SW-17 package programme need date is the linked start less the stated lead/review time, the same date the timing uses',async t=>{
 const f=await fixture(t);
 // A1 starts 2031-09-30 in the current programme; 14 stated calendar days -> 2031-09-16 (hand count: Sep 16 + 14 = Sep 30).
 f.create('package','LEAD-REVIEW',{'review time':'14','forecast delivery date':'2031-09-25',status:'Ordered'},{activityIds:['A1']});
 f.create('package','NO-LEAD',{'forecast delivery date':'2031-09-25',status:'Ordered'},{activityIds:['A1']});
 f.create('package','BAD-LEAD',{'review time':'10 working days','forecast delivery date':'2031-09-25',status:'Ordered'},{activityIds:['A1']});
 const rows=deliveryPosition(f.state).packageRows;
 const lead=rows.find(r=>r.reference==='LEAD-REVIEW')!,none=rows.find(r=>r.reference==='NO-LEAD')!,bad=rows.find(r=>r.reference==='BAD-LEAD')!;
 assert.equal(lead.programmeNeedDate,'2031-09-16');assert.equal(lead.needDate,'2031-09-16');
 assert.equal(lead.headroomCalendarDays,-9);assert.equal(lead.forecastLate,true);
 assert.match(lead.needDateBasis,/linked activity start 2031-09-30 less the stated 14 calendar-day lead\/review time/);
 // no stated time: no default, the start itself; forecast 09-25 is 5 days early
 assert.equal(none.programmeNeedDate,'2031-09-30');assert.equal(none.needDate,'2031-09-30');assert.equal(none.headroomCalendarDays,5);assert.equal(none.forecastLate,false);
 // stated but unreadable: not established, never the raw start
 assert.equal(bad.programmeNeedDate,null);assert.equal(bad.needDate,null);assert.equal(bad.forecastLate,false);
});

test('procurement protects the earlier recorded need and identifies overdue undelivered packages',async t=>{
 const f=await fixture(t);
 f.create('package','EARLY-NEED',{'required on site':'2031-08-29','forecast delivery date':'2031-09-19',status:'Ordered'},{activityIds:['A1']});
 const row=deliveryPosition(f.state).packageRows.find(r=>r.reference==='EARLY-NEED')!;
 assert.equal(row.programmeNeedDate,'2031-09-30');assert.equal(row.needDate,'2031-08-29');
 assert.equal(row.headroomCalendarDays,-21);assert.equal(row.overdueUndelivered,true);
 assert.equal(row.needDateBasis,'the required-on-site date from the register (screening)');
 f.create('package','RECEIVED',{'required on site':'2031-08-29','forecast delivery date':'2031-09-19','actual delivery date':'2031-08-28',status:'Delivered'},{activityIds:['A1']});
 const received=deliveryPosition(f.state).packageRows.find(r=>r.reference==='RECEIVED')!;
 assert.equal(received.deliveredAtDataDate,true);assert.equal(received.overdueUndelivered,false);
});

test('Delivery follows the latest submitted programme while undated updates remain pending on every page',async t=>{
 const {store,state}=await fixture(t);
 const later=await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(deliveryProgramme('2031-09-30')),mediaType:'text/plain',sourceFilename:'Monthly_Update.xer',uploadedAt:'2031-10-01',uploadIntent:'add_update'});
 for(const [key] of deliveryPages){
  const r=deliveryModule(state,key);
  assert.equal((r.data as any).programmeRevisionId,later.linkedArtifactId);
  assert.equal(r.scheduleAuthorityReview!.state,'submitted_current');
  assert.equal(r.scheduleAuthorityReview!.authority,'submitted');
  assert.equal(r.scheduleAuthorityReview!.pendingSchedules.length,0);
  assert.equal((r.data as any).dataDateIso,'2031-09-30');
 }
 const undated=await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(deliveryProgramme('')),mediaType:'text/plain',sourceFilename:'Update_No_DD.xer',uploadedAt:'2031-10-02',uploadIntent:'add_update'});
 for(const [key] of deliveryPages){
  const r=deliveryModule(state,key);
  assert.equal((r.data as any).programmeRevisionId,later.linkedArtifactId);
  assert.equal((r.data as any).dataDateIso,'2031-09-30');
  assert.ok(r.scheduleAuthorityReview!.pendingSchedules.some(p=>p.revisionId===undated.linkedArtifactId&&p.dateRelationship==='date_missing'));
 }
 const fresh=store.getOrCreate('DELIVERY-B');
 const first=await store.ingestEvidenceFile({projectId:fresh.projectId,bytes:Buffer.from(deliveryProgramme()),mediaType:'text/plain',sourceFilename:'First.xer',uploadedAt:'2031-09-01'});
 const ready=deliveryModule(fresh,'construction-readiness');
 assert.equal((ready.data as any).programmeRevisionId,first.linkedArtifactId);
 assert.equal((ready.data as any).dataDateIso,'2031-08-31');
 assert.equal(ready.scheduleAuthorityReview!.state,'submitted_current');
 assert.equal(ready.scheduleAuthorityReview!.pendingSchedules.length,0);
});

test('BOQ-only projects expose scope, procurement, long-lead, material and risk intelligence before specialist registers exist',async t=>{
 const f=await fixture(t);
 await f.upload('BOQ.csv','Item No,Description,Unit,Quantity,Rate,Amount,Currency\n1,Tower A Zone 2 Level 05 Electrical Switchgear,No.,2,1000000,2000000,AED\n2,Tower A Zone 2 Level 05 Fire Alarm Panel,No.,4,10000,40000,AED');
 const keys=['procurement-packages','long-lead','material-tracking','construction-discipline','construction-locations'];
 for(const key of keys){
  const r=deliveryModule(f.state,key),data=r.data as any;
  assert.ok(data.rows.length>0,key+' should answer from the useful Project information already available');
  assert.notEqual(r.status,'blocked',key+' must not become an empty blocked page while usable scope intelligence exists');
  assert.equal(r.status,'partial',key+' incomplete register confirmation must remain visible and must not become falsely ready');
 }
 const packages=(deliveryModule(f.state,'procurement-packages').data as any).rows;
 assert.ok(packages.some((r:any)=>/Switchgear/.test(r.system)&&r.procurementPriority==='Critical'));
 const material=(deliveryModule(f.state,'material-tracking').data as any).rows;
 assert.ok(material.some((r:any)=>/Tower A/.test(r.location)&&/Zone 2/.test(r.location)&&/05/.test(r.location)));
 // SW-32: BOQ wording is never the risk list; it stays in the labelled candidate list, never counted.
 const riskPage=deliveryModule(f.state,'delivery-risks'),risks=riskPage.data as any;
 assert.equal(risks.rows.length,0);assert.equal(riskPage.status,'blocked');assert.match(String(riskPage.reason),/No risk register read/);
 assert.ok(risks.derivedRiskCandidates.some((r:any)=>r.category==='procurement'&&r.probability==='Not established'&&r.candidateGroup==='Candidates from BOQ wording, not risks'));
});

test('register imports remain candidates but clean source facts are immediately visible with authority kept separate',async t=>{
 const f=await fixture(t);await f.upload('Procurement.csv','Package ID,Description,Unit,Ordered Quantity,Ordered Date,Supplier ID,Lifecycle ID\nPK1,Chiller,No.,1,2031-08-20,S1,L1');
 const before=deliveryPosition(f.state),r=before.records.find(r=>r.reference==='PK1')!;assert.equal(r.kind,'package');assert.equal(r.state,'extracted_candidate');assert.match(r.receipts[0]!.sourceHash,/^[a-f0-9]{64}$/);assert.equal(before.packageRows.length,1);assert.equal(before.packageRows[0]!.sourceState,'extracted_candidate');assert.equal(before.populations.package!.state,'not_established');
 assert.throws(()=>f.review(r),/link.*not an established|lifecycle/i);
 f.review(r,{'lifecycle id':null},{links:{}});assert.equal(deliveryPosition(f.state).packageRows.length,1);assert.equal(deliveryPosition(f.state).materialRows[0]!.required,null);
});

test('material reconciliation uses the same BOQ and installed authority, preserves over-installation and separates units',async t=>{
 const f=await fixture(t);await f.upload('BOQ.csv','Item No,Description,Unit,Quantity,Rate,Amount,Currency\n1,Concrete,m3,100,2,200,USD\n2,Cable,m,50,4,200,AED');
 await f.upload('Measurements.csv','Measurement Date,Item No,Cumulative Installed Qty,Unit\n2031-08-20,1,150,m3\n2031-09-30,1,200,m3');
 const items=resolveBoqSource(f.state,'').quantities!.items;const concrete=items.find(i=>i.unit==='m3')!,cable=items.find(i=>i.unit==='m')!;
 const r=f.create('package','CONCRETE',{'unit':'m3','ordered quantity':110,'ordered date':'2031-08-01','delivered quantity':100,'delivered date':'2031-08-15','accepted quantity':90,'accepted date':'2031-08-20'},{boqItemIds:[concrete.quantityItemId]});
 f.create('package','CABLE',{unit:'m'},{boqItemIds:[cable.quantityItemId]});
 let p=deliveryPosition(f.state),q=p.materialRows.find(x=>x.recordId===r.recordId)!;
 assert.equal(q.required,100);assert.equal(q.installed,150);assert.equal(q.remainingToInstall,-50);assert.equal(q.procurementCoveragePercent,110);assert.ok(p.findings.some(f=>f.code==='INSTALLED_ABOVE_REQUIREMENT'));assert.equal(p.boqIntelligence.currencies.length,2);
 assert.deepEqual(p.boqIntelligence.currencies.map(c=>c.unmappedValue),[0,0]);
 f.population('package');p=deliveryPosition(f.state);const materialCurve=p.curves.find(c=>c.kind==='material_quantity'&&c.packageId===r.recordId&&c.stage==='installed')!;assert.equal(materialCurve.coveragePercent,100);assert.deepEqual(materialCurve.excludedRecordIds,[]);
 assert.ok(p.curves.filter(c=>c.series==='actual').every(c=>c.points.every((x:any)=>x.dateIso<='2031-08-31')));
 f.create('package','SPLIT',{}, {boqItemIds:[concrete.quantityItemId]});p=deliveryPosition(f.state);q=p.materialRows.find(x=>x.recordId===r.recordId)!;assert.equal(q.required,null);assert.equal(q.installed,null);
 f.review(r,{}, {links:{...r.links,boqAllocations:[{boqItemId:concrete.quantityItemId,quantity:60,unit:'m3'}]}});assert.equal(deliveryPosition(f.state).materialRows.find(x=>x.recordId===r.recordId)!.required,60);
});

test('Stage 1 lifecycle governance can bootstrap itself but ordinary records still require an established template',async t=>{
 const f=await fixture(t);
 const lifecycle=f.create('lifecycle','LC-BOOT',{'lifecycle id':'LC-BOOT',stages:'po;delivery;installation'});
 assert.equal(lifecycle.state,'governed');
 assert.equal(lifecycle.kind,'lifecycle');

 f.change({action:'create',kind:'package',fields:{'record reference':'PK-NO-TEMPLATE',description:'Package awaiting lifecycle','lifecycle id':'LC-MISSING'}});
 const manual=deliveryStore(f.state).manual.at(-1)!;
 assert.throws(()=>f.change({
   action:'review',recordId:manual.recordId,sourceRevision:manual.revision,state:'governed',
   fields:{},note:'Attempt governance without established lifecycle.'
 }),/Select a governed lifecycle template in this project/);
});

test('long-lead backward dates require each duration, day basis and source; missing inputs never become dates',async t=>{
 const f=await fixture(t),activity=projectControlSchedule(f.state)!.revision.model.activities[0]!;
 const lifecycle=f.create('lifecycle','L1',{stages:'po; manufacturing; delivery; installation','po duration':0,'po day basis':'calendar days','po duration source':'Approved plan','manufacturing duration':20,'manufacturing day basis':'calendar days','manufacturing duration source':'Supplier confirmation','delivery duration':5,'delivery day basis':'calendar days','delivery duration source':'Carrier quotation'});
 let r=f.create('package','CHILLER',{'lifecycle id':lifecycle.recordId,'forecast delivery date':'2031-10-05'},{activityIds:[activity.activityId]});
 let p=deliveryPosition(f.state).packageRows[0]!;assert.equal(p.latestOrderDate?.slice(0,10),'2031-09-05');assert.equal(p.headroomCalendarDays,-5);
 r=f.review(r,{'manufacturing day basis':'unknown'});p=deliveryPosition(f.state).packageRows[0]!;assert.equal(p.latestOrderDate,null);assert.equal(p.latestOrderState,'not_established');
 f.review(r,{'manufacturing day basis':'calendar days','manufacturing duration source':'Controlled user assumption'});assert.equal(deliveryPosition(f.state).packageRows[0]!.latestOrderState,'scenario');
});

test('readiness gates use a scoped complete denominator; unrelated unknown gates cannot mark a ready workfront partial',async t=>{
 const f=await fixture(t),a=f.create('workfront','A'),b=f.create('workfront','B');
 f.create('gate','A-DESIGN',{applicable:'yes','satisfied date':'2031-08-20'},{recordIds:[a.recordId]});
 f.create('gate','A-PERMIT',{applicable:'no'},{recordIds:[a.recordId]});
 f.create('gate','B-DESIGN',{applicable:'yes'},{recordIds:[b.recordId]});
 assert.equal(deliveryPosition(f.state).readiness[0]!.readinessPercent,null);f.population('gate',a.recordId);
 const rows=deliveryPosition(f.state).readiness;assert.equal(rows.find(r=>r.recordId===a.recordId)!.readinessPercent,100);assert.equal(rows.find(r=>r.recordId===a.recordId)!.state,'ready');assert.equal(rows.find(r=>r.recordId===b.recordId)!.state,'unknown');
 assert.equal(rows.find(r=>r.recordId===b.recordId)!.unknownCount,null);
});

test('confirmed unresolved interfaces directly gate linked Construction Readiness while candidates do not',async t=>{
 const f=await fixture(t),activity=projectControlSchedule(f.state)!.revision.model.activities[0]!;
 const workfront=f.create('workfront','WF-IFACE',{}, {activityIds:[activity.activityId]});
 f.create('gate','WF-READY',{applicable:'yes','satisfied date':'2031-08-20'},{recordIds:[workfront.recordId]});f.population('gate',workfront.recordId);
 let page=deliveryModule(f.state,'construction-readiness'),row=(page.data as any).rows.find((r:any)=>r.recordId===workfront.recordId);
 assert.equal(row.state,'ready');
 await f.upload('Candidate_Interfaces.csv','Interface ID,Giving Party,Receiving Party,Current Status,Affected Workfront,Linked Activity\nIF-CAND,Design,Construction,Blocked,WF-IFACE,'+activity.activityId);
 const candidate=deliveryRecords(f.state).records.find(r=>r.reference==='IF-CAND')!;
 assert.equal(candidate.kind,'interface');assert.equal(candidate.state,'extracted_candidate');
 page=deliveryModule(f.state,'construction-readiness');row=(page.data as any).rows.find((r:any)=>r.recordId===workfront.recordId);
 assert.equal(row.state,'ready','candidate interface must not change readiness');
 f.review(candidate,{}, {links:{recordIds:[workfront.recordId],activityIds:[activity.activityId]}});
 page=deliveryModule(f.state,'construction-readiness');row=(page.data as any).rows.find((r:any)=>r.recordId===workfront.recordId);
 assert.equal(row.state,'blocked');assert.deepEqual(row.interfaceGate.interfaceIds,['IF-CAND']);
 assert.ok((page.data as any).findings.some((finding:any)=>finding.code==='INTERFACE_BLOCKED'));
});

test('formal Interface Register upload is identified and mapped to interface candidates without silent confirmation',async t=>{
 const f=await fixture(t);
 const uploaded=await f.upload('Project_Interface_Register.csv','Interface ID,Giving Party,Receiving Party,Required Deliverable,Required Date,Current Status,Responsible Party\nIF-001,Design Consultant,Main Contractor,Approved shop drawing,2031-08-20,Open,Design Manager');
 const document=f.state.evidenceDocuments.find(d=>d.documentId===uploaded.documentId)!;assert.equal(document.documentType,'interface_register');
 const record=deliveryRecords(f.state).records.find(r=>r.reference==='IF-001')!;
 assert.equal(record.kind,'interface');assert.equal(record.state,'extracted_candidate');assert.equal(record.fields['giving party'],'Design Consultant');
 const page=deliveryModule(f.state,'delivery-interfaces');
 assert.equal(page.status,'partial','clean register rows are usable without claiming confirmation');
 assert.equal((page.data as any).rows[0].authority,'source');
 assert.equal((page.data as any).rows[0].state,'overdue');
 assert.equal((page.data as any).title,'Interface Management');
 assert.equal((page.data as any).confirmedCount,0);
});

test('Interface totals distinguish absent and reviewed-empty populations and reopen after new records',async t=>{
 const f=await fixture(t),position=()=>deliveryModule(f.state,'delivery-interfaces').data as any;
 let data=position();for(const key of ['openCount','blockerCount','overdueCount','linkedActivityCount'])assert.equal(data[key],null,key);
 assert.match(data.managementPosition,/Upload the register in Add documents/);
 f.population('interface');data=position();for(const key of ['openCount','blockerCount','overdueCount','linkedActivityCount'])assert.equal(data[key],0,key);
 const r=f.create('interface','IF-NEW',{'current status':'Open','required date':'2031-08-31'},{activityIds:['A1']});
 data=position();assert.equal(data.population.state,'not_established');assert.equal(data.blockerCount,null);assert.equal(data.knownBlockerCount,0);assert.equal(data.linkedActivityCount,null);assert.equal(data.knownLinkedActivityCount,1);
 f.population('interface');data=position();assert.equal(data.blockerCount,0,'due on the reporting date is not overdue');assert.equal(data.openCount,1);assert.equal(data.linkedActivityCount,1);
 f.review(r,{'current status':'Unknown','required date':'2031-08-01'});f.population('interface');data=position();assert.equal(data.rows[0].state,'unknown');assert.equal(data.openCount,null);assert.equal(data.overdueCount,null);assert.equal(data.blockerCount,null);
});

test('Interface missing dates do not erase known blockers or fabricate assessed zero, and source records keep their authority',async t=>{
 const f=await fixture(t);
 await f.upload('Interfaces.csv','Interface ID,Current Status,Required Date,Linked Activity\nIF-BLOCKED,Blocked,,A1\nIF-OPEN,Open,,A2\nIF-CLOSED,Closed,,A2\nIF-MISSING,,,A1');
 f.population('interface');let data=deliveryModule(f.state,'delivery-interfaces').data as any;
 assert.equal(data.confirmedCount,0);assert.ok(data.rows.every((row:any)=>row.authority==='source'));
 assert.equal(data.knownBlockerCount,1);assert.equal(data.blockerCount,null);assert.equal(data.overdueCount,null);assert.equal(data.openCount,null);assert.equal(data.knownOpenCount,2);assert.equal(data.linkedActivityCount,2);
 assert.doesNotMatch(data.managementPosition,/confirmed interface/);assert.match(data.managementPosition,/source or reviewed/);
 const before=readFileSync(f.state.evidenceDocuments.find(d=>d.sourceFilename==='Interfaces.csv')!.storedPath!);
 const open=deliveryRecords(f.state).records.find(row=>row.reference==='IF-OPEN')!,missing=deliveryRecords(f.state).records.find(row=>row.reference==='IF-MISSING')!;
 f.review(open,{'required date':'2031-09-10'});f.review(missing,{'current status':'Closed'});f.population('interface');
 data=deliveryModule(f.state,'delivery-interfaces').data as any;assert.equal(data.blockerCount,1);assert.equal(data.overdueCount,null,'undated blocked item still has unknown overdue status');assert.equal(data.openCount,2);
 assert.deepEqual(readFileSync(f.state.evidenceDocuments.find(d=>d.sourceFilename==='Interfaces.csv')!.storedPath!),before);
});

test('Interface counts cover every source row and confirmed reviewed zero does not hide missing activity linkage',async t=>{
 const f=await fixture(t),csv='Interface ID,Current Status,Required Date,Linked Activity\n'+Array.from({length:620},(_,i)=>'IF-'+i+','+(i===619?'Blocked':'Closed')+',2031-09-10,'+(i===618?'':'A1')).join('\n');
 await f.upload('Full-Interfaces.csv',csv);f.population('interface');
 const data=deliveryModule(f.state,'delivery-interfaces').data as any;assert.equal(data.rows.length,620);assert.equal(data.blockerCount,1);assert.equal(data.openCount,1);assert.equal(data.overdueCount,0);assert.equal(data.linkedActivityCount,null);assert.equal(data.knownLinkedActivityCount,1);
 const last=deliveryRecords(f.state).records.find(r=>r.reference==='IF-619')!;f.review(last,{'current status':'Closed'});f.population('interface');
 assert.equal((deliveryModule(f.state,'delivery-interfaces').data as any).blockerCount,0);
});

test('Batch H Interface columns remain explicit after governance and never render undefined',async t=>{
 const f=await fixture(t);
 await f.upload('Interfaces.csv','Interface ID,Giving Party,Receiving Party,Package,Discipline,System,Location,Required Deliverable,Required Date,Current Status,Responsible Party,Consequence,Escalation\nIF-H,Designer,Contractor,MEP,Electrical,BMS,Zone 2,Approved sequence,2031-08-20,Blocked,Interface Manager,Workfront cannot proceed,Escalate coordination');
 const source=deliveryRecords(f.state).records.find(r=>r.reference==='IF-H')!;f.review(source);
 const data=deliveryModule(f.state,'delivery-interfaces').data as any,row=data.rows[0];
 assert.equal(data.title,'Interface Management');assert.equal(row.interfaceId,'IF-H');assert.equal(row.givingParty,'Designer');assert.equal(row.receivingParty,'Contractor');
 assert.equal(row.package,'MEP');assert.equal(row.discipline,'Electrical');assert.equal(row.system,'BMS');assert.equal(row.location,'Zone 2');
 assert.equal(row.requiredDeliverable,'Approved sequence');assert.equal(row.responsibleParty,'Interface Manager');assert.equal(row.consequence,'Workfront cannot proceed');assert.equal(row.escalation,'Escalate coordination');
 assert.ok(!JSON.stringify(row).match(/undefined/i));
 const uiSource=readFileSync(join(process.cwd(),'packages/runtime-api/src/ui.ts'),'utf8');for(const heading of ['Interface ID','Giving party','Receiving party','Package','Discipline','System','Location','Required deliverable','Required date','Responsible party','Activity','RFI','Submittal','Risk','Consequence','Escalation'])assert.match(uiSource,new RegExp(heading,'i'));
});

test('Batch H Quality and Commissioning rates require complete current populations and exclude future rows',async t=>{
 for(const kind of ['quality','commissioning'] as const){
  const f=await fixture(t);
  f.create(kind,'PASS',{'raised date':'2031-08-01','actual date':'2031-08-10','outcome date':'2031-08-10',outcome:'passed'});
  f.create(kind,'FAIL',{'raised date':'2031-08-01','actual date':'2031-08-11','outcome date':'2031-08-11',outcome:'failed'});
  f.create(kind,'FUTURE',{'raised date':'2031-09-01','actual date':'2031-09-02','outcome date':'2031-09-02',outcome:'passed'});
  let summary=deliveryPosition(f.state).summaries[kind]!;assert.equal(summary.passRatePercent,null);
  f.population(kind);summary=deliveryPosition(f.state).summaries[kind]!;
  assert.equal(summary.currentCount,2);assert.equal(summary.futureCount,1);assert.equal(summary.passRatePercent,50);assert.match(summary.basis,/confirmed complete set of current applicable records/i);
 }
});

test('original ABB outcome rates stay unknown when status coverage has no complete outcome coverage',async t=>{
 for(const kind of ['design','quality','commissioning'] as const){
  const f=await fixture(t);
  const pending=f.create(kind,'PENDING',{'raised date':'2031-08-01',status:'open'});
  f.population(kind);
  let summary=deliveryPosition(f.state).summaries[kind]!;
  assert.equal(summary.currentCount,1,'current status is established independently of an outcome');
  assert.equal(summary.knownOutcomeCount,0);assert.equal(summary.unknownOutcomeCount,1);
  assert.equal(summary.passRatePercent,null,'no known outcomes cannot establish zero passed');
  assert.equal(summary.passedCount,null);assert.equal(summary.failedCount,null);
  assert.equal(summary.knownPassedCount,0);assert.equal(summary.knownFailedCount,0);
  assert.match(summary.basis,/rate is withheld/);
  if(kind==='design')continue;
  f.create(kind,'FAIL',{'raised date':'2031-08-01','actual date':'2031-08-10','outcome date':'2031-08-10',outcome:'failed'});
  f.population(kind);summary=deliveryPosition(f.state).summaries[kind]!;
  assert.equal(summary.knownOutcomeCount,1);assert.equal(summary.unknownOutcomeCount,1);assert.equal(summary.passRatePercent,null);
  assert.equal(summary.failedCount,null);assert.equal(summary.knownFailedCount,1);
  f.review(pending,{status:'failed','actual date':'2031-08-11','outcome date':'2031-08-11'});
  f.population(kind);summary=deliveryPosition(f.state).summaries[kind]!;
  assert.equal(summary.knownOutcomeCount,2);assert.equal(summary.unknownOutcomeCount,0);
  assert.equal(summary.passRatePercent,0,'complete known failed outcomes establish an actual zero');
  assert.equal(summary.passedCount,0);assert.equal(summary.failedCount,2);
 }
});

test('original ABB approved submittals close their dated review across the full retained population',async t=>{
 const f=await fixture(t);
 const csv=['Submittal ID,Description,Status,Submitted Date,Approval Date',
  ...Array.from({length:620},(_,i)=>['SUB-'+i,'Drawing '+i,i<600?(i%2?'Approved with Comments':'Approved'):'Under Review','2031-08-01',i<600?'2031-08-20':''].join(',')),
  'FUTURE,Future review,Approved,2031-09-01,2031-09-10'].join('\n');
 await f.upload('Submittal-register.csv',csv);
 const originals=f.state.evidenceDocuments.map(d=>[d.storedPath,readFileSync(d.storedPath)] as const);
 const source=deliveryRecords(f.state).records.filter(r=>r.kind==='submittal');
 assert.equal(source.length,621);
 for(const r of source)f.review(r);
 f.population('submittal');
 const position=deliveryPosition(f.state),summary=position.summaries.submittal!;
 assert.equal(summary.currentCount,620);assert.equal(summary.futureCount,1);
 assert.equal(summary.closedCount,600);assert.equal(summary.openCount,20);
 assert.equal(summary.closurePercent,Math.round(600/620*100*10000)/10000);
 assert.equal(summary.knownOutcomeCount,0);assert.equal(summary.passRatePercent,null,'approval is not a test result');
 const module=deliveryModule(f.state,'delivery-submittals'),data=module.data as any;
 assert.equal(data.summary.closedCount,600);assert.equal(data.summary.passRatePercent,null);
 const html=runInNewContext(deliveryScript()+';deliveryObjectDetail(summary)',{summary:data.summary,Intl,escapeHtml:(v:unknown)=>String(v),fmt:(v:unknown)=>String(v),humanizeKey:(v:string)=>v});
 assert.match(html,/Closed Count<\/dt><dd>600/);
 assert.match(html,/Pass Rate Percent<\/dt><dd>Not established/);
 for(const [path,bytes] of originals)assert.deepEqual(readFileSync(path),bytes,'original source bytes retained');
});

test('Batch H readiness reconciles applicable, unknown and N/A gates and scope items',async t=>{
 const f=await fixture(t),ready=f.create('workfront','READY'),na=f.create('workfront','NA');
 f.create('gate','READY-G',{applicable:'yes','satisfied date':'2031-08-20'},{recordIds:[ready.recordId]});
 f.create('gate','READY-NA',{applicable:'no'},{recordIds:[ready.recordId]});
 f.create('gate','NA-G',{applicable:'no'},{recordIds:[na.recordId]});
 f.population('gate',ready.recordId);f.population('gate',na.recordId);
 const rows=deliveryPosition(f.state).readiness,readyRow=rows.find(r=>r.recordId===ready.recordId)!,naRow=rows.find(r=>r.recordId===na.recordId)!;
 assert.equal(readyRow.state,'ready');assert.equal(readyRow.applicableCount,1);assert.equal(readyRow.notApplicableCount,1);
 assert.equal(naRow.state,'not_applicable');assert.equal(naRow.applicableCount,0);assert.equal(naRow.notApplicableCount,1);assert.equal(naRow.readinessPercent,null);
 const data=deliveryModule(f.state,'construction-readiness').data as any;
 assert.equal(data.metrics.find((m:any)=>m.label==='Not applicable').value,1);assert.equal(data.metrics.find((m:any)=>m.label==='Reviewed scope').value,2);
});

test('Batch H record kind is deterministic under column permutation and ambiguous rows require governance',()=>{
 const receipt={documentId:'D',sourceHash:'H',revision:'R',locator:'row:1',basisState:'active',authority:'source_record' as const};
 const a:any={cells:{'package id':'P1','supplier id':'S1'},receipt},b:any={cells:{'supplier id':'S1','package id':'P1'},receipt};
 assert.equal(classifyDeliveryRowKind(a,'',null),null);assert.equal(classifyDeliveryRowKind(b,'',null),null);
 assert.equal(classifyDeliveryRowKind(a,'','package'),'package');assert.equal(classifyDeliveryRowKind(b,'','package'),'package');
 assert.equal(classifyDeliveryRowKind(a,'procurement_register',null),'package');assert.equal(classifyDeliveryRowKind(b,'procurement_register',null),'package');
 const permit:any={cells:{'permit id':'PER-1','supplier id':'SUP-1','issue date':'2031-08-01','expiry date':'2031-09-01'},receipt:{...receipt,locator:'page:3:line:1'}};
 assert.equal(classifyDeliveryRowKind(permit,'submittal_register',null),'permit','primary page signature outranks a foreign supplier ID and document-wide type');
 const explicit:any={cells:{'delivery record type':'interface','package id':'P1'},receipt};assert.equal(classifyDeliveryRowKind(explicit,'procurement_register',null),'interface');
});

test('Batch H schedule/WBS long-lead intelligence remains candidate and carries design/submittal dependencies',async t=>{
 const f=await fixture(t),model=projectControlSchedule(f.state)!.revision.model,activity=model.activities[0]!;
 (model.wbs as any[]).push({wbsId:'LL-WBS',name:'Long Lead Materials',parentWbsId:null,sourceRefs:[]});(activity as any).wbsId='LL-WBS';f.store.touch(f.state);
 f.create('design','DES-LL',{'raised date':'2031-08-01'},{activityIds:[activity.activityId]});f.create('submittal','SUB-LL',{'raised date':'2031-08-01'},{activityIds:[activity.activityId]});
 const data=deliveryModule(f.state,'long-lead').data as any,candidate=data.rows.find((r:any)=>r.candidateType==='schedule_wbs');
 assert.ok(candidate);assert.equal(candidate.authority,'candidate');assert.match(candidate.basis,/not a confirmed procurement package/i);
 assert.deepEqual(candidate.designDependencies,['DES-LL']);assert.deepEqual(candidate.submittalDependencies,['SUB-LL']);assert.equal(candidate.programmeNeedDate,'2031-09-30');
});

test('Batch H Delivery Control publishes action-first linked management constraints',async t=>{
 const f=await fixture(t),activity=projectControlSchedule(f.state)!.revision.model.activities[0]!;
 f.create('package','PK-H',{'forecast delivery date':'2031-10-10'},{activityIds:[activity.activityId]});
 const data=deliveryModule(f.state,'delivery-control').data as any,action=data.managementActions.find((r:any)=>/after the linked programme need date/i.test(r.issue));
 assert.ok(action);assert.equal(action.package,'PK-H');assert.equal(action.requiredDate,'2031-09-30');assert.equal(action.owner,null);
 assert.ok(action.affectedSchedule.some((v:string)=>v.includes(activity.activityId)));assert.match(action.consequence,/after the linked programme need date/i);assert.ok(action.action);
  assert.equal(action.requiredDate,'2031-09-30','source linked programme date is the action deadline, not a fabricated register date');
 assert.match(deliveryScript(),/Top Delivery constraints & required actions/);
});

test('Batch H Delivery navigation groups every specialist page without deleting capability',()=>{
 const delivery=moduleRegistry.filter(m=>m.area==='delivery');assert.equal(delivery.length,deliveryPages.length);
 const groups=new Map(delivery.map(m=>[m.key,m.group]));
 assert.equal(groups.get('delivery-control'),'Delivery Control');
 for(const key of ['procurement-packages','material-tracking','long-lead','procurement-scurves','delivery-suppliers','procurement-readiness'])assert.equal(groups.get(key),'Procurement & Long Lead');
 for(const key of ['delivery-design','delivery-submittals','delivery-interfaces'])assert.equal(groups.get(key),'Design & Interfaces');
 for(const key of ['construction-discipline','construction-locations','construction-readiness','delivery-permits'])assert.equal(groups.get(key),'Construction Control');
 for(const key of ['delivery-quality','delivery-hse'])assert.equal(groups.get(key),'Quality & HSE');
 for(const key of ['delivery-commissioning','delivery-assets','delivery-closeout','delivery-spares','handover-readiness'])assert.equal(groups.get(key),'Testing & Handover');
 for(const key of ['delivery-risks','delivery-weather'])assert.equal(groups.get(key),'Delivery Risk');
});

test('Batch H preserves BOQ candidate authority and Weather non-causation',async t=>{
 const f=await fixture(t);await f.upload('BOQ.csv','Item No,Description,Unit,Quantity,Rate,Amount,Currency\nLL1,Elevator equipment,no,2,100,200,AED');
 const procurement=deliveryModule(f.state,'procurement-packages').data as any;assert.ok(procurement.rows.length);assert.ok(procurement.rows.every((r:any)=>/candidate/i.test(r.currentStatus)));
 const longLead=deliveryModule(f.state,'long-lead').data as any;assert.ok(longLead.rows.some((r:any)=>r.authority==='candidate'));
 f.create('weather','WX-1',{'event start':'2031-08-10','event end':'2031-08-10','duration hours':8,'recorded working impact hours':4});
 const weather=deliveryPosition(f.state).weatherRows[0]!;assert.match(weather.causationBasis,/Recorded site facts only/i);assert.match(weather.causationBasis,/causation and entitlement remain/i);
 assert.match(deliveryPosition(f.state).authorityScope,/does not establish EOT or causation/i);
});

test('future approvals and closures do not improve historical position; rectification is not closure; unknown inspection outcomes are excluded',async t=>{
 const f=await fixture(t);f.create('submittal','FUTURE',{status:'Approved','raised date':'2031-08-01','approval date':'2031-09-10'});
 f.create('quality','NCR',{'raised date':'2031-08-01','due date':'2031-08-10','rectified date':'2031-08-20',status:'Closed'});
 f.create('quality','PASS',{'raised date':'2031-08-01','actual date':'2031-08-20',outcome:'passed','outcome date':'2031-08-20'});
 f.create('quality','UNKNOWN',{'raised date':'2031-08-01','actual date':'2031-08-20'});
 const p=deliveryPosition(f.state);assert.equal(p.registerRows.find(r=>r.reference==='FUTURE')!.currentStatus,'open');assert.equal(p.registerRows.find(r=>r.reference==='NCR')!.currentStatus,'open');assert.equal(p.summaries.quality!.passRatePercent,null,'known outcomes do not establish a complete applicable population');assert.equal(p.summaries.quality!.knownOutcomeCount,1);assert.equal(p.summaries.quality!.unknownOutcomeCount,2);assert.match(p.summaries.quality!.basis,/rate is withheld/i);
 f.create('hse','INCIDENT',{'incident date':'2031-08-01','lost time injuries':0,'frequency rate basis':1000000});f.population('hse');assert.equal(deliveryPosition(f.state).hsePosition.frequencyRate,null);
});

test('handover completion needs a complete population and verified source evidence; typed dates alone are insufficient',async t=>{
 const f=await fixture(t);await f.upload('Handover.csv','Requirement ID,Description,Raised Date,Due Date,Verification Date,Acceptance Date\nH1,Training,2031-08-01,2031-08-30,2031-08-20,2031-08-21');
 const h=deliveryRecords(f.state).records.find(r=>r.reference==='H1')!;f.review(h);
 assert.equal(deliveryPosition(f.state).handover.readinessPercent,null);f.population('handover');assert.equal(deliveryPosition(f.state).handover.readinessPercent,null);
 f.review(h,{}, {state:'verified'});f.population('handover');assert.equal(deliveryPosition(f.state).handover.readinessPercent,100);assert.equal(deliveryModule(f.state,'handover-readiness').status,'ready');
 f.create('handover','H2',{'raised date':'2031-08-10','due date':'2031-09-10',status:'Accepted'});assert.equal(deliveryPosition(f.state).handover.readinessPercent,null);
});

test('separate currency and count curves disclose excluded records; lifecycle weights produce exact chart points only with a complete denominator',async t=>{
 const f=await fixture(t),l=f.create('lifecycle','WEIGHTS',{stages:'po; delivery','po weight':25,'delivery weight':75});
 const a=f.create('package','A',{'lifecycle id':l.recordId,'weighting basis':'controlled management weight','management weight':3,'po actual date':'2031-08-01','delivery actual date':'2031-08-20','package value':100,currency:'USD'});
 f.create('package','B',{'lifecycle id':l.recordId,'weighting basis':'controlled management weight','management weight':1,'po actual date':'2031-08-10','delivery actual date':'2031-09-20','package value':200,currency:'AED'});
 assert.equal(deliveryPosition(f.state).weightedGroups[0]!.value,null);f.population('package');const p=deliveryPosition(f.state);assert.equal(p.weightedGroups[0]!.value,81.25);
 const c=p.curves.find(c=>c.kind==='weighted_procurement_progress'&&c.series==='actual')!;assert.deepEqual(c.points.map((p:any)=>p.value),[18.75,25,81.25]);assert.equal(c.denominator,4);
 const amounts=p.curves.filter(c=>c.kind==='commitment_value');assert.deepEqual(amounts.map(c=>[c.unit,c.points.at(-1).value]),[['USD',100],['AED',200]]);
 f.review(a,{'management weight':null});assert.equal(deliveryPosition(f.state).weightedGroups[0]!.value,null);
});

test('review history persists; partial edits retain prior decisions; collisions require explicit supersession and stale concurrent saves fail',async t=>{
 const f=await fixture(t);let a=f.create('supplier','S1',{company:'Company'});a=f.review(a,{owner:'Alice'});f.review(a,{contact:'Contact'});assert.equal(deliveryRecords(f.state).records.find(r=>r.recordId===a.recordId)!.fields.owner,'Alice');
 const version=f.state.version;f.create('supplier','S2');assert.throws(()=>f.change({action:'create',kind:'supplier',fields:{'record reference':'STALE'},expectedVersion:version}),/PROJECT_VERSION_CHANGED/);
 const other=f.store.getOrCreate('OTHER');assert.throws(()=>changeDelivery(other,{expectedVersion:other.version,action:'review',recordId:a.recordId,sourceRevision:a.revision,state:'governed',note:'Other project'}),/Source revision/);
 const b=f.create('supplier','S1');assert.equal(deliveryRecords(f.state).records.find(r=>r.recordId===a.recordId)!.state,'conflicted');f.review(b,{}, {supersedesId:a.recordId});assert.equal(deliveryRecords(f.state).records.find(r=>r.recordId===a.recordId)!.state,'superseded');
 f.review(b,{contact:'Updated contact'});assert.equal(deliveryRecords(f.state).records.find(r=>r.recordId===a.recordId)!.state,'superseded');assert.equal(deliveryStore(f.state).decisions.at(-1)!.supersedesId,a.recordId);
 assert.throws(()=>f.review(a,{}, {supersedesId:b.recordId}),/supersession.*cycle/);
 f.create('package','LINKED',{}, {supplierIds:[b.recordId]});f.population('supplier');
 const restored=new RuntimeProjectStore({dataDir:f.dir,durable:false}).get(f.state.projectId)!;assert.deepEqual(deliveryStore(restored),deliveryStore(f.state));assert.equal(deliveryRecords(restored).records.find(r=>r.recordId===b.recordId)!.state,'governed');assert.equal(deliveryRecords(other).records.length,0);
});

test('source mapping retains raw hashes; importing a revision cannot silently govern it',async t=>{
 const f=await fixture(t);const upload=await f.upload('Unusual.csv','Control Number,Equipment Scope,Maker\nEQ1,Elevator,Vendor');const doc=f.state.evidenceDocuments.find(d=>d.documentId===upload.documentId)!;
 f.change({action:'map_document',documentId:doc.documentId,sourceHash:doc.sourceHashSha256,kind:'package',columns:{'record reference':'Control Number',description:'Equipment Scope'}});
 const candidate=deliveryRecords(f.state).records.find(r=>r.reference==='EQ1')!;assert.equal(candidate.state,'extracted_candidate');assert.equal(candidate.receipts[0]!.sourceHash,doc.sourceHashSha256);const position=deliveryPosition(f.state);assert.equal(position.packageRows.length,1);assert.equal(position.packageRows[0]!.sourceState,'extracted_candidate');assert.equal(position.populations.package!.state,'not_established');
});

test('exports include every curve point beyond row 20, all parent keys and project scope',async()=>{
 const result:any={key:'procurement-scurves',status:'partial',reason:'Dated governed subset',data:{projectionKey:'delivery',curves:[{key:'curve-1',points:Array.from({length:63},(_,i)=>({dateIso:'2031-08-01',value:i,recordIds:['P'+i]}))}]}};
 const buffer=await buildDeliveryWorkbook('PROJECT-A',result),book=new ExcelJS.Workbook();await book.xlsx.load(buffer as any);const points=book.worksheets.find(w=>w.name.endsWith('points'))!;assert.equal(points.rowCount,64);assert.ok((points.getRow(64).values as any[]).includes('PROJECT-A'));assert.ok((points.getRow(64).values as any[]).includes(62));
});

test('UI pagination, filtering, sorting and chart labels preserve zero and unavailable distinctions',()=>{
 new Script(deliveryScript());const context:any={escapeHtml:(x:any)=>String(x)};runInNewContext(deliveryScript()+';globalThis.deliveryValue=deliveryValue;',context);assert.equal(context.deliveryValue(null),STATUS_LABELS.not_established);assert.equal(context.deliveryValue(0),'0');assert.notEqual(context.deliveryValue(null),context.deliveryValue(0));
 const table={rows:Array.from({length:63},(_,i)=>({reference:'R'+i,state:i%2?'working':'governed',quantity:63-i})),query:'',filter:'governed',sort:'quantity',direction:1};const filtered=context.deliveryFiltered(table);assert.equal(filtered.length,32);assert.equal(filtered[0].quantity,1);table.filter='';table.query='R62';assert.equal(context.deliveryFiltered(table).length,1);
});

test('Delivery display preserves exact record references and quantities while formatting dates and risk states',()=>{
 const context:any={escapeHtml:(x:any)=>String(x)};runInNewContext(deliveryScript()+';globalThis.show=deliveryValue;',context);
 assert.equal(context.show(1450000000),'1,450,000,000');assert.equal(context.show(0.0001),'<0.01');assert.equal(context.show(-50),'-50');
 assert.equal(context.show('2026-08-31'),'Aug 31, 2026');assert.equal(context.show('2031-09-30T08:00:00Z'),'Sep 30, 2031');
 assert.equal(context.show('2026-02-31'),'2026-02-31');assert.equal(context.show('S03_2026-08-31.xer'),'S03_2026-08-31.xer');assert.equal(context.show('001200'),'001200');
 const rows=[{riskId:'R1',status:'open'},{riskId:'R2',status:'closed'}];
 assert.deepEqual(Array.from(context.deliveryFiltered({rows,query:'',filter:'open',sort:null}), (r:any)=>r.riskId),['R1']);
 const markup=context.deliveryTable('risk','Risk register',rows,[['riskId','Risk']]);assert.match(markup,/<option value="open">Open<\/option>/);
 const review=context.deliveryTable('review','Record review',[{state:'extracted_candidate'}],[['state','Review state']]);assert.match(review,/<option value="extracted_candidate">From register, not yet confirmed<\/option>/);
});

test('Delivery Risks uses the existing risk population, not unrelated procurement candidates or population decisions',async t=>{
 const f=await fixture(t);await f.upload('Procurement.csv','Package ID,Description\nP1,Unrelated package\nP2,Another package');
 let report=deliveryModule(f.state,'delivery-risks');assert.equal(report.status,'blocked');assert.match(report.reason!,/No confirmed Project Risk Register is available/);assert.equal((report.data as any).reviewRecords.length,0);
 await f.upload('Risks.csv','Risk ID,Description,Status,Identified Date,Probability,Impact,Rating\nR1,Current risk,Open,2031-08-01,0.4,3,Medium\nR2,Future risk,Open,2031-09-10,0.2,2,Low');
 report=deliveryModule(f.state,'delivery-risks');assert.equal(report.status,'ready');assert.match(report.reason!,/2 risk records are supplied: 1 current, 1 after/);
 assert.equal((report.data as any).population.kind,'risk');assert.equal((report.data as any).population.denominator,1);assert.equal((report.data as any).metrics.find((m:any)=>m.label==='Open at reporting date').value,1);assert.equal((report.data as any).reviewRecords.length,0);
 const linked=f.create('workfront','WF1',{}, {riskIds:['R1']});report=deliveryModule(f.state,'delivery-risks');assert.deepEqual((report.data as any).reviewRecords.map((r:any)=>r.recordId),[linked.recordId]);
 const exported=deliveryExportResult(f.state,report).data as any;
 assert.deepEqual(exported.sourceRecords.map((r:any)=>r.recordId),[linked.recordId]);
 assert.ok(exported.reviewHistory.every((r:any)=>r.recordId===linked.recordId));
 assert.equal(exported.riskBasis.sourceRows.length,2,'the complete original risk source remains in the export');
 assert.equal(exported.riskBasis.future.length,1,'future risk evidence remains separate and available');
 assert.equal((report.data as any).rows[0].score,1.2);assert.equal((report.data as any).population.denominator,1);
});


test('HSE rates require matching non-overlapping exposure periods and an explicit complete incident population',async t=>{
 const f=await fixture(t);f.create('hse','HOURS',{type:'exposure','exposure scope':'All site personnel','period start':'2031-08-01','period end':'2031-08-31','report date':'2031-08-31','man hours':100000,'frequency rate basis':1000000});
 f.create('hse','LTI',{type:'incident','exposure scope':'All site personnel','incident date':'2031-08-20','lost time injuries':1});
 assert.equal(deliveryPosition(f.state).hsePosition.frequencyRate,null);f.population('hse');assert.equal(deliveryPosition(f.state).hsePosition.frequencyRate,10);
 f.create('hse','DUPLICATE-PERIOD',{type:'exposure','exposure scope':'All site personnel','period start':'2031-08-15','period end':'2031-08-31','report date':'2031-08-31','man hours':50000,'frequency rate basis':1000000});f.population('hse');
 assert.equal(deliveryPosition(f.state).hsePosition.frequencyRate,null);assert.match(deliveryPosition(f.state).hsePosition.explanation,/Overlapping/);
});

test('BOQ mapping dimensions and installed curves use stable package populations and compatible units',async t=>{
 const f=await fixture(t);await f.upload('BOQ.csv','Item No,Description,Unit,Quantity,Rate,Amount,Currency\n1,Concrete,m3,100,2,200,USD\n2,Cable,m,50,4,200,AED');
 await f.upload('Measured.csv','Measurement Date,Item No,Cumulative Installed Qty,Unit\n2031-08-01,1,10,m3\n2031-08-20,1,60,m3');
 const item=resolveBoqSource(f.state,'').quantities!.items[0]!,location=f.create('location','AREA',{description:'Area'});
 const pkg=f.create('package','PK',{discipline:'Civil'},{boqItemIds:[item.quantityItemId],locationIds:[location.recordId]});
 f.create('workfront','WF',{discipline:'Civil'},{boqItemIds:[item.quantityItemId],packageIds:[pkg.recordId]});f.population('package');
 const p=deliveryPosition(f.state);assert.equal(p.boqIntelligence.mappingCoverage.find(r=>r.dimension==='location')!.percent,50);assert.equal(p.boqIntelligence.valueByDiscipline[0]!.value,200);assert.equal(p.boqIntelligence.quantityPopulations.length,2);
 const curve=p.curves.find(c=>c.kind==='material_quantity'&&c.stage==='installed')!;assert.equal(curve.coveragePercent,100);assert.deepEqual(curve.includedRecordIds,[pkg.recordId]);assert.deepEqual(curve.points.map((x:any)=>x.value),[10,60]);
});

test('Delivery reuses existing risk identities and scoring; foreign or invented risk links are rejected',async t=>{
 const f=await fixture(t);await f.upload('Risks.csv','Risk ID,Description,Category,Status,Identified Date,Probability,Impact,Rating\nR1,Delivery risk,Procurement,Open,2031-08-01,0.4,3,Medium');
 const risk=deliveryAuthorityCatalog(f.state,'risk');assert.equal(risk[0]!.id,'R1');
 const activity=projectControlSchedule(f.state)!.revision.model.activities[0]!;
 const pkg=f.create('package','PK',{description:'Chiller'}, {riskIds:['R1'],activityIds:[activity.activityId]});
 const rows=deliveryPosition(f.state).riskRows;assert.equal(rows[0]!.score,1.2);assert.deepEqual(rows[0]!.deliveryRecordIds,[pkg.recordId]);assert.equal(rows[0]!.programmeExposure[0]!.criticality,'near_critical');
 assert.throws(()=>f.review(pkg,{}, {links:{riskIds:['OTHER-PROJECT-RISK']}}),/risk link/);
});

test('retained native and OCR pages create review candidates with physical page receipts; unread pages stay disclosed',async t=>{
 const f=await fixture(t),bytes=Buffer.from('Retained PDF byte identity for source-receipt test'),storedPath=join(f.dir,'receipt.pdf');writeFileSync(storedPath,bytes);const hash=createHash('sha256').update(bytes).digest('hex');
 const doc:any={documentId:'PDF-RECEIPT',sourceFilename:'Delivery evidence.pdf',sourceHashSha256:hash,storedPath,mediaType:'application/pdf',basisState:'historical',documentType:'supporting_document',linkedArtifactId:null,uploadedAt:'2031-09-01',supersededByDocumentId:null,fullTextRead:{sourceHashSha256:hash,producerVersion:'full-page-read-v1',completedAt:'2031-09-01',result:{complete:false,pages:[{pageNumber:1,method:'native',text:'Package ID: PK-NATIVE\nDescription: Chiller\nOrdered Quantity: 2'},{pageNumber:2,method:'ocr',text:'Submittal ID: SUB-OCR\nDescription: Technical approval\nActual Issue: 2031-08-15'},{pageNumber:3,method:'failed',text:''}]}}};
 f.state.evidenceDocuments.push(doc);f.store.touch(f.state);let p=deliveryPosition(f.state);const candidate=p.records.find(r=>r.reference==='SUB-OCR')!;assert.equal(candidate.state,'extracted_candidate');assert.equal(candidate.receipts[0]!.locator,'page:2:line:1');assert.equal(candidate.receipts[0]!.sourceHash,hash);assert.ok(p.diagnostics.some(d=>d.includes('PHYSICAL_PAGE_COVERAGE_INCOMPLETE')));assert.equal(p.packageRows.length,1);assert.equal(p.packageRows[0]!.sourceState,'extracted_candidate');assert.equal(p.populations.package!.state,'not_established');
 f.review(candidate);assert.equal(deliveryPosition(f.state).registerRows.find(r=>r.reference==='SUB-OCR')!.currentStatus,'performed');
 assert.throws(()=>f.population('submittal'),/physical-page/);
 doc.fullTextRead.result.complete=true;f.store.touch(f.state);f.population('submittal');assert.equal(deliveryPosition(f.state).populations.submittal!.denominator,1);
 doc.fullTextRead.result.complete=false;f.store.touch(f.state);assert.equal(deliveryPosition(f.state).populations.submittal!.denominator,null);
 doc.supersededByDocumentId='NEW-REVISION';f.store.touch(f.state);assert.equal(deliveryRecords(f.state).records.find(r=>r.reference==='SUB-OCR')!.state,'superseded');
});


test('explicit Delivery schemas cannot displace existing BOQ or HSE authority; multi-kind coverage stays per register',async t=>{
 const f=await fixture(t);await f.upload('Delivery.csv','Delivery Record Type,Record Reference,Description,Man Hours,Lost Time Injuries\npackage,PK1,Chiller,,\nhse,HSE1,Exposure,1000,0');
 const doc=f.state.evidenceDocuments.find(d=>d.sourceFilename==='Delivery.csv')!;assert.equal(doc.documentType,'delivery_register');
 const p=deliveryPosition(f.state);assert.equal(p.records.length,2);assert.deepEqual(p.documents.map(d=>d.kind).sort(),['hse','package']);assert.equal(p.hsePosition.frequencyRate,null);
});


test('Delivery cannot call a record overdue when its due date is not established',async t=>{
 const f=await fixture(t);
 const snag=f.create('snag','NO-DUE',{'raised date':'2031-08-01','status as of':'2031-08-31',status:'Overdue'});
 f.population('snag');
 const position=deliveryPosition(f.state),row=position.registerRows.find(r=>r.recordId===snag.recordId)!;
 assert.equal(row.dueDate,null);
 assert.equal(row.overdue,null);
 assert.equal(row.currentStatus,'open');
 assert.ok(position.findings.some(x=>x.code==='DELIVERY_LATENESS_DUE_DATE_REQUIRED'&&x.recordId===snag.recordId));
 const page=deliveryModule(f.state,'delivery-closeout').data as any;
 const rendered=page.rows.find((r:any)=>r.recordId===snag.recordId);
 assert.equal(rendered.overdue,null);
 assert.equal(rendered.dueDate,null);
});


test('source RFI answers and future closures use the shared dated lifecycle before confirmation',async t=>{
 const f=await fixture(t);
 await f.upload('RFI.csv','RFI ID,Description,Raised Date,Response Date,Required Response,Status\nR1,Answered query,2031-08-01,2031-08-10,2031-08-05,Answered\nR2,Future answer,2031-08-01,2031-09-01,2031-08-15,Closed\nR3,Pending query,2031-08-01,,2031-09-05,Open');
 const p=deliveryPosition(f.state),summary=p.summaries.design!;
 assert.equal(p.registerRows.find(r=>r.reference==='R1')!.currentStatus,'closed');
 assert.equal(p.registerRows.find(r=>r.reference==='R1')!.overdue,false);
 assert.equal(p.registerRows.find(r=>r.reference==='R2')!.currentStatus,'open');
 assert.equal(summary.knownOpenCount,p.existingAuthorities.rfi.current.filter(r=>r.status==='open').length);
 assert.equal(summary.knownOpenCount,2);
 assert.equal(summary.knownOverdueCount,1);
 assert.ok(!p.findings.some(r=>r.code==='RECORD_OVERDUE'&&r.recordId===p.registerRows.find(r=>r.reference==='R1')!.recordId));
});

test('clean source register establishes package counts and lateness before approval; one completeness decision unlocks percentages',async t=>{
 const f=await fixture(t);
 await f.upload('Procurement.csv','Package ID,Description,Required On Site,Forecast Delivery,Owner\nPK1,Fire pumps,2031-08-01,2031-08-15,MEP Lead\nPK2,Cables,2031-09-01,2031-08-15,Electrical Lead');
 const dashboard=deliveryDashboard(f.state);assert.equal(dashboard.knownPackageRecordCount,2);assert.equal(dashboard.latePackageKnownCount,1);assert.equal(dashboard.confirmedPackageCount,null);
 f.population('package');assert.equal(deliveryPosition(f.state).populations.package!.denominator,2);
 assert.equal(deliveryRecords(f.state).records.find(r=>r.reference==='PK1')!.state,'extracted_candidate','confirming completeness does not pretend each row has been certified');
});

test('quality records with inconsistent close dates remain separate from known open records',async t=>{
 const f=await fixture(t);
 await f.upload('NCR.csv','NCR ID,Description,Raised Date,Closed Date,Status\nN1,Unresolved closure,2031-08-20,2031-08-10,Closed\nN2,Open defect,2031-08-01,,Open\nN3,Closed defect,2031-08-01,2031-08-10,Closed');
 const p=deliveryPosition(f.state),summary=p.summaries.quality!;
 assert.equal(summary.knownOpenCount,1);assert.equal(summary.unknownStatusCount,1);
 const page:any=deliveryModule(f.state,'delivery-quality').data;
 assert.equal(page.metrics.find((m:any)=>m.label==='Open records').value,1);
 assert.equal(page.metrics.find((m:any)=>m.label==='Status unclear').value,1);
});

test('a package without a calculated driving network does not report that it is off the path',async t=>{
 const f=await fixture(t);
 f.create('package','PKG-UNKNOWN',{'required on site':'2031-09-01','forecast delivery':'2031-10-01',status:'Ordered'},{activityIds:['A1']});
 const model=projectControlSchedule(f.state)!.revision.model;model.calendars=[];f.state.version++;
 const row=deliveryPosition(f.state).packageRows.find(r=>r.reference==='PKG-UNKNOWN')!;
 assert.equal(row.drivingPath,null);
});

test('undated supplied risks remain the main risk register instead of being replaced by BOQ candidates',async t=>{
 const f=await fixture(t);
 await f.upload('Risk.csv','Risk ID,Description,Status,Rating,Probability,Impact,Owner,Due Date\nR1,Supply risk,Mitigating,High,0.4,3,Buyer,2031-09-10\nR2,Closed risk,Closed,Low,0.2,1,Planner,2031-09-20');
 const page:any=deliveryModule(f.state,'delivery-risks').data;
 assert.equal(page.boqDerivedCandidate,false);assert.equal(page.rows.length,2);
 assert.equal(page.rows[0].reportingScope,'Reporting date missing');
 assert.equal(page.metrics.find((m:any)=>m.label==='Reported open / mitigating').value,1);
 assert.equal(page.metrics.find((m:any)=>m.label==='Open at reporting date').value,null);
 assert.equal(page.metrics.find((m:any)=>m.label==='Reporting date missing').value,2);
});

test('one source-bound procurement decision changes delivery and readiness without rewriting source dates',async t=>{
 const {procurementDateBasis}=await import('../packages/runtime-api/src/procurement-date-basis');
 const {reportingReadinessEvidence}=await import('../packages/runtime-api/src/evidence-readiness');
 const {projectActions}=await import('../packages/runtime-api/src/project-actions');
 const f=await fixture(t);
 await f.upload('Procurement.csv','Package ID,Description,Required On Site,Forecast Delivery,Status,Linked Activity\nP1,Pump,2031-08-29,2031-09-19,Ordered,A1');
 const before=deliveryPosition(f.state).packageRows[0]!;assert.equal(before.overdueUndelivered,true);
 const workflow=projectActions(f.state,{issues:[]} as any);const action=workflow.actions.find(a=>a.target.kind==='review-procurement-date');assert.ok(action);
 const fingerprint=procurementDateBasis(f.state).sourceFingerprint;
 f.store.updateControls(f.state.projectId,{reviewDecisions:{'procurement-date-basis':{choice:'programme',sourceFingerprint:fingerprint,confirmedAt:'2031-09-01',sourceRefs:[]}}});
 assert.equal(procurementDateBasis(f.state).choice,'programme');
 const after=deliveryPosition(f.state).packageRows[0]!;assert.equal(after.needDate,'2031-09-30');assert.equal(after.sourceRequiredOnSite,'2031-08-29');assert.equal(after.overdueUndelivered,false);assert.equal(after.forecastLate,false);
 const readiness=reportingReadinessEvidence(f.state,'2031-08-31');assert.ok(Object.values(readiness.A1??{}).every(value=>value?.state!=='blocked'));
 const reloaded=new RuntimeProjectStore({dataDir:f.dir,durable:false}).get(f.state.projectId)!;assert.equal(procurementDateBasis(reloaded).choice,'programme');
 const revised=projectActions(f.state,{issues:[]} as any);assert.ok(revised.information.some(a=>a.target.kind==='review-procurement-date'));
 f.state.evidenceDocuments.find(d=>d.documentType==='procurement_register')!.sourceHashSha256='changed-source';f.state.version++;
 assert.equal(procurementDateBasis(f.state).choice,null);
});

test('older BOQ imports recover cost codes from retained source without new quantities or allocations',async t=>{
 const f=await fixture(t);await f.upload('BOQ.csv','Item No,Cost Code,Description,Unit,Quantity,Rate,Amount,Currency\n1,CC-002,Concrete,m3,2,50,100,AED');
 assert.ok(f.state.boq);
 for(const row of f.state.boq!.canonicalItems)delete row.costCode;
 for(const row of f.state.quantities?.items??[])delete row.costCode;
 const original=JSON.stringify(f.state.quantities);
 const result=resolveBoqSource(f.state,projectControlSchedule(f.state)!.revision.model.sourceRevisionId);
 assert.equal(result.quantities?.items[0]?.costCode,'CC-002');assert.equal(result.quantities?.items[0]?.contractQuantity,2);assert.equal(result.quantities?.allocations.length,0);
 assert.equal(JSON.stringify(f.state.quantities),original);
 const {linkDataset}=await import('../packages/runtime-api/src/link-candidates');
 assert.match(linkDataset(f.state,'boq_activity').sources[0]!.description,/Cost code CC-002/);
});

test('source procurement references resolve uniquely and remain visible in package readiness without invented gate authority',async t=>{
 const f=await fixture(t);
 await f.upload('Procurement.csv','Package ID,Description,Status,Required On Site\nPKG-1,Pump,Ordered,2031-09-30');
 await f.upload('Submittals.csv','Submittal ID,Description,Procurement Package,Revision,Actual Issue,Approval Date,Status\nSUB-1,Pump drawing,PKG-1,A,2031-08-01,2031-08-20,Approved\nSUB-2,Pump revision,PKG-1,B,2031-08-20,2031-09-10,Approved\nSUB-3,Missing package,PKG-MISSING,A,2031-08-01,,Pending');
 const original=JSON.stringify(f.state.evidenceDocuments);
 const all=deliveryRecords(f.state).records,pack=all.find(r=>r.reference==='PKG-1')!,sub=all.find(r=>r.reference==='SUB-1')!;
 assert.equal(sub.kind,'submittal');assert.equal(sub.fields['package id'],'PKG-1');assert.deepEqual(sub.links.packageIds,[pack.recordId]);
 const row=deliveryPosition(f.state).readiness.find(r=>r.recordId===pack.recordId)!;
 assert.deepEqual(row.linkedSubmittals.map(r=>[r.reference,r.approvedAtDataDate]),[['SUB-1',true],['SUB-2',false]]);
 assert.equal(row.readinessPercent,null,'two linked approvals cannot establish a complete gate denominator');
 assert.notEqual(row.state,'ready');assert.equal(JSON.stringify(f.state.evidenceDocuments),original);
 assert.ok(deliveryPosition(f.state).findings.some(r=>r.code==='STALE_RELATIONSHIP'&&r.recordId===all.find(r=>r.reference==='SUB-3')!.recordId));
 f.create('package','PKG-1',{'required on site':'2031-09-30'});
 assert.deepEqual(deliveryRecords(f.state).records.find(r=>r.reference==='SUB-1')!.links.packageIds,['PKG-1'],'duplicate package references never pick an arbitrary record');
 assert.ok(deliveryPosition(f.state).findings.some(r=>r.code==='STALE_RELATIONSHIP'&&r.recordId===sub.recordId));
});

test('asset register flags, criticality and text locations reach asset and handover views without invented dates or acceptance',async t=>{
 const f=await fixture(t);
 await f.upload('Assets.csv','Asset ID,System,Description,Location,Criticality,Tag Installed,Commissioned,O&M Manual,Warranty\nAS-1,HVAC,Air handling unit,Level 2,High,Yes,No,Received,Valid\nAS-2,ICT,Network cabinet,Control room,Medium,No,Yes,Pending,Pending');
 const original=JSON.stringify(f.state.evidenceDocuments),assets=deliveryModule(f.state,'delivery-assets').data as any;
 assert.equal(assets.rows.length,2);
 const a=assets.rows.find((r:any)=>r.reference==='AS-1');
 assert.deepEqual([a.system,a.location,a.criticality,a.tagInstalledStatus,a.commissionedStatus,a.omManualStatus,a.warrantyStatus],['HVAC','Level 2','High','Yes','No','Received','Valid']);
 assert.equal(a.installationDate,null);assert.equal(a.commissioningDate,null);assert.equal(a.takingOverDate,null);assert.equal(a.statusAsOfIso,null);assert.match(a.sourceStatusBasis,/no status date/);
 const handover=deliveryModule(f.state,'handover-readiness').data as any;
 assert.deepEqual(handover.assetSourceRows,assets.rows);assert.equal(handover.handover.readinessPercent,null);
 const ui=runInNewContext(deliveryScript()+';({columns:deliveryColumns("delivery-assets"),ready:deliveryColumns("procurement-readiness"),submittals:deliveryColumns("delivery-submittals")})',{Intl});
 for(const key of ['location','criticality','tagInstalledStatus','commissionedStatus','omManualStatus','warrantyStatus'])assert.ok(ui.columns.some(([k]:string[])=>k===key));
 assert.ok(ui.ready.some(([k]:string[])=>k==='linkedSubmittals'));assert.ok(ui.submittals.some(([k]:string[])=>k==='linkedPackages'));
 const book=new ExcelJS.Workbook();await book.xlsx.load(await buildDeliveryWorkbook(f.state.projectId,deliveryModule(f.state,'handover-readiness')) as any);
 const sheet=book.worksheets.find(s=>s.name.endsWith('assetSourceRows'))!;assert.ok(sheet);assert.equal(sheet.rowCount,3);assert.ok(deliveryColumnKeys(book,sheet.name).includes('tagInstalledStatus'));assert.ok((sheet.getRow(1).values as any[]).includes('Tag installed status'));assert.equal(JSON.stringify(f.state.evidenceDocuments),original);
});

test('procurement lateness checks recognize the supplied required-on-site date',async t=>{
 const f=await fixture(t);await f.upload('Procurement.csv','Package ID,Description,Status,Required On Site\nPKG-LATE,Pump,Late,2031-08-20');
 const p=deliveryPosition(f.state),r=p.registerRows.find(r=>r.reference==='PKG-LATE')!;
 assert.equal(r.dueDate,'2031-08-20');assert.equal(p.findings.some(x=>x.recordId===r.recordId&&x.code==='DELIVERY_LATENESS_DUE_DATE_REQUIRED'),false);
});

test('completed programme work retains open procurement in a separate close-out action group',async t=>{
 const f=await fixture(t),model=projectControlSchedule(f.state)!.revision.model;
 model.activities[0]!.status='completed';model.activities[0]!.actualFinishIso='2031-08-01';f.store.touch(f.state);
 f.create('package','CLOSE-OUT',{status:'Manufacturing','required on site':'2031-08-10','forecast delivery':'2031-09-05'},{activityIds:['A1']});
 f.create('package','NO-DATE',{status:'Awarded'},{activityIds:['A1']});
 f.create('package','DELIVERED',{status:'Delivered','actual delivery':'2031-08-01'},{activityIds:['A1']});
 f.create('package','ACTIVE',{status:'Ordered','required on site':'2031-08-10','forecast delivery':'2031-09-05'},{activityIds:['A2']});
 const before=JSON.stringify(f.state.controls),p=crossDomainAccountability(f.state);
 const cleanup=p.ownerGroups.find(g=>g.register==='procurement-packages'&&g.state==='register_cleanup')!;
 const live=p.ownerGroups.find(g=>g.register==='procurement-packages'&&g.state==='active_control')!;
 assert.equal(cleanup.count,2);assert.equal(live.count,1);assert.equal(p.recordActions.filter(a=>a.owningModule==='procurement-packages').length,3);
 const action=p.actions.find(a=>a.actionId===cleanup.groupId)!;
 assert.match(action.issue,/Close-out review/);assert.match(action.requiredAction,/completed programme work/);assert.equal(action.dueIso,null);assert.equal(action.sourceDueIso,'2031-08-10');assert.equal(action.sourceOverdueDays,21);
 assert.match(action.escalation??'',/1 overdue source record/);assert.match(p.actions.find(a=>a.actionId===live.groupId)!.escalation??'',/overdue source record/);
 assert.equal(JSON.stringify(f.state.controls),before);
});

test('late procurement forecasts do not create already-overdue escalation before the source need date',async t=>{
 const f=await fixture(t),supplier=f.create('supplier','VENDOR',{company:'Vendor'});
 f.create('package','FUTURE-NEED',{status:'Ordered','required on site':'2031-09-10','forecast delivery':'2031-09-20'},{supplierIds:[supplier.recordId]});
 const p=crossDomainAccountability(f.state),action=p.actions.find(a=>a.owningModule==='procurement-packages')!;
 assert.ok(action);assert.equal(action.escalation,null);assert.equal(action.sourceOverdueCount,0);assert.equal(action.sourceOverdueDays,0);
 assert.ok(p.details.every(d=>d.overdueDays===0));
});

test('reported delivery stays unresolved when its date conflicts; forecast source points remain qualified and reviewable',async t=>{
 const f=await fixture(t);
 const pkg=f.create('package','CONFLICT',{status:'Delivered','forecast delivery':'2031-09-05','required on site':'2031-08-10'},{activityIds:['A1']});
 const before=JSON.stringify(f.state.controls),p=deliveryPosition(f.state),row=p.packageRows.find(r=>r.recordId===pkg.recordId)!;
 assert.equal(row.deliveryDateConflict,true);assert.equal(row.deliveredAtDataDate,false);assert.equal(row.deliveredStatusOnly,true);assert.equal(row.forecastLate,false);
 assert.equal(row.readiness!.state,'unknown');assert.equal(row.readiness!.readinessPercent,null);
 assert.ok(p.findings.some(r=>r.code==='PROCUREMENT_DELIVERY_DATE_CONFLICT'&&r.recordId===pkg.recordId));
 const curve=p.curves.find(c=>c.kind==='throughput'&&c.stage==='delivery'&&c.series==='forecast')!;
 assert.equal(curve.points[0]!.dateIso,'2031-09-05');assert.equal(curve.sourceDateConflictCount,1);assert.deepEqual(curve.sourceDateConflictRecordIds,[pkg.recordId]);assert.match(curve.qualification!,/Source forecast retained/);
 const page=deliveryModule(f.state,'procurement-readiness').data as any;
 assert.equal(page.metrics.find((m:any)=>m.label==='Ready · known subset').value,0);assert.equal(page.metrics.find((m:any)=>m.label==='Unknown readiness').value,1);
 assert.equal(JSON.stringify(f.state.controls),before);
 f.review(pkg,{'actual delivery':'2031-08-20'});
 const corrected=deliveryPosition(f.state).packageRows.find(r=>r.recordId===pkg.recordId)!;
 assert.equal(corrected.deliveryDateConflict,false);assert.equal(corrected.readiness!.state,'ready');
 assert.equal(deliveryRecords(f.state).records.find(r=>r.recordId===pkg.recordId)!.fields['forecast delivery'],'2031-09-05','review does not erase the retained original forecast');
});

test('package readiness requires linked submittal evidence even when delivery is dated',async t=>{
 const f=await fixture(t),pkg=f.create('package','DELIVERED-WITH-DESIGN',{status:'Delivered','actual delivery':'2031-08-20'});
 const sub=f.create('submittal','SUB-PENDING',{status:'Under Review'},{packageIds:[pkg.recordId]});
 const ready=()=>deliveryPosition(f.state).packageRows.find(r=>r.recordId===pkg.recordId)!.readiness!;
 assert.equal(ready().state,'unknown');assert.equal(ready().linkedSubmittals[0]!.approvedAtDataDate,null);
 f.review(sub,{status:'Approved','approval date':'2031-09-05'});assert.equal(ready().state,'unknown');
 let current=deliveryRecords(f.state).records.find(r=>r.recordId===sub.recordId)!;
 f.review(current,{status:'Approved','approval date':'2031-08-25'});assert.equal(ready().state,'ready');
 current=deliveryRecords(f.state).records.find(r=>r.recordId===sub.recordId)!;
 f.review(current,{status:'Rejected','rejection date':'2031-08-30'});assert.equal(ready().state,'blocked');assert.equal(ready().linkedSubmittals[0]!.approvedAtDataDate,false);
 assert.equal(ready().readinessPercent,null,'linked submittals cannot invent a gate denominator');
});

test('testing, handover and asset pages share complete source comparisons without merging populations or acceptance',async t=>{
 const f=await fixture(t),model=projectControlSchedule(f.state)!.revision.model;
 model.activities[0]!.name='Testing equipment';model.activities[0]!.status='completed';model.activities[1]!.name='Handover systems';f.store.touch(f.state);
 const rows=Array.from({length:260},(_,i)=>'AS-'+i+',Pump '+i+','+(i<244?'Yes':'No')+','+(i<237?'Yes':'No')+','+(i===259?'2031-10-01':''));
 await f.upload('Assets.csv','Asset ID,Description,Tag Installed,Commissioned,Status As Of\n'+rows.join('\n'));
 const original=JSON.stringify(f.state.evidenceDocuments),pages=['delivery-commissioning','handover-readiness','delivery-assets'].map(k=>deliveryModule(f.state,k).data as any);
 const comparison=pages[0].handoverSourceComparison;
 for(const p of pages)assert.deepEqual(p.handoverSourceComparison,comparison);
 assert.equal(comparison.assetRecordCount,260);assert.equal(comparison.unlinkedAssetCount,260);assert.equal(comparison.comparability,'different_populations');
 const testing=comparison.rows.find((r:any)=>r.key==='testing'),handover=comparison.rows.find((r:any)=>r.key==='handover'),installed=comparison.rows.find((r:any)=>r.key==='installed'),commissioned=comparison.rows.find((r:any)=>r.key==='commissioned');
 assert.equal(testing.numerator,1);assert.equal(testing.denominator,1);assert.equal(testing.missingCompletionDates,1);assert.equal(handover.numerator,0);
 assert.deepEqual([installed.numerator,installed.denominator,installed.percent],[244,260,93.85]);assert.deepEqual([commissioned.numerator,commissioned.denominator,commissioned.percent],[237,260,91.15]);
 assert.equal(installed.undatedCount,259);assert.equal(installed.futureCount,1);assert.match(comparison.basis,/different sets of records/);
 assert.equal(pages[1].handover.readinessPercent,null);assert.equal(JSON.stringify(f.state.evidenceDocuments),original);
});
test('unrecognized asset flags remain unknown and no programme source produces null programme counts',async t=>{
 const f=await fixture(t);await f.upload('Assets.csv','Asset ID,Tag Installed,Commissioned\nA1,Yes,Under review\nA2,,No');
 f.state.schedules=[];f.store.touch(f.state);
 const comparison=(deliveryModule(f.state,'delivery-assets').data as any).handoverSourceComparison;
 assert.equal(comparison.rows.find((r:any)=>r.key==='installed').percent,null);assert.equal(comparison.rows.find((r:any)=>r.key==='commissioned').unknownCount,1);
 assert.equal(comparison.rows.find((r:any)=>r.key==='testing').numerator,null);assert.equal(comparison.reviewAvailable,false);assert.match(comparison.dateQualification,/Data Date is unavailable/);
});
