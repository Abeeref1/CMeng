import test from 'node:test';import assert from 'node:assert/strict';
import {positionVerdict} from '../packages/runtime-api/src/position-review';
const result=(key:string,data:unknown)=>({key,data,status:'partial' as const,reason:null,dependencies:[]});
test('verdicts change with available quantities, cash evidence and schedule scope',()=>{
 assert.match(positionVerdict(result('quantity-scurve',{series:[],unmappedItemIds:[]})).text,/not available/);
 assert.match(positionVerdict(result('quantity-scurve',{series:[{points:[{actualInstalledQuantity:0}]}]})).text,/Installed quantities are available/);
 assert.match(positionVerdict(result('cash-flow',{position:{performance:{cashFlow:{currencies:[{sourceReadiness:{netCashReady:true}}]}}}})).text,/Actual cash is supported/);
 const d=positionVerdict(result('master-dashboard',{metrics:[{key:'submitted-programme-finish',value:'2031-04-20'},{key:'contract-finish',value:'2031-04-15'}],sourceInterpretation:{progressMeasures:{scopeComparison:{gapPercentagePoints:-.54}}}}));
 assert.equal(d.rag,'red');assert.match(d.text,/5 calendar days/);assert.match(d.text,/0.54 percentage points behind/);
});


test('claim verdicts use assessed events, not correspondence or unrelated progress',()=>{
 for(const eventCount of [3,7]){
  const d={position:{claimsNotices:{noticeTimelinessCounts:{event_date_missing:eventCount}}},claimsReporting:{notices:{asOf:Array.from({length:eventCount+2},(_,i)=>({kind:i<eventCount?'claim_notice':'determination',eventStartIso:null}))}},sourceInterpretation:{progressMeasures:{scopeComparison:{gapPercentagePoints:-2}}}};
  const verdict=positionVerdict(result('commercial-claims-notices',d));
  assert.equal(verdict.facts.noticeEventDateMissingCount,eventCount);
  assert.match(verdict.text,new RegExp('^'+eventCount+' events lack'));
  assert.doesNotMatch(verdict.text,/schedule progress/);
 }
 const absent=positionVerdict(result('commercial-claims-notices',{claimsReporting:{notices:{asOf:[{eventStartIso:null}]}}}));
 assert.equal(absent.facts.noticeEventDateMissingCount,undefined);
 assert.doesNotMatch(absent.text,/1 events/);
 assert.doesNotMatch(positionVerdict(result('cost-forecast',{sourceInterpretation:{progressMeasures:{scopeComparison:{gapPercentagePoints:-2}}}})).text,/schedule progress/);
});
