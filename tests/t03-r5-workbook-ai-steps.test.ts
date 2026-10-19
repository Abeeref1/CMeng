import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import ExcelJS from 'exceljs';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {aiReadingCoverage} from '../packages/runtime-api/src/evidence-semantic-ai';

// R5: a workbook read before AI reading steps were recorded must still make the
// screen say that its reading is incomplete once the register refresh has run.
const XLSX='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
async function fixture(t:any){
 const dir=mkdtempSync(join(tmpdir(),'t03-r5-wb-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:dir,durable:false}),projectId='R5-WB';
 const wb=new ExcelJS.Workbook();
 // Unfamiliar headings the fixed rules cannot map, so the sheet is in the AI-eligible population.
 wb.addWorksheet('Unfamiliar').addRows([['Project Ref','Unfamiliar Code','Unknown Value'],['PK-001','W-77','A'],['PK-002','W-78','B'],['PK-003','W-79','C']]);
 await store.ingestEvidenceFile({projectId,sourceFilename:'unfamiliar.xlsx',sourceRelativePath:'unfamiliar.xlsx',mediaType:XLSX,
  bytes:Buffer.from(await wb.xlsx.writeBuffer()),uploadedAt:'2031-09-01T00:00:00Z',uploadIntent:'add_update'});
 const state=store.get(projectId)!,doc=state.evidenceDocuments[0]!;
 const ingestSteps=structuredClone(doc.semanticAiSteps??[]);
 assert.ok(ingestSteps.some(step=>step.status==='disabled'&&step.sourceHashSha256===doc.sourceHashSha256),'fixture is AI-eligible: '+JSON.stringify(ingestSteps));
 return {store,projectId,state,doc,ingestSteps};
}
const provider={providerConfigured:true,estimatedMaxUsdPerCall:0.02};

test('T03 R5 a current workbook with no AI step record gets its steps on refresh, without re-deriving anything',async t=>{
 const {store,projectId,state,doc,ingestSteps}=await fixture(t);
 delete doc.semanticAiSteps; // as stored before AI reading steps were recorded
 assert.equal(aiReadingCoverage(state.evidenceDocuments,provider).statement,null,'the gap: nothing is said');
 const derivedBefore=JSON.stringify([state.derivedControlsByDocument,state.derivedReadinessByDocument,state.controls]);
 const tabularBefore=JSON.stringify(doc.tabularRead),version=state.version;
 const result=await store.refreshSpreadsheetRegisters(projectId);
 assert.equal(result.refreshedDocumentCount,0,'derived register data is current and is not refreshed');
 assert.deepEqual(result.diagnostics,[]);
 assert.deepEqual(doc.semanticAiSteps,ingestSteps,'the recorded steps are exactly those of the original read');
 assert.equal(JSON.stringify(doc.tabularRead),tabularBefore,'retained read is unchanged');
 assert.equal(JSON.stringify([state.derivedControlsByDocument,state.derivedReadinessByDocument,state.controls]),derivedBefore,'no figure changes');
 assert.equal(state.version,version+1,'the stored record changed once');
 assert.match(aiReadingCoverage(state.evidenceDocuments,provider).statement!,/^Reading is incomplete: .* AI is set up\./);
 // Idempotent: a second refresh records nothing more.
 await store.refreshSpreadsheetRegisters(projectId);
 assert.deepEqual(doc.semanticAiSteps,ingestSteps);assert.equal(state.version,version+1);
});

test('T03 R5 a workbook re-read by the refresh records its steps when it has none for its current source',async t=>{
 const {store,projectId,state,doc,ingestSteps}=await fixture(t);
 delete doc.semanticAiSteps;
 doc.semanticAiSteps=[{sheetName:'Old',sourceHashSha256:'OLDER-SOURCE',status:'unresolved',attempted:true,note:'older source'}];
 doc.derivedRegisterRead={producerVersion:'register-derived-v7',sourceHashSha256:doc.sourceHashSha256};
 const result=await store.refreshSpreadsheetRegisters(projectId);
 assert.equal(result.refreshedDocumentCount,1,JSON.stringify(result));
 assert.deepEqual(doc.semanticAiSteps,[{sheetName:'Old',sourceHashSha256:'OLDER-SOURCE',status:'unresolved',attempted:true,note:'older source'},...ingestSteps],
  'older-source steps are kept; current-source steps are added');
 assert.match(aiReadingCoverage(state.evidenceDocuments,provider).statement!,/^Reading is incomplete:/);
});

test('T03 R5 steps already recorded for the current source, including paid calls, are never replaced',async t=>{
 const {store,projectId,doc}=await fixture(t);
 const paid=[{sheetName:'Unfamiliar',sourceHashSha256:doc.sourceHashSha256,status:'unresolved' as const,attempted:true,note:'AI already read this sheet.'}];
 doc.semanticAiSteps=structuredClone(paid);
 await store.refreshSpreadsheetRegisters(projectId);
 assert.deepEqual(doc.semanticAiSteps,paid);
 doc.derivedRegisterRead={producerVersion:'register-derived-v7',sourceHashSha256:doc.sourceHashSha256};
 assert.equal((await store.refreshSpreadsheetRegisters(projectId)).refreshedDocumentCount,1);
 assert.deepEqual(doc.semanticAiSteps,paid);
});
