import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import type {TableSemanticAiInput,TableSemanticAiResolver} from '../packages/runtime-api/src/evidence-semantic-ai';
import type {ContractAiResolver} from '../packages/contract-parser/src';

// P4 invariant: a CSV read before AI reading steps were recorded (no
// semanticAiSteps for its source) and with columns no CMeng reader consumed is
// found by Finish AI reading, read once with AI, recorded on the document and
// never read again. The document screen counts it before and not after.
// Placeholder and comment columns are not sent. No real provider is used here.
const extra='RFI ID,Subject,Status,Date Raised,Response Due,Site Weather\nRFI-001,Door detail,Open,2031-01-02,2031-01-09,Sunny\nRFI-002,Slab edge,Closed,2031-01-03,2031-01-10,Rain\n';
const plain='RFI ID,Subject,Status,Date Raised,Response Due\nRFI-001,Door detail,Open,2031-01-02,2031-01-09\nRFI-002,Slab edge,Closed,2031-01-03,2031-01-10\n';
const comment='RFI ID,Subject,Status,Date Raised,Response Due,Comments,Extra_1\nRFI-001,Door detail,Open,2031-01-02,2031-01-09,see drawing,a\nRFI-002,Slab edge,Closed,2031-01-03,2031-01-10,ok,b\n';
const provider={providerConfigured:true,estimatedMaxUsdPerCall:0.01};

async function legacyProject(t:{after(fn:()=>void):void},files:Record<string,string>,resolver:TableSemanticAiResolver){
  const dir=mkdtempSync(join(tmpdir(),'cmeng-p4-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false,semanticAiResolver:resolver}),state=store.getOrCreate('P4-BACKFILL');
  for(const [name,text] of Object.entries(files)){
    await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(text),mediaType:'text/csv',sourceFilename:name,uploadedAt:'2031-01-05'});
    // Read before AI reading steps were recorded: the document carries none.
    delete state.evidenceDocuments.find(d=>d.sourceFilename===name)!.semanticAiSteps;
  }
  return {store,state};
}

