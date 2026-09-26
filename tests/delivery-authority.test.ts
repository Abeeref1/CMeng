import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Script,runInNewContext} from 'node:vm';
import ExcelJS from 'exceljs';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {changeDelivery,deliveryRecords,deliveryStore} from '../packages/runtime-api/src/delivery-records';
import {deliveryModule,deliveryPosition,deliveryPages} from '../packages/runtime-api/src/delivery-projections';
import {deliveryScript} from '../packages/runtime-api/src/ui-delivery';
import {resolveBoqSource} from '../packages/runtime-api/src/boq-source';
import {projectControlSchedule} from '../packages/runtime-api/src/canonical-time-claims';
import {buildDeliveryWorkbook} from '../packages/runtime-api/src/delivery-export';
import type {DeliveryKind,DeliveryRecord} from '../packages/delivery-core/src/types';

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

test('Delivery consumes the adopted programme; pending updates and first-upload blockers stay actionable on every page',async t=>{
 const {store,state}=await fixture(t),original=projectControlSchedule(state)!.revision.revisionId;
 await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(deliveryProgramme('2031-09-30')),mediaType:'text/plain',sourceFilename:'Pending.xer',uploadedAt:'2031-10-01',uploadIntent:'add_update'});
 for(const [key] of deliveryPages){const r=deliveryModule(state,key);assert.equal((r.data as any).programmeRevisionId,original);assert.equal(r.scheduleAuthorityReview!.pendingSchedules.length,1);assert.equal((r.data as any).dataDateIso,'2031-08-31');}
 const fresh=store.getOrCreate('DELIVERY-B');await store.ingestEvidenceFile({projectId:fresh.projectId,bytes:Buffer.from(deliveryProgramme()),mediaType:'text/plain',sourceFilename:'First.xer',uploadedAt:'2031-09-01'});
 const blocked=deliveryModule(fresh,'construction-readiness');assert.equal((blocked.data as any).dataDateIso,null);assert.equal(blocked.scheduleAuthorityReview!.pendingSchedules[0]!.canAdopt,true);
});

test('register imports remain candidates, retain source receipts and do not improve procurement figures',async t=>{
 const f=await fixture(t);await f.upload('Procurement.csv','Package ID,Description,Unit,Ordered Quantity,Ordered Date,Supplier ID,Lifecycle ID\nPK1,Chiller,No.,1,2031-08-20,S1,L1');
 const before=deliveryPosition(f.state),r=before.records.find(r=>r.reference==='PK1')!;assert.equal(r.kind,'package');assert.equal(r.state,'extracted_candidate');assert.match(r.receipts[0]!.sourceHash,/^[a-f0-9]{64}$/);assert.equal(before.packageRows.length,0);
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
 assert.ok(p.curves.filter(c=>c.series==='actual').every(c=>c.points.every((x:any)=>x.dateIso<='2031-08-31')));
 f.create('package','SPLIT',{}, {boqItemIds:[concrete.quantityItemId]});p=deliveryPosition(f.state);q=p.materialRows.find(x=>x.recordId===r.recordId)!;assert.equal(q.required,null);assert.equal(q.installed,null);
 f.review(r,{}, {links:{...r.links,boqAllocations:[{boqItemId:concrete.quantityItemId,quantity:60,unit:'m3'}]}});assert.equal(deliveryPosition(f.state).materialRows.find(x=>x.recordId===r.recordId)!.required,60);
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
});

test('future approvals and closures do not improve historical position; rectification is not closure; unknown inspection outcomes are excluded',async t=>{
 const f=await fixture(t);f.create('submittal','FUTURE',{status:'Approved','raised date':'2031-08-01','approval date':'2031-09-10'});
 f.create('quality','NCR',{'raised date':'2031-08-01','due date':'2031-08-10','rectified date':'2031-08-20',status:'Closed'});
 f.create('quality','PASS',{'raised date':'2031-08-01','actual date':'2031-08-20',outcome:'passed','outcome date':'2031-08-20'});
 f.create('quality','UNKNOWN',{'raised date':'2031-08-01','actual date':'2031-08-20'});
 const p=deliveryPosition(f.state);assert.equal(p.registerRows.find(r=>r.reference==='FUTURE')!.currentStatus,'open');assert.equal(p.registerRows.find(r=>r.reference==='NCR')!.currentStatus,'open');assert.equal(p.summaries.quality!.passRatePercent,100);assert.equal(p.summaries.quality!.knownOutcomeCount,1);assert.equal(p.summaries.quality!.unknownOutcomeCount,2);
 f.create('hse','INCIDENT',{'incident date':'2031-08-01','lost time injuries':0,'frequency rate basis':1000000});f.population('hse');assert.equal(deliveryPosition(f.state).hsePosition.frequencyRate,null);
});

