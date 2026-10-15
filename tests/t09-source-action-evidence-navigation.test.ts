import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {actionSourceCorrectionRecord} from '../packages/runtime-api/src/project-actions';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import type {ProjectRuntimeState} from '../packages/runtime-api/src/project-state-types';

const projectState={
 projectId:'EXACT-PROJECT',evidenceDocuments:[
  {documentId:'DOC-01',sourceHashSha256:'SHA-BYTES-01',sourceFilename:'Quality register original.pdf'},
  {documentId:'DOC-02',sourceHashSha256:'SHA-BYTES-02',sourceFilename:'Current procurement.xlsx'},
 ]
} as unknown as ProjectRuntimeState;
test('T09 actions identify original source document with SHA and physical locator',()=>{
 const value=actionSourceCorrectionRecord(projectState,'evidence-document:DOC-01:page:7');
 assert.deepEqual(value,{source:'Quality register original.pdf',locator:'Page 7',documentId:'DOC-01',sourceHash:'SHA-BYTES-01'});
 const other=actionSourceCorrectionRecord(projectState,'evidence-document:DOC-02:row:1743');
 assert.equal(other.locator,'Row 1743');assert.equal(other.documentId,'DOC-02');
});
test('T09 foreign or missing source cannot create a fictitious document link',()=>{
 const missing=actionSourceCorrectionRecord(projectState,'evidence-document:OTHER:row:3');
 assert.equal(missing.documentId,undefined);assert.equal(missing.sourceHash,undefined);
});
test('T09 real browser UI builds source link for the project and hash, not an unsupported role or loop',()=>{
 const html=cmengUatHtml();
 const match=/function actionSourceLink\(row\)\{[\s\S]*?\n\}/.exec(html)?.[0];
 assert.ok(match,'inspect real browser source renderer');
 const fn=runInNewContext('('+match+')',{project:()=> 'EXACT-PROJECT',escapeHtml:(v:unknown)=>String(v),encodeURIComponent}) as (row:unknown)=>string;
 const row=actionSourceCorrectionRecord(projectState,'evidence-document:DOC-01:page:7');
 assert.ok(fn(row).includes('/api/projects/EXACT-PROJECT/evidence/documents/DOC-01/source?hash=SHA-BYTES-01'));
 assert.ok(fn(row).includes('Quality register original.pdf · Page 7'));
 assert.ok(!fn(actionSourceCorrectionRecord(projectState,'evidence-document:FOREIGN')).includes('<a '));
});
