import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import type {CanonicalScheduleActivity, CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
import {buildLookAheadProjection} from '../packages/lookahead-schedule/src';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

function activity(activityId:string, patch:Partial<CanonicalScheduleActivity>={}):CanonicalScheduleActivity {
  return {
    projectId:'BACKLOG-ACCEPTANCE',activityId,nativeId:null,name:activityId,wbsId:'W1',calendarId:null,
    activityType:'task',status:'not_started',baselineStartIso:null,baselineFinishIso:null,
    currentStartIso:'2026-01-12',currentFinishIso:'2026-01-20',actualStartIso:null,actualFinishIso:null,
    forecastStartIso:null,forecastFinishIso:null,originalDurationHours:null,remainingDurationHours:null,
    totalFloatHours:null,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[],...patch,
  };
}
function model(activities:CanonicalScheduleActivity[]):CanonicalScheduleModel {
  return {
    projectId:'BACKLOG-ACCEPTANCE',source:'schedule_xlsx',sourceRevisionId:'R1',dataDateIso:'2026-01-11',
    activities,relationships:[],wbs:[{wbsId:'W1',parentWbsId:null,name:'Civil',sourceRefs:[]}],
    calendars:[],diagnostics:[],
  };
}
const options={generatedAt:'2026-01-11T00:00:00.000Z',producerVersion:'acceptance',windowDays:42};

test('Batch C: missed start with future finish belongs only to overdue backlog',()=>{
  const p=buildLookAheadProjection(model([
    activity('LATE_START',{currentStartIso:'2026-01-06',currentFinishIso:'2026-01-26'}),
    activity('FUTURE'),
  ]),options);
  assert.deepEqual(p.overdueBacklogRows.map(r=>r.activityId),['LATE_START']);
  assert.deepEqual(p.forwardWindowRows.map(r=>r.activityId),['FUTURE']);
  assert.equal(p.overdueBacklogRows[0]!.classification,'missed_start');
  assert.equal(p.overdueBacklogRows[0]!.daysToStart,-5);
  assert.equal(p.overdueBacklogRows[0]!.daysToFinish,15);
  assert.equal(p.missedStartCount,1);
  assert.equal(p.overdueCount,0,'legacy overdueCount remains a finish-overdue count');
  assert.equal(p.overdueBacklogCount,1);
  assert.equal(p.rows.length,2,'compatibility list retains each activity exactly once');
});

test('Batch C: overdue start and finish are two conditions on one backlog activity',()=>{
  const p=buildLookAheadProjection(model([
    activity('BOTH',{currentStartIso:'2026-01-02',currentFinishIso:'2026-01-09'}),
  ]),options);
  assert.equal(p.overdueBacklogCount,1);
  assert.equal(p.overdueCount,1);
  assert.equal(p.missedStartCount,1);
  assert.equal(p.forwardWindowCount,0);
  assert.equal(p.rows.length,1);
  assert.equal(p.overdueBacklogRows[0]!.finishOverdue,true);
  assert.equal(p.overdueBacklogRows[0]!.missedPlannedStart,true);
});

test('Batch C: ongoing work and the Data Date boundary stay in the forward window',()=>{
  const p=buildLookAheadProjection(model([
    activity('ONGOING',{status:'in_progress',actualStartIso:'2026-01-06',currentStartIso:'2026-01-06',percentComplete:20}),
    activity('STARTS_AT_DD',{currentStartIso:'2026-01-11'}),
    activity('OUTSIDE',{currentStartIso:'2026-03-01',currentFinishIso:'2026-03-10'}),
    activity('DONE',{status:'completed',actualStartIso:'2026-01-02',actualFinishIso:'2026-01-04',percentComplete:100}),
  ]),options);
  assert.deepEqual(p.forwardWindowRows.map(r=>r.activityId).sort(),['ONGOING','STARTS_AT_DD']);
  assert.equal(p.overdueBacklogCount,0);
  assert.equal(p.missedStartCount,0);
  assert.equal(p.rows.length,2);
});

test('Batch C: backlog blockers cannot inflate forward-window readiness or interventions',()=>{
  const p=buildLookAheadProjection(model([
    activity('LATE_START',{currentStartIso:'2026-01-06',currentFinishIso:'2026-01-26'}),
    activity('FUTURE'),
  ]),{...options,readinessEvidence:{LATE_START:{procurement_material:{state:'blocked',sourceRefs:['procurement:material-1']}}}});
  assert.equal(p.overdueBacklogBlockedCount,1);
  assert.equal(p.blockedCount,0);
  assert.equal(p.blockerOccurrenceCount,0);
  assert.deepEqual(p.managementInterventions,[]);
  assert.ok(p.readinessCoverage!.every(r=>r.denominator===p.forwardWindowCount));
  assert.equal(p.readyCount+p.conditionalCount+p.blockedCount,p.forwardWindowCount);
  assert.equal(new Set(p.rows.map(r=>r.activityId)).size,p.overdueBacklogCount+p.forwardWindowCount);
});

function renderLookAhead(p:ReturnType<typeof buildLookAheadProjection>):string {
  const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const start=script.indexOf('function renderLookAheadVisual(data){');
  const end=script.indexOf('function renderMonteCarloRiskVisual(data){',start);
  assert.ok(start>=0&&end>start);
  const scope:Record<string,unknown>={
    p,projectionFor:(value:unknown)=>value,
    escapeHtml:(value:unknown)=>String(value??''),fmt:(value:unknown)=>String(value??''),
    planningShortDate:(value:unknown)=>String(value??''),humanizeKey:(value:unknown)=>String(value??''),
    planningKpis:()=>'',experienceDisclosure:()=>'',moduleBarList:()=>'',planningLookAheadTimeline:()=>'',
    planningStatusBand:()=>'',planningLookAheadBlockers:()=>'',
    managementPanel:(title:string,description:string,content:string)=>'<section><h4>'+title+'</h4>'+description+content+'</section>',
  };
  return vm.runInNewContext(script.slice(start,end)+';renderLookAheadVisual(p);',scope) as string;
}

test('Batch C: overdue-start screen reports start lateness, never absolute future-finish days',()=>{
  const p=buildLookAheadProjection(model([
    activity('LATE_START',{currentStartIso:'2026-01-06',currentFinishIso:'2026-01-26'}),
  ]),options);
  const rendered=renderLookAhead(p);
  assert.match(rendered,/<th>Start overdue days<\/th>/);
  assert.match(rendered,/<th>Finish overdue days<\/th>/);
  assert.match(rendered,/<td>Start overdue<\/td><td>2026-01-06<\/td><td>5<\/td><td>—<\/td>/);
  assert.doesNotMatch(rendered,/<td>15<\/td>/);
});

test('Batch C: screen keeps both overdue amounts separate for a late start and finish',()=>{
  const p=buildLookAheadProjection(model([
    activity('BOTH',{currentStartIso:'2026-01-02',currentFinishIso:'2026-01-09'}),
  ]),options);
  assert.match(renderLookAhead(p),/<td>Start and finish overdue<\/td><td>2026-01-09<\/td><td>9<\/td><td>2<\/td>/);
});