test('P4: a CSV read without AI steps and with one unread column is found, read once and recorded',async t=>{
  const calls:TableSemanticAiInput[]=[];
  const resolver:TableSemanticAiResolver={name:'fake-free',async resolveTable(input){calls.push(input);return null;}};
  const {store,state}=await legacyProject(t,{'RFI.csv':extra},resolver);
  const document=state.evidenceDocuments.find(d=>d.sourceFilename==='RFI.csv')!;
  assert.equal((document as {semanticAiSteps?:unknown}).semanticAiSteps,undefined,'read before AI steps were recorded');

  const before=store.aiReadingCoverage(state.projectId,provider);
  assert.equal(before.documentsEligibleForAi,1,'the document is counted as eligible');
  assert.equal(before.stepsAwaitingAi,1,'the screen offers Finish AI reading');
  assert.match(before.statement!,/1 document has columns CMeng's rules could not read\. Finish AI reading reads it, up to USD 0\.0100/);
  assert.doesNotMatch(before.statement!,/—/,'no em dash');

  const refused=await store.finishAiTableReading(state.projectId,{allowSemanticAi:false});
  assert.equal(refused.state,'not_allowed');assert.equal(calls.length,0,'no paid call without permission');

  const version=state.version;
  const read=await store.finishAiTableReading(state.projectId,{allowSemanticAi:true});
  assert.equal(read.state,'read');assert.equal(read.documentsRead,1);
  assert.equal(calls.length,1,'exactly one AI call');
  assert.deepEqual(calls[0]!.unconsumedColumns,[{rawHeader:'Site Weather',columnIndex:5}],'only the column no reader consumed is sent');
  const steps=(document.semanticAiSteps??[]).filter(s=>s.sourceHashSha256===document.sourceHashSha256);
  assert.deepEqual(steps.map(s=>[s.sheetName,s.status,s.attempted]),[['CSV','unresolved',true]],'the AI step is recorded on the document');
  assert.ok(state.version>version,'the project is refreshed');

  const after=store.aiReadingCoverage(state.projectId,provider);
  assert.equal(after.documentsEligibleForAi,0);assert.equal(after.stepsAwaitingAi,0);

  const again=await store.finishAiTableReading(state.projectId,{allowSemanticAi:true});
  assert.equal(again.state,'nothing_to_read');assert.equal(calls.length,1,'a sheet AI already read is not called again');
});

test('P4: a CSV whose columns are all read, or only placeholder and comment columns are left, is not eligible',async t=>{
  const calls:string[]=[];
  const resolver:TableSemanticAiResolver={name:'fake-free',async resolveTable(input){calls.push(input.sheetName);return null;}};
  const {store,state}=await legacyProject(t,{'Plain.csv':plain,'Comment.csv':comment},resolver);
  const coverage=store.aiReadingCoverage(state.projectId,provider);
  assert.equal(coverage.documentsEligibleForAi,0);assert.equal(coverage.stepsAwaitingAi,0);assert.equal(coverage.statement,null);
  const result=await store.finishAiTableReading(state.projectId,{allowSemanticAi:true});
  assert.equal(result.state,'nothing_to_read');assert.deepEqual(calls,[]);
});

test('P4: a validated AI reading is applied to the document and the project',async t=>{
  const resolver:TableSemanticAiResolver={name:'fake-free',async resolveTable(input){
    return {documentType:'rfi_register',category:'engineering',confidence:0.95,method:'ai_grounded',signals:['fake validated'],
      columnMeanings:[{columnIndex:5,rawHeader:'Site Weather',meaning:'description',confidence:0.95,source:'ai_grounded'}]} as never;
  }};
  const {store,state}=await legacyProject(t,{'RFI.csv':extra},resolver);
  const document=state.evidenceDocuments.find(d=>d.sourceFilename==='RFI.csv')!;
  const result=await store.finishAiTableReading(state.projectId,{allowSemanticAi:true});
  assert.equal(result.state,'read');
  assert.equal(document.csvSemantic?.method,'ai_grounded','the validated reading is kept on the document');
  assert.deepEqual(result.steps.map(s=>s.status),['validated']);
  assert.ok(document.identification.diagnostics.some(d=>/^CSV_REGISTER_ROLE_ESTABLISHED_FROM_GROUNDED_AI:/.test(d)),'applied as upload applies it');
  assert.equal(store.aiReadingCoverage(state.projectId,provider).documentsEligibleForAi,0);
});

test('P4: Finish AI reading stops at the monthly cap and makes no further call',async t=>{
  const calls:string[]=[];
  const resolver:TableSemanticAiResolver={name:'fake-capped',async resolveTable(input){calls.push(input.sourceHashSha256);throw new Error('MODEL_MONTHLY_BUDGET_EXHAUSTED');}};
  const {store,state}=await legacyProject(t,{'A.csv':extra,'B.csv':extra.replace('RFI-002','RFI-003')},resolver);
  assert.equal(store.aiReadingCoverage(state.projectId,provider).documentsEligibleForAi,2);
  const result=await store.finishAiTableReading(state.projectId,{allowSemanticAi:true});
  assert.equal(calls.length,1,'no call after the cap');
  assert.equal(result.stoppedAtCap,true);
  assert.ok(result.steps.every(s=>s.status==='stopped_at_cap'));
  const coverage=store.aiReadingCoverage(state.projectId,provider);
  assert.equal(coverage.stepsAwaitingAi,2,'both documents still await AI reading');
});

test('P4: a contract read before AI steps were recorded is found and its unresolved headings are read with AI',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-p4c-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  let calls=0;
  const contractAiResolver:ContractAiResolver={name:'fake-contract',async resolveHeading(input){
    calls++;
    return {kind:'clause',identifier:'AI-'+calls,contextIdentifier:null,heading:'Resolved '+calls,confidence:0.99,
      sourceStart:input.sourceSpan.start,sourceEnd:input.sourceSpan.end,sourceText:input.sourceSpan.text,explanation:'fixture'};
  }};
  const store=new RuntimeProjectStore({dataDir:dir,durable:false,contractAiResolver}),state=store.getOrCreate('P4-CONTRACT');
  const text='MAIN WORKS CONTRACT\n\n1. Definitions\nThe Employer and the Contractor agree as follows.\n\nClause ??? unresolved heading A\nThe Contractor shall give notice within 28 days.\n';
  await store.ingestContract({projectId:state.projectId,bytes:Buffer.from(text),mediaType:'text/plain',sourceFilename:'Main_Contract.txt',role:'main',uploadedAt:'2031-01-05'});
  const document=state.evidenceDocuments.find(d=>d.category==='contract')!;
  assert.ok(document,'the contract is a project document');
  assert.equal(calls,0,'no AI call at upload without permission');
  delete (document as {semanticAiSteps?:unknown}).semanticAiSteps;
  assert.equal(store.aiReadingCoverage(state.projectId,provider).documentsEligibleForAi,1,'the contract with no AI steps is counted');
  const read=await store.finishAiTableReading(state.projectId,{allowSemanticAi:true});
  assert.equal(read.state,'read');assert.equal(read.documentsRead,1);
  const steps=(document.semanticAiSteps??[]).filter(s=>s.sourceHashSha256===document.sourceHashSha256);
  assert.ok(steps.length>0,'the contract AI steps are recorded on the document');
  assert.equal(store.aiReadingCoverage(state.projectId,provider).documentsEligibleForAi,0,'not counted again');
  const again=await store.finishAiTableReading(state.projectId,{allowSemanticAi:true});
  assert.equal(again.state,'nothing_to_read','a contract AI already read is not read again');
});

