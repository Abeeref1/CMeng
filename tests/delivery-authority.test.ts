import test from 'node:test';
import {createHash} from 'node:crypto';
import {deliveryAuthorityCatalog} from '../packages/runtime-api/src/delivery-authorities';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Script,runInNewContext} from 'node:vm';
import ExcelJS from 'exceljs';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {changeDelivery,deliveryRecords,deliveryStore} from '../packages/runtime-api/src/delivery-records';
import {deliveryModule,deliveryPosition,deliveryPages,deliveryExportResult} from '../packages/runtime-api/src/delivery-projections';
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
 assert.deepEqual(p.boqIntelligence.currencies.map(c=>c.unmappedValue),[0,0]);
 f.population('package');p=deliveryPosition(f.state);const materialCurve=p.curves.find(c=>c.kind==='material_quantity'&&c.packageId===r.recordId&&c.stage==='installed')!;assert.equal(materialCurve.coveragePercent,100);assert.deepEqual(materialCurve.excludedRecordIds,[]);
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
 assert.equal(rows.find(r=>r.recordId===b.recordId)!.unknownCount,null);
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
 const b=f.create('supplier','S1');assert.equal(deliveryRecords(f.state).records.find(r=>r.recordId===a.recordId)!.state,'conflicted');f.review(b,{}, {supersedesId:a.recordId});assert.equal(deliveryRecords(f.state).records.find(r=>r.recordId===a.recordId)!.state,'superseded');
 f.review(b,{contact:'Updated contact'});assert.equal(deliveryRecords(f.state).records.find(r=>r.recordId===a.recordId)!.state,'superseded');assert.equal(deliveryStore(f.state).decisions.at(-1)!.supersedesId,a.recordId);
 assert.throws(()=>f.review(a,{}, {supersedesId:b.recordId}),/supersession.*cycle/);
 f.create('package','LINKED',{}, {supplierIds:[b.recordId]});f.population('supplier');
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
 new Script(deliveryScript());const context:any={escapeHtml:(x:any)=>String(x)};runInNewContext(deliveryScript()+';globalThis.deliveryValue=deliveryValue;',context);assert.equal(context.deliveryValue(null),'Not established');assert.equal(context.deliveryValue(0),'0');
 const table={rows:Array.from({length:63},(_,i)=>({reference:'R'+i,state:i%2?'working':'governed',quantity:63-i})),query:'',filter:'governed',sort:'quantity',direction:1};const filtered=context.deliveryFiltered(table);assert.equal(filtered.length,32);assert.equal(filtered[0].quantity,1);table.filter='';table.query='R62';assert.equal(context.deliveryFiltered(table).length,1);
});

test('Delivery display preserves exact record references and quantities while formatting dates and risk states',()=>{
 const context:any={escapeHtml:(x:any)=>String(x)};runInNewContext(deliveryScript()+';globalThis.show=deliveryValue;',context);
 assert.equal(context.show(1450000000),'1,450,000,000');assert.equal(context.show(0.0001),'0.0001');assert.equal(context.show(-50),'-50');
 assert.equal(context.show('2026-08-31'),'31 Aug 2026');assert.equal(context.show('2031-09-30T08:00:00Z'),'30 Sept 2031 08:00 UTC');
 assert.equal(context.show('2026-02-31'),'2026-02-31');assert.equal(context.show('S03_2026-08-31.xer'),'S03_2026-08-31.xer');assert.equal(context.show('001200'),'001200');
 const rows=[{riskId:'R1',status:'open'},{riskId:'R2',status:'closed'}];
 assert.deepEqual(Array.from(context.deliveryFiltered({rows,query:'',filter:'open',sort:null}), (r:any)=>r.riskId),['R1']);
 const markup=context.deliveryTable('risk','Risk register',rows,[['riskId','Risk']]);assert.match(markup,/<option value="open">Open<\/option>/);
 const review=context.deliveryTable('review','Record review',[{state:'extracted_candidate'}],[['state','Review state']]);assert.match(review,/<option value="extracted_candidate">Awaiting review<\/option>/);
});

test('Delivery Risks uses the existing risk population, not unrelated procurement candidates or population decisions',async t=>{
 const f=await fixture(t);await f.upload('Procurement.csv','Package ID,Description\nP1,Unrelated package\nP2,Another package');
 let report=deliveryModule(f.state,'delivery-risks');assert.equal(report.status,'blocked');assert.match(report.reason!,/risk register is not established/);assert.equal((report.data as any).reviewRecords.length,0);
 await f.upload('Risks.csv','Risk ID,Description,Status,Identified Date,Probability,Impact,Rating\nR1,Current risk,Open,2031-08-01,0.4,3,Medium\nR2,Future risk,Open,2031-09-10,0.2,2,Low');
 report=deliveryModule(f.state,'delivery-risks');assert.equal(report.status,'ready');assert.match(report.reason!,/2 risk records are supplied: 1 current, 1 after/);
 assert.equal((report.data as any).population.kind,'risk');assert.equal((report.data as any).population.denominator,1);assert.equal((report.data as any).metrics.find((m:any)=>m.label==='Open risks').value,1);assert.equal((report.data as any).reviewRecords.length,0);
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
 f.state.evidenceDocuments.push(doc);f.store.touch(f.state);let p=deliveryPosition(f.state);const candidate=p.records.find(r=>r.reference==='SUB-OCR')!;assert.equal(candidate.state,'extracted_candidate');assert.equal(candidate.receipts[0]!.locator,'page:2:line:1');assert.equal(candidate.receipts[0]!.sourceHash,hash);assert.ok(p.diagnostics.some(d=>d.includes('PHYSICAL_PAGE_COVERAGE_INCOMPLETE')));assert.equal(p.packageRows.length,0);
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
