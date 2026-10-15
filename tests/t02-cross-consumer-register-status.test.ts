import test from 'node:test';
import assert from 'node:assert/strict';
import {registerBusinessStatusFields} from '../packages/truth-kernel/src';
import {sourceReadinessStatus} from '../packages/runtime-api/src/evidence-readiness';
import {operationalSourceStatus} from '../packages/runtime-api/src/operational-reporting';
import type {SourceRow} from '../packages/truth-kernel/src';

const src=(cells:Record<string,string>):SourceRow=>({cells,receipt:{
 documentId:'ORIGINAL',sourceHash:'ORIGINAL-HASH',revision:'R-2',locator:'row:1001',basisState:'candidate',authority:'source_record'
}});
test('T02 every reader uses the same business status field registry for NCR and RFI',()=>{
 const cases=[
  {type:'quality_ncr_register',kind:'ncr' as const,field:'ncr status',value:'closed'},
  {type:'rfi_register',kind:'rfi' as const,field:'response status',value:'answered'},
  {type:'risk_register',kind:'risk' as const,field:'risk status',value:'open'},
 ];
 for(const row of cases){
  assert.ok(registerBusinessStatusFields(row.type).includes(row.field));
  const operational=operationalSourceStatus(src({[row.field]:row.value}),row.kind);
  const readiness=sourceReadinessStatus([row.field,'activity id'],[row.value,'TASK-12'],row.type);
  assert.equal(operational.value,row.value);
  assert.equal(readiness.value,row.value);
  assert.equal(readiness.conflicted,false);
 }
});
test('T02 two contradictory source status columns produce uncertainty in both reader paths',()=>{
 const cells={'ncr status':'closed',status:'open'};
 const a=operationalSourceStatus(src(cells),'ncr');
 const b=sourceReadinessStatus(['ncr status','status'],['closed','open'],'quality_ncr_register');
 assert.equal(a.value,'');assert.equal(a.conflicted,true);
 assert.equal(b.value,'');assert.equal(b.conflicted,true);
 assert.equal(b.observed.length,2);
});
test('T02 procurement/delivery and submittal-specific fields are consumed without generic status',()=>{
 const procurement=sourceReadinessStatus(['delivery status','package id'],['delivered','PK-7'],'procurement_register');
 const submittal=sourceReadinessStatus(['submittal status','submittal id'],['approved','SD-8'],'submittal_register');
 assert.equal(procurement.value,'delivered');
 assert.equal(submittal.value,'approved');
});
test('T02 clean absence is not substituted with zero or a false closed claim',()=>{
 const result=sourceReadinessStatus(['ncr status','activity id'],[' ','W-3'],'quality_ncr_register');
 assert.equal(result.value,'');assert.equal(result.conflicted,false);
});
