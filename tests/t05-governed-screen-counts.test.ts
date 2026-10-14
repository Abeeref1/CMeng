import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {createSourceFile,isFunctionDeclaration,ScriptTarget} from 'typescript';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// Work from the actual assembled browser script, not a separately recreated
// display helper or a fabricated API producer.
const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'real CMeng browser script exists');
const source=createSourceFile('cmeng-screen.js',script,ScriptTarget.Latest,true);
function originalFunction(name:string):string {
 const result=source.statements.find(node=>isFunctionDeclaration(node)&&node.name?.text===name);
 assert.ok(result,'missing production browser function '+name);
 return result.getText(source);
}

test('T05 missing governed counts stay Not established and a genuine established zero stays zero',()=>{
 const fn=runInNewContext(originalFunction('governedDisplayCount')+';governedDisplayCount') as (confirmed:boolean,value:unknown)=>unknown;
 assert.equal(fn(true,0),0,'known empty population is an actual zero');
 assert.equal(fn(true,23),23);
 for(const input of [null,undefined,NaN,Infinity,-Infinity,'']){
  assert.equal(fn(true,input),'Not established','missing or invalid register figure must not become zero');
 }
 assert.equal(fn(false,0),'Not established','known subset cannot be published as total without population authority');
 assert.equal(fn(false,23),'Not established');
});

test('T05 an unassessed management consistency population cannot read as 0 completed checks',()=>{
 const render=runInNewContext(originalFunction('renderManagementConsistency')+';renderManagementConsistency',{
  escapeHtml:(value:unknown)=>String(value),humanizeKey:String,
 }) as (x:any)=>string;
 assert.match(render({state:'pending',checkCount:null,failedCheckIds:[],scope:'Pending source check'}),
  /Not established checks/);
 assert.doesNotMatch(render({state:'pending',checkCount:null,failedCheckIds:[],scope:'Pending'}),
  /\b0 checks\b/);
 assert.match(render({state:'pass',checkCount:0,failedCheckIds:[],scope:'Empty but established'}),
  /0 checks/,'literal zero survives when actually supplied');
 assert.match(render({state:'failed',checkCount:11,failedCheckIds:['MISMATCH'],scope:'Checked'}),
  /11 checks/);
});

test('T05 all affected screen sites use the audited source-preserving count rule',()=>{
 assert.match(script,/\["Variations by Data Date",governedDisplayCount\(variationPopulationEstablished,vo\.recordCount\)/);
 assert.match(script,/\["Approved by Data Date",governedDisplayCount\(variationPopulationEstablished,vo\.approvedCount\)/);
 assert.match(script,/\["Rejected",governedDisplayCount\(variationPopulationEstablished,vo\.rejectedCount\)/);
 assert.match(script,/\["Certificate periods by Data Date",governedDisplayCount\(paymentPopulationEstablished,paymentRegister\.asOfRecordCount\)/);
 assert.match(script,/\["Future \/ undated records",fmt\(vo\.futureRecordCount\?\?"Not established"\)/);
});

test('T05/N2/N3 unknown schedule variance and float coverage cannot display fabricated zeros or a percent unit',()=>{
 const band=runInNewContext(originalFunction('planningStatusBand')+';planningStatusBand',{
  escapeHtml:(v:unknown)=>String(v),fmt:(v:unknown)=>String(v),
 }) as (rows:any[][])=>string;
 assert.match(band([['Late',null,'danger'],['On time',null,'success']]),/not confirmed/i,
  'unestablished variance is not a proven empty distribution');
 assert.doesNotMatch(band([['Late',null,'danger'],['On time',null,'success']]),/0/);
 assert.match(band([['Late',0,'danger'],['On time',0,'success']]),/established population is zero/i,
  'genuine established zero remains distinguished from missing evidence');
 assert.match(script,/variance\.lateActivities\?\?null/);
 assert.match(script,/variance\.onTimeActivities\?\?null/);
 assert.match(script,/variance\.earlyActivities\?\?null/);
 assert.match(script,/variance\.unknownActivities\?\?null/);
 assert.doesNotMatch(script,/variance\.(?:lateActivities|onTimeActivities|earlyActivities|unknownActivities)\|\|0/);
 assert.match(script,/variance\.denominator\?\?null/,'unverified baseline comparison cannot borrow total execution denominator');
 assert.doesNotMatch(script,/fmt\(r\.float\.coveragePercent\)\)\+'% of remaining/);
});
