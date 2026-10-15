import test from 'node:test';
import assert from 'node:assert/strict';
import type {ActivityAnalyticsRow} from '../packages/activity-analytics/src/types';
import {diagnosisSourceCounts} from '../packages/runtime-api/src/project-diagnosis';
// Independently reproduce the original six full-population source predicates.
const original=(rows:readonly ActivityAnalyticsRow[],predicate:(row:ActivityAnalyticsRow)=>boolean|null)=>{
 let known=0,unresolved=0;
 for(const row of rows){const value=predicate(row);if(value===null)unresolved++;else if(value)known++;}
 return {knownCount:rows.length&&unresolved<rows.length?known:null,
   value:rows.length&&!unresolved?known:null,unresolvedCount:unresolved,population:rows.length};
};
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const active=(row:ActivityAnalyticsRow)=>['not_started','in_progress'].includes(row.status);
function reference(rows:readonly ActivityAnalyticsRow[],movement:(id:string)=>number|null){
 return {zeroFloat:original(rows,row=>finite(row.totalFloatHours)?row.totalFloatHours===0:null),
   missedStarts:original(rows,row=>row.missedPlannedStart),
   overdueFinishes:original(rows,row=>row.finishOverdue),
   baselineSlippage:original(rows,row=>row.finishVarianceDays===null?null:active(row)&&row.finishVarianceDays>0),
   previousUpdateSlippage:original(rows,row=>{const value=movement(row.activityId);return value===null?null:value>0;}),
   scheduleDelayed:original(rows,row=>row.scheduleDelayed)};
}
function input(shape:number,size:number){
 const rows=Array.from({length:size},(_,i)=>({
   activityId:'SOURCE-'+shape+'-'+i,status:i%9===0?'completed':i%3===0?'in_progress':'not_started',
   totalFloatHours:i%19===0?null:i%29===0?Number.NaN:i%7===0?0:i%11===0?-8:24,
   missedPlannedStart:i%17===0?null:i%5===0,finishOverdue:i%13===0?null:i%7===0,
   finishVarianceDays:i%23===0?null:i%31===0?0:(i%3)-1,scheduleDelayed:i%41===0?null:i%8===0,
 })) as unknown as ActivityAnalyticsRow[];
 const movement=(id:string):number|null=>{const i=Number(id.split('-').at(-1));
   return i%37===0?null:i%4===0?0:i%7===0?-2:i%11===0?3:0;};
 return {rows,movement};
}
test('T11 management diagnosis counts retain full source population, true zero, unknown, and project isolation',()=>{
 for(const [shape,size] of [[1,11003],[2,6101],[3,1],[4,0]] as const){
   const {rows,movement}=input(shape,size),snapshot=JSON.stringify(rows);
   const actual=diagnosisSourceCounts(rows,movement);
   assert.deepEqual(actual,reference(rows,movement),size+' rows vs independent original source predicates');
   assert.deepEqual(diagnosisSourceCounts(rows,movement),actual,'repeat matches original complete population');
   assert.equal(JSON.stringify(rows),snapshot,'source rows must not change');
   for(const [name,result] of Object.entries(actual)){
     assert.equal(result.population,size,name+' complete denominator');
     if(size>0&&result.unresolvedCount>0)assert.equal(result.value,null,name+' unresolved must not turn zero');
   }
 }
 const unknown=[{activityId:'UNKNOWN',status:'not_started',totalFloatHours:null,missedPlannedStart:null,finishOverdue:null,finishVarianceDays:null,scheduleDelayed:null}] as unknown as ActivityAnalyticsRow[];
 const trueZero=[{activityId:'ESTABLISHED',status:'not_started',totalFloatHours:0,missedPlannedStart:false,finishOverdue:false,finishVarianceDays:0,scheduleDelayed:false}] as unknown as ActivityAnalyticsRow[];
 for(const c of Object.values(diagnosisSourceCounts(unknown,()=>null))){
   assert.equal(c.value,null);assert.equal(c.knownCount,null);assert.equal(c.unresolvedCount,1);
 }
 const known=diagnosisSourceCounts(trueZero,()=>0);
 assert.equal(known.zeroFloat.value,1,'one original activity has an established 0-hour float');
 for(const [name,c] of Object.entries(known)){
   const expected=name==='zeroFloat'?1:0;
   assert.equal(c.value,expected,name+' count from original source');
   assert.equal(c.knownCount,expected,name+' established subset');
   assert.equal(c.unresolvedCount,0,name+' known, not missing');
 }
 for(const c of Object.values(diagnosisSourceCounts([],()=>0))){
   assert.equal(c.value,null,'no supplied population cannot establish a known zero');
   assert.equal(c.knownCount,null,'no supplied population cannot establish a known subset');
   assert.equal(c.population,0);
 }
});
