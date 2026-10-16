import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEotAssessmentProjection} from '../packages/eot-assessment/src';
import type {ContractTimeBasis} from '../packages/eot-assessment/src';

const windows:any={windows:[],positiveProgrammeMovementDays:null,projectCompletionMovementDays:null,projectCompletionMovementBasis:'unavailable',diagnostics:[]};
const delay:any={projectId:'FROZEN-INDEPENDENT-EOT',events:[],diagnostics:[]};
const input={generatedAt:'2028-03-01',producerVersion:'frozen-reference'};
const basis=(patch:Partial<ContractTimeBasis>={}):ContractTimeBasis=>({
 contractualCompletionIso:'2028-02-28',contractualCompletionState:'official',
 officialApprovedEotDays:2,officialApprovedEotState:'official',
 eotDayBasis:'calendar_days',eotDayBasisState:'official',sourceRefs:['original-contract:page:17'],...patch
});
const calculated=(patch:Partial<ContractTimeBasis>={})=>buildEotAssessmentProjection(windows,delay,basis(patch),input);

test('T12 frozen civil-day EOT references retain leap years and source-day timezone',()=>{
 for(const [from,days,expected] of [
  ['2028-02-28',1,'2028-02-29'],['2028-02-28',2,'2028-03-01'],
  ['2027-02-28',1,'2027-03-01'],['2028-12-31',84,'2029-03-25'],
  ['2028-02-28T23:30:00-05:00',2,'2028-03-01'],
 ] as const){
  const source=basis({contractualCompletionIso:from,officialApprovedEotDays:days});
  const copy=structuredClone(source);
  const result=buildEotAssessmentProjection(windows,delay,source,input);
  assert.equal(result.officialAdjustedCompletionIso,expected,from+' + '+days+' calendar days');
  assert.deepEqual(source,copy,'original contractual authority must remain untouched');
 }
});

test('T12 incorporated approved EOT is not counted twice when only incremental award applies',()=>{
 const actual=calculated({contractualCompletionIso:'2028-02-28',incorporatedEotDays:30,
  additionalApprovedEotDays:2,officialApprovedEotDays:32,overlapResolution:'resolved'});
 assert.equal(actual.timeBasisReconciliation?.additionalApprovedEotDays,2);
 assert.equal(actual.officialAdjustedCompletionIso,'2028-03-01');
 assert.equal(actual.officialApprovedEotDays,32,'original registered total stays as source evidence');
});

test('T12 unknown or invalid official EOT source leaves final completion unestablished without crashing',()=>{
 for(const amount of [NaN,Infinity,-Infinity,1e300]){
  const source=basis({officialApprovedEotDays:amount});
  const result=buildEotAssessmentProjection(windows,delay,source,input);
  assert.equal(result.officialAdjustedCompletionIso,null);
  assert.equal(result.scenarioAdjustedCompletionIso,null);
  assert.equal(source.officialApprovedEotDays,amount,'retain invalid reported number for source review');
  if(!Number.isFinite(amount))assert.ok(result.diagnostics.includes('EOT_AWARD_DAYS_NOT_FINITE_ADJUSTED_COMPLETION_WITHHELD'));
 }
 for(const malformed of ['2028-02-30','2027-02-29','2028-13-01','not a date']){
  const result=calculated({contractualCompletionIso:malformed});
  assert.equal(result.officialAdjustedCompletionIso,null,malformed);
  assert.equal(result.scenarioAdjustedCompletionIso,null,malformed);
 }
});