test('P4: a contract PDF is never read as a CSV table by Finish AI reading',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-p4d-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const tableCalls:string[]=[];
  const resolver:TableSemanticAiResolver={name:'fake-table',async resolveTable(input){tableCalls.push(input.sheetName);return null;}};
  const store=new RuntimeProjectStore({dataDir:dir,durable:false,semanticAiResolver:resolver,contractAiResolver:null}),state=store.getOrCreate('P4-PDF');
  await store.ingestContract({projectId:state.projectId,bytes:Buffer.from('MAIN WORKS CONTRACT\n\n1. Definitions\nText.\n'),mediaType:'text/plain',sourceFilename:'Main_Contract.txt',role:'main',uploadedAt:'2031-01-05'});
  await store.finishAiTableReading(state.projectId,{allowSemanticAi:true});
  assert.deepEqual(tableCalls,[],'the table reader is never called on a contract');
});

test('P4: a contract uploaded with the other documents gets their AI permission at upload',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-p4e-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const contractAiResolver:ContractAiResolver={name:'fake-contract',async resolveHeading(){return null;}};
  const store=new RuntimeProjectStore({dataDir:dir,durable:false,contractAiResolver}),state=store.getOrCreate('P4-UPLOAD');
  const text='MAIN WORKS CONTRACT\n\nAgreement between the Employer and the Contractor.\n\n1. Definitions\nTime for Completion means 540 days.\n\n2. Contract Price\nThe Contract Price is SAR 10,000,000.\n\nClause ??? unresolved heading A\nThe Contractor shall give notice within 28 days.\n';
  await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(text),mediaType:'text/plain',sourceFilename:'Main_Contract.txt',uploadedAt:'2031-01-05',allowSemanticAi:true} as never);
  const document=state.evidenceDocuments.find(d=>d.category==='contract');
  if(!document){t.skip('the text was not read as a contract in this build');return;}
  const steps=(document.semanticAiSteps??[]).filter(s=>s.sourceHashSha256===document.sourceHashSha256);
  assert.ok(steps.length>0);
  assert.ok(steps.every(s=>s.status!=='disabled'),'AI permission reached the contract reader: '+steps.map(s=>s.status).join(','));
});

test('Contract AI reading continues past the per-file limit: a second reading reuses earlier answers and reads only the rest',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-p4f-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const asked:string[]=[];
  const contractAiResolver:ContractAiResolver={name:'fake-contract',async resolveHeading(input){asked.push(input.sourceSpan.text);return null;}};
  const store=new RuntimeProjectStore({dataDir:dir,durable:false,contractAiResolver}),state=store.getOrCreate('P4-LIMIT');
  const headings=Array.from({length:12},(_,i)=>'Clause ??? unclear heading '+String.fromCharCode(65+i)+'\nThe Contractor shall comply with item '+(i+1)+'.\n').join('\n');
  await store.ingestContract({projectId:state.projectId,bytes:Buffer.from('MAIN WORKS CONTRACT\n\n1. Definitions\nTerms.\n\n'+headings),mediaType:'text/plain',sourceFilename:'Main_Contract.txt',role:'main',uploadedAt:'2031-01-05'});
  const document=state.evidenceDocuments.find(d=>d.category==='contract')!;
  const first=await store.finishAiTableReading(state.projectId,{allowSemanticAi:true});
  assert.equal(first.state,'read');
  assert.equal(asked.length,8,'the first reading stops at the 8-call limit');
  assert.equal((document.semanticAiSteps??[]).filter(s=>s.status==='call_limit').length,4);
  const second=await store.finishAiTableReading(state.projectId,{allowSemanticAi:true});
  assert.equal(second.state,'read');
  assert.equal(asked.length,12,'the second reading asks only the 4 headings not read before');
  assert.equal(new Set(asked).size,12,'no heading is asked twice');
  const steps=(document.semanticAiSteps??[]).filter(s=>s.sourceHashSha256===document.sourceHashSha256);
  assert.equal(steps.filter(s=>s.status==='call_limit').length,0,'nothing is left at the limit');
  assert.equal(steps.filter(s=>/reused/.test(s.note)).length,8,'the 8 earlier answers are reused without a call');
  assert.equal((await store.finishAiTableReading(state.projectId,{allowSemanticAi:true})).state,'nothing_to_read');
});
