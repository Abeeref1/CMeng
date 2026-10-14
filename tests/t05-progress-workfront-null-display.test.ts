import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {createSourceFile,isFunctionDeclaration,ScriptTarget} from 'typescript';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// This is the real assembled UI function, not a duplicate mocked presentation.
const assembled=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(assembled,'CMeng assembled browser script is present');
const parsed=createSourceFile('cmeng-browser.js',assembled,ScriptTarget.Latest,true);
const renderer=parsed.statements.find(x=>isFunctionDeclaration(x)&&x.name?.text==='renderProgressBreakdownVisual');
assert.ok(renderer,'source Progress Breakdown renderer must be assembled');

function render(rows:Record<string,unknown>[]){
 const project={
  rows:[],totalActivityCount:5,overallScheduleProgressPercent:null,overallProgressCoveragePercent:null,
  baselinePlanAvailable:false,controlledBaselineAvailable:false,hierarchyRows:[],
  dimensionViews:[{dimension:'wbs',label:'By WBS',basis:'All source activity IDs',
   available:true,classificationCoveragePercent:100,classifiedPopulation:1,unclassifiedPopulation:0,rows}],
 };
 const sourceBefore=JSON.stringify(project);
 const script=renderer.getText(parsed)+';renderProgressBreakdownVisual';
 const display=runInNewContext(script,{
  projectionFor:(value:unknown)=>value,
  fmt:(value:unknown)=>value===null||value===undefined?'Not established':String(value),
  escapeHtml:(value:unknown)=>String(value).replace(/[&<>"]/g,t=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'} as Record<string,string>)[t]!),
  percent2:(n:number)=>String(n),
  responseListPopulation:(arr:unknown[])=>({total:arr.length}),
  sourcePopulationControl:()=>'',planningShortDate:()=> 'Not established',
  pmcDisplayOwner:()=> 'PMC planning role',
  planningKpis:(items:unknown[][])=>items.map(x=>x.map(v=>String(v)).join(':')).join(' | '),
 }) as (data:unknown)=>string;
 const html=display(project);
 assert.equal(JSON.stringify(project),sourceBefore,'screen must not rewrite original programme positions');
 return html;
}
const row=(counts:Record<string,unknown>)=>({
 groupLabel:'Original Electrical Workfront',groupKey:'WBS-X',activityCount:5,completedCount:2,
 baselinePlannedPercent:null,currentPlanPercent:null,scheduleProgressPercent:null,
 physicalMeasuredPercent:null,certifiedPhysicalPercent:null,forecastFinishIso:null,
 criticalCount:null,negativeFloatCount:null,milestoneThreatIds:[],owner:null,
 managementAction:'Review supplied workfront source',...counts,
});

test('T05 WBS management rows keep six missing source counts as Not established, never zero',()=>{
 const html=render([row({
  delayedActivityCount:null,longLeadActivityCount:null,longLeadSourceLinkedCount:null,
  longLeadProgrammeCandidateCount:null,procurementBlockerCount:null,designBlockerCount:null,
 })]);
 assert.match(html,/Original Electrical Workfront/);
 assert.match(html,/<td>Not established<\/td><td>— \/ —<\/td>/,
  'delay count must not become fabricated zero');
 assert.match(html,/Not established<br><small>Linked long-lead records Not established · explicit programme candidates Not established<\/small>/,
  'all source long-lead populations remain unresolved');
 assert.match(html,/<td>Not established \/ Not established<\/td>/,
  'missing procurement and design blockers are distinct from genuinely unblocked');
 assert.doesNotMatch(html,/0<br><small>Linked long-lead records 0/);
});

test('T05 original real zero source counts stay zero in workfront tiles',()=>{
 const html=render([row({
  delayedActivityCount:0,longLeadActivityCount:0,longLeadSourceLinkedCount:0,
  longLeadProgrammeCandidateCount:0,procurementBlockerCount:0,designBlockerCount:0,
 })]);
 assert.match(html,/<td>0<\/td><td>— \/ —<\/td>/);
 assert.match(html,/<td>0<br><small>Linked long-lead records 0 · explicit programme candidates 0<\/small><\/td>/);
 assert.match(html,/<td>0 \/ 0<\/td>/);
});

test('T05 mixed source knowledge never turns missing material blockers into known zero',()=>{
 const html=render([row({
  delayedActivityCount:3,longLeadActivityCount:0,longLeadSourceLinkedCount:null,
  longLeadProgrammeCandidateCount:7,procurementBlockerCount:null,designBlockerCount:0,
 })]);
 assert.match(html,/<td>3<\/td><td>— \/ —<\/td>/);
 assert.match(html,/0<br><small>Linked long-lead records Not established · explicit programme candidates 7/);
 assert.match(html,/<td>Not established \/ 0<\/td>/);
});
