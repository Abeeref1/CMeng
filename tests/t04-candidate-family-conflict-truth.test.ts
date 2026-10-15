import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {sourceTables,governedTables} from '../packages/truth-kernel/src';

function file(dir:string,id:string,amount:number,family:string,state:'candidate'|'active'|'additive'|'superseded'='candidate'){
 const bytes=Buffer.from('invoice id,amount,currency,status\n'+id+','+amount+',SAR,open\n');
 const storedPath=join(dir,id+'.csv');writeFileSync(storedPath,bytes);
 return {documentId:id,sourceHashSha256:createHash('sha256').update(bytes).digest('hex'),
  storedPath,sourceFilename:id+'.csv',mediaType:'text/csv',basisState:state,
  linkedArtifactId:null,uploadedAt:'2031-04-01',familyKey:family,documentType:'payment_register'} as any;
}
test('T04 two conflicting candidate revisions of one source family are never silently combined as current numbers',()=>{
 const dir=mkdtempSync(join(tmpdir(),'t04-source-family-'));
 try{
  const first=file(dir,'first',3500,'payment-register'),second=file(dir,'second',7200,'payment-register');
  const before=JSON.stringify([first,second]),diagnostics:string[]=[];
  const full=sourceTables([first,second],[],{includeHistorical:true});
  assert.equal(full.length,2,'both original retained source files readable and provenance intact');
  const selected=governedTables([first,second],diagnostics);
  assert.equal(selected.length,0,'unselected conflicting family candidates must not be added, replaced or merged');
  assert.ok(diagnostics.some(d=>d.startsWith('CANDIDATE_FAMILY_CONFLICT_REVIEW_REQUIRED:payment-register')));
  assert.equal(JSON.stringify([first,second]),before,'source bytes, dates and authority unchanged');
  const active={...first,basisState:'active'};
  const governed=governedTables([active,second],[]);
  assert.equal(governed.length,1,'confirmed active basis beats competing candidate');
  assert.equal(governed[0]?.document.documentId,'first');
  assert.equal(governed[0]?.rows[0]?.receipt.basisState,'active');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('T04 singleton clean candidate is usable in labelled SOURCE analytics without promoting formal authority',()=>{
 const dir=mkdtempSync(join(tmpdir(),'t04-source-single-'));
 try{
  const sole=file(dir,'sole',2200,'payment-register'),unrelated=file(dir,'other',8400,'independent-supply');
  const selected=governedTables([sole,unrelated],[]);
  assert.equal(selected.length,2,'unambiguous different source families can each be analysed');
  assert.equal(selected[0]?.rows[0]?.receipt.basisState,'candidate','no adopted authority inferred');
  assert.equal(selected[0]?.rows[0]?.receipt.authority,'source_record','per-row source reference retained');
  const twoFilesSameSource=file(dir,'second',7700,'payment-register');
  const conflict=governedTables([sole,twoFilesSameSource,unrelated],[]);
  assert.deepEqual(conflict.map(x=>x.document.documentId),['other'],'conflicting family remains unresolved; unrelated valid source remains visible');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('T04 sheet count is never confused with multiple competing documents',()=>{
 const dir=mkdtempSync(join(tmpdir(),'t04-multisheet-'));
 try{
  const a=file(dir,'single',15,'family-only');
  // An additional table from the SAME source document does not make another revision.
  const duplicate={...a,documentId:'single',tabularRead:undefined};
  assert.equal(governedTables([a,duplicate],[]).length,1,'same content-hash and document identity do not invent another candidate revision');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
