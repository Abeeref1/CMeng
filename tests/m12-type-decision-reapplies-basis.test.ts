import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {documentClassificationChoices} from '../packages/runtime-api/src/document-identification';

// M1.2 invariant: confirming a file's type moves it into the right family and
// decides its basis there, so a file read as a supporting document becomes a
// current register when confirmed as one.
test('M1.2: a type decision re-applies the basis in the new family',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-m12-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate('M12');
  await store.ingestEvidenceFile({projectId:'M12',bytes:Buffer.from('Item,Text,Owner,State\nX1,Site access road flooding,Site Manager,Open\nX2,Crane availability,Planner,Closed\n'),mediaType:'text/csv',sourceFilename:'Notes_list.csv',uploadedAt:'2026-09-01'});
  const doc=state.evidenceDocuments[0]!;
  const choice=documentClassificationChoices(doc).find(c=>c.documentType==='risk_register');
  assert.ok(choice,'risk register is offered: '+documentClassificationChoices(doc).map(c=>c.documentType).join(','));
  const before={type:doc.documentType,basis:doc.basisState,family:doc.familyKey};
  await store.reviewDocumentClassification('M12',{documentId:doc.documentId,sourceHash:doc.sourceHashSha256,expectedVersion:state.version,documentType:'risk_register',reference:'Checked: this is the risk register'});
  assert.equal(doc.documentType,'risk_register');
  assert.notEqual(doc.familyKey,before.family,'the file moves family');
  assert.ok(['active','additive'].includes(doc.basisState),'its basis is decided in the new family (was '+before.basis+', now '+doc.basisState+')');
  assert.equal(state.activeEvidenceBasis[doc.familyKey]!==undefined||doc.basisState==='additive',true);
});
