import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// Execute the exact assembled production payment-panel expression, not a
// duplicate of the business conditions or a reduced alternate renderer.
const browser=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(browser,'the original assembled browser must be available');
const beginning=browser.indexOf('const lifecycleVisual=renderVisualPanel(');
const ending=browser.indexOf('const slaCountValues=',beginning);
assert.ok(beginning>=0&&ending>beginning,'the complete original IPC visual expression remains present');
const realPanelExpression=browser.slice(beginning,ending);

function render(input:{source:boolean;population:boolean;stages:boolean;count:number|null}):string {
 const value=runInNewContext(realPanelExpression+';lifecycleVisual',{
  paymentSourceEstablished:input.source,
  paymentPopulationEstablished:input.population,
  paymentLifecycleEstablished:input.stages,
  paymentRegister:{recordCount:input.count},
  lifecycleCounts:{applied:0,assessed:0,certified:0,paid:0},
  renderVisualPanel:(_title:string,_basis:string,body:string)=>body,
  renderVisualBars:(rows:unknown,unit:string)=>JSON.stringify({rows,unit}),
 });
 return String(value);
}

test('T07 absent payment register is unknown and never an all-zero lifecycle',()=>{
 const html=render({source:false,population:false,stages:false,count:null});
 assert.match(html,/Payment register is not confirmed\. Lifecycle counts are not confirmed/);
 assert.doesNotMatch(html,/There are zero confirmed current payments/);
 assert.doesNotMatch(html,/\\"applied\\":0/);
});

test('T07 source exists but incomplete stages cannot be described as missing source or paid zero',()=>{
 const html=render({source:true,population:true,stages:false,count:8});
 assert.match(html,/Payment source records are retained/);
 assert.match(html,/current lifecycle stages are not fully established/);
 assert.doesNotMatch(html,/Payment register is not confirmed|zero confirmed current payments/);
});

test('T07 an evidenced empty as-of population is a genuine zero',()=>{
 const html=render({source:true,population:true,stages:false,count:0});
 assert.match(html,/zero confirmed current payments/);
 assert.doesNotMatch(html,/not confirmed/);
});

test('T07 fully established lifecycle preserves every original bar and its genuine zero counts',()=>{
 const html=render({source:true,population:true,stages:true,count:3});
 const chart=JSON.parse(html);
 assert.equal(chart.unit,'records');
 assert.deepEqual(Array.from(chart.rows,(r:any)=>[r.label,r.value]),[
  ['Applied',0],['Assessed',0],['Certified',0],['Paid',0]
 ]);
});
