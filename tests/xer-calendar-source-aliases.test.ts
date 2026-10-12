import test from 'node:test';
import assert from 'node:assert/strict';
import {parseXerBytes} from '../packages/xer-parser/src';
import {verifyXerCalendars} from '../packages/xer-parser/src/calendar-integrity';

function calendar(columns:string[],values:string[]){
 const input=['ERMHDR\t23.12','%T\tCALENDAR','%F\tclndr_id\tclndr_name\t'+columns.join('\t'),'%R\t1\t6D-10H\t'+values.join('\t'),'%E'].join('\n');
 return verifyXerCalendars(parseXerBytes(Buffer.from(input))).calendars[0]!;
}
test('explicit calendar hour aliases are retained without inventing working intervals',()=>{
 for(const hours of [10,24]){
  const result=calendar(['hours_per_day','hours_per_week'],[String(hours),String(hours*6)]);
  assert.equal(result.conversionDayHours,hours);
  assert.equal(result.conversionWeekHours,hours*6);
  assert.equal(result.data,null);
  assert.equal(result.status,'unresolved');
 }
});
test('conflicting or invalid calendar conversion declarations remain unresolved',()=>{
 const conflict=calendar(['day_hr_cnt','hours_per_day'],['8','10']);
 assert.equal(conflict.conversionDayHours,null);
 assert.ok(conflict.conversionDiagnostics.some(value=>value.startsWith('CALENDAR_CONVERSION_CONFLICT:')));
 const invalid=calendar(['hours_per_day'],['unknown']);
 assert.equal(invalid.conversionDayHours,null);
 assert.ok(invalid.conversionDiagnostics.some(value=>value.startsWith('CALENDAR_CONVERSION_INVALID:')));
});
test('matching aliases preserve native declarations and names alone supply no hours',()=>{
 assert.equal(calendar(['day_hr_cnt','hours_per_day'],['10','10']).conversionDayHours,10);
 assert.equal(calendar(['day_hr_cnt'],['']).conversionDayHours,null);
});
