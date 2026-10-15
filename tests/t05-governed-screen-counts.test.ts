import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {createSourceFile,isFunctionDeclaration,ScriptTarget} from 'typescript';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {buildScheduleChangeReportFromHistory} from '../packages/schedule-change-report/src';

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

test('T05 commercial count authority requires a real numeric population and never status-only zero',()=>{
 assert.match(script,/const knownCount=value=>typeof value==="number"&&Number\.isFinite\(value\)&&value>=0/);
 assert.match(script,/if\(!knownCount\(count\)\)return "Not established"/,
  'commercial summary cannot convert an established status with missing count into zero');
 assert.match(script,/const variationPopulationEstablished=knownCount\(vo\.recordCount\)/);
 assert.match(script,/const variationLifecycleEstablished=variationPopulationEstablished&&variationLifecycleCounts\.every\(knownCount\)/);
 assert.doesNotMatch(script,/variationPopulationEstablished=\(vo\.recordCount\?\?0\)>0\|\|vo\.state==="established"/);
 assert.match(script,/const siteInstructionPopulationEstablished=knownCount\(si\.recordCount\)/);
 assert.match(script,/governedDisplayCount\(siteInstructionPopulationEstablished,si\.unquotedCount\)/);
 assert.doesNotMatch(script,/siteInstructionPopulationEstablished\?\(si\.unquotedCount\?\?0\)/);
 assert.match(script,/escapeHtml\(fmt\(challenge\.unavailableCheckCount\)\)/);
 assert.doesNotMatch(script,/challenge\.unavailableCheckCount\?\?0/);
});

