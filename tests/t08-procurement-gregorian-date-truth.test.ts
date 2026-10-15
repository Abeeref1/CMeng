import test from 'node:test';
import assert from 'node:assert/strict';
import {procurementTiming} from '../packages/truth-kernel/src';

const base={
 dataDateIso:'2032-03-10',programmeNeedDate:'2032-03-01',
 sourceRequiredOnSite:'2032-02-29',forecastDelivery:'2032-03-05',
 actualDelivery:null,status:'open',governingDate:null,
} as const;

test('T08 invalid calendar source need dates never become confirmed overdue dates',()=>{
 const values=['2032-02-30','2032-02-31','2031-02-29','2032-04-31'];
 for(const invalid of values){
  const input={...base,programmeNeedDate:null,sourceRequiredOnSite:invalid};
  const original=JSON.stringify(input);
  const result=procurementTiming(input);
  assert.equal(result.sourceRequiredOnSite,null,invalid+' must be unknown, not silently normalized');
  assert.equal(result.needDate,null,'no guessed need date');
  assert.equal(result.overdueUndelivered,false,'cannot prove overdue without a real need date');
  assert.equal(result.headroomCalendarDays,null,'unknown is not zero');
  assert.equal(JSON.stringify(input),original,'input remains unchanged');
 }
});
test('T08 valid leap-day need date and source status produce defensible overdue calendar days',()=>{
 const result=procurementTiming({...base});
 assert.equal(result.needDate,'2032-02-29');
 assert.equal(result.overdueUndelivered,true);
 assert.equal(result.headroomCalendarDays,-5);
 assert.equal(result.forecastLate,true);
 assert.equal(result.deliveredAtDataDate,false);
});
test('T08 impossible actual delivery date cannot prove a physical delivery',()=>{
 const result=procurementTiming({...base,actualDelivery:'2032-02-30',status:'open'});
 assert.equal(result.deliveredAtDataDate,false);
 assert.equal(result.overdueUndelivered,true,'valid missed need date and open status still show overdue');
});
test('T08 future actual delivery never clears a reporting-date overdue position',()=>{
 const result=procurementTiming({...base,actualDelivery:'2032-03-21',status:'delivered'});
 assert.equal(result.deliveredAtDataDate,false);
 assert.equal(result.deliveryDateConflict,true);
 assert.equal(result.overdueUndelivered,true);
});
test('T08 valid delivered date preserves completion without changing original source',()=>{
 const input={...base,actualDelivery:'2032-03-01',status:'delivered'};
 const original=JSON.stringify(input);
 const result=procurementTiming(input);
 assert.equal(result.deliveredAtDataDate,true);
 assert.equal(result.overdueUndelivered,false);
 assert.equal(JSON.stringify(input),original);
});
