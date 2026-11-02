import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {aiReadingCoverage,type TableSemanticAiResolver} from '../packages/runtime-api/src/evidence-semantic-ai';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// M16.1 invariant: a table uploaded without AI can be finished later by one
// explicit action. No paid call runs unless the request is allowed to make one;
// the status names the real next step (the Finish AI reading action), and a sheet
// AI already read is never called again. No real provider is used here.
const register='Ref,Thing,When,Who\nX-1,Alpha,2031-01-02,North\nX-2,Beta,2031-01-03,South\n';

test('M16.1: upload without AI, then Finish AI reading reads the remaining table once',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-m161-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const calls:string[]=[];
  const resolver:TableSemanticAiResolver={name:'fake-free',async resolveTable(input){calls.push(input.sheetName);return null;}};
  const store=new RuntimeProjectStore({dataDir:dir,durable:false,semanticAiResolver:resolver}),state=store.getOrCreate('M161-READ');
  await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(register),mediaType:'text/csv',sourceFilename:'Register.csv',uploadedAt:'2031-01-05'});
  const document=state.evidenceDocuments.find(d=>d.sourceFilename==='Register.csv')!;
  assert.ok((document.semanticAiSteps??[]).some(s=>s.status==='disabled'),'AI was not used at upload');
  assert.deepEqual(calls,[],'no AI call at upload');
  const before=aiReadingCoverage(state.evidenceDocuments,{providerConfigured:true,estimatedMaxUsdPerCall:0.01});
  assert.match(before.statement!,/Use Finish AI reading to read them/,'the status names the real action');

  const refused=await store.finishAiTableReading(state.projectId,{allowSemanticAi:false});
  assert.equal(refused.state,'not_allowed');assert.deepEqual(calls,[],'no paid call without permission');

  const version=state.version;
  const read=await store.finishAiTableReading(state.projectId,{allowSemanticAi:true});
  assert.equal(read.state,'read');assert.equal(read.documentsRead,1);
  assert.deepEqual(calls,['CSV'],'AI read the remaining table once');
  assert.ok(state.version>version,'the project is recalculated with the new reading');
  const after=aiReadingCoverage(state.evidenceDocuments,{providerConfigured:true,estimatedMaxUsdPerCall:0.01});
  assert.equal(after.stepsAwaitingAi,0);assert.match(after.statement!,/AI has already read the rest; they need review\./);

  const again=await store.finishAiTableReading(state.projectId,{allowSemanticAi:true});
  assert.equal(again.state,'nothing_to_read');assert.deepEqual(calls,['CSV'],'a sheet AI already read is not called again');
});

test('M16.1: the document screen offers Finish AI reading only when AI is set up and steps await it',()=>{
  const script=cmengUatHtml();
  assert.match(script,/data\.aiReading\.aiSetUp&&data\.aiReading\.stepsAwaitingAi>0\?' <button class="btn small" type="button" id="finishAiReading">Finish AI reading<\/button>/);
  assert.match(script,/\/evidence\/ai-reading',\{method:'POST'\}/);
});
