import test from 'node:test';
import assert from 'node:assert/strict';

test('a selected procurement date never silently falls back to the other source date',async()=>{
 const {procurementTiming}=await import('../packages/truth-kernel/src/procurement-timing');
 const input={dataDateIso:'2031-08-31',programmeNeedDate:null,sourceRequiredOnSite:'2031-08-01',forecastDelivery:'2031-09-02',actualDelivery:null,status:'Ordered'};
 assert.equal(procurementTiming(input).overdueUndelivered,true);
 const selected=procurementTiming({...input,governingDate:'programme'});assert.equal(selected.needDate,null);assert.equal(selected.headroomCalendarDays,null);assert.equal(selected.overdueUndelivered,false);
});
