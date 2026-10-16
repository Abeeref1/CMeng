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

test('T08 a real-looking date prefix with malformed time or suffix cannot establish source delivery or overdue',()=>{
 const bad=['2032-02-29Tgarbage','2032-02-29T25:00:00Z',
  '2032-02-29T10:99:00Z','2032-02-29T08:00:00+15:00',
  '2032-02-29 extra text','2032-02-29garbage'];
 for(const malformed of bad){
  const input={...base,programmeNeedDate:null,sourceRequiredOnSite:malformed};
  const before=JSON.stringify(input);
  const position=procurementTiming(input);
  assert.equal(position.sourceRequiredOnSite,null,malformed);
  assert.equal(position.needDate,null,'a malformed need date cannot be established by a valid prefix');
  assert.equal(position.overdueUndelivered,false);
  assert.equal(position.headroomCalendarDays,null);
  assert.equal(JSON.stringify(input),before,'original raw source must remain unchanged');
 }
});
test('T08 malformed reporting timestamp cannot falsely prove current delivery or overdue',()=>{
 for(const malformed of ['2032-03-10Tgarbage','2032-03-10T24:00:00Z']){
  const result=procurementTiming({...base,dataDateIso:malformed,
   actualDelivery:'2032-03-01',status:'delivered'});
  assert.equal(result.deliveredAtDataDate,false,'invalid Data Date has no current-period authority');
  assert.equal(result.overdueUndelivered,false,'invalid Data Date cannot establish overdue days');
 }
});
test('T08 valid ISO timestamps retain physical delivery and true overdue calendar positions',()=>{
 const input={...base,dataDateIso:'2032-03-10T17:45:00+04:00',
  sourceRequiredOnSite:'2032-02-29T07:30:00Z',
  forecastDelivery:'2032-03-05T08:00:00Z',actualDelivery:'2032-03-01T09:00:00Z',
  status:'delivered'};
 const before=JSON.stringify(input),result=procurementTiming(input);
 assert.equal(result.needDate,'2032-02-29');
 assert.equal(result.deliveredAtDataDate,true);
 assert.equal(result.overdueUndelivered,false);
 assert.equal(result.headroomCalendarDays,-5);
 assert.equal(JSON.stringify(input),before);
});

test('T08 timezone offsets beyond ±14 hours are not accepted as source calendar dates',()=>{
 for(const bad of ['2032-02-29T10:00:00+14:01','2032-02-29T09:59:00-14:59','2032-02-29T01:00:00+14:30']){
  const input={...base,programmeNeedDate:null,sourceRequiredOnSite:bad};
  const before=JSON.stringify(input),position=procurementTiming(input);
  assert.equal(position.needDate,null,'out-of-range offset cannot certify a source date');
  assert.equal(position.overdueUndelivered,false);
  assert.equal(JSON.stringify(input),before);
 }
 for(const good of ['2032-02-29T07:00:00+14:00','2032-02-29T11:00:00-14:00','2032-02-29T00:00:00+13:59']){
  const position=procurementTiming({...base,programmeNeedDate:null,sourceRequiredOnSite:good});
  assert.equal(position.needDate,'2032-02-29','valid offsets retain the source local date');
 }
});

test('T08 nullable, disputed or unverified statuses cannot prove that goods are overdue-undelivered',()=>{
 for(const status of [null,undefined,'','unknown','Not established','Unverified','disputed','N/A','tbc']){
  const input={...base,status:status as unknown as string};
  const before=JSON.stringify(input),position=procurementTiming(input);
  assert.equal(position.deliveredAtDataDate,false);
  assert.equal(position.overdueUndelivered,false,'source status does not establish non-delivery');
  assert.equal(position.needDate,'2032-02-29');
  assert.equal(JSON.stringify(input),before,'source input remains unaltered');
 }
 for(const status of ['open','Pending','in progress']){
  assert.equal(procurementTiming({...base,status}).overdueUndelivered,true,
   'explicit open status retains its true overdue position');
 }
 assert.equal(procurementTiming({...base,status:'unknown',actualDelivery:'2032-03-20'}).overdueUndelivered,true,
  'an explicit future physical delivery date still establishes not delivered by Data Date');
});
