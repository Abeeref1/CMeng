import test from 'node:test';
import assert from 'node:assert/strict';
import {procurementTiming} from '../packages/truth-kernel/src/procurement-timing';

// F14: a delivered / received / completed status with no actual date is delivered
// with the date not stated. It is never counted late and never overdue.
const base={programmeNeedDate:null,sourceRequiredOnSite:'2031-08-10',forecastDelivery:'2031-09-01',actualDelivery:null};

test('F14 received and delivered-to-site statuses are delivery, never late or overdue',()=>{
 for(const status of ['Received','Delivered to Site','Delivered on site','Received on Site','Delivered','Completed']){
  const t=procurementTiming({...base,dataDateIso:'2031-08-31',status});
  assert.equal(t.deliveredStatusOnly,true,status+' is delivered with the date not stated');
  assert.equal(t.forecastLate,false,status+' is never counted late');
  assert.equal(t.overdueUndelivered,false,status+' is never overdue');
 }
 // A part delivery is not a delivery: it stays open and late against its need date.
 const partial=procurementTiming({...base,dataDateIso:'2031-08-31',status:'Partially Delivered'});
 assert.equal(partial.deliveredStatusOnly,false);
 assert.equal(partial.forecastLate,true);
});

test('F14 a delivered status with no actual date is not late when the Data Date is unknown',()=>{
 const t=procurementTiming({...base,dataDateIso:null,status:'Delivered'});
 assert.equal(t.deliveredStatusOnly,true);
 assert.equal(t.forecastLate,false,'the forecast date of a delivered package does not make it late');
 assert.equal(t.overdueUndelivered,false);
 // An open package with the same dates is still screened as late.
 assert.equal(procurementTiming({...base,dataDateIso:null,status:'Ordered'}).forecastLate,true);
});
