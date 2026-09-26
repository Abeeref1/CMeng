import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {PDFParse} from 'pdf-parse';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {changeDelivery,deliveryRecords,deliveryStore,deliveryHash} from '../packages/runtime-api/src/delivery-records';
import {deliveryModule,deliveryPosition} from '../packages/runtime-api/src/delivery-projections';
import {resolveBoqSource} from '../packages/runtime-api/src/boq-source';
import type {DeliveryKind,DeliveryRecord} from '../packages/delivery-core/src/types';

const programme=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tFRESH\t2034-04-30','%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt','%R\t1\t1\tACT1\tInstall plant\tTK_NotStart\t2034-05-10\t2034-05-20\t80\t80','%E'].join('\n');
async function fixture(t:any,id='NEW-SCENARIO',durable=false){
 const root=mkdtempSync(join(tmpdir(),'delivery-new-scenarios-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable}),state=store.getOrCreate(id);
 async function upload(name:string,content:string|Uint8Array,intent?:'replace_current_basis'){
  return store.ingestEvidenceFile({projectId:id,sourceFilename:name,mediaType:name.endsWith('.pdf')?'application/pdf':name.endsWith('.xer')?'text/plain':'text/csv',bytes:typeof content==='string'?Buffer.from(content):Buffer.from(content),uploadedAt:'2034-05-01',...(intent?{uploadIntent:intent}:{})});
 }
 await upload('Adopted.xer',programme,'replace_current_basis');
 const change=(input:any)=>{const result=changeDelivery(state,{expectedVersion:state.version,...input});store.touch(state);return result;};
 const record=(id:string)=>deliveryRecords(state).records.find(r=>r.recordId===id)!;
 function working(kind:DeliveryKind,reference:string,fields:any={}){change({action:'create',kind,fields:{'record reference':reference,description:reference,...fields}});return record(deliveryStore(state).manual.at(-1)!.recordId);}
 function review(r:DeliveryRecord,fields:any={},extra:any={}){change({action:'review',recordId:r.recordId,sourceRevision:r.revision,state:'governed',fields,note:'Independent new-scenario review.',...extra});return record(r.recordId);}
 const create=(kind:DeliveryKind,ref:string,fields:any={},links:any={})=>review(working(kind,ref,fields),{}, {links});
 const population=(kind:DeliveryKind)=>change({action:'confirm_population',kind,note:'Enumerated new-scenario population.'});
 return {root,store,state,upload,change,record,working,review,create,population,position:()=>deliveryPosition(state)};
}

test('new HSE scenarios: valid zero/whole Arabic counts work; negative, fractional and percent counts cannot offset other injuries',async t=>{
 const a=await fixture(t,'INDEPENDENT-A'),b=await fixture(t,'INDEPENDENT-B');
 for(const f of [a,b])f.create('hse','EXPOSURE',{type:'exposure','exposure scope':'Plant B','period start':'2034-04-01','period end':'2034-04-30','report date':'2034-04-30','man hours':125000,'frequency rate basis':1000000});
 const good=a.create('hse','EVENT',{type:'incident','exposure scope':'Plant B','incident date':'2034-04-15','lost time injuries':'٧'});a.population('hse');assert.equal(a.position().hsePosition.frequencyRate,56);
 b.create('hse','EVENT',{type:'incident','exposure scope':'Plant B','incident date':'2034-04-15','lost time injuries':0});b.population('hse');assert.equal(b.position().hsePosition.frequencyRate,0);
 for(const invalid of [-2,0.25,'2%','unknown']){
  const bad=a.working('hse','BAD-'+invalid,{type:'incident','exposure scope':'Plant B','incident date':'2034-04-20','lost time injuries':invalid});
  assert.throws(()=>a.review(bad),/non-negative whole number/);
  assert.equal(a.record(bad.recordId).state,'working');assert.equal(a.record(bad.recordId).fields['lost time injuries'],invalid);
  a.review(bad,{}, {state:'scenario'});
 }
 // A retained decision written by an older release must not bypass projection validation.
 const legacy=a.working('hse','OLD-DECISION',{type:'incident','exposure scope':'Plant B','incident date':'2034-04-22','lost time injuries':-2});
 a.state.delivery!.decisions.push({recordId:legacy.recordId,sourceRevision:legacy.revision,state:'governed',fields:legacy.fields,links:legacy.links,note:'Pre-fix persisted input.',supersedesId:null,actorId:'fixture',recordedAt:'2034-04-30'});a.store.touch(a.state);a.population('hse');
 assert.equal(a.position().hsePosition.frequencyRate,null);assert.equal(a.position().hsePosition.lostTimeInjuries,null);assert.deepEqual(a.position().hsePosition.invalidInjuryRecordIds,[legacy.recordId]);assert.ok(a.position().findings.some(x=>x.recordId===legacy.recordId&&x.code==='INVALID_DELIVERY_NUMBER'));
 assert.equal(b.position().hsePosition.frequencyRate,0,'another project with identical references stays correct');
 assert.equal(a.record(good.recordId).fields['lost time injuries'],'٧');
});

test('new Spares scenarios: all excess steps are disclosed; equal, decimal, future and invalid inputs stay distinct',async t=>{
 const f=await fixture(t);const fields=(required:number,delivered:number,accepted:number,stored:number,handed:number)=>({'required quantity':required,'delivered quantity':delivered,'delivered date':'2034-04-11','accepted quantity':accepted,'accepted date':'2034-04-12','stored quantity':stored,'stored date':'2034-04-13','handed over quantity':handed,'handed over date':'2034-04-14',unit:'litre'});
 const over=f.create('spare','OVER',fields(25,30,32,35,38)),equal=f.create('spare','EQUAL',fields(12,12,12,12,12)),decimal=f.create('spare','DECIMAL',fields(12.5,12,11,10,7.25));
 const future=f.create('spare','FUTURE',{...fields(12,12,12,12,99),'handed over date':'2034-05-01'});
 const p=f.position();assert.equal(p.spareRows.find(r=>r.recordId===over.recordId)!.remaining,-13);assert.equal(p.findings.filter(x=>x.recordId===over.recordId&&x.code.startsWith('SPARES_')).length,9);
 assert.equal(p.spareRows.find(r=>r.recordId===equal.recordId)!.remaining,0);assert.equal(p.spareRows.find(r=>r.recordId===decimal.recordId)!.remaining,5.25);
 assert.equal(p.spareRows.find(r=>r.recordId===future.recordId)!.handedOver,null);assert.equal(p.spareRows.find(r=>r.recordId===future.recordId)!.remaining,null);
 assert.equal(p.findings.filter(x=>[equal.recordId,decimal.recordId,future.recordId].includes(x.recordId??'')&&x.code.startsWith('SPARES_')).length,0);
 const invalid=f.working('spare','INVALID',{'required quantity':-8,'handed over quantity':3,'handed over date':'2034-04-14'});assert.throws(()=>f.review(invalid),/non-negative quantity/);
 f.state.delivery!.decisions.push({recordId:invalid.recordId,sourceRevision:invalid.revision,state:'governed',fields:invalid.fields,links:invalid.links,note:'Old saved input',supersedesId:null,actorId:'fixture',recordedAt:'2034-04-30'});f.store.touch(f.state);
 const row=f.position().spareRows.find(r=>r.recordId===invalid.recordId)!;assert.equal(row.required,null);assert.equal(row.remaining,null);assert.equal(row.fields['required quantity'],-8);
});

test('new BOQ scenarios: compatible multi-item totals work; partial, shared and mixed-unit scope withhold table and curve consistently',async t=>{
 const f=await fixture(t);await f.upload('BOQ.csv','Item No,Description,Unit,Quantity,Rate,Amount,Currency\nA,Steel A,kg,80,2,160,AED\nB,Steel B,kg,120,2,240,AED\nC,Coating,m2,40,5,200,AED');
 await f.upload('Measurements.csv','Measurement Date,Item No,Cumulative Installed Qty,Unit\n2034-04-15,A,30,kg\n2034-04-20,B,45,kg\n2034-05-01,A,70,kg\n2034-04-20,C,10,m2');
 const items=resolveBoqSource(f.state,'').quantities!.items,a=items.find(i=>i.description==='Steel A')!,b=items.find(i=>i.description==='Steel B')!,c=items.find(i=>i.unit==='m2')!;
 let r=f.create('package','STEEL',{unit:'kg'},{boqItemIds:[a.quantityItemId,b.quantityItemId]});f.population('package');let row=f.position().materialRows[0]!;
 assert.equal(row.required,200);assert.equal(row.installed,75);assert.equal(row.remainingToInstall,125);assert.equal(row.installationCompletionPercent,37.5);
 assert.deepEqual(f.position().curves.find(x=>x.kind==='material_quantity'&&x.stage==='installed')!.points.map((x:any)=>x.value),[75]);
 for(const qty of [40,0]){r=f.review(r,{}, {links:{...r.links,boqAllocations:[{boqItemId:a.quantityItemId,quantity:qty,unit:'kg'},{boqItemId:b.quantityItemId,quantity:120,unit:'kg'}]}});row=f.position().materialRows[0]!;assert.equal(row.required,qty+120);assert.equal(row.installed,null);assert.equal(row.installationCompletionPercent,null);assert.equal(f.position().curves.some(x=>x.kind==='material_quantity'&&x.stage==='installed'),false);}
 r=f.review(r,{}, {links:{...r.links,boqAllocations:[{boqItemId:a.quantityItemId,quantity:80,unit:'kg'},{boqItemId:b.quantityItemId,quantity:120,unit:'kg'}]}});assert.equal(f.position().materialRows[0]!.installed,75,'explicit complete allocations remain valid');
 r=f.review(r,{unit:null},{links:{boqItemIds:[a.quantityItemId,c.quantityItemId]}});row=f.position().materialRows[0]!;assert.equal(row.unit,null);assert.equal(row.installed,null);assert.ok(f.position().findings.some(x=>x.code==='MATERIAL_UNITS_INCOMPATIBLE'));
 r=f.review(r,{unit:'kg'},{links:{boqItemIds:[a.quantityItemId]}});f.create('package','SHARED',{unit:'kg'},{boqItemIds:[a.quantityItemId]});assert.deepEqual(f.position().materialRows.map(x=>x.installed),[null,null]);
});

test('new review-time scenarios: valid same-day and 18-day reviews average 9; future and reversed dates are excluded from both mean and count',async t=>{
 const f=await fixture(t);for(const kind of ['submittal','design'] as const){
  for(const [ref,submitted,response] of [['VALID','2034-04-02','2034-04-20'],['SAME','2034-04-15','2034-04-15'],['FUTURE','2034-04-25','2034-05-02'],['REVERSED','2034-04-30','2034-04-01']])f.create(kind,kind+ref,{'raised date':'2034-04-01','actual submission date':submitted,'response date':response});
  const summary=f.position().summaries[kind]!;assert.equal(summary.reviewPeriodCalendarDays,9);assert.equal(summary.reviewPeriodKnownCount,2);
 }
 assert.equal(f.position().findings.filter(x=>x.code==='REVIEW_DATE_ORDER_INVALID').length,2);
});

test('new evidence lifecycle: dated handover/closure need a verified decision and current receipt; added evidence, restart and withdrawal are governed',async t=>{
 const f=await fixture(t,'EVIDENCE-A',true),other=await fixture(t,'EVIDENCE-B');
 await f.upload('Handover.csv','Requirement ID,Description,Raised Date,Due Date,Verification Date,Acceptance Date\nHAND-A,Training,2034-04-01,2034-04-28,2034-04-20,2034-04-21');
 let h=deliveryRecords(f.state).records.find(r=>r.reference==='HAND-A')!;h=f.review(h);f.population('handover');
 assert.equal(f.position().handover.readinessPercent,null);assert.equal(f.position().registerRows.find(r=>r.recordId===h.recordId)!.currentStatus,'verification_required');
 h=f.review(h,{}, {state:'verified'});f.population('handover');assert.equal(f.position().handover.readinessPercent,100);assert.equal(deliveryModule(f.state,'handover-readiness').status,'ready');
 h=f.review(h,{'verification date':'2034-05-01'},{state:'verified'});f.population('handover');assert.equal(f.position().handover.readinessPercent,null);
 h=f.review(h,{'verification date':'2034-04-22'},{state:'verified'});f.population('handover');assert.equal(f.position().handover.readinessPercent,100);
 const snag=f.create('snag','SNAG-A',{'raised date':'2034-04-01','due date':'2034-04-15','verification date':'2034-04-22','closed date':'2034-04-23'});assert.equal(f.position().registerRows.find(r=>r.recordId===snag.recordId)!.currentStatus,'verification_required');
 assert.throws(()=>f.review(snag,{}, {state:'verified'}),/supporting source evidence/);
 await f.upload('Snag-verification.csv','Snag ID,Description,Verification Date,Closed Date\nCLOSURE-EVIDENCE,Independent closure inspection,2034-04-22,2034-04-23');
 const receipt=deliveryRecords(f.state).records.find(r=>r.reference==='CLOSURE-EVIDENCE')!.receipts[0]!;assert.throws(()=>other.change({action:'create',kind:'snag',fields:{'record reference':'FOREIGN'},receipts:[receipt]}),/Evidence must identify a document in this project/);
 f.review(snag,{}, {state:'verified',receipts:[receipt]});assert.equal(f.position().registerRows.find(r=>r.recordId===snag.recordId)!.currentStatus,'closed');
 const restored=new RuntimeProjectStore({dataDir:f.root}).get('EVIDENCE-A')!;assert.equal(deliveryPosition(restored).handover.readinessPercent,100);assert.equal(deliveryRecords(restored).records.find(r=>r.recordId===snag.recordId)!.receipts.length,1);
 const doc=f.state.evidenceDocuments.find(d=>d.documentId===receipt.documentId)!;doc.supersededByDocumentId='replacement-source';f.store.touch(f.state);assert.equal(f.position().handover.readinessPercent,100,'withdrawing an unrelated closure receipt does not change handover');assert.throws(()=>f.review(f.record(snag.recordId),{}, {state:'verified',receipts:[receipt]}),/no longer current/);assert.equal(f.position().registerRows.some(r=>r.recordId===snag.recordId&&r.currentStatus==='closed'),false);
});

async function packet(texts:string[],scanned:boolean){const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);for(const text of texts)doc.addPage([700,500]).drawText(text,{font,size:17,x:30,y:450,lineHeight:32});let bytes=await doc.save();if(!scanned)return bytes;const reader=new PDFParse({data:bytes});try{const pages=(await reader.getScreenshot({scale:2,imageBuffer:true,imageDataUrl:false})).pages,result=await PDFDocument.create();for(const page of pages){const png=await result.embedPng(page.data);result.addPage([700,500]).drawImage(png,{x:0,y:0,width:700,height:500});}return result.save();}finally{await reader.destroy();}}

test('cross-kind date matrix: current requirements with future events cannot become completed; independent programmes keep independent reporting positions',async t=>{
 const a=await fixture(t,'DATE-MATRIX-A'),b=await fixture(t,'DATE-MATRIX-B');
 for(const f of [a,b])for(const kind of ['handover','snag'] as const){
  const identity=kind==='handover'?'Requirement ID':'Snag ID',completion=kind==='handover'?'Acceptance Date':'Closed Date';
  await f.upload(kind+'.csv',identity+',Description,Raised Date,Verification Date,'+completion+'\n'+kind+'-DONE,Completed,2034-04-01,2034-04-20,2034-04-21\n'+kind+'-LATER,Still open,2034-04-01,2034-05-20,2034-05-21\n'+kind+'-FUTURE,Not yet raised,2034-05-01,2034-05-20,2034-05-21\n'+kind+'-UNVERIFIED,Past completion future verification,2034-04-01,2034-05-20,2034-04-21');
  for(const r of deliveryRecords(f.state).records.filter(r=>r.kind===kind))f.review(r,{}, {state:'verified'});f.population(kind);
  let p=f.position(),later=p.registerRows.find(r=>r.reference===kind+'-LATER')!;
  assert.equal(later.scope,'current');assert.equal(later.currentStatus,'open');assert.equal(later.verificationDate,'2034-05-20');assert.equal(p.summaries[kind]!.closurePercent,null,'past completion with only future verification prevents a falsely complete summary');
  assert.equal(p.summaries[kind]!.knownCurrentCount,3);assert.equal(p.summaries[kind]!.futureCount,1);
  const unresolved=deliveryRecords(f.state).records.find(r=>r.reference===kind+'-UNVERIFIED')!;f.review(unresolved,{}, {state:'scenario'});f.population(kind);p=f.position();
  assert.equal(p.summaries[kind]!.currentCount,2);assert.equal(p.summaries[kind]!.closedCount,1);assert.equal(p.summaries[kind]!.closurePercent,50);
  if(kind==='handover'){assert.equal(p.handover.acceptedKnownCount,1);assert.equal(p.handover.rows.length,2);assert.equal(p.handover.readinessPercent,50);}
 }
 for(const kind of ['submittal','design','quality','commissioning'] as const){
  a.create(kind,kind+'-FUTURE',{'raised date':'2034-04-01','actual submission date':'2034-04-10','actual date':'2034-04-15','approval date':'2034-05-20','response date':'2034-05-20','outcome date':'2034-05-20',status:kind==='quality'||kind==='commissioning'?'passed':'approved'});a.population(kind);
  const p=a.position(),row=p.registerRows.find(r=>r.reference===kind+'-FUTURE')!;assert.equal(row.scope,'current');assert.ok(!['source_approved','passed','accepted','closed'].includes(row.currentStatus));assert.equal(p.summaries[kind]!.reviewPeriodKnownCount,0);assert.equal(p.summaries[kind]!.knownOutcomeCount,0);
 }
 // Different defects in this same project cannot change a valid completion calculation.
 const invalid=a.working('spare','BAD-QTY',{'required quantity':-20});assert.throws(()=>a.review(invalid),/non-negative quantity/);
 assert.equal(a.position().handover.readinessPercent,50);assert.equal(b.position().handover.readinessPercent,50);
 await a.upload('Later-programme.xer',programme.replace('2034-04-30','2034-05-31'),'replace_current_basis');
 assert.equal(a.position().handover.readinessPercent,100);assert.equal(a.position().handover.rows.length,3);assert.equal(a.position().summaries.snag!.closedCount,3);
 assert.equal(b.position().dataDateIso,'2034-04-30');assert.equal(b.position().handover.readinessPercent,50);assert.equal(b.position().summaries.snag!.closedCount,1);
});

for(const scanned of [false,true])test('new '+(scanned?'OCR':'native')+' packet: submittal, spares and permit keep separate identities and source pages',async t=>{
 const f=await fixture(t);await f.upload('Mixed-submittal-packet.pdf',await packet(['Supplier ID: SUBCONTRACTOR-1\nSubmittal ID: NEW-SUB\nDescription: Shop drawing\nRaised Date: 2034-04-01','Description: Spare filters\nSpare ID: NEW-SPARE\nRequired Quantity: 24','Permit ID: NEW-PERMIT\nDescription: Lift permit\nSupplier ID: SUP-9\nIssue Date: 2034-04-10\nExpiry Date: 2034-05-10'],scanned));await f.store.refreshDeferredPdfReads(f.state.projectId);
 const records=deliveryRecords(f.state).records;assert.deepEqual(records.map(r=>[r.kind,r.reference,r.receipts[0]!.locator]),[['submittal','NEW-SUB','page:1:line:1'],['spare','NEW-SPARE','page:2:line:1'],['permit','NEW-PERMIT','page:3:line:1']]);assert.ok(records.every(r=>r.state==='extracted_candidate'));
 assert.equal(f.state.evidenceDocuments.find(d=>d.sourceFilename.endsWith('.pdf'))!.fullTextRead!.result.complete,true);
 if(!scanned){const spare=records[1]!,receipt=spare.receipts[0]!,legacyId='delivery:'+deliveryHash([f.state.projectId,'submittal',receipt.documentId,receipt.locator]).slice(0,24);f.state.delivery??={schemaVersion:1,manual:[],decisions:[],populations:[]};f.state.delivery.decisions.push({recordId:legacyId,sourceRevision:spare.revision,state:'governed',fields:spare.fields,links:spare.links,note:'Original packet classification',supersedesId:null,actorId:'fixture',recordedAt:'2034-04-30'});const reclassified=f.record(legacyId);assert.equal(reclassified.kind,'spare');assert.equal(reclassified.state,'stale');assert.notEqual(reclassified.revision,spare.revision);assert.equal(f.review(reclassified).state,'governed');assert.equal(f.state.delivery.decisions.filter(d=>d.recordId===legacyId).length,2,'corrected identity retains the earlier review history');}
});