test('handover completion needs a complete population and dated verification; project readiness can become ready',async t=>{
 const f=await fixture(t);f.create('handover','H1',{'raised date':'2031-08-01','due date':'2031-08-30','verification date':'2031-08-20','acceptance date':'2031-08-21'});
 assert.equal(deliveryPosition(f.state).handover.readinessPercent,null);f.population('handover');assert.equal(deliveryPosition(f.state).handover.readinessPercent,100);assert.equal(deliveryModule(f.state,'handover-readiness').status,'ready');
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
 const b=f.create('supplier','S1');assert.equal(deliveryRecords(f.state).records.find(r=>r.recordId===a.recordId)!.state,'conflicted');f.review(b,{}, {supersedesId:a.recordId});assert.equal(deliveryRecords(f.state).records.find(r=>r.recordId===a.recordId)!.state,'stale');
 const restored=new RuntimeProjectStore({dataDir:f.dir,durable:false}).get(f.state.projectId)!;assert.deepEqual(deliveryStore(restored),deliveryStore(f.state));assert.equal(deliveryRecords(restored).records.find(r=>r.recordId===b.recordId)!.state,'governed');assert.equal(deliveryRecords(other).records.length,0);
});

test('source mapping retains raw hashes; importing a revision cannot silently govern it',async t=>{
 const f=await fixture(t);const upload=await f.upload('Unusual.csv','Control Number,Equipment Scope,Maker\nEQ1,Elevator,Vendor');const doc=f.state.evidenceDocuments.find(d=>d.documentId===upload.documentId)!;
 f.change({action:'map_document',documentId:doc.documentId,sourceHash:doc.sourceHashSha256,kind:'package',columns:{'record reference':'Control Number',description:'Equipment Scope'}});
 const candidate=deliveryRecords(f.state).records.find(r=>r.reference==='EQ1')!;assert.equal(candidate.state,'extracted_candidate');assert.equal(candidate.receipts[0]!.sourceHash,doc.sourceHashSha256);assert.equal(deliveryPosition(f.state).packageRows.length,0);
});

test('exports include every curve point beyond row 20, all parent keys and project scope',async()=>{
 const result:any={key:'procurement-scurves',status:'partial',reason:'Dated governed subset',data:{projectionKey:'delivery',curves:[{key:'curve-1',points:Array.from({length:63},(_,i)=>({dateIso:'2031-08-01',value:i,recordIds:['P'+i]}))}]}};
 const buffer=await buildDeliveryWorkbook('PROJECT-A',result),book=new ExcelJS.Workbook();await book.xlsx.load(buffer as any);const points=book.worksheets.find(w=>w.name.endsWith('points'))!;assert.equal(points.rowCount,64);assert.ok((points.getRow(64).values as any[]).includes('PROJECT-A'));assert.ok((points.getRow(64).values as any[]).includes(62));
});

test('UI pagination, filtering, sorting and chart labels preserve zero and unavailable distinctions',()=>{
 new Script(deliveryScript());const context:any={escapeHtml:(x:any)=>String(x)};runInNewContext(deliveryScript()+';globalThis.deliveryValue=deliveryValue;',context);assert.equal(context.deliveryValue(null),'Unresolved');assert.equal(context.deliveryValue(0),'0');
 const table={rows:Array.from({length:63},(_,i)=>({reference:'R'+i,state:i%2?'working':'governed',quantity:63-i})),query:'',filter:'governed',sort:'quantity',direction:1};const filtered=context.deliveryFiltered(table);assert.equal(filtered.length,32);assert.equal(filtered[0].quantity,1);table.filter='';table.query='R62';assert.equal(context.deliveryFiltered(table).length,1);
});
