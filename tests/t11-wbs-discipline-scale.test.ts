import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyScheduleActivity,scheduleScopeClassification} from '../packages/runtime-api/src/schedule-scope-classification';
import type {CanonicalScheduleModel,CanonicalScheduleActivity} from '../packages/schedule-analysis-core/src';

test('T11 repeated WBS discipline lookups preserve the exact source classification for every activity',()=>{
  const projectId='TEST-WBS-CLASSIFICATION';
  const wbs=[
    {wbsId:'ROOT',name:'MEP',parentWbsId:null,sourceRefs:[]},
    {wbsId:'M',name:'Mechanical Zone 3',parentWbsId:'ROOT',sourceRefs:[]},
    {wbsId:'E',name:'Electrical Zone 4',parentWbsId:'ROOT',sourceRefs:[]},
    {wbsId:'BOTH',name:'Mechanical Electrical Combined',parentWbsId:'ROOT',sourceRefs:[]},
    {wbsId:'EMPTY',name:'Area Unknown',parentWbsId:null,sourceRefs:[]},
  ];
  const names=['General installation','Mechanical valve work','Electrical cable work','Mechanical Electrical coordination'];
  const group=['M','E','BOTH','EMPTY',null];
  const activities:CanonicalScheduleActivity[]=Array.from({length:1000},(_,i)=>({
    projectId,activityId:'ACT-'+i,nativeId:String(i),
    name:names[i%4]!,wbsId:group[i%group.length]!,
    calendarId:'C',activityType:'task',status:'not_started',
    baselineStartIso:'2031-01-01',baselineFinishIso:'2031-06-01',
    currentStartIso:'2031-01-01',currentFinishIso:'2031-06-01',
    actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
    originalDurationHours:24,remainingDurationHours:24,totalFloatHours:null,
    freeFloatHours:null,percentComplete:null,sourceRefs:[],diagnostics:[],
  }));
  const model:CanonicalScheduleModel={projectId,source:'xer',sourceRevisionId:'SUBMITTED-1',dataDateIso:'2031-02-01',
    activities,relationships:[],wbs,calendars:[],diagnostics:[]};
  const preserved=JSON.stringify({activities,wbs});
  const actual=scheduleScopeClassification(model).rows;
  const independent=activities.map(activity=>classifyScheduleActivity(model,activity));
  assert.equal(actual.length,1000,'do not limit the activity population to a page');
  assert.deepEqual(actual,independent,'memoized discipline must agree with independently recomputed source classifications');
  assert.equal(JSON.stringify({activities,wbs}),preserved,'classifications must not edit source rows or hierarchy');
  assert.equal(actual[0]?.discipline,'Mechanical','nearest source WBS discipline used when task text has none');
  assert.equal(actual[1]?.discipline,'Mechanical','explicit task discipline outranks its electrical WBS');
  assert.equal(actual[2]?.discipline,'Electrical','explicit electrical task wins over a mixed-discipline WBS');
  assert.equal(actual[3]?.discipline,null,'ambiguous task and unknown WBS must not invent a discipline');
  assert.equal(actual[7]?.discipline,'MEP','ambiguous task and combined WBS may use the one explicit source parent');
  assert.equal(actual[4]?.discipline,null,'source without a discipline must remain unknown');
  assert.strictEqual(scheduleScopeClassification(model).rows,actual,'one immutable source model shares one classification result');
});


test('T11 full 8,501-activity source classification reuses the exact spatial readers without changing independent uncached results',()=>{
  const projectId='BLIND-SOURCE-CLASSIFICATION';
  const wbs=[
    {wbsId:'M',name:'Mechanical Zone 3',parentWbsId:null,sourceRefs:[]},
    {wbsId:'E',name:'Electrical Tower 2',parentWbsId:null,sourceRefs:[]},
    {wbsId:'BOTH',name:'Combined Mechanical Electrical',parentWbsId:null,sourceRefs:[]},
    {wbsId:'U',name:'General Utilities',parentWbsId:null,sourceRefs:[]},
  ];
  const names=['General installation','Mechanical pipe fittings','Electrical cable pulling','عمارة مستوى 3','Zone 2 Floor G Package A','منطقة 4 طابق 2','Equipment commissioning'];
  const ids=['M','E','BOTH','U'];
  const activities:CanonicalScheduleActivity[]=Array.from({length:8501},(_,i)=>({
    projectId,activityId:'ROW-'+i,nativeId:String(i),name:names[i%names.length]!,wbsId:ids[i%ids.length]!,
    calendarId:'C',activityType:'task',status:'not_started',
    baselineStartIso:'2032-01-01',baselineFinishIso:'2032-08-01',
    currentStartIso:'2032-01-01',currentFinishIso:'2032-08-01',
    actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
    originalDurationHours:24,remainingDurationHours:24,totalFloatHours:null,
    freeFloatHours:null,percentComplete:null,sourceRefs:[],diagnostics:[],
  }));
  const model:CanonicalScheduleModel={projectId,source:'xer',sourceRevisionId:'SOURCE-1',dataDateIso:'2032-02-01',
    activities,relationships:[],wbs,calendars:[],diagnostics:[]};
  const savedSource=JSON.stringify(model);
  const full=scheduleScopeClassification(model);
  const independentlyParsed=activities.map(row=>classifyScheduleActivity(model,row));
  assert.equal(full.rows.length,8501,'none of the source activities are reduced to a preview');
  assert.deepEqual(full.rows,independentlyParsed,'every spatial field, source basis, discipline and source order match the uncached interpreter');
  assert.equal(full.rows[0]?.discipline,'Mechanical','source WBS provides discipline without a task label');
  assert.equal(full.rows[1]?.discipline,'Mechanical','explicit task evidence outranks Electrical WBS');
  assert.equal(full.rows[2]?.discipline,'Electrical','explicit Electrical task overrides mixed-discipline parent');
  assert.equal(full.rows[3]?.discipline,'Infrastructure','the source WBS names Utilities, so infrastructure is established even when the activity name is Arabic-only');
  for(const coverage of full.coverage){
    const independentCount=independentlyParsed.filter(row=>row[coverage.key]!==null).length;
    assert.equal(coverage.classified,independentCount,'coverage uses the full source population for '+coverage.key);
    assert.equal(coverage.total,8501);
  }
  assert.equal(JSON.stringify(model),savedSource,'the source programme must remain byte-for-byte unchanged');
  const replacement:CanonicalScheduleModel={...model,sourceRevisionId:'SOURCE-2',activities:activities.map((r,i)=>i===0?{...r,name:'Electrical cable works'}:r)};
  const next=scheduleScopeClassification(replacement);
  assert.equal(next.rows[0]?.discipline,'Electrical','a new source revision must override the former source evidence');
  assert.equal(full.rows[0]?.discipline,'Mechanical',"the earlier model's result remains unchanged");
  const unrelated:CanonicalScheduleModel={...model,projectId:'SEPARATE-PROJECT',activities:activities.slice(0,32).map(r=>({...r,projectId:'SEPARATE-PROJECT'}))};
  assert.deepEqual(scheduleScopeClassification(unrelated).rows,independentlyParsed.slice(0,32),'no classifications leak across projects');
});
