import test from 'node:test';import assert from 'node:assert/strict';
import {positionVerdict} from '../packages/runtime-api/src/position-review';
const result=(key:string,data:unknown)=>({key,data,status:'partial' as const,reason:null,dependencies:[]});
test('verdicts change with available quantities, cash evidence and schedule scope',()=>{
 assert.match(positionVerdict(result('quantity-scurve',{series:[],unmappedItemIds:[]})).text,/not available/);
 assert.match(positionVerdict(result('quantity-scurve',{series:[{points:[{actualInstalledQuantity:0}]}]})).text,/Installed quantity evidence is available/);
 assert.match(positionVerdict(result('cash-flow',{position:{performance:{cashFlow:{currencies:[{sourceReadiness:{netCashReady:true}}]}}}})).text,/Actual cash is supported/);
 const d=positionVerdict(result('master-dashboard',{metrics:[{key:'submitted-programme-finish',value:'2031-04-20'},{key:'contract-finish',value:'2031-04-15'}],sourceInterpretation:{progressMeasures:{scopeComparison:{gapPercentagePoints:-.54}}}}));
 assert.equal(d.rag,'red');assert.match(d.text,/5 calendar days/);assert.match(d.text,/0.54 percentage points behind/);
});
