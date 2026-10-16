import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeSchedule,
  sourceScheduleCompletionBases,
  DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
  type CanonicalScheduleActivity,
  type CanonicalScheduleModel,
} from '../packages/schedule-analysis-core/src';
import {compareScheduleRevisions,classifyScheduleChanges,type ScheduleRevision} from '../packages/schedule-revision-core/src';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import {buildScheduleChangeReportProjection} from '../packages/schedule-change-report/src';

// Independent original-source oracle: the report without precomputed analyses
// still evaluates its own two source schedules. No project IDs are singled out
// by product code and no producer output is used to determine expectations.
function revision(projectId:string,sequence:number,activityCount:number):ScheduleRevision {
  const month=projectId==='SOURCE-SECOND'?'04':'03';
  const date=(i:number)=>'2031-'+month+'-'+String(1+(i%27)).padStart(2,'0');
  const activities:CanonicalScheduleActivity[]=Array.from({length:activityCount},(_,i)=>{
    const completed=i%13===0;
    return {
      projectId,activityId:'SRC-'+i,nativeId:String(i),name:'Original activity '+i,
      wbsId:'W',calendarId:'C',activityType:i%23===0?'finish_milestone':'task',
      status:completed?'completed':i%5===0?'in_progress':'not_started',
      baselineStartIso:date(i),baselineFinishIso:i%29===0?null:date(i+6),
      currentStartIso:date(i),
      currentFinishIso:i%17===0?null:i%19===0?'invalid-source-date':date(i+sequence+3),
      actualStartIso:completed?date(i):null,
      actualFinishIso:completed&&i%11!==0?date(i+7):null,
      forecastStartIso:null,
      forecastFinishIso:!completed&&i%7===0?date(i+sequence+8):null,
      originalDurationHours:24,remainingDurationHours:completed?0:24,
      totalFloatHours:i%9===0?null:i%3===0?-8:24,
      freeFloatHours:null,percentComplete:completed?100:i%5===0?30:0,
      sourceRefs:[],diagnostics:[],
    };
  });
  const model:CanonicalScheduleModel={
    projectId,source:'xer',sourceRevisionId:'S-'+sequence,
    dataDateIso:'2031-'+month+'-'+String(1+sequence).padStart(2,'0'),
    activities,relationships:[],
    wbs:[{wbsId:'W',name:'Source work',parentWbsId:null,sourceRefs:[]}],
    calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],diagnostics:[],
  };
  return {revisionId:'S-'+sequence,label:'Submitted '+sequence,sequence,
    effectiveAt:model.dataDateIso,model};
}

function assertedSourceCompletion(model:CanonicalScheduleModel):string|null {
  const bases=sourceScheduleCompletionBases(model);
  return (bases.find(row=>row.basis==='forecast'&&row.dateIso)
    ??bases.find(row=>row.basis==='programme'&&row.dateIso))?.dateIso??null;
}

test('T11 exact original change-report parity with reused completed source analyses across two isolated projects',()=>{
  const projectResults:string[]=[];
  for(const projectId of ['SOURCE-FIRST','SOURCE-SECOND']){
    const before=revision(projectId,1,2301),after=revision(projectId,2,2301);
    const originalSource=JSON.stringify([before,after]);
    const options={generatedAt:'2031-05-01T00:00:00Z',producerVersion:'independent-t11'};
    const original=buildScheduleChangeReportProjection(before,after,options);
    const originalPair=compareScheduleRevisions(before,after);
    const originalClassification=classifyScheduleChanges(originalPair.activityChanges,before.model,after.model);
    const borrowed=buildScheduleChangeReportProjection(before,after,{
      ...options,precomputedComparison:originalPair,precomputedChangeCategories:originalClassification,
    });
    assert.deepEqual(borrowed,original,'reused same-pair classification must exactly match the complete independent producer');
    assert.notStrictEqual(borrowed.changeCategories,originalClassification,'each page must own its returned audit categories');
    assert.notStrictEqual(borrowed.changeCategories[0],originalClassification[0],'source category rows cannot alias another page');
    originalClassification[0]!.activityCount=900000;
    assert.deepEqual(borrowed,original,'altering another view must never mutate the returned source classification');
    assert.ok(original.engineeringChanges,'full original change record must exist');
    assert.equal(original.engineeringChanges.fromCompletionIso,assertedSourceCompletion(before.model));
    assert.equal(original.engineeringChanges.toCompletionIso,assertedSourceCompletion(after.model));
    for(const config of [
      DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
      {...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:3},
    ]){
      const a=analyzeSchedule(before.model,config),b=analyzeSchedule(after.model,config);
      assert.deepEqual(a.completionBases,analyzeSchedule(before.model).completionBases,
        'completion date bases must not depend on float screening policy');
      assert.deepEqual(b.completionBases,analyzeSchedule(after.model).completionBases,
        'current revision completion must remain source-based');
      let hits=0;
      const instrumented=(value:ReturnType<typeof analyzeSchedule>)=>
        Object.defineProperty({...value},'completionBases',{
          enumerable:true,configurable:true,
          get(){hits++;return value.completionBases;},
        }) as ReturnType<typeof analyzeSchedule>;
      const full=new Map<CanonicalScheduleModel,ReturnType<typeof analyzeSchedule>>([
        [before.model,instrumented(a)],[after.model,instrumented(b)],
      ]);
      const reused=buildScheduleChangeReportProjection(before,after,{
        ...options,precomputedAnalyses:full,
      });
      assert.deepEqual(reused,original,'every original report field and full source population');
      assert.equal(hits,2,'read exact current analyses instead of recomputing both schedules');
      const partiallyAvailable=buildScheduleChangeReportProjection(before,after,{
        ...options,precomputedAnalyses:new Map([[before.model,a]]),
      });
      assert.deepEqual(partiallyAvailable,original,'missing precomputation uses original fallback');
    }
    assert.equal(JSON.stringify([before,after]),originalSource,
      'original activity records, statuses and provenance remain untouched');
    projectResults.push(original.engineeringChanges.toCompletionIso??'unknown');
    // A changed source revision must be explicitly analyzed again. No global
    // activity, project, revision-ID, calendar or authority cache is introduced.
    after.model.activities[1]!.forecastFinishIso='2031-12-20';
    const revised=buildScheduleChangeReportProjection(before,after,{
      ...options,precomputedAnalyses:new Map([
        [before.model,analyzeSchedule(before.model)],
        [after.model,analyzeSchedule(after.model)],
      ]),
    });
    const independentlyRevised=buildScheduleChangeReportProjection(before,after,options);
    assert.ok(revised.engineeringChanges,'changed source must retain engineering record');
    assert.deepEqual(revised,independentlyRevised);
    assert.equal(revised.engineeringChanges.toCompletionIso,'2031-12-20');
  }
  assert.notEqual(projectResults[0],projectResults[1],
    'two projects with matching activity IDs and revision labels keep distinct source dates');
});
