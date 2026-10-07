import {segmentContractTextBlocks} from '../packages/contract-parser/src/segmenter';
import test from 'node:test';import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import ExcelJS from 'exceljs';import JSZip from 'jszip';
import {runtimeProjects,RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {rebuildEvidenceFamily} from '../packages/runtime-api/src/evidence-control';
import {commercialCanonical} from '../packages/runtime-api/src/commercial-canonical';
import {hseReportPosition,refreshHseSummary,parseHseSummary} from '../packages/runtime-api/src/hse-report-evidence';
import {readRegisterWorkbook} from '../packages/runtime-api/src/register-workbook';
import {analyzeCsvEvidence,analyzeEvidenceRows} from '../packages/runtime-api/src/evidence';
import {numberValue,canonicalHeader,prepareRegisterRows,sourceTables} from '../packages/truth-kernel/src';
import {reviewRegisterDates} from '../packages/runtime-api/src/register-date-review';
import {moduleRegistry,pageApiKey,publicModuleResult,resolveModuleKey,titleForModule} from '../packages/runtime-api/src/registry';
import {buildModuleJsonDownload} from '../packages/runtime-api/src/module-report';
import type {StoredEvidenceDocument} from '../packages/runtime-api/src/project-state-types';
const hash=(b:string|Uint8Array)=>createHash('sha256').update(b).digest('hex');
test('Stage 1 fresh quality cohort retains every reordered noisy workbook row and upgrades prior reader snapshots',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'quality-header-cohort-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 let store=new RuntimeProjectStore({dataDir:dir,durable:false});
 const seed=randomUUID();process.stdout.write('\nCMENG_STAGE1_QUALITY_HEADER_SEED='+seed+'\n');
 const expected=new Map<string,{ids:string[];bytes:Buffer;documentId:string;sourceHash:string}>();
 for(let i=0;i<10;i++){
  const projectId=('QUALITY-'+seed+'-'+i).toUpperCase(),ids=Array.from({length:3+i%3},(_,j)=>'NCR-'+createHash('sha256').update(seed+':'+i+':'+j).digest('hex').slice(0,12));
  const headers=['Description','Comment '+(10+i),'NCR ID','Status','Owner','Extra_'+i,'X'+(20+i),'Closed Date'];
  const sourceRows=[['Project '+projectId,'Control report','','','','','',''],['','Control report','','','','','',''],headers,
   ...ids.map((id,j)=>[i%2?'Quality observation '+j:'ملاحظة جودة '+j,j%2?'n/a':'-',id,j%2?'Open':'مفتوح',i%2?'QA/QC':'المقاول',j%2?'3':'','note','']),
   ['TOTAL','','','','','','','']];
  const rotation=(i*3)%headers.length,columns=Array.from({length:headers.length},(_,j)=>(j+rotation)%headers.length);
  if(i%2)columns.reverse();
  const wb=new ExcelJS.Workbook(),sheet=wb.addWorksheet(i%2?'Observations':'بيانات الجودة');
  for(const row of sourceRows)sheet.addRow(columns.map(c=>row[c]??''));
  wb.addWorksheet('Notes').addRows([['Unclassified evidence'],['A1','B2'],['opaque','value']]);
  const bytes=Buffer.from(await wb.xlsx.writeBuffer());
  await store.ingestEvidenceFile({projectId,sourceFilename:'generic-'+i+'.xlsx',sourceRelativePath:'generic-'+i+'.xlsx',mediaType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',bytes,uploadedAt:'2039-02-10T00:00:00Z',uploadIntent:'add_update'});
  const state=store.get(projectId)!,doc=state.evidenceDocuments[0]!;
  assert.deepEqual(state.controls.ncrs.map(row=>row.ncrId).sort(),[...ids].sort());
  const table=sourceTables([doc],[]).find(row=>row.document.documentType==='quality_ncr_register')!;
  assert.ok(table,'the owning worksheet must reach the shared source table');
  assert.equal(table.rows.length,ids.length);assert.equal(table.intelligence.headerRowIndex,2);
  assert.ok(state.controls.ncrs.every(row=>row.sourceRefs.every(ref=>ref.includes(':sheet:'))));
  assert.ok(state.controls.ncrs.every(row=>row.closedIso===null),'no closure date is invented');
  expected.set(projectId,{ids,bytes,documentId:doc.documentId,sourceHash:doc.sourceHashSha256});
  // Recreate the old reader's empty derived population, then require migration
  // from retained bytes rather than changing the source or authority decision.
  const basisState=doc.basisState;
  doc.derivedRegisterRead={producerVersion:'register-derived-v7',sourceHashSha256:doc.sourceHashSha256};
  state.derivedControlsByDocument[doc.documentId]!.ncrs=[];state.controls.ncrs=[];
  const refreshed=await store.refreshSpreadsheetRegisters(projectId);
  assert.equal(refreshed.refreshedDocumentCount,1,JSON.stringify(refreshed));
  assert.deepEqual(state.controls.ncrs.map(row=>row.ncrId).sort(),[...ids].sort());
  assert.equal(doc.basisState,basisState);assert.equal(doc.derivedRegisterRead?.producerVersion,'register-derived-v8');
  assert.deepEqual(readFileSync(doc.storedPath),bytes);assert.equal(doc.sourceHashSha256,hash(bytes));
  assert.equal((await store.refreshSpreadsheetRegisters(projectId)).refreshedDocumentCount,0,'repeated refresh is idempotent');
 }
 store=new RuntimeProjectStore({dataDir:dir,durable:false});
 for(const [projectId,e] of expected){const state=store.get(projectId)!,doc=state.evidenceDocuments.find(row=>row.documentId===e.documentId)!;
  assert.deepEqual(state.controls.ncrs.map(row=>row.ncrId).sort(),[...e.ids].sort());
  assert.equal(doc.sourceHashSha256,e.sourceHash);assert.deepEqual(readFileSync(doc.storedPath),e.bytes);
 }
 process.stdout.write('CMENG_STAGE1_QUALITY_HEADER_RESULT='+JSON.stringify({projects:10,exactPopulations:true,reorderedColumns:true,sourceBytesPreserved:true,readerMigration:true,idempotence:true,restart:true})+'\n');
});
test('Stage 1 sparse control schemas and compact headers retain owning roles and identities',async()=>{
 const {identifyEvidenceDocument}=await import('../packages/runtime-api/src/document-identification');
 const cases=[
  ['Instruction ID,Issue Date,Variation ID,Status\nSI-K7,2032-03-09,VO-M8,Issued','site_instruction_register','instruction:si-k7'],
  ['InstructionID,IssueDate,VariationID,Status\nSI-K7,2032-03-09,VO-M8,Issued','site_instruction_register','instruction:si-k7'],
  ['Obligation ID,Due Date\nOB-H3,2032-03-12','contract_obligation_register','obligation:ob-h3'],
  ['ObligationID,DueDate\nOB-H3,2032-03-12','contract_obligation_register','obligation:ob-h3'],
  ['Retention ID,Held Amount\nRET-B4,12000','retention_register','retention:ret-b4'],
  ['RetentionID,HeldAmount\nRET-B4,12000','retention_register','retention:ret-b4'],
  ['Instruction ID,Issue Date\nتعليمات-١,2032-03-09','site_instruction_register','instruction:تعليمات-١'],
  ['Instruction ID,Issue Date\nتوجيهات-١,2032-03-09','site_instruction_register','instruction:توجيهات-١'],
 ];
 for(const [text,type,identity] of cases){
  const result=await identifyEvidenceDocument({bytes:Buffer.from(text!),sourceFilename:'generic.csv',sourceRelativePath:null,declaredMediaType:'text/csv'});
  assert.equal(result.identification.detectedDocumentType,type,text!.split('\n')[0]);
  assert.equal(result.identification.sourceDocumentIdentity,identity,'a related identifier cannot replace the owning identity');
 }
 const multi=await identifyEvidenceDocument({bytes:Buffer.from('Instruction ID,Issue Date,Variation ID,Status\nSI-K7,2032-03-09,VO-M8,Issued\nSI-K8,2032-03-10,VO-M9,Issued'),sourceFilename:'generic.csv',sourceRelativePath:null,declaredMediaType:'text/csv'});
 assert.equal(multi.identification.detectedDocumentType,'site_instruction_register');
 assert.equal(multi.identification.sourceDocumentIdentity,null,'a multi-record register has no single document identity from a related VO');
 assert.equal(canonicalHeader('GrossCertifiedAmount'),'gross certified amount');
 assert.equal(canonicalHeader('CPI'),'cpi');assert.equal(canonicalHeader('m3'),'m3');
 assert.equal(canonicalHeader('Activity IDs'),'activity ids');assert.equal(canonicalHeader('ActivityIDs'),'activity ids');
 assert.equal(canonicalHeader('Resource UIDs'),'resource uids');
 const ambiguous=await identifyEvidenceDocument({bytes:Buffer.from('Reference,Date,Value\nX-4,2032-03-09,12000'),sourceFilename:'generic.csv',sourceRelativePath:null,declaredMediaType:'text/csv'});
 assert.equal(ambiguous.identification.needsReview,true,'generic fields do not establish a specialist role');
});
test('Stage 1 sparse current control rows remain canonical with unknown lifecycle and financial basis',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'sparse-control-register-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:dir,durable:false}),projectId='SPARSE-CONTROL-REGISTER';
 const files=[
  ['si.csv','InstructionID,IssueDate\nSI-P1,2032-03-09'],
  ['ob.csv','ObligationID,DueDate\nOB-P2,2032-03-12'],
  ['ret.csv','RetentionID,HeldAmount\nRET-P3,12000'],
 ];
 for(const [name,text] of files)await store.ingestEvidenceFile({projectId,sourceFilename:name!,mediaType:'text/csv',bytes:Buffer.from(text!),uploadedAt:'2032-03-10T00:00:00Z',uploadIntent:'add_update'});
 const state=store.get(projectId)!,canonical=commercialCanonical(state);
 assert.equal(canonical.siteInstructions.length,1);assert.equal(canonical.obligations.length,1);assert.equal(canonical.retentions.length,1);
 assert.equal(canonical.siteInstructions[0]!.instructionId,'SI-P1');assert.equal(canonical.variations.length,0);
 assert.equal(canonical.obligations[0]!.responsibleParty,null);
 assert.equal(canonical.retentions[0]!.amount.value,12000);
 assert.equal(canonical.retentions[0]!.amount.currency,null);assert.equal(canonical.retentions[0]!.amount.asOf,null);
 assert.equal(canonical.retentions[0]!.dueDate,null);
 for(const [name,text] of files){const doc=state.evidenceDocuments.find(row=>row.sourceFilename===name)!;assert.deepEqual(readFileSync(doc.storedPath),Buffer.from(text!));}
});
test('Stage 1 preserves gross work and gross certification as distinct payment columns',()=>{
 const read=prepareRegisterRows([
  ['Certificate No','Gross Work','Variations','Gross Certified Amount','Employer Certified Amount','Net Certified','Currency'],
  ['IPC-COMPONENTS','1000','200','1200','1200','1080','AED'],
 ],'payment_certificates');
 assert.equal(read.recognized,true);
 assert.equal(new Set(read.headers).size,read.headers.length,'different financial stages must not collapse into duplicate meanings');
 assert.equal(read.headers[1],'gross work');assert.equal(read.headers[3],'gross certified amount');
 assert.equal(read.rows[0]![1],'1000');assert.equal(read.rows[0]![3],'1200');
 assert.equal(canonicalHeader('Gross Certified / الإجمالي المعتمد'),'gross certified amount');
 assert.equal(canonicalHeader('Gross Certified Amount (AED)'),'gross certified amount aed');
 assert.equal(canonicalHeader('Gross'),'gross work','retain the existing generic-gross interpretation without overriding an explicit certification header');
});
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

test('summary footer rows never become source records while legitimate TOTAL-like identifiers remain',()=>{
 const risk=prepareRegisterRows([
  ['Risk ID','Description','Status','Owner'],
  ['TOTAL','','',''],
 ],'risk_register');
 assert.equal(risk.recognized,true);assert.equal(risk.rows.length,0);

 const payment=prepareRegisterRows([
  ['Certificate No','Net Certified','Currency','Status'],
  ['IPC-1','100','AED','Certified'],
  ['Grand Total','100','',''],
 ],'payment_certificates');
 assert.equal(payment.recognized,true);assert.equal(payment.rows.length,1);assert.equal(payment.rows[0]![0],'IPC-1');

 const arabic=prepareRegisterRows([
  ['Risk ID','Description','Status'],
  ['الإجمالي','',''],
 ],'risk_register');
 assert.equal(arabic.rows.length,0);

 const legitimate=prepareRegisterRows([
  ['Risk ID','Description','Status'],
  ['TOTAL-01','Total station access risk','Open'],
 ],'risk_register');
 assert.equal(legitimate.rows.length,1);assert.equal(legitimate.rows[0]![0],'TOTAL-01');
});

test('accounting-format amounts remain numeric and reach variation controls', async t => {
 assert.equal(numberValue('(249,816)'),-249816);
 assert.equal(numberValue('(٢٤٩٬٨١٦)'),-249816);
 assert.equal(numberValue('(-249,816)'),null,'ambiguous signed accounting notation must fail closed');
 const dir=mkdtempSync(join(tmpdir(),'variation-accounting-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:dir,durable:false}),projectId='VARIATION-ACCOUNTING';
 await store.ingestEvidenceFile({
  projectId,sourceFilename:'Variation_Register.csv',mediaType:'text/csv',
  bytes:Buffer.from('Variation ID,Description,Approved Amount,Status,Currency\nVO-1,Scope credit,"(249,816)",Approved,EUR'),
  uploadedAt:'2031-04-30T00:00:00Z',uploadIntent:'add_update',
 });
 const state=store.get(projectId)!;
 assert.equal(state.controls.variations.length,1);
 assert.equal(state.controls.variations[0]!.variationId,'VO-1');
 assert.equal(state.controls.variations[0]!.amount,-249816);
 assert.equal(state.controls.variations[0]!.currency,'EUR');
});

test('Stage 1 supported control registers retain current identity and old reference fallthrough is repaired on refresh',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'control-register-upgrade-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:dir,durable:false}),projectId='NEW-CONTROL-REGISTER';
 const files=[
  ['source-one.csv','Retention ID,Status,Retention Amount,Currency,VAT Basis,As Of,Due Date,Trigger\nRET-1,Held,300,AED,Exclusive,2031-04-30,2031-06-30,TOC','retention_register'],
  ['source-two.csv','Instruction ID,Description,Issue Date,Status,Variation ID,Quotation Date,Estimated Amount,Currency\nSI-1,Drainage,2031-04-01,Issued,VO-9,2031-04-10,200,AED','site_instruction_register'],
  ['source-three.csv','Obligation ID,Clause,Description,Responsible Party,Due Date,Status,Evidence Reference\nOBL-1,2,Certification,Engineer,2031-05-01,Open,IPC','contract_obligation_register'],
 ];
 for(const [name,text,type] of files){
  await store.ingestEvidenceFile({projectId,sourceFilename:name!,mediaType:'text/csv',bytes:Buffer.from(text!),uploadedAt:'2031-04-30T00:00:00Z',uploadIntent:'add_update'});
  const document=store.get(projectId)!.evidenceDocuments.find(doc=>doc.sourceFilename===name)!;
  assert.equal(document.documentType,type);assert.equal(document.basisState,'active');
 }
 const state=store.get(projectId)!,canonical=commercialCanonical(state);
 assert.equal(canonical.retentions.length,1);assert.equal(canonical.obligations.length,1);assert.equal(canonical.siteInstructions.length,1);
 assert.equal(canonical.variations.length,0,'a relationship to VO-9 does not create a second variation record');
 const retention=state.evidenceDocuments[0]!,bytes=readFileSync(retention.storedPath),sourceHash=retention.sourceHashSha256;
 retention.basisState='historical';delete state.activeEvidenceBasis[retention.familyKey];
 retention.derivedRegisterRead={producerVersion:'register-derived-v5',sourceHashSha256:sourceHash};
 const refreshed=await store.refreshSpreadsheetRegisters(projectId);
 assert.equal(refreshed.refreshedDocumentCount,1);assert.equal(retention.basisState,'active');
 assert.equal(retention.sourceHashSha256,sourceHash);assert.deepEqual(readFileSync(retention.storedPath),bytes);
 assert.equal((await store.refreshSpreadsheetRegisters(projectId)).refreshedDocumentCount,0,'migration must be idempotent');
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
 assert.equal(doc.derivedRegisterRead?.producerVersion,'register-derived-v8');
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
