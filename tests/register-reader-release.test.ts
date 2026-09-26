import {segmentContractTextBlocks} from '../packages/contract-parser/src/segmenter';
import test from 'node:test';import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import ExcelJS from 'exceljs';import JSZip from 'jszip';
import {runtimeProjects,RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {rebuildEvidenceFamily} from '../packages/runtime-api/src/evidence-control';
import {hseReportPosition,refreshHseSummary,parseHseSummary} from '../packages/runtime-api/src/hse-report-evidence';
import {readRegisterWorkbook} from '../packages/runtime-api/src/register-workbook';
import {analyzeCsvEvidence,analyzeEvidenceRows} from '../packages/runtime-api/src/evidence';
import {prepareRegisterRows,sourceTables} from '../packages/truth-kernel/src';
import {reviewRegisterDates} from '../packages/runtime-api/src/register-date-review';
import {moduleRegistry,pageApiKey,publicModuleResult,resolveModuleKey,titleForModule} from '../packages/runtime-api/src/registry';
import {buildModuleJsonDownload} from '../packages/runtime-api/src/module-report';
import type {StoredEvidenceDocument} from '../packages/runtime-api/src/project-state-types';
const hash=(b:string|Uint8Array)=>createHash('sha256').update(b).digest('hex');
function setup(t:any){const dir=mkdtempSync(join(tmpdir(),'register-release-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const state=runtimeProjects.getOrCreate('READ-'+randomUUID());
 const csv=(text:string,type:string)=>{const id='D'+state.evidenceDocuments.length,path=join(dir,id+'.csv');writeFileSync(path,text);const doc={documentId:id,sourceFilename:id+'.csv',sourceHashSha256:hash(text),storedPath:path,mediaType:'text/csv',basisState:'active',documentType:type,diagnostics:[],uploadedAt:'2031-04-30'} as unknown as StoredEvidenceDocument;state.evidenceDocuments.push(doc);state.version++;return doc;};return {state,csv};}

test('activity linkage recognizes title rows, bilingual activity codes, absent, empty and unmatched columns',()=>{
 const ids=new Set(['WORK-01']);
 const read=(s:string)=>analyzeCsvEvidence(Buffer.from(s),ids);
 assert.equal(read('Project title\nClaim Ref,Activity Code / رقم النشاط\nC1,WORK-01').state,'linked');
 assert.equal(read('Claim Ref,Subject\nC1,Work').message,'No linkage column supplied');
 assert.equal(read('Claim Ref,Activity Code\nC1,').state,'values_empty');
 const mismatch=read('Claim Ref,Activity Code\nC1,OTHER');assert.equal(mismatch.state,'no_matches');assert.equal(mismatch.coveragePercent,0);
 assert.equal(read('Claim Ref,Activity Code\nC1,').coveragePercent,null);
});

test('three independent registers with alternative raised headers read dates, total failures trigger one reading check',t=>{
 const {state,csv}=setup(t);
 csv('RFI No,Date Raised,Status\nR1,01/04/2031,Open','rfi_register');
 csv('Risk No,Date Raised,Status\nK1,01/04/2031,Open','risk_register');
 csv('Incident ID,Date Raised,Status\nI1,01/04/2031,Open','incident_register');
 const good=reviewRegisterDates(sourceTables(state.evidenceDocuments,[]));assert.equal(good.rows.length,3);assert.ok(good.rows.every(r=>r.missingPercent===0));assert.equal(good.likelyMappingFault,false);
 for(const doc of state.evidenceDocuments){const s='Ref,Description,Status\n'+doc.documentId+',missing raised field,Open';writeFileSync(doc.storedPath,s);doc.sourceHashSha256=hash(s);}
 const missing=reviewRegisterDates(sourceTables(state.evidenceDocuments,[]));assert.equal(missing.likelyMappingFault,true);assert.equal(missing.affectedRegisterCount,3);assert.ok(missing.rows.every(r=>r.state==='column_not_found'));
});

test('HSE monthly tables resolve the latest reporting period and rates require counts plus a read source table',async t=>{
 const {state,csv}=setup(t);
 const doc=csv('Report Date,Man Hours,LTI,MTC,TRIR\n2031-03-31,18000,0,1,11.11\n2031-04-30,24000,0,0,0\n2031-05-31,25000,1,0,8','hse_report');
 await refreshHseSummary(doc);state.version++;
 const april=hseReportPosition(state,'2031-04-30');assert.equal(april.periodEndIso,'2031-04-30');assert.equal(april.metrics.manHours,24000);assert.equal(april.metrics.trir,0);assert.equal(april.rates.recordableCasesFromLtiAndMedical,0);assert.equal(april.futureReportCount,1);
 const cover=parseHseSummary('Report date: 2031-04-30\nTRIR: 2.5',doc.sourceHashSha256,'page:1');
 doc.hseSummary={...cover,sourceTableRead:false};state.version++;
 const unread=hseReportPosition(state,'2031-04-30');assert.equal(unread.metrics.trir,null);assert.equal(unread.rates.recordableCasesFromLtiAndMedical,null);assert.equal(unread.rates.reason,'Rate unconfirmed, source table unread');assert.equal(unread.rates.reportedRates.trir,2.5,'reported cover value retained separately from confirmed rate');
});

test('valid prefixed XLSX namespaces, title rows, bilingual headings and serial dates reach register rows',async()=>{
 const wb=new ExcelJS.Workbook(),sheet=wb.addWorksheet('Payments');
 sheet.addRow(['Project title']);sheet.addRow([]);sheet.addRow(['Certificate No','Net Certified','Certificate Date / تاريخ الاعتماد','Activity Code']);sheet.addRow(['IPC-1',100,46265,'WORK-01']);sheet.addRow(['IPC-2',200,'31/08/2026','WORK-01']);
 const zip=await JSZip.loadAsync(await wb.xlsx.writeBuffer());
 for(const file of Object.values(zip.files).filter(f=>!f.dir&&/^xl\/.*\.xml$/.test(f.name))){let xml=await file.async('string');if(!xml.includes('xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'))continue;xml=xml.replace('xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"','xmlns:ss="http://schemas.openxmlformats.org/spreadsheetml/2006/main"').replace(/<(\/?)([A-Za-z][\w-]*)(?=[\s/>])/g,'<$1ss:$2');zip.file(file.name,xml);}
 const bytes=await zip.generateAsync({type:'nodebuffer'});const read=await readRegisterWorkbook(bytes,hash(bytes),'payment_certificates');const p=prepareRegisterRows(read.sheets[0]!.rows,'payment_certificates');
 assert.equal(p.headerRow,3);assert.equal(p.recognized,true);assert.equal(p.rows.length,2);assert.equal(p.rows[0]![2],'2026-08-31');assert.equal(p.rows[1]![2],'2026-08-31');
 assert.equal(analyzeEvidenceRows(read.sheets[0]!.rows,new Set(['WORK-01'])).mappedActivityCount,2);
});

test('reader upgrade refreshes existing uploads, repairs false family collisions and preserves real revisions and raw bytes',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'register-upgrade-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:dir,durable:false}),id='EXISTING';
 const header='Claim Ref,Event Description,Notice Date,Event Date,Days Claimed,Assessed Days,Status,Determination Ref,Awarded Days';
 for(const [filename,text,date] of [
   ['Claims_Rev1.csv',header+'\nC1,Access,2031-03-02,2031-03-01,4,2,Submitted,,','2031-03-03'],
   ['Claims_Rev2.csv',header+'\nC2,Access,2031-04-02,2031-04-01,7,3,Submitted,,','2031-04-03'],
   ['Decisions.csv','Determination Ref,Claim Ref,Determination Date,Awarded EOT Days\nD1,C2,2031-04-10,3','2031-04-11'],
 ] as const)await store.ingestEvidenceFile({projectId:id,sourceFilename:filename,mediaType:'text/csv',bytes:Buffer.from(text),uploadedAt:date+'T00:00:00Z',uploadIntent:'replace_current_basis'});
 const state=store.get(id)!,decision=state.evidenceDocuments.find(d=>d.sourceFilename==='Decisions.csv')!;
 for(const d of state.evidenceDocuments){
   delete d.derivedRegisterRead;d.documentType='determination_register';d.familyKey=decision.familyKey;d.logicalDocumentKey=decision.logicalDocumentKey;
 }
 rebuildEvidenceFamily(state,decision.familyKey);
 assert.ok(state.evidenceDocuments.filter(d=>d.sourceFilename.startsWith('Claims')).every(d=>d.basisState==='superseded'));
 state.derivedControlsByDocument={};state.derivedReadinessByDocument={};state.controls.delayClaims=null;store.touch(state);
 const before=state.evidenceDocuments.map(d=>({id:d.documentId,hash:d.sourceHashSha256,bytes:readFileSync(d.storedPath).toString('base64'),intent:d.uploadIntent}));
 const restored=new RuntimeProjectStore({dataDir:dir,durable:false}),upgrade=await restored.refreshSpreadsheetRegisters(id),after=restored.get(id)!;
 assert.equal(upgrade.refreshedDocumentCount,3);assert.deepEqual(upgrade.diagnostics,[]);
 assert.equal(after.evidenceDocuments.find(d=>d.sourceFilename==='Claims_Rev1.csv')!.basisState,'superseded','real older claim revision stays superseded');
 assert.equal(after.evidenceDocuments.find(d=>d.sourceFilename==='Claims_Rev2.csv')!.basisState,'active');
 assert.equal(after.evidenceDocuments.find(d=>d.sourceFilename==='Decisions.csv')!.basisState,'active','determinations retain their own population');
 assert.deepEqual(after.controls.delayClaims?.claims.map(c=>c.claimId),['C2']);
 assert.deepEqual(after.evidenceDocuments.map(d=>({id:d.documentId,hash:d.sourceHashSha256,bytes:readFileSync(d.storedPath).toString('base64'),intent:d.uploadIntent})),before);
 const version=after.version;assert.equal((await restored.refreshSpreadsheetRegisters(id)).refreshedDocumentCount,0);assert.equal(after.version,version,'current reader does not repeatedly rebuild or duplicate records');
 const reopened=new RuntimeProjectStore({dataDir:dir,durable:false});
 await reopened.ingestEvidenceFile({projectId:id,sourceFilename:'Claims_Rev3.csv',mediaType:'text/csv',bytes:Buffer.from(header+'\nC3,Access,2031-05-02,2031-05-01,9,4,Submitted,,'),uploadedAt:'2031-05-03T00:00:00Z',uploadIntent:'replace_current_basis'});
 assert.deepEqual(reopened.get(id)!.controls.delayClaims?.claims.map(c=>c.claimId),['C3'],'a later upload after restart replaces the same semantic register role');
 assert.equal(reopened.get(id)!.evidenceDocuments.find(d=>d.sourceFilename==='Claims_Rev2.csv')!.basisState,'superseded');
});

test('page title, navigation definition, export name and public API identity use the same registry',()=>{
 for(const page of moduleRegistry){
  assert.equal(resolveModuleKey(page.apiKey!),page.key);assert.equal(titleForModule(page.apiKey!),page.title);
  const result={key:page.key,status:'ready' as const,data:{},reason:null,dependencies:[]};
  const publicResult=publicModuleResult(result,page.apiKey!);assert.equal(publicResult.key,page.apiKey);assert.equal(publicResult.page.title,page.title);assert.equal(publicResult.page.group,page.group);
  const exported=JSON.parse(buildModuleJsonDownload('PROJECT',page.key,result).toString());assert.equal(exported.report.module,page.title);assert.equal(exported.report.moduleKey,pageApiKey(page.key));
  assert.equal(publicModuleResult(result,page.key).legacyKey,page.key);
 }
});

 test('adjacent contract-data rows sharing an Article retain both terms without a duplicate-clause alarm',()=>{
 const result=segmentContractTextBlocks([{sourceKind:'pdf_page',sourceIndex:0,page:1,block:0,text:'Contract data\nReference | Value\nArticle 7 | Delay damages rate | AED 1200 per day\nArticle 7 | Delay damages cap | 10%\nArticle 8 | Retention percent | 5%\nArticle 8 | Retention cap | 5%'}],{sourceType:'pdf',physicalComplete:true});
 assert.ok(!result.diagnostics.some(d=>d.startsWith('CONTRACT_DUPLICATE_SECTION_INSTANCE')));
 const article=result.sections.find(s=>s.identifier==='7')!;assert.match(article.text,/1200/);assert.match(article.text,/10%/);
 });

test('comma, semicolon and tab registers share parsing and preserve quoted fields and unknown dates', async t => {
 const {csv: document, state} = setup(t);
 const {csv: rows} = await import('../packages/truth-kernel/src');
 const header=['Package ID','Description','Required On Site','Forecast Delivery','Status','Currency','Value','Activity ID'];
 const values=['PK-1','Valve, pump; assembly','2031-04-30','','Ordered','AED','1200','WORK-01'];
 for (const separator of [',',';','\t']) {
  const quote=(v:string)=>'"'+v.replaceAll('"','""')+'"';
  const content=header.map(quote).join(separator)+'\r\n'+values.map(quote).join(separator)+'\r\n';
  assert.deepEqual(rows(content),[header,values]);
  const doc=document(content,'procurement_register');
  const table=sourceTables([doc],[])[0]!;
  assert.equal(table.recognition?.recognized,true);
  assert.equal(table.rows[0]!.cells.description,values[1]);
  assert.equal(table.rows[0]!.cells['forecast delivery'],'');
  assert.equal(analyzeCsvEvidence(Buffer.from(content),new Set(['WORK-01'])).mappedActivityCount,1);
 }
 assert.throws(()=>rows('Reference;Description\n1;"unfinished'),/CSV_UNCLOSED_QUOTE/);
 const payment=prepareRegisterRows(rows('Certificate,Period End,Gross,Retention,Net,Release Date,Status\nIPC-1,2031-04-30,100,10,90,2031-05-10,Released'),'payment_certificates');
 assert.equal(payment.recognized,true);
 assert.deepEqual(payment.headers,['certificate no','period end','gross work','retention','net certified','release date','status']);
 assert.ok(!payment.headers.includes('payment date'),'release does not establish actual payment');
 assert.ok(!payment.headers.includes('certificate date'),'release does not establish certification');
 assert.equal(state.evidenceDocuments.length,3);
});

test('shared reader upgrade repairs text/plain CSV ingestion without changing another project or source bytes', async t => {
 const dir=mkdtempSync(join(tmpdir(),'delimiter-upgrade-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:dir,durable:false});
 const unchanged=store.getOrCreate('OTHER-PROJECT');
 const beforeOther=JSON.stringify(unchanged);
 const bytes=Buffer.from('Package ID;Description;Required On Site;Forecast Delivery;Status;Currency;Value\nPK-1;Valves;2031-04-30;2031-05-10;Ordered;AED;1200');
 await store.ingestEvidenceFile({projectId:'REGISTER-PROJECT',sourceFilename:'Source.csv',mediaType:'text/plain',bytes,uploadedAt:'2031-04-01T00:00:00Z'});
 const state=store.get('REGISTER-PROJECT')!,doc=state.evidenceDocuments[0]!;
 assert.equal(doc.documentType,'procurement_register');
 doc.mediaType='text/plain';doc.derivedRegisterRead={producerVersion:'register-derived-v2',sourceHashSha256:doc.sourceHashSha256};
 const sourceHash=doc.sourceHashSha256;
 const result=await store.refreshSpreadsheetRegisters('REGISTER-PROJECT');
 assert.equal(result.refreshedDocumentCount,1);assert.deepEqual(result.diagnostics,[]);
 assert.equal(doc.derivedRegisterRead?.producerVersion,'register-derived-v4');
 assert.equal(sourceTables([doc],[])[0]!.recognition?.recognized,true);
 assert.equal(doc.sourceHashSha256,sourceHash);assert.deepEqual(readFileSync(doc.storedPath),bytes);
 assert.equal(JSON.stringify(unchanged),beforeOther);
 assert.equal((await store.refreshSpreadsheetRegisters('REGISTER-PROJECT')).refreshedDocumentCount,0);
});

test('document permission columns cannot become financial bond evidence through a filename prefix', async () => {
 const {identifyEvidenceDocument} = await import('../packages/runtime-api/src/document-identification');
 const result=await identifyEvidenceDocument({sourceFilename:'SEC01_Document_Access_Matrix.csv',sourceRelativePath:null,
  bytes:Buffer.from('Document Class,PMO Admin,Project Director,Planner,Commercial Manager,Engineer,Contractor User,External Viewer\nContract,Full,Full,Read,Full,Read,None,None'),declaredMediaType:'text/csv'});
 assert.equal(result.identification.detectedDocumentType,'document_access_matrix');
 assert.equal(result.identification.detectedCategory,'other');
});

test('historical inventory reading does not make old rows part of the current calculation basis', t => {
 const {csv,state}=setup(t);
 const current=csv('Certificate No,Net Certified\nIPC-1,90','payment_certificates');
 const old=csv('Certificate No,Net Certified\nIPC-0,70','payment_certificates');old.basisState='superseded';
 const inventory=sourceTables(state.evidenceDocuments,[],{includeHistorical:true});
 assert.equal(inventory.length,2);assert.ok(inventory.every(table=>table.recognition?.recognized));
 assert.deepEqual(sourceTables(state.evidenceDocuments,[]).map(table=>table.document.documentId),[current.documentId]);
});
