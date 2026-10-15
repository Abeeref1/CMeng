import test from 'node:test';
import assert from 'node:assert/strict';
import {assetFlagCompletionAsOf,programmeCompletionAsOf} from '../packages/runtime-api/src/handover-source-review';

test('T08 original asset flags are retained but future, undated and unclear statuses cannot certify an as-of percentage',()=>{
 const source=[
  {value:true,statusDate:'2032-02-29'},
  {value:true,statusDate:'2032-03-15'},
  {value:false,statusDate:'2032-02-20'},
  {value:true,statusDate:null},
  {value:null,statusDate:'2032-02-01'},
 ];
 const original=JSON.stringify(source);
 const result=assetFlagCompletionAsOf(source,'2032-03-01');
 assert.equal(source.filter(row=>row.value===true).length,3,'three original positive flags remain in the source');
 assert.equal(result.confirmedYes,1,'only dated known positive flags before Data Date are established');
 assert.equal(result.knownCount,2);
 assert.equal(result.unknownCount,3);
 assert.equal(result.percentage,null,'three uncertain as-of positions cannot create a current handover percentage');
 assert.equal(JSON.stringify(source),original,'never rewrite the source flags or status dates');
});

test('T08 complete dated source population reports genuine zero and exact positive fractions',()=>{
 const source=[{value:true,statusDate:'2032-02-29'},{value:false,statusDate:'2032-02-25'}];
 const result=assetFlagCompletionAsOf(source,'2032-03-01');
 assert.deepEqual(result,{confirmedYes:1,knownCount:2,unknownCount:0,percentage:50});
 const zero=assetFlagCompletionAsOf([{value:false,statusDate:'2032-03-01'}],'2032-03-01');
 assert.deepEqual(zero,{confirmedYes:0,knownCount:1,unknownCount:0,percentage:0});
});

test('T08 invalid and absent reporting calendar dates never establish as-of asset or programme completion',()=>{
 const asset=[{value:true,statusDate:'2032-02-29'}];
 for(const cutoff of ['2032-02-30',null,'2032-03-01Tbad']){
  const result=assetFlagCompletionAsOf(asset,cutoff);
  assert.deepEqual(result,{confirmedYes:null,knownCount:null,unknownCount:1,percentage:null});
  const programme=programmeCompletionAsOf([{status:'completed',actualFinishIso:'2032-02-29'}],cutoff);
  assert.equal(programme.sourceCompletedCount,1);
  assert.equal(programme.knownAsOfCount,null);
  assert.equal(programme.percentage,null);
 }
});

test('T08 invalid source-status timestamps are unknown rather than dated acceptance',()=>{
 const source=[{value:true,statusDate:'2032-02-29Tbad'},{value:false,statusDate:'2032-02-28'}];
 const result=assetFlagCompletionAsOf(source,'2032-03-01');
 assert.equal(result.knownCount,1);
 assert.equal(result.confirmedYes,0);
 assert.equal(result.unknownCount,1);
 assert.equal(result.percentage,null);
});
