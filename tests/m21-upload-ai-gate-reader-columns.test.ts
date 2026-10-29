import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import type {TableSemanticAiInput,TableSemanticAiResolver} from '../packages/runtime-api/src/evidence-semantic-ai';

// M2.1 (upload gate) invariant: the upload-time AI check and the column report
// use one interpretation, what the canonical readers consume. Columns a reader
// consumes are never sent to the AI as unread; a column no reader consumes is,
// even when its heading is in the old recognition word list.

process.env.CMENG_OCR_ENABLED='0';
const TEXT='Determination ID,Claim ID,Days Awarded,Date,Source Letter,Status,Value Note\nD1,C1,15,2031-03-01,L-77,Determined,see file\nD2,C1,11,2031-03-20,L-80,Determined,partial';

test('M2.1: the upload AI gate sends only the columns no canonical reader consumes, and the column report agrees',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'m21-upload-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const seen:TableSemanticAiInput[]=[];
  const resolver:TableSemanticAiResolver={name:'stub',async resolveTable(input){seen.push(input);return null;}};
  const store=new RuntimeProjectStore({dataDir:dir,durable:false,semanticAiResolver:resolver});
  const projectId='M21-UPLOAD-'+Math.random().toString(36).slice(2,8).toUpperCase();
  store.getOrCreate(projectId);
  await store.ingestEvidenceFile({projectId,bytes:Buffer.from(TEXT),sourceFilename:'Determinations.csv',mediaType:'text/csv',uploadedAt:'2031-05-01T00:00:00.000Z',uploadIntent:'add_update',allowSemanticAi:true});
  assert.equal(seen.length,1,'one AI reading is requested: one column is not consumed by any reader');
  const sent=(seen[0]!.unconsumedColumns??[]).map(c=>c.rawHeader);
  assert.deepEqual(sent,['Value Note'],'only the unconsumed column goes to the AI: '+JSON.stringify(sent));
  // The column report of the stored document reads the same interpretation.
  const state=store.get(projectId)!;
  const doc=state.evidenceDocuments[0]!;
  const {readerConsumedColumns}=await import('../packages/runtime-api/src/reader-consumption');
  const {sourceTables}=await import('../packages/truth-kernel/src');
  const table=sourceTables(state.evidenceDocuments,[])[0]!;
  const consumed=readerConsumedColumns(state,doc.documentId,table.headers,doc.documentType);
  const notConsumed=table.intelligence.columns.map(c=>c.rawHeader).filter((h,i)=>!consumed.has(table.headers[i]??''));
  assert.deepEqual(notConsumed,['Value Note'],'the column report agrees with the AI gate: '+JSON.stringify(notConsumed));
});

test('M2.1: a heading in the old word list that no reader consumes is still sent to the AI',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'m21-upload-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const seen:TableSemanticAiInput[]=[];
  const resolver:TableSemanticAiResolver={name:'stub',async resolveTable(input){seen.push(input);return null;}};
  const store=new RuntimeProjectStore({dataDir:dir,durable:false,semanticAiResolver:resolver});
  const projectId='M21-WORDLIST-'+Math.random().toString(36).slice(2,8).toUpperCase();
  store.getOrCreate(projectId);
  const text='Determination ID,Claim ID,Days Awarded,Date,Status,Value\nD1,C1,15,2031-03-01,Determined,12\nD2,C1,11,2031-03-20,Determined,9';
  await store.ingestEvidenceFile({projectId,bytes:Buffer.from(text),sourceFilename:'Determinations.csv',mediaType:'text/csv',uploadedAt:'2031-05-01T00:00:00.000Z',uploadIntent:'add_update',allowSemanticAi:true});
  assert.equal(seen.length,1,'"Value" is in the word list but no reader consumes it, so the AI is asked');
  assert.deepEqual((seen[0]!.unconsumedColumns??[]).map(c=>c.rawHeader),['Value']);
});