test('T05 payment screens require retained source authority before zeros are shown',()=>{
 assert.match(script,/const paymentSourceEstablished=knownCount\(paymentRegister\.sourceRecordCount\)&&paymentRegister\.sourceRecordCount>0/);
 assert.match(script,/const paymentPopulationEstablished=paymentSourceEstablished&&knownCount\(paymentRegister\.recordCount\)/);
 assert.match(script,/const paymentLifecycleEstablished=paymentPopulationEstablished&&\[/);
 assert.doesNotMatch(script,/paymentPopulationEstablished=\(paymentRegister\.recordCount\?\?0\)>0\|\|paymentRegister\.state==="established"/);
 assert.doesNotMatch(script,/lifecycleCounts\.(?:applied|assessed|certified|paid)\?\?0/);
 assert.match(script,/governedDisplayCount\(paymentSourceEstablished,paymentRegister\.futureRecordCount\)/);
 assert.match(script,/governedDisplayCount\(paymentSourceEstablished,paymentRegister\.undatedRecordCount\)/);
 assert.match(script,/governedDisplayCount\(paymentPopulationEstablished,slaCounts\.notEstablished\)/);
 assert.match(script,/\["Overdue unpaid",governedDisplayCount\(paymentPopulationEstablished,slaCounts\.overdueUnpaid\)/);
 assert.match(script,/\["Paid late",governedDisplayCount\(paymentPopulationEstablished,slaCounts\.paidLate\)/);
});


test('T05 missing screen counts are not zeros, including grouped issue counts',()=>{
 const helpers=runInNewContext([
   originalFunction('knownScreenCount'),
   originalFunction('sumKnownScreenCounts'),
   originalFunction('screenCountText'),
   ';({knownScreenCount,sumKnownScreenCounts,screenCountText})'
 ].join('\n'),{fmt:(value:unknown)=>String(value)}) as {
   knownScreenCount:(value:unknown)=>number|null;
   sumKnownScreenCounts:(data:unknown,keys:string[])=>number|null;
   screenCountText:(value:unknown)=>string;
 };
 for(const missing of [null,undefined,'',NaN,Infinity,'0']){
   assert.equal(helpers.knownScreenCount(missing),null);
   assert.equal(helpers.screenCountText(missing),'Not established');
 }
 assert.equal(helpers.knownScreenCount(0),0);
 assert.equal(helpers.screenCountText(0),'0');
 assert.equal(helpers.sumKnownScreenCounts({},['a','b']),null);
 assert.equal(helpers.sumKnownScreenCounts({a:0},['a','b']),null);
 assert.equal(helpers.sumKnownScreenCounts({a:0,b:0},['a','b']),0);
 assert.equal(helpers.sumKnownScreenCounts({a:3,b:2},['a','b']),5);
 assert.match(script,/const sourceTotal=sumKnownScreenCounts\(overall/);
 assert.match(script,/countRows=Object\.entries\(descriptions\).*screenCountText\(counts\?\.\[kind\]\)/);
 assert.match(script,/\["Source uncertainty coverage",uncertainty\.coveragePercent===null\|\|uncertainty\.coveragePercent===undefined\?"Not established"/);
 assert.doesNotMatch(script,/uncertainty\.coveragePercent===null\|\|uncertainty\.coveragePercent===undefined\?"0%"/);
});

test('T05 missing management issue assessments are never green and signed float stays factual',()=>{
 const signed=runInNewContext(originalFunction('screenSignedNumberText')+';screenSignedNumberText',{
   fmt:(value:unknown)=>String(value),
 }) as (value:unknown)=>string;
 assert.equal(signed(-16),'-16','valid negative float is not an unknown count');
 assert.equal(signed(0),'0');
 for(const bad of [null,undefined,NaN,Infinity,''])assert.equal(signed(bad),'Not established');
 assert.match(script,/const positionSeverity=p=>\{const counts=p\.issueAssessment\?\.counts;if\(!counts\)return \{label:'Checks not established'/);
 assert.doesNotMatch(script,/const positionSeverity=p=>\{const counts=p\.issueAssessment\?\.counts\|\|\{\}/);
 assert.match(script,/const assessableNoticeCount=sumKnownScreenCounts\(timeliness/);
 assert.match(script,/const noticeEvidenceGapCount=sumKnownScreenCounts\(timeliness/);
 assert.doesNotMatch(script,/uncertainty\.coveragePercent===null\|\|uncertainty\.coveragePercent===undefined\?"0%"/);
});

test('T05/T10 visual charts withhold unknown totals and label every missing category',()=>{
 const safe=(value:unknown)=>String(value);
 const context={escapeHtml:safe,fmt:safe,percent2:safe};
 const functions=[
  originalFunction('renderVisualBars'),
  originalFunction('renderDonutChart'),
  originalFunction('chartToneColor')
 ];
 const render=runInNewContext(functions.join('\n')+';({renderVisualBars,renderDonutChart})',context) as {
  renderVisualBars:(items:any[],unit?:string)=>string;
  renderDonutChart:(items:any[],label?:string)=>string;
 };
 const partial=render.renderDonutChart([{label:'Observed',value:8},{label:'Unknown',value:null}], 'Records');
 assert.match(partial,/Distribution total not established/);
 assert.match(partial,/Unknown/);
 assert.match(partial,/Not established/);
 assert.doesNotMatch(partial,/donut-ring/,'incomplete category population cannot become a 100% known-subset pie');
 const bars=render.renderVisualBars([{label:'Paid',value:2},{label:'Unassessed',value:null}],'records');
 assert.match(bars,/Unassessed/);
 assert.match(bars,/Not established/);
 assert.doesNotMatch(bars,/Unassessed[^]*?visual-bar-fill/,'unassessed category must not receive a fabricated zero-valued bar');
 const full=render.renderDonutChart([{label:'Paid',value:2},{label:'Open',value:0}],'Records');
 assert.match(full,/donut-ring/);
 assert.match(full,/Paid/);
 assert.match(full,/Open/);
});

test('T05/T06 absent revision comparison does not publish false zero changes',()=>{
 const result=buildScheduleChangeReportFromHistory([],{generatedAt:'2031-01-01T00:00:00Z',producerVersion:'source-test'});
 assert.equal(result.state,'insufficient_history');
 for(const key of ['matchedActivityCount','addedActivityCount','removedActivityCount',
   'modifiedActivityCount','unchangedActivityCount','addedRelationshipCount','removedRelationshipCount'] as const){
   assert.equal(result[key],null,key+' must be missing until there are two comparable source revisions');
 }
 assert.deepEqual(result.changedActivities,[],'empty available detail rows are not fabricated comparisons');
});

test('T05 unknown progress cohorts and forecast coverage cannot display false completed zero',()=>{
 assert.doesNotMatch(script,/p\.progress\.completedCount\|\|0/);
 assert.doesNotMatch(script,/p\.progress\?\.inProgressCount\|\|0/);
 assert.doesNotMatch(script,/p\.progress\?\.notStartedCount\|\|0/);
 assert.match(script,/const independentCount=knownScreenCount\(p\.establishedForecastCount\)/);
 assert.match(script,/independentCount===null\?'<div class="notice warn">/);
 assert.match(script,/\["Project documents",data\.evidenceDocumentCount\?\?null/);
 assert.match(script,/\["Activities",w\.activityCount\?\?null/);
});
