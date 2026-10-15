import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {deliverySourceTables} from '../packages/runtime-api/src/delivery-sources';
import type {ProjectRuntimeState} from '../packages/runtime-api/src/project-state-types';

const source=(pages:Array<{pageNumber:number;text:string;method:'native'|'ocr'}>)=>{
 const dir=mkdtempSync(join(tmpdir(),'cmeng-pdf-source-')),path=join(dir,'source.pdf');
 const bytes=Buffer.from('ORIGINAL IMMUTABLE PDF SOURCE\n');
 writeFileSync(path,bytes);
 const hash=createHash('sha256').update(bytes).digest('hex');
 const document:any={
  documentId:'ORIGINAL-PDF-1',sourceHashSha256:hash,storedPath:path,
  sourceFilename:'Quality evidence.pdf',mediaType:'application/pdf',
  documentType:'quality_ncr_register',basisState:'candidate',familyKey:'quality',
  linkedArtifactId:null,uploadedAt:'2031-01-01T00:00:00Z',parserState:'parsed',
  fullTextRead:{sourceHashSha256:hash,result:{complete:true,pages}},
 };
 const state={projectId:'INDEPENDENT-DOCUMENT',evidenceDocuments:[document]} as unknown as ProjectRuntimeState;
 return {dir,state};
};
test('T02 a headerless continuation page retains all business rows and their true physical locators',()=>{
 const fixture=source([
 {pageNumber:1,method:'native',text:'NCR ID | NCR Status | Description\nNCR-1 | open | punch item\nNCR-2 | closed | verified'},
 {pageNumber:2,method:'native',text:'NCR-3 | open | second page\nNCR-4 | closed | archived'},
 ]);
 try{
  const before=JSON.stringify(fixture.state.evidenceDocuments);
  const diagnostics:string[]=[],tables=deliverySourceTables(fixture.state,diagnostics);
  const rows=tables.flatMap(t=>t.rows);
  assert.equal(rows.length,4,'no first-page-only population');
  assert.deepEqual(rows.map(r=>r.cells['ncr id']),['NCR-1','NCR-2','NCR-3','NCR-4']);
  assert.deepEqual(rows.map(r=>r.receipt.locator),['page:1:line:2','page:1:line:3','page:2:line:1','page:2:line:2']);
  assert.equal(JSON.stringify(fixture.state.evidenceDocuments),before,'original PDF and page readings unchanged');
 }finally{rmSync(fixture.dir,{recursive:true,force:true});}
});
test('T02 an unread or unrelated page never reuses an unrelated header as a current register',()=>{
 const fixture=source([
  {pageNumber:1,method:'native',text:'NCR ID | NCR Status | Description\nNCR-1 | open | first'},
  {pageNumber:3,method:'native',text:'NCR-2 | closed | gap in source pages'},
 ]);
 try{
  const tables=deliverySourceTables(fixture.state,[]);
  assert.deepEqual(tables.flatMap(t=>t.rows).map(r=>r.cells['ncr id']),['NCR-1']);
 }finally{rmSync(fixture.dir,{recursive:true,force:true});}
});
