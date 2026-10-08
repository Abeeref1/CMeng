import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {
  assessTableSemanticAiProposal,
  GroundedTableSemanticAiResolver,
  type TableSemanticAiProposal,
} from '../packages/runtime-api/src/evidence-semantic-ai';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {inferTableSemanticRoute} from '../packages/truth-kernel/src';
import type {StructuredModel} from '../packages/project-ask/src/provider';

const rows=[
  ['ABC','Cut','Q1','Q2','FX','Stage'],
  ['PC-1','2039-01-31','1000','900','AED','Paid'],
  ['PC-2','2039-02-28','1800','1700','AED','Certified'],
  ['PC-3','2039-03-31','2500','2400','AED','Open'],
];
const sourceHash='a'.repeat(64);
const proposal=():TableSemanticAiProposal=>({
  sourceHashSha256:sourceHash,sheetName:'CSV',documentType:'payment_certificates',confidence:0.97,
  columns:[
    {columnIndex:0,rawHeader:'ABC',meaning:'certificate no',confidence:0.99},
    {columnIndex:1,rawHeader:'Cut',meaning:'period end',confidence:0.96},
    {columnIndex:2,rawHeader:'Q1',meaning:'net certified',confidence:0.99},
    {columnIndex:3,rawHeader:'Q2',meaning:'paid amount',confidence:0.98},
    {columnIndex:4,rawHeader:'FX',meaning:'currency',confidence:0.99},
    {columnIndex:5,rawHeader:'Stage',meaning:'status',confidence:0.95},
  ],
});

test('grounded semantic proposal is source-bound and must reproduce an existing CMeng schema',()=>{
  assert.equal(inferTableSemanticRoute(rows),null,'opaque headers must not be pre-solved by the deterministic aliases');
  const accepted=assessTableSemanticAiProposal({sourceHashSha256:sourceHash,sheetName:'CSV',rows},proposal());
  assert.equal(accepted?.documentType,'payment_certificates');
  assert.equal(accepted?.method,'ai_grounded');
  assert.equal(accepted?.columnMeanings?.length,6);

  const wrongHash=proposal();wrongHash.sourceHashSha256='b'.repeat(64);
  assert.equal(assessTableSemanticAiProposal({sourceHashSha256:sourceHash,sheetName:'CSV',rows},wrongHash),null);
  const wrongHeader=proposal();wrongHeader.columns[0]!.rawHeader='Invented';
  assert.equal(assessTableSemanticAiProposal({sourceHashSha256:sourceHash,sheetName:'CSV',rows},wrongHeader),null);
  const low=proposal();low.confidence=0.89;
  assert.equal(assessTableSemanticAiProposal({sourceHashSha256:sourceHash,sheetName:'CSV',rows},low),null);
  const badMeaning=proposal();(badMeaning.columns[2] as any).meaning='approved eot days';
  assert.equal(assessTableSemanticAiProposal({sourceHashSha256:sourceHash,sheetName:'CSV',rows},badMeaning),null);
});

test('AI cannot contradict a deterministic table role',()=>{
  const risk=[
    ['Risk ID','Description','Owner','Due Date','Status'],
    ['R-1','Access','PM','2039-02-01','Open'],
    ['R-2','Design','Designer','2039-02-02','Open'],
  ];
  assert.equal(inferTableSemanticRoute(risk)?.documentType,'risk_register');
  const p=proposal();p.sourceHashSha256=sourceHash;p.sheetName='Risk';p.columns=[
    {columnIndex:0,rawHeader:'Risk ID',meaning:'certificate no',confidence:0.99},
    {columnIndex:1,rawHeader:'Description',meaning:'net certified',confidence:0.99},
  ];
  assert.equal(assessTableSemanticAiProposal({sourceHashSha256:sourceHash,sheetName:'Risk',rows:risk},p),null);
});

test('unresolved CSV uses grounded semantic AI once, existing payment engine consumes it, and the same source hash is not paid twice',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-j3-semantic-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  let calls=0;
  const model:StructuredModel={structured:async(_name,_schema,_prompt,input:any)=>{
    calls++;
    const header=input.table.rows[0] as string[];
    return {
      sourceHashSha256:input.sourceHashSha256,sheetName:input.sheetName,documentType:'payment_certificates',confidence:0.97,
      columns:[
        {columnIndex:header.indexOf('ABC'),rawHeader:'ABC',meaning:'certificate no',confidence:0.99},
        {columnIndex:header.indexOf('Cut'),rawHeader:'Cut',meaning:'period end',confidence:0.96},
        {columnIndex:header.indexOf('Q1'),rawHeader:'Q1',meaning:'net certified',confidence:0.99},
        {columnIndex:header.indexOf('Q2'),rawHeader:'Q2',meaning:'paid amount',confidence:0.98},
        {columnIndex:header.indexOf('FX'),rawHeader:'FX',meaning:'currency',confidence:0.99},
        {columnIndex:header.indexOf('Stage'),rawHeader:'Stage',meaning:'status',confidence:0.95},
      ],
    };
  }};
  const store=new RuntimeProjectStore({dataDir:dir,durable:false,semanticAiResolver:new GroundedTableSemanticAiResolver(model)});
  const bytes=Buffer.from(rows.map(row=>row.join(',')).join('\n'));
  const upload=()=>store.ingestEvidenceFile({projectId:'J3-AI',bytes,mediaType:'text/csv',sourceFilename:'opaque_771.csv',
    sourceRelativePath:'opaque_771.csv',uploadedAt:'2039-04-01T00:00:00.000Z',uploadIntent:'add_update',allowSemanticAi:true});
  await upload();
  const state=store.get('J3-AI')!,doc=state.evidenceDocuments.find(d=>d.sourceFilename==='opaque_771.csv')!;
  assert.equal(calls,1);
  assert.equal(doc.csvSemantic?.method,'ai_grounded');
  assert.equal(doc.documentType,'payment_certificates');
  assert.equal(state.controls.invoices.length,3,'existing payment controls must consume the mapped source rows');
  assert.ok(state.controls.invoices.every(row=>row.sourceRefs.some(ref=>ref.startsWith('evidence-document:'+doc.documentId))));

  await upload();
  assert.equal(calls,1,'same source hash must reuse the retained semantic mapping');
  assert.equal(store.get('J3-AI')!.controls.invoices.length,3,'re-upload must not duplicate the current payment population');
});

test('AI-off unresolved evidence is retained without manufacturing specialist facts',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-j3-no-ai-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  let calls=0;
  const resolver={name:'must-not-run',resolveTable:async()=>{calls++;throw new Error('unexpected');}};
  const store=new RuntimeProjectStore({dataDir:dir,durable:false,semanticAiResolver:resolver});
  const bytes=Buffer.from(rows.map(row=>row.join(',')).join('\n'));
  await store.ingestEvidenceFile({projectId:'J3-OFF',bytes,mediaType:'text/csv',sourceFilename:'opaque_991.csv',
    sourceRelativePath:'opaque_991.csv',uploadedAt:'2039-04-01T00:00:00.000Z',uploadIntent:'add_update',allowSemanticAi:false});
  const state=store.get('J3-OFF')!,doc=state.evidenceDocuments.find(d=>d.sourceFilename==='opaque_991.csv')!;
  assert.equal(calls,0);assert.equal(doc.csvSemantic,undefined);assert.equal(state.controls.invoices.length,0);
  assert.ok(state.evidenceDocuments.some(d=>d.sourceHashSha256===doc.sourceHashSha256),'ambiguous source must remain retained');
});
