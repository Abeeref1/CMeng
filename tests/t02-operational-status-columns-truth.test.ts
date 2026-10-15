import test from 'node:test';
import assert from 'node:assert/strict';
import {operationalSourceStatus} from '../packages/runtime-api/src/operational-reporting';
import type {SourceRow} from '../packages/truth-kernel/src';

const row=(cells:Record<string,string>):SourceRow=>({cells,receipt:{
  documentId:'ORIGINAL-REGISTER',sourceHash:'SOURCE-SHA',revision:'REV-1',
  locator:'sheet:Quality:row:345',basisState:'candidate',authority:'source_record',
}});
test('T02 original NCR-specific status from a readable source is not dropped when generic status column absent',()=>{
 const input=row({'ncr id':'NCR-345','ncr status':'closed','severity':'major'});
 const original=JSON.stringify(input);
 const result=operationalSourceStatus(input,'ncr');
 assert.equal(result.value,'closed');
 assert.equal(result.conflicted,false);
 assert.equal(result.observed.length,1);
 assert.equal(JSON.stringify(input),original,'unchanged source fields and receipt');
});
test('T02 NCR/RFI/risk status aliases recognized separately without fabricating a general status',()=>{
 assert.equal(operationalSourceStatus(row({'rfi status':'answered'}),'rfi').value,'answered');
 assert.equal(operationalSourceStatus(row({'response status':'open'}),'rfi').value,'open');
 assert.equal(operationalSourceStatus(row({'risk status':'mitigating'}),'risk').value,'mitigating');
 assert.equal(operationalSourceStatus(row({'current status':'closed'}),'ncr').value,'closed');
 assert.equal(operationalSourceStatus(row({'status':'open'}),'risk').value,'open');
 assert.equal(operationalSourceStatus(row({'ncr status':'closed'}),'rfi').value,'','NCR is not an RFI column');
});
test('T02 opposing generic and register-specific source status must be a conflict, not silently accepted',()=>{
 const input=row({'ncr status':'closed','status':'open'});
 const result=operationalSourceStatus(input,'ncr');
 assert.equal(result.conflicted,true);
 assert.equal(result.value,'','conflicting source cannot assert zero open NCRs');
 assert.equal(result.observed.length,2);
 assert.deepEqual(result.observed.map(x=>x.raw),['closed','open']);
});
test('T02 repeated consistent assertions do not invent a conflict or duplicate a record',()=>{
 const input=row({'ncr status':'CLOSED','status':'closed'});
 const result=operationalSourceStatus(input,'ncr');
 assert.equal(result.conflicted,false);
 assert.equal(result.value,'CLOSED');
 assert.equal(result.observed.length,2);
});
test('T02 missing or empty business status remains unknown, never interpreted as closed',()=>{
 const result=operationalSourceStatus(row({'ncr status':' ','status':''}),'ncr');
 assert.equal(result.value,'');
 assert.equal(result.conflicted,false);
 assert.equal(result.observed.length,0);
});
