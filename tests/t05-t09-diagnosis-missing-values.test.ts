import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {projectDiagnosisScript} from '../packages/runtime-api/src/ui-project-diagnosis';

function browser(){
 const context:Record<string,unknown>={
  fmt:(value:unknown)=>value===null||value===undefined?'Not established':String(value),
  escapeHtml:(value:unknown)=>String(value).replace(/[&<>"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'} as Record<string,string>)[s]!),
  planningShortDate:(value:unknown)=>value==null?'Not established':String(value),
  planningKpis:(rows:unknown[][])=>rows.map(r=>r.map(v=>String(v)).join(' = ')).join(' | '),
  managementModuleLink:(key:string,label:string)=>'<a data-module="'+key+'">'+label+'</a>',
  renderCompletionPosition:()=>'<div class="completion">Completion authority retained</div>',
  actionDeadlineText:()=> 'Deadline not established',
  renderProjectDiagnosis:()=>'<div class="source-read">Original project facts retained</div>',
 };
 runInNewContext(projectDiagnosisScript+'\n;renderProjectDiagnosis=()=>\'<div class="source-read">Nested full diagnosis is tested separately</div>\';globalThis.fixture={renderProjectPrioritySummary,renderProjectBrief,renderProjectDashboardSummary,milestoneExposureNote};',context);
 return context.fixture as {
  renderProjectPrioritySummary:(v:unknown)=>string;
  renderProjectBrief:(d:unknown,data?:unknown)=>string;
  renderProjectDashboardSummary:(v:unknown)=>string;
  milestoneExposureNote:(v:unknown)=>string;
 };
}

test('T09 source action with no assigned owner does not invent a Project Controls Manager',()=>{
 const b=browser();
 const source={
  actions:[{recordKey:'ncr|record-7',issue:'An open NCR from the source',consequence:'Requires follow-up',
   requiredAction:'Review signed source receipt',owner:null,organisation:null,dueIso:null}],
 };
 const original=JSON.stringify(source),html=b.renderProjectPrioritySummary(source);
 assert.match(html,/Responsible: Not assigned/);
 assert.doesNotMatch(html,/Responsible: Project Controls Manager/);
 assert.match(html,/Deadline not established/);
 assert.equal(JSON.stringify(source),original,'rendering cannot rewrite owner, record or date');
});

test('T05 unknown milestone coverage and known zero are explicitly different',()=>{
 const b=browser();
 assert.match(b.milestoneExposureNote({value:null,identifiedCount:9,knownCount:null}),/Priority count not established/);
 assert.doesNotMatch(b.milestoneExposureNote({value:null,identifiedCount:9,knownCount:null}),/0 identified priorities/);
 assert.match(b.milestoneExposureNote({value:null,identifiedCount:9,knownCount:0}),/0 identified priorities/);
 assert.match(b.milestoneExposureNote({value:0,absenceConfirmed:false}),/No identified milestone/);
});

test('T05 sourced workfront/previous-revision unknown counts do not render as zero',()=>{
 const b=browser();
 const diagnosis={
  dataDateIso:'2031-08-31',executionActivityCount:90,relationshipCount:20,calendarCount:2,
  summary:'Uncertain programme position',completion:{independentFinishIso:'2031-11-01'},
  network:{state:'calculated',rows:[],relationships:[],basis:'Calculated from source'},actions:[],
  counts:{critical:{value:null,knownCount:4},negativeFloat:{value:null,knownCount:0},nearCritical:{value:null,knownCount:null}},
  wbsRows:[{wbs:'WEST',pressureCount:3,criticalCount:null,negativeFloatCount:0,
   worstFloatHours:null,drivingCount:null}],milestoneRows:[],
  milestoneExposure:{value:null,identifiedCount:3,knownCount:null},
  revision:{state:'available',modified:null,added:0,removed:null,finishMovementCalendarDays:null},
  actionRegister:{actions:[]},
 };
 const copy=JSON.stringify(diagnosis),html=b.renderProjectBrief(diagnosis);
 assert.match(html,/3<\/td><td>Not established<\/td><td>0<\/td>/,
  'real zero negative-float count remains zero but unknown critical count is withheld');
 assert.match(html,/Not established<\/td><\/tr>/,
  'independent driving network must not invent a missing driving activity count');
 // N3: an unknown count is not followed by its noun; the real zero stays zero.
 assert.match(html,/Since the previous revision: changed activities Not established, added 0, removed Not established\./,
  'missing revision counts must not be displayed as zero');
 assert.doesNotMatch(html,/Not established activities/,'no unit after an unknown word');
 assert.equal(JSON.stringify(diagnosis),copy,'display can never alter exact source record or decision');
});

test('T05 driver summary never fabricates pressure count',()=>{
 const b=browser();
 const d={
  dataDateIso:'2031-08-31',summary:'Evidence partial',
  completion:{},network:{state:'calculated',rows:[]},counts:{
   critical:{value:null,knownCount:null},negativeFloat:{value:null,knownCount:0},nearCritical:{value:null,knownCount:null}},
  wbsRows:[{wbs:'MEP',pressureCount:null,drivingCount:2}],actions:[],
 };
 const result=b.renderProjectDashboardSummary(d);
 assert.match(result,/Not established pressure/);
 assert.doesNotMatch(result,/0 pressure/);
 assert.match(result,/2 driving/);
});
