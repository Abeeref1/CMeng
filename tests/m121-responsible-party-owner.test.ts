import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {operationalControlsAsOf} from '../packages/runtime-api/src/operational-reporting';
import {canonicalHeader} from '../packages/truth-kernel/src';

// M12.1 invariant: an NCR register's "Responsible Party" is the record owner on
// every reader; in a claims register it keeps its own meaning.
test('M12.1: the responsible party is the owner of an NCR, and keeps its meaning in a claims register',async t=>{
  assert.equal(canonicalHeader('Responsible Party','delay_eot_claims_register'),'responsible party');
  const dir=mkdtempSync(join(tmpdir(),'cmeng-m121-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate('M121');
  await store.ingestEvidenceFile({projectId:'M121',bytes:Buffer.from('NCR ID,Description,Responsible Party,Status,Date Raised\nN1,Weld defect,QA Manager,Open,2026-08-01\n'),mediaType:'text/csv',sourceFilename:'NCR.csv',uploadedAt:'2026-09-01'});
  const ncrs=(operationalControlsAsOf(state,'2026-09-01') as any).quality.current as any[];
  assert.equal(ncrs.length,1);assert.equal(ncrs[0].owner,'QA Manager');
});
