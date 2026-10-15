import test from 'node:test';
import assert from 'node:assert/strict';
import {managementDate,managementText,managementValue,managementValueState} from '../packages/runtime-api/src/management-values';

// Independent renderer oracle: authoritative state wins over an untrusted
// placeholder value. A known literal zero still has its ordinary meaning.
test('T05 source state cannot convert missing/disputed/not-applicable values into zero or good news',()=>{
 const cases:Array<[unknown,string,string]>=[
  [{state:'unknown',value:0},'not_established','Not established'],
  [{state:'missing',value:0},'not_established','Not established'],
  [{valueState:'missing_information',state:'ready',value:false},'not_established','Not established'],
  [{state:'unresolved',value:0},'not_established','Not established'],
  [{state:'not_read',value:0},'not_established','Not established'],
  [{state:'not_provided',value:0},'not_in_source','Not in source'],
  [{state:'not_applicable',value:0},'not_applicable','Not applicable'],
  [{state:'not_applicable_completed',value:0},'not_applicable','Not applicable'],
  [{state:'disputed',value:0},'records_disagree','Records disagree'],
  [{state:'quarantined',value:0},'withheld','Withheld'],
  [{state:'not_calculable',value:0},'not_calculable','Not calculable'],
  [{state:'value',value:0},'value','0'],
  [{state:'ready',value:0},'value','0'],
  [0,'value','0'],
 ];
 for(const [source,state,display] of cases){
  const untouched=JSON.stringify(source);
  assert.equal(managementValueState(source),state,JSON.stringify(source));
  assert.equal(managementValue(source),display,JSON.stringify(source));
  assert.equal(managementValue(source,'SAR'),display==='0'?'0 SAR':display,'unknown states must not acquire units');
  assert.equal(JSON.stringify(source),untouched,'source values and authority must be retained unmodified');
 }
});

test('T02/T05 invalid civil source dates cannot normalize to another date on screen',()=>{
 const cases:Array<[string,string]>=[
  ['2028-02-29','Feb 29, 2028'],
  ['2029-02-29','Not calculable'],
  ['2030-02-30','Not calculable'],
  ['2030-04-31','Not calculable'],
  ['2030-13-01','Not calculable'],
  ['2030-00-01','Not calculable'],
  ['2030-01-00','Not calculable'],
  ['2030-01-01','Jan 1, 2030'],
  ['2030-01-01T00:00:00.000Z','Jan 1, 2030'],
 ];
 for(const [source,wanted] of cases){
  assert.equal(managementDate(source),wanted,source);
 }
 assert.match(managementText('Cost report due=2030-02-30'),/Due: Not calculable/);
 assert.equal(managementValue({valueState:'not_established',value:0},'days'),'Not established');
});

test('T05 explicit known-value state never makes a blank or nonfinite source quantity factual',()=>{
 const cases:Array<[unknown,string,string]>=[
  [{state:'value'},'not_established','Not established'],
  [{state:'value',value:null},'not_established','Not established'],
  [{state:'value',value:''},'not_established','Not established'],
  [{valueState:'value',value:'   '},'not_established','Not established'],
  [{state:'value',value:Number.NaN},'not_calculable','Not calculable'],
  [{state:'value',value:Infinity},'not_calculable','Not calculable'],
  [{state:'value',value:-Infinity},'not_calculable','Not calculable'],
  ['   ','not_established','Not established'],
  [{state:'value',value:0},'value','0'],
  [{valueState:'value',value:-1.5},'value','-1.5'],
 ];
 for(const [item,state,display] of cases){
  assert.equal(managementValueState(item),state);
  assert.equal(managementValue(item),display);
  assert.equal(managementValue(item,'working days'),state==='value'?display+' working days':display,
    'unknowns may never acquire a day or cost unit');
 }
 const unread={state:'value',value:Number.NaN};
 assert.ok(Number.isNaN(unread.value),'original source value remains intact');
 assert.equal(managementValue(unread,'SAR'),'Not calculable');
});
