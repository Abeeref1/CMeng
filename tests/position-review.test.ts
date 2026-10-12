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

test('a specific headline retains its own next step despite an unrelated first issue',()=>{
 const r:any=result('notices-claims',{noticeEventDateMissingCount:2});
 r.issueAssessment={counts:{missing_information:1},issues:[{kind:'missing_information',summary:'Bond expiry needed',action:'Provide bond dates',owner:'Project evidence owner'}]};
 const v=positionVerdict(r);assert.match(v.text,/event dates/);assert.match(v.nextAction,/event or awareness date/);assert.doesNotMatch(v.nextAction,/bond/);assert.equal(v.owner,'Contracts Manager');assert.equal(v.owner,v.assignTo);assert.notEqual(v.owner,r.issueAssessment.issues[0].owner,'unrelated issue owner must not replace the domain role');
 const late=positionVerdict(result('master-dashboard',{metrics:[{key:'submitted-programme-finish',value:'2031-06-07'},{key:'contract-finish',value:'2031-04-15'}]}));
 assert.match(late.text,/53 calendar days late/);assert.equal(late.assignTo,'Project Director');assert.match(late.nextAction,/packages.*not yet been established/);assert.doesNotMatch(late.owner,/assign a person/);
});

test('matching progress does not request recovery for a difference that is absent',()=>{
 const v=positionVerdict(result('progress-report',{scopeComparison:{gapPercentagePoints:0}}));
 assert.match(v.text,/matches baseline plan/);assert.match(v.nextAction,/Monitor schedule progress/);assert.doesNotMatch(v.nextAction,/difference|recovery/);
});


test('Master Dashboard lets a publishable CMeng forecast lead over an ahead submitted date',()=>{
 const verdict=positionVerdict(result('master-dashboard',{metrics:[
  {key:'contract-finish',value:'2043-08-20'},
  {key:'submitted-programme-finish',value:'2043-04-17'},
  {key:'independent-forecast-finish',value:'2043-09-11'},
 ]}));
 assert.equal(verdict.rag,'red');
 assert.match(verdict.text,/CMeng programme calendar recalculation is 22 calendar days late/);
 assert.doesNotMatch(verdict.text,/125 days ahead|within the contract date/);
});

test('an ahead submitted date cannot create a green management verdict while the CMeng forecast is withheld',()=>{
 const verdict=positionVerdict(result('master-dashboard',{metrics:[
  {key:'contract-finish',value:'2043-08-20'},
  {key:'submitted-programme-finish',value:'2043-04-17'},
  {key:'independent-forecast-finish',value:null},
 ]}));
 assert.equal(verdict.rag,'amber');
 assert.match(verdict.text,/submitted position, not a confirmed management forecast/i);
});
