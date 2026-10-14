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
  assert.equal(actual[3]?.discipline,'MEP','ambiguous task and combined WBS may use the one explicit source parent');
  assert.equal(actual[4]?.discipline,null,'source without a discipline must remain unknown');
  assert.strictEqual(scheduleScopeClassification(model).rows,actual,'one immutable source model shares one classification result');
});
