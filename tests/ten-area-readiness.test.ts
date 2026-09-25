import {contractTermVersions,termAtEvent} from '../packages/runtime-api/src/contract-term-versions';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import ExcelJS from 'exceljs';
import {RuntimeProjectStore,runtimeProjects} from '../packages/runtime-api/src/project-state';
import {contractCompletionPosition} from '../packages/runtime-api/src/contract-completion';
import {canonicalTimeClaims,projectControlSchedule} from '../packages/runtime-api/src/canonical-time-claims';
import {commercialCanonical} from '../packages/runtime-api/src/commercial-canonical';
import {certificateProfile} from '../packages/runtime-api/src/certificate-profile';
import {sourceTables,prepareRegisterRows} from '../packages/truth-kernel/src';
import {documentReadReview} from '../packages/runtime-api/src/document-read-review';
import {evidenceAvailabilityReview} from '../packages/runtime-api/src/evidence-availability-review';
import {checkPageValues} from '../packages/runtime-api/src/page-value-checks';
import {moduleForProject,directorForProject,boardReportForProject} from '../packages/runtime-api/src/project-projections';
import {buildIndependentForecastProjection} from '../packages/independent-forecast/src';
import {buildNearCriticalProjection} from '../packages/near-critical-analysis/src';
import {DEFAULT_SCHEDULE_ANALYSIS_CONFIG} from '../packages/schedule-analysis-core/src';
import {identifyEvidenceDocument} from '../packages/runtime-api/src/document-identification';
process.env.CMENG_OCR_ENABLED='0';
const stamp='2031-07-01T12:00:00Z';
let fixtureSequence=0;
function fixture(t:any){const dir=mkdtempSync(join(tmpdir(),'ten-area-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const store=new RuntimeProjectStore({dataDir:dir,durable:false});const state=store.getOrCreate('GENERIC-'+(++fixtureSequence));return{dir,store,state};}
function contract(state:any,text:string,role='main',id='MAIN'){state.evidenceDocuments.push({documentId:id,documentType:role==='main'?'main_contract':'contract_amendment',category:'contract',basisState:'active',uploadedAt:stamp,sourceFilename:id+'.pdf'});state.contractDocuments.push({documentId:id,role,result:{sections:[{sectionKey:'Article 9',heading:'Article 9 Contract data',text,startPage:4,sourceMode:'deterministic',sourceSpans:[]}]}});state.version++;}
const cal='(0||CalendarData()((0||DaysOfWeek()('+Array.from({length:7},(_,i)=>'(0||'+(i+1)+'()((0||0(s|08:00|f|16:00)())))').join('')+'))(0||Exceptions()())))';
function xer(date:string,finish='2031-07-02 16:00',bad=false){return ['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tGENERIC\t'+date,'%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tEight hours\t'+(bad?'(BROKEN':cal),'%T\tTASK','%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt','%R\t1\t1\t1\tA1\tActivity one\tTK_NotStart\t2031-07-01 08:00\t'+finish+'\t9\t9\t5','%E'].join('\n');}
async function schedule(store:any,date:string,name:string,finish?:string,bad=false){return store.ingestEvidenceFile({projectId:store.listProjectIds()[0]!,bytes:Buffer.from(xer(date,finish,bad)),mediaType:'text/plain',sourceFilename:name,uploadedAt:stamp});}
async function register(store:any,text:string,type:string,name='register.csv'){return store.ingestEvidenceFile({projectId:store.listProjectIds()[0]!,bytes:Buffer.from(text),mediaType:'text/csv',sourceFilename:name,category:/payment|variation|bond/.test(type)?'boq_cost':'risk_claims_procurement',documentType:type,uploadedAt:stamp});}

test('mixed claim lifecycle registers retain their claim identity and payment components',async t=>{
 const {store,state}=fixture(t);await schedule(store,'2031-07-01','programme.xer');
 const text='Claim Ref,Event Description,Notice Date,Event Date,Days Claimed,Determination Ref,Determination Date,Awarded Days,Status\nC1,Access restriction,03/06/2031,01/06/2031,7,D1,20/06/2031,3,Determined\nC2,Late drawing,04/06/2031,02/06/2031,4,,,,Submitted';
 const identification=await identifyEvidenceDocument({bytes:Buffer.from(text),sourceFilename:'records.csv',sourceRelativePath:null});
 assert.equal(identification.identification.detectedDocumentType,'delay_eot_claims_register');
 await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(text),mediaType:'text/csv',sourceFilename:'claims.csv',uploadedAt:stamp});
 const claims=canonicalTimeClaims(state).delayClaims;assert.equal(claims?.claims.length,2);assert.equal(claims?.events[0]?.title,'Access restriction');
 await register(store,'Certificate No,Type,Period End,Gross Work Done (period),Variations,Retention Deducted,Advance Recovery,Net Certified,Currency,VAT Basis\nIPC1,Interim,30/06/2031,1000,0,50,0,950,USD,Exclusive','payment_certificates','payments.csv');
 const profile=certificateProfile(commercialCanonical(state));assert.equal(profile.groups[0]?.totals?.grossWork,1000);assert.equal(profile.groups[0]?.totals?.retentionDeduction,50);
});
test('completion amendment tables select As amended and retain genuine conflicts',t=>{
 const {state}=fixture(t);contract(state,'Original Completion Date\n07 September 2031');
 contract(state,'Effective date: 01 February 2031\nAMENDMENT PARTICULARS\nItem\nOriginal\nAs amended\nOriginal Completion Date\n07 September 2031\n27 September 2031\nRevised Completion Date is 27 September 2031','amendment','AMD');
 assert.equal(contractCompletionPosition(state,'2031-01-31').value,'2031-09-07');
 assert.equal(contractCompletionPosition(state,'2031-07-01').value,'2031-09-27');
 contract(state,'Effective date: 01 February 2031\nRevised Completion Date: 28 September 2031','amendment','CONFLICT');
 assert.equal(contractCompletionPosition(state,'2031-07-01').state,'conflicted');
});
test('vertical contract data cells produce dated terms with page references',t=>{
 const {state}=fixture(t);contract(state,'CONTRACT DATA\nItem\nParticulars\nDelay Damages\nAED 500 per day\nMaximum Delay Damages\n10% of accepted amount\nRetention\n5% of each certificate\nLimit of Retention Money\n3% of accepted amount\nPayment period\n30 days after certification\nInitial notice of claim / compensation event\nnotification period\n56 days\nPerformance Security\nAED 100000');
 contract(state,'Effective date: 01 June 2031\nItem Original As amended\nNotice of delay event period (Article\n23.1)\n56 days 21 days','amendment','AMD');
 const versions=contractTermVersions(state);
 for(const [term,value] of [['ldRate',500],['ldCap',10],['retentionPercent',5],['retentionCapPercent',3],['paymentPeriodDays',30],['performanceSecurity',100000]] as const){assert.equal(termAtEvent(versions,term,'2031-05-01').value,value,term);}
 assert.equal(termAtEvent(versions,'noticePeriodDays','2031-05-31').value,56);
 assert.equal(termAtEvent(versions,'noticePeriodDays','2031-06-01').value,21);
 assert.ok(versions.every(v=>v.sourceRefs.some(r=>r.endsWith('page:4'))));
});
test('a mixed currency label preserves source amounts without creating a summable currency',async t=>{
 const {store,state}=fixture(t);await schedule(store,'2031-07-01','programme.xer');
 await register(store,'Certificate No,Period End,Net Certified,Currency,VAT Basis\nIPC1,30/06/2031,950,SAR / USD,Exclusive','payment_certificates');
 const ledger=commercialCanonical(state);assert.equal(ledger.payments[0]?.amounts.netCertifiedAmount.value,950);assert.equal(ledger.payments[0]?.amounts.netCertifiedAmount.currency,null);
 assert.equal(certificateProfile(ledger).groups[0]?.totals,null);
});
test('bilingual approval headers retain the explicit variation lifecycle date',t=>{
 const read=prepareRegisterRows([['Variation No / رقم أمر التغيير','Approval Date / تاريخ الاعتماد','Approved Amount USD','Status'],['V1','09/03/2031','50000','Approved']],'variation_register');
 assert.equal(read.headers[1],'approval date');assert.equal(read.rows[0]?.[1],'2031-03-09');
});

test('1 completion labels exclude signing/commencement/effective dates and conflicts stay unresolved',t=>{const {state}=fixture(t);contract(state,'Signing date: 2030-01-01\nCommencement date: 2030-02-01\nContract completion date | 31 July 2031');let p=contractCompletionPosition(state,'2031-07-01');assert.equal(p.value,'2031-07-31');assert.equal(p.state,'official');assert.match(p.sourceRefs[0]!,/page:4/);contract(state,'Completion date: 2031-08-31','main','SECOND');p=contractCompletionPosition(state,'2031-07-01');assert.equal(p.value,null);assert.equal(p.state,'conflicted');assert.match(p.reason!,/Conflicting/);});
test('1 prospective completion amendment switches on effective date, never to that date',t=>{const {state}=fixture(t);contract(state,'Completion date: 2031-07-31');contract(state,'Effective Date: 2031-06-01\nRevised contractual completion: 30 September 2031','amendment','AMD');assert.equal(contractCompletionPosition(state,'2031-05-31').value,'2031-07-31');assert.equal(contractCompletionPosition(state,'2031-06-01').value,'2031-09-30');});
test('2 common reference headers and day-first dates become canonical claims',async t=>{const {store,state}=fixture(t);await schedule(store,'2031-07-01','unrelated.xer');await register(store,'Claim Ref,Event,Date of Notice,Days Claimed,Status\nC1,Access,03/06/2031,7,Submitted','delay_eot_claims_register');const p=canonicalTimeClaims(state);assert.equal(p.delayClaims?.claims.length,1);assert.equal(p.delayClaims?.notices[0]?.actualIssuedAt?.slice(0,10),'2031-06-03');for(const [type,label,key] of [['variation_register','Variation No','variation id'],['rfi_register','Ref','rfi id'],['quality_ncr_register','NCR No','ncr id'],['risk_register','Risk Ref','risk id'],['procurement_register','Ref','package id']])assert.equal(prepareRegisterRows([[label!,'Status'],['1','Open']],type).headers[0],key);});
test('2 unreadable columns disclose rows and original column names',t=>{const {state,dir}=fixture(t);const bytes=Buffer.from('Mystery,Other\na,b\nc,d');const storedPath=join(dir,'unknown.csv');writeFileSync(storedPath,bytes);const d:any={documentId:'X',documentType:'delay_eot_claims_register',storedPath,sourceFilename:'unknown.csv',sourceHashSha256:createHash('sha256').update(bytes).digest('hex'),mediaType:'text/csv',basisState:'active'};const tables=sourceTables([d],[]);const review=documentReadReview(d,state,tables[0]);assert.equal(review.state,'unresolved');assert.match(review.note!,/Read 2 rows, columns not recognised: mystery, other/);});
test('3 reverse first-upload order and misleading names select latest internal data date',async t=>{const {store,state}=fixture(t);await schedule(store,'2031-07-01','baseline-1990.xer');await schedule(store,'2031-05-01','latest-2099.xer');await schedule(store,'2031-06-01','rev99.xer');assert.equal(projectControlSchedule(state)?.revision.model.dataDateIso?.slice(0,10),'2031-07-01');assert.ok(state.schedules.every(s=>s.role==='update'));});
test('4 hour-based fractional movement has one value across Windows EOT Delay Director Board',async t=>{const {store,state}=fixture(t);await schedule(store,'2031-06-01','a.xer','2031-07-02 08:00');await schedule(store,'2031-07-01','b.xer','2031-07-02 09:00');state.controls.boardPublication={sourceManifestId:null,evidenceReceiptIds:[],finalizedAt:null};runtimeProjects.replace(state);const pages=new Map<string,any>();for(const key of ['windows-analysis','eot-assessment','delay-claims','project-director','board-report'])pages.set(key,key==='project-director'?{data:directorForProject(state.projectId)}:key==='board-report'?{data:boardReportForProject(state.projectId)}:moduleForProject(state.projectId,key));const checks=checkPageValues(pages);const c=checks.find(c=>c.metric==='Gross positive programme movement');assert.ok(c);assert.equal(c.state,'passed',JSON.stringify(c));assert.equal(c.values[0]?.value,0.041667);});
test('5 unreadable calendars withhold recalculated finish and contract gap',async t=>{const {store,state}=fixture(t);await schedule(store,'2031-07-01','bad.xer','2031-07-02 16:00',true);const model=state.schedules[0]!.revision.model;const forecast=buildIndependentForecastProjection(model,{generatedAt:stamp,producerVersion:'test'});assert.equal(forecast.independentForecastCompletionIso,null);assert.equal(forecast.requiredFinishVarianceDays,null);assert.equal(forecast.unresolvedActivityCount,1);const near=buildNearCriticalProjection(model,{generatedAt:stamp,producerVersion:'test',config:{...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:5}});assert.equal(near.nearCriticalCount,null);assert.equal(near.floatRiskWatchlistCount,null);assert.equal(near.unresolvedActivityCount,1);});
test('6 advances remain separate from certified profile',async t=>{const {store,state}=fixture(t);await schedule(store,'2031-07-01','a.xer');await register(store,'Certificate No,Payment Type,Period End,Gross Work,Variations,Retention,Advance Recovery,Net Certified,Currency,VAT Basis,Certified Amount Basis\nIPC-1,Interim,30/06/2031,1000,0,50,0,950,USD,Exclusive,Incremental\nAP-1,Advance payment,30/06/2031,300,0,0,0,300,USD,Exclusive,Incremental','payment_certificates');const ledger=commercialCanonical(state);assert.equal(ledger.payments.length,1);assert.equal(ledger.advancePayments?.length,1);const p=certificateProfile(ledger);assert.equal(p.groups[0]?.totals?.netCertifiedAmount,950);assert.equal(p.groups[0]?.totals?.grossWork,1000);assert.equal(p.groups[0]?.totals?.retentionDeduction,50);});
test('7 supplied unrecognised files are named in availability',t=>{const {state}=fixture(t);for(const name of ['bonds.pdf','determinations.pdf','cost-history.pdf','hse-report.pdf','risk-dates.pdf'])state.evidenceDocuments.push({documentId:name,documentType:'supporting_document',sourceFilename:name,category:'other',basisState:'candidate'} as any);const review=evidenceAvailabilityReview(state);for(const name of ['bonds.pdf','determinations.pdf','cost-history.pdf','hse-report.pdf','risk-dates.pdf'])assert.ok(review.some(r=>r.state==='supplied_not_recognised'&&r.detail.includes(name)),name);});
test('9 XLSX title rows bilingual headers day-first and Excel serial dates reach payment and variation ledgers',async t=>{const {store,state}=fixture(t);await schedule(store,'2031-07-01','a.xer');for(const kind of ['payment','variation']){const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('Register');sheet.addRow(['Project title']);sheet.addRow([]);if(kind==='payment'){sheet.addRow(['Certificate No / رقم المستخلص','Period End','Net Amount','Currency','VAT Basis']);sheet.addRow(['IPC-X',48029,500,'USD','Exclusive']);}else{sheet.addRow(['Variation No / رقم التغيير','Status','Date of Approval','Approved Amount','Currency','VAT Basis']);sheet.addRow(['V1','Approved','03/06/2031',700,'USD','Exclusive']);}const bytes=Buffer.from(await workbook.xlsx.writeBuffer());await store.ingestEvidenceFile({projectId:state.projectId,bytes,sourceFilename:kind+'.xlsx',mediaType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',category:'boq_cost',documentType:kind==='payment'?'payment_certificates':'variation_register',uploadedAt:stamp});}const ledger=commercialCanonical(state);assert.equal(ledger.payments.length,1);assert.equal(ledger.payments[0]?.periodEnd,'2031-06-30');assert.match(ledger.payments[0]!.receipt.locator,/sheet:Register:row:4/);assert.equal(ledger.variations[0]?.approvalDate,'2031-06-03');assert.equal(ledger.variations[0]?.approvedAmount.value,700);});

test('8 Article contract data tables retain page receipts and dated prospective values',t=>{const {state}=fixture(t);contract(state,'Article 8.7 | Delay damages rate | USD 1200 per calendar day\nArticle 8.7 | Delay damages cap | 10%\nArticle 14.3 | Retention percent | 5%\nArticle 14.3 | Retention cap | 3%\nArticle 14.7 | Payment period | 28 calendar days\nArticle 20.1 | Initial claim notice | 21 days\nArticle 4.2 | Performance security amount | USD 250000');contract(state,'Effective Date | 2031-06-01\nArticle 14.7 | Payment period | 35 calendar days\nArticle 20.1 | Initial claim notice | 14 days','amendment','AMD');const versions=contractTermVersions(state);assert.equal(versions.length,9);assert.ok(versions.every(v=>v.sourceRefs[0]?.endsWith('page:4')));assert.equal(termAtEvent(versions,'paymentPeriodDays','2031-05-31').value,28);assert.equal(termAtEvent(versions,'paymentPeriodDays','2031-06-01').value,35);assert.equal(termAtEvent(versions,'noticePeriodDays','2031-05-31').value,21);assert.equal(termAtEvent(versions,'noticePeriodDays','2031-06-01').value,14);assert.equal(termAtEvent(versions,'ldRate','2031-06-01').unit,'USD per day');assert.equal(termAtEvent(versions,'paymentPeriodDays',null).value,null);});

test('1 one native contract completion reaches dashboard forecast EOT claims and reports',async t=>{
 const {store,state}=fixture(t);await schedule(store,'2031-07-01','a.xer');
 const {PDFDocument,StandardFonts}=await import('pdf-lib');const doc=await PDFDocument.create();const page=doc.addPage();const font=await doc.embedFont(StandardFonts.Helvetica);
 ['Article 1 Contract data','Signing date: 2030-01-01','Commencement date: 2030-02-01','Contract completion date: 31 July 2031'].forEach((line,i)=>page.drawText(line,{x:40,y:760-i*24,size:12,font}));
 await store.ingestContract({projectId:state.projectId,bytes:await doc.save(),mediaType:'application/pdf',sourceFilename:'contract.pdf',role:'main',uploadedAt:stamp});
 runtimeProjects.replace(state);
 const pages=new Map<string,any>();for(const key of ['notices-claims','milestones','independent-forecast','eot-assessment','master-dashboard'])pages.set(key,moduleForProject(state.projectId,key));
 for(const [key,p] of pages){assert.equal(p.data?.reportingContract?.completionAuthority?.governedContractualFinish,'2031-07-31',key);}
 assert.equal(pages.get('independent-forecast').data.requiredFinishIso.slice(0,10),'2031-07-31');
 assert.equal(pages.get('eot-assessment').data.contractualCompletionIso.slice(0,10),'2031-07-31');
 assert.equal(pages.get('notices-claims').data.contractualCompletionIso.slice(0,10),'2031-07-31');
 assert.equal(checkPageValues(pages).find(c=>c.metric==='Contract completion')?.state,'passed');
});
test('6 Overview Payments Cash Flow share certificate amounts and states; drift fails the check',async t=>{
 const {store,state}=fixture(t);await schedule(store,'2031-07-01','a.xer');await register(store,'Certificate No,Payment Type,Period End,Certificate Date,Gross Work,Variations,Retention,Advance Recovery,Other Deductions,Net Certified,Currency,VAT Basis,Certified Amount Basis\nIPC-1,Interim,30/06/2031,30/06/2031,1000,0,50,0,0,950,USD,Exclusive,Incremental\nAP-1,Advance payment,30/06/2031,30/06/2031,300,0,0,0,0,300,USD,Exclusive,Incremental','payment_certificates');runtimeProjects.replace(state);
 const pages=new Map<string,any>();for(const key of ['commercial-overview','payments','cash-flow'])pages.set(key,moduleForProject(state.projectId,key));
 assert.equal(checkPageValues(pages).find(c=>c.metric==='Overview and Payments certified state and values')?.state,'passed');
 const all=[...pages.values()].map(p=>p.data.position.certificateProfile);assert.deepEqual(all[0],all[1]);assert.deepEqual(all[1],all[2]);assert.equal(all[0].groups[0].totals.netCertifiedAmount,950);
 const altered=structuredClone(pages.get('payments'));altered.data.position.currencies=[{currency:'USD',certifiedAmount:{state:'established',value:999}}];pages.set('payments',altered);
 assert.equal(checkPageValues(pages).find(c=>c.metric==='Overview and Payments certified state and values')?.state,'failed');
});
test('1 conflicting native completion dates carry an unresolved reason to every date consumer',async t=>{
 const {store,state}=fixture(t);await schedule(store,'2031-07-01','a.xer');
 const {PDFDocument,StandardFonts}=await import('pdf-lib');const pdf=await PDFDocument.create();const page=pdf.addPage();const font=await pdf.embedFont(StandardFonts.Helvetica);
 ['Contract completion date: 31 July 2031','Contract completion date: 31 August 2031'].forEach((line,i)=>page.drawText(line,{x:40,y:700-i*24,size:12,font}));
 await store.ingestContract({projectId:state.projectId,bytes:await pdf.save(),mediaType:'application/pdf',sourceFilename:'conflicting-contract.pdf',role:'main',uploadedAt:stamp});runtimeProjects.replace(state);
 for(const key of ['master-dashboard','independent-forecast','milestones','notices-claims','eot-assessment']){
  const data:any=moduleForProject(state.projectId,key).data;const authority=data.reportingContract.completionAuthority;
  assert.equal(authority.governedContractualFinish,null,key);assert.equal(authority.authority,'conflicted',key);assert.match(authority.reason,/Conflicting completion dates/,key);assert.equal(authority.explanation,authority.reason,key);
  if(key==='independent-forecast'){assert.equal(data.requiredFinishIso,null);assert.equal(data.requiredFinishVarianceDays,null);}
 }
});
test('7 common risk-date bond and HSE column layouts are extracted',async t=>{
 const {store,state}=fixture(t);await schedule(store,'2031-07-01','a.xer');await register(store,'Risk Ref,Status,Date Identified,Status Date,Rating,Owner\nR1,Open,03/06/2031,30/06/2031,High,Construction','risk_register');
 await register(store,'Guarantee No,Bond Type,Amount,Currency,Status,Date of Expiry\nB1,Performance,25000,USD,Active,31/12/2031','bond_register');
 await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from('Report Date,Man Hours,LTI,Medical Treatment Cases,First Aid Cases,Near Misses\n30/06/2031,12345,0,1,2,3'),mediaType:'text/csv',sourceFilename:'figures.csv',uploadedAt:stamp});
 assert.equal(state.controls.risks[0]?.raisedIso,'2031-06-03');assert.equal(state.controls.risks[0]?.statusAsOfIso,'2031-06-30');assert.equal(state.controls.bonds[0]?.amount,25000,JSON.stringify({docs:state.evidenceDocuments.map(d=>({type:d.documentType,basis:d.basisState})),derived:state.derivedControlsByDocument}));
 const hse=state.evidenceDocuments.find(d=>d.documentType==='hse_report')?.hseSummary;assert.equal(hse?.periodEndIso,'2031-06-30');assert.equal(hse?.metrics.manHours,12345);assert.equal(hse?.metrics.lostTimeInjuries,0);assert.ok(hse?.sourceRefs[0]?.includes('row:2'));
});
test('2 a read register with missing identity columns does not become a zero-record page',async t=>{
 const {store,state}=fixture(t);await schedule(store,'2031-07-01','a.xer');await register(store,'Status,Description,Odd Column\nOpen,Access,one\nOpen,Design,two','delay_eot_claims_register','claims.csv');
 const {PDFDocument,StandardFonts}=await import('pdf-lib');const pdf=await PDFDocument.create();const pdfPage=pdf.addPage();const font=await pdf.embedFont(StandardFonts.Helvetica);pdfPage.drawText('Contract completion date: 31 July 2031',{x:40,y:700,size:12,font});
 await store.ingestContract({projectId:state.projectId,bytes:await pdf.save(),mediaType:'application/pdf',sourceFilename:'contract.pdf',role:'main',uploadedAt:stamp});runtimeProjects.replace(state);
 const page:any=moduleForProject(state.projectId,'notices-claims');assert.equal(page.data.recordCount,null);assert.match(page.reason,/Read 2 rows, columns not recognised/);assert.equal(page.data.state,'unresolved');
 assert.equal(page.data.contractualCompletionIso,'2031-07-31');
 const keys=['notices-claims','milestones','independent-forecast','delay-claims','windows-analysis','eot-assessment','commercial-overview','payments','cash-flow','commercial-claims-notices'];
 const checks=checkPageValues(new Map(keys.map(key=>[key,moduleForProject(state.projectId,key)])));
 for(const metric of ['Contract completion','Current claim identity cohort','Current notice cohort','Current commercial currency positions'])assert.equal(checks.find(c=>c.metric===metric)?.state,'passed',metric);
});
test('2 live-style event impact headings remain recognised beside the claims register',async t=>{
 const {store,state}=fixture(t);await schedule(store,'2031-07-01','a.xer');
 await register(store,'Claim Ref,Event,Date of Notice,Days Claimed,Status\nC1,Access,03/06/2031,7,Submitted','delay_eot_claims_register','claims.csv');
 await register(store,'Claim ID,Calculated Critical Impact Days,Concurrency Days,Mitigation Days,Net Assessed Impact Days,Analysis Status,Approved\nC1,7,1,1,5,Complete,Yes','delay_eot_claims_register','impacts.csv');
 const tables=sourceTables(state.evidenceDocuments,[]);assert.ok(tables.every(table=>table.recognition?.recognized));
 assert.equal(canonicalTimeClaims(state).delayClaims?.claims.find(c=>c.claimId==='C1')?.assessedDays,5);
 runtimeProjects.replace(state);const page:any=moduleForProject(state.projectId,'notices-claims');assert.equal(page.data.registerReadIssues,undefined);assert.equal(page.data.claimCount,1);
});
test('8 payment due dates select the term effective at each certificate event',async t=>{
 const {store,state}=fixture(t);await schedule(store,'2031-07-01','a.xer');
 const {PDFDocument,StandardFonts}=await import('pdf-lib');
 for(const [role,id,lines] of [['main','base',['Article 14.7 Contract data','Payment period: 28 calendar days']],['amendment','change',['Article 14.7 Amendment','Effective Date: 2031-06-01','Payment period: 35 calendar days']]] as const){const pdf=await PDFDocument.create();const page=pdf.addPage();const font=await pdf.embedFont(StandardFonts.Helvetica);lines.forEach((line,i)=>page.drawText(line,{x:40,y:760-i*24,size:12,font}));await store.ingestContract({projectId:state.projectId,bytes:await pdf.save(),mediaType:'application/pdf',sourceFilename:id+'.pdf',role,uploadedAt:stamp});}
 await register(store,'Certificate No,Period End,Certificate Date,Net Certified,Currency,VAT Basis\nP1,31/05/2031,31/05/2031,100,USD,Exclusive\nP2,01/06/2031,01/06/2031,200,USD,Exclusive','payment_certificates');
 const {commercialFoundationForState}=await import('../packages/runtime-api/src/commercial-foundation-runtime');const f=commercialFoundationForState(state);
 const rows=f.paymentRegister.rows;assert.equal(rows.find(r=>r.paymentId==='P1')?.lifecycle.paymentDueDate.value,'2031-06-28');assert.equal(rows.find(r=>r.paymentId==='P2')?.lifecycle.paymentDueDate.value,'2031-07-06');
});
test('10 population cache invalidates for in-place source identity/type changes and isolates consumer lists',async t=>{
 const {store,state}=fixture(t);await schedule(store,'2031-07-01','a.xer');const model=state.schedules[0]!.revision.model;const {activityPopulation}=await import('../packages/schedule-analysis-core/src');const first=activityPopulation(model);first.reporting.memberIds.push('fake');first.activities.length=0;assert.equal(activityPopulation(model).activities.length,1);assert.equal(activityPopulation(model).reporting.memberIds.length,1);model.activities[0]!.activityType='wbs_summary';assert.equal(activityPopulation(model).activities.length,0);model.activities[0]!.activityType='task';model.activities[0]!.activityId='renamed';assert.deepEqual(activityPopulation(model).reporting.memberIds,['renamed']);
});
test('3 a newer unadopted update is disclosed and a missing data date cannot become current',async t=>{
 const {store,state}=fixture(t);await schedule(store,'2031-06-01','a.xer');const old=projectControlSchedule(state)!;await schedule(store,'2031-07-01','b.xer');state.activeEvidenceBasis['schedule:control']!.activeArtifactId=old.revision.revisionId;state.version++;
 const {reportingData}=await import('../packages/runtime-api/src/reporting-contract');const data:any=reportingData(state,'independent-forecast',{});assert.equal(data.reportingContract.newerUnadoptedSchedules[0]?.dataDateIso.slice(0,10),'2031-07-01');assert.equal(data.reportingContract.dataDateIso,'2031-06-01');
 const other=store.getOrCreate('NO-DATA-DATE');await store.ingestEvidenceFile({projectId:other.projectId,bytes:Buffer.from(xer('')),mediaType:'text/plain',sourceFilename:'latest-2099.xer',uploadedAt:stamp});assert.equal(projectControlSchedule(other),null);
});
test('10 issue inspection retains findings at the end of a 20,000-row register',async()=>{
 const {assessModuleIssues}=await import('../packages/runtime-api/src/module-issues');const rows=Array.from({length:20000},(_,i)=>({id:'A'+i,value:i,details:{state:'established',diagnostics:i===19999?['MALFORMED_SOURCE_DATE']:[]}}));const result=assessModuleIssues({key:'activity-analytics',status:'partial',reason:null,dependencies:[],data:{rows,systemEvidenceContract:{state:'verified_for_checked_metrics',checks:[]}}},{state:'pass',failedCheckIds:[],checkCount:1});assert.ok(result.issues.some(i=>i.kind==='data_quality'&&i.detail.includes('MALFORMED_SOURCE_DATE')));
});
test('10 graph reuse detects in-place broken links cycles external links and identity changes',async t=>{
 const {store,state}=fixture(t);await schedule(store,'2031-07-01','a.xer');const model=state.schedules[0]!.revision.model;const {analyzeScheduleGraph}=await import('../packages/schedule-analysis-core/src');const first=analyzeScheduleGraph(model);first.topologicalOrder?.push('fake');assert.deepEqual(analyzeScheduleGraph(model).topologicalOrder,['A1']);
 model.relationships.push({relationshipId:'R1',predecessorActivityId:'A1',successorActivityId:'MISSING',type:'FS',lagHours:0,external:false,sourceRefs:[],diagnostics:[]});assert.deepEqual(analyzeScheduleGraph(model).brokenSuccessorActivityIds,['MISSING']);model.relationships[0]!.successorActivityId='A1';assert.deepEqual(analyzeScheduleGraph(model).selfLoops,['A1']);model.relationships[0]!.external=true;assert.equal(analyzeScheduleGraph(model).externalRelationshipCount,1);assert.equal(analyzeScheduleGraph(model).selfLoops.length,0);model.activities[0]!.activityId='renamed';assert.deepEqual(analyzeScheduleGraph(model).topologicalOrder,['renamed']);
});


test('clean identical civil and calculated finish dates have no timezone-induced challenge',async t=>{
 const previous=process.env.TZ;
 try {
  for(const zone of ['UTC','Asia/Dubai','Asia/Tokyo','America/Los_Angeles']){
   process.env.TZ=zone;
   const {store,state}=fixture(t);await schedule(store,'2031-07-01','programme.xer','2031-07-02 09:00');runtimeProjects.replace(state);
   const result=moduleForProject(state.projectId,'independent-forecast');const data=result.data as any;
   assert.equal(data.forecastVarianceDays,0,zone);
   assert.ok(data.activities.every((a:any)=>a.finishVarianceDays===0),zone);
   const comparison=data.challenge.items.find((i:any)=>i.metric==='completion_date');
   assert.equal(comparison.gap.value,0,zone);assert.equal(comparison.materialDifference,false,zone);
   assert.equal(data.systemEvidenceContract.failureCount,0,zone);
   const history=moduleForProject(state.projectId,'forecast-history').data as any;
   assert.ok(history.points.every((p:any)=>p.calendarVersusSubmittedDays===null||p.calendarVersusSubmittedDays===0),zone);
  }
 } finally { if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous; }
});
