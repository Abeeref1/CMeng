import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNearCriticalProjection} from '../packages/near-critical-analysis/src';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// T06 / N7: grouped float (work-package lowest float, float histogram buckets,
// float distribution) is shown in working days only when every float-bearing
// member activity uses one source calendar working-day length.
function model(calendarFor:(id:string)=>string,floats:Record<string,number>={A1:16,A2:24,B1:24,B2:48}){
  const activity=(id:string,wbsId:string,flt:number)=>({
    activityId:id,nativeId:id,name:id,wbsId,calendarId:calendarFor(id),activityType:'task',
    status:'in_progress',totalFloatHours:flt,freeFloatHours:null,percentComplete:0,
    originalDurationHours:80,remainingDurationHours:80,
    currentStartIso:'2031-01-01',currentFinishIso:'2031-03-01',
    baselineStartIso:'2031-01-01',baselineFinishIso:'2031-03-01',
    actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
    sourceRefs:[],diagnostics:[]});
  return {projectId:'P',source:'xer',sourceRevisionId:'R',dataDateIso:'2031-02-01',relationships:[],diagnostics:[],
    wbs:[{wbsId:'W1',name:'One',parentWbsId:null,sourceRefs:[]},{wbsId:'W2',name:'Two',parentWbsId:null,sourceRefs:[]}],
    // Lowest float in W1 is on the 8-hour calendar; the other member is on 12 hours.
    activities:[activity('A1','W1',floats.A1!),activity('A2','W1',floats.A2!),activity('B1','W2',floats.B1!),activity('B2','W2',floats.B2!)],
    calendars:[{calendarId:'C8',semanticComplete:true,standardDayHours:8,sourceRefs:[]},
      {calendarId:'C12',semanticComplete:true,standardDayHours:12,sourceRefs:[]},
      {calendarId:'C12',semanticComplete:true,standardDayHours:24,sourceRefs:[]},
      {calendarId:'UNREAD',semanticComplete:false,standardDayHours:8,sourceRefs:[]}]} as any;
}
const project=(calendarFor:(id:string)=>string,floats?:Record<string,number>)=>buildNearCriticalProjection(model(calendarFor,floats),{generatedAt:'2031-02-01',producerVersion:'t'}) as any;

test('T06 near-critical work-package lowest float uses the group rule, never the lowest activity calendar alone',()=>{
  const mixed=project(id=>id==='A1'?'C8':'C12');
  const w1=mixed.managementGroups.find((g:any)=>g.wbsId==='W1'),w2=mixed.managementGroups.find((g:any)=>g.wbsId==='W2');
  assert.equal(w1.lowestFloatHours,16,'hours unchanged');
  assert.equal(w1.lowestFloatActivityId,'A1');
  assert.equal(w1.lowestFloatWorkingDays,null,'members on 8 h and 12 h calendars never give one group day value');
  assert.equal(w1.lowestFloatDaysBasis,'mixed_calendar_day_lengths');
  assert.equal(w2.lowestFloatWorkingDays,2,'24 h on the first 12-hour calendar definition is 2 working days');
  assert.equal(w2.lowestFloatDaysBasis,'source_activity_calendar');
  // Lowest float (B1) is on a read 12-hour calendar; the other member (B2) is on an unread calendar.
  const unread=project(id=>id==='B2'?'UNREAD':'C12',{A1:16,A2:24,B1:-16,B2:-8}).managementGroups.find((g:any)=>g.wbsId==='W2');
  assert.deepEqual(unread.activityIds.slice().sort(),['B1','B2']);
  assert.equal(unread.lowestFloatActivityId,'B1');
  assert.equal(unread.lowestFloatWorkingDays,null,'an unread member calendar never becomes an 8-hour day');
  assert.equal(unread.lowestFloatDaysBasis,'calendar_working_day_not_established');
});

test('T06 float histogram buckets and float distribution carry working days only for one shared day length',()=>{
  const shared=project(()=>'C12');
  assert.equal(shared.floatHourHistogram.daysBasis,'source_activity_calendar');
  assert.equal(shared.floatHourHistogram.workingDayHours,12);
  assert.deepEqual(shared.floatHourHistogram.groups.map((g:any)=>[g.lowerHours,g.lowerWorkingDays,g.count]),[[16,1.333333,1],[24,2,2],[48,4,1]]);
  assert.equal(shared.floatDistributionDaysBasis,'source_activity_calendar');
  assert.equal(shared.floatDistributionWorkingDays.maximum,4);
  assert.equal(shared.floatDistribution.maximum,48,'hour distribution unchanged');
  const mixed=project(id=>id==='A1'?'C8':'C12');
  assert.equal(mixed.floatHourHistogram.daysBasis,'mixed_calendar_day_lengths');
  assert.equal(mixed.floatHourHistogram.workingDayHours,null);
  assert.ok(mixed.floatHourHistogram.groups.every((g:any)=>g.lowerWorkingDays===null&&g.upperWorkingDays===null));
  assert.equal(mixed.floatDistributionWorkingDays,null,'no single day value for a mixed-calendar population');
  assert.equal(mixed.floatDistributionDaysBasis,'mixed_calendar_day_lengths');
  assert.deepEqual(mixed.floatHourHistogram.groups.map((g:any)=>[g.lowerHours,g.count]),shared.floatHourHistogram.groups.map((g:any)=>[g.lowerHours,g.count]),'hour buckets unchanged');
});

test('T06 previous float and float erosion convert each side with its own revision calendar',()=>{
  const previousFloat={revisionId:'R0',totalFloatByActivity:new Map<string,number|null>([['A1',48],['A2',48]]),
    // A1 was on a 12-hour calendar in the previous revision; A2 previous calendar not read; B1 not matched.
    workingDayHoursByActivity:new Map<string,number|null>([['A1',12],['A2',null]])};
  const out=buildNearCriticalProjection(model(id=>id==='A1'?'C8':'C12'),{generatedAt:'2031-02-01',producerVersion:'t',previousFloat}) as any;
  const row=(id:string)=>out.rows.find((r:any)=>r.activityId===id);
  const a1=row('A1'),a2=row('A2'),b1=row('B1');
  assert.ok(a1&&a2&&b1,'rows found');
  assert.equal(a1.previousTotalFloatHours,48);assert.equal(a1.floatErosionHours,32,'hours unchanged');
  assert.equal(a1.previousTotalFloatWorkingDays,4,'48 h on the previous 12-hour calendar');
  assert.equal(a1.floatErosionWorkingDays,2,'4 previous working days minus 2 current working days (16 h on 8 h), not 32/8');
  assert.equal(a2.previousTotalFloatHours,48);
  assert.equal(a2.previousTotalFloatWorkingDays,null,'unknown previous calendar never becomes a day');
  assert.equal(a2.floatErosionWorkingDays,null);
  assert.equal(b1.previousTotalFloatHours,null);assert.equal(b1.previousTotalFloatWorkingDays,null);assert.equal(b1.floatErosionWorkingDays,null);
  assert.ok(!JSON.stringify(project(()=>'C12')).includes('previousTotalFloatWorkingDays'),'no previous revision adds no field');
});

test('T06 screens: float buckets, float summary and thresholds show working days or say why not',()=>{
  const html=cmengUatHtml();
  assert.ok(!html.includes("distributionSummary(p.floatDistribution,'hours','Unfinished execution activity float values')"),'float summary in hours only remains');
  assert.ok(html.includes("floatDistributionSummary(p,'Unfinished execution activity float values')"));
  assert.ok(html.includes('floatBucketDaysNote(sourceHistogram?.daysBasis)'),'histogram states its day basis');
  assert.ok(html.includes('" working days · "'),'histogram buckets show working days first');
  assert.ok(!html.includes("Critical ≤ '+escapeHtml(screenSignedNumberText(p.criticalFloatThresholdHours))+' h"),'critical threshold in hours only remains');
  assert.ok(!html.includes("Critical = TF ≤ '+escapeHtml(fmt(criticalThreshold))+' h"),'critical threshold in hours only remains');
  assert.ok(!html.includes('"TF > "+fmt(criticalThreshold)+" h and ≤ "'),'critical threshold in hours only remains');
  assert.ok(!html.includes('<th>Previous float h</th><th>Float erosion h</th>'),'between-revision float headers in hours remain');
  assert.ok(html.includes('" working days (previous revision calendar) · "'),'previous float shows its own revision working days');
  assert.ok(html.includes("sourceWorkingFloatField(r,'nearCriticalThresholdHours')"),'per-activity near-critical limit uses the shared helper');
  assert.ok(!html.includes("fmt(r.nearCriticalThresholdHours)+' h'"),'per-activity near-critical limit in hours only remains');
  assert.ok(!html.includes('sourceWorkingFloat({submittedTotalFloatHours:group.lowestFloatHours,submittedTotalFloatWorkingDays:group.lowestFloatWorkingDays})'),'group float ignores the mixed-calendar basis');
  const start=html.indexOf('function floatThresholdText('),end=html.indexOf('\nfunction ',start+10);
  assert.ok(start>0,'shared threshold text exists');
  const floatThresholdText=new Function('screenSignedNumberText','fmt','return '+html.slice(start,end))(String,String);
  assert.equal(floatThresholdText(0),'0 working days','zero hours is zero working days on every calendar');
  assert.equal(floatThresholdText(8),'8 h (hours threshold; working days differ by activity calendar)');
  assert.equal(floatThresholdText(null),'Not established');
});

test('T06 an activity near-critical limit in hours carries working days of its own calendar',async()=>{
  const {attachFloatWorkingDays}=await import('../packages/runtime-api/src/activity-float-reconciliation');
  const out=attachFloatWorkingDays({rows:[{activityId:'A1',nearCriticalThresholdHours:80},{activityId:'B2',nearCriticalThresholdHours:80}]},
    model(id=>id==='B2'?'UNREAD':'C8')) as any;
  assert.equal(out.rows[0].nearCriticalThresholdWorkingDays,10,'80 h on an 8-hour calendar');
  assert.equal(out.rows[0].nearCriticalThresholdHours,80,'hours kept');
  assert.equal(out.rows[1].nearCriticalThresholdWorkingDays,null,'unread calendar stays unknown');
});

// ---- Round 3: durations, float shift between revisions, variance-trend float points ----
function revisionModel(revisionId:string,dayHours:number|null,floats:Record<string,number>,status:Record<string,string>={}){
  const m=model(()=>'CAL',floats);
  m.sourceRevisionId=revisionId;
  for(const a of m.activities)a.status=status[a.activityId]??'in_progress';
  m.calendars=dayHours===null?[{calendarId:'CAL',semanticComplete:false,standardDayHours:8,sourceRefs:[]}]
    :[{calendarId:'CAL',semanticComplete:true,standardDayHours:dayHours,sourceRefs:[]},{calendarId:'CAL',semanticComplete:true,standardDayHours:24,sourceRefs:[]}];
  return {revisionId,label:revisionId,sequence:revisionId==='R1'?1:2,effectiveAt:revisionId==='R1'?'2031-01-01':'2031-02-01',model:m};
}

test('T06 activity durations in hours carry working days of the activity calendar, completed included; unknown stays unknown',async()=>{
  const {attachFloatWorkingDays}=await import('../packages/runtime-api/src/activity-float-reconciliation');
  const m=model(id=>id==='B2'?'UNREAD':'C8');m.activities[1].status='completed';
  const body={rows:[{activityId:'A1',originalDurationHours:80,remainingDurationHours:40},{activityId:'A2',originalDurationHours:24,remainingDurationHours:0},
    {activityId:'B2',remainingDurationHours:16},{activityId:'ZZ',remainingDurationHours:16},{activityId:'A1',remainingDurationHours:8,remainingDurationWorkingDays:7}]};
  const before=JSON.stringify(body);
  const out=attachFloatWorkingDays(body,m) as any;
  assert.equal(JSON.stringify(body),before,'input not mutated');
  assert.equal(out.rows[0].originalDurationWorkingDays,10);assert.equal(out.rows[0].remainingDurationWorkingDays,5);
  assert.equal(out.rows[0].originalDurationHours,80,'hours kept');
  assert.equal(out.rows[0].durationDaysBasis,'source_activity_calendar');
  assert.equal(out.rows[1].originalDurationWorkingDays,3,'a completed activity duration is still a source fact (24 h on its first 8 h calendar)');
  assert.equal(out.rows[1].remainingDurationWorkingDays,0,'zero stays zero');
  assert.equal(out.rows[2].remainingDurationWorkingDays,null,'unread calendar never becomes an 8-hour day');
  assert.equal(out.rows[2].durationDaysBasis,'calendar_working_day_not_established');
  assert.equal(out.rows[3].remainingDurationWorkingDays,undefined,'unknown activity gets no invented day');
  assert.equal(out.rows[4].remainingDurationWorkingDays,7,'existing day value never overwritten');
});

test('T06 revision float shift converts each side with its own revision calendar',async()=>{
  const {buildScheduleChangeReportProjection}=await import('../packages/schedule-change-report/src');
  // R1 calendar 8 h/day, R2 calendar 12 h/day: A1 float 16 h (2 d) -> 36 h (3 d) = +1 working day although +20 h.
  const from=revisionModel('R1',8,{A1:16,A2:24,B1:24,B2:48}),to=revisionModel('R2',12,{A1:36,A2:24,B1:0,B2:24},{B2:'completed'});
  const out=buildScheduleChangeReportProjection(from as any,to as any,{generatedAt:'2031-02-01',producerVersion:'t'}) as any;
  const row=(id:string)=>out.changedActivities.find((r:any)=>r.activityId===id);
  assert.equal(row('A1').floatShiftHours,20,'hours unchanged');
  assert.equal(row('A1').floatShiftWorkingDays,1,'3 working days (R2) minus 2 working days (R1), not 20/8 or 20/12');
  assert.equal(row('A1').floatShiftDaysBasis,'each_revision_activity_calendar');
  assert.equal(row('B1').floatShiftWorkingDays,-3);
  assert.equal(row('B2').floatShiftWorkingDays,null,'completed work has no live float in days');
  assert.equal(row('B2').floatShiftDaysBasis,'not_applicable_completed');
  const moved=out.changeSummary.largestFloatMovements.find((r:any)=>r.activityId==='A1');
  assert.equal(moved.floatShiftWorkingDays,1);
  const unread=buildScheduleChangeReportProjection(revisionModel('R1',null,{A1:16,A2:24,B1:24,B2:48}) as any,to as any,{generatedAt:'2031-02-01',producerVersion:'t'}) as any;
  const a1=unread.changedActivities.find((r:any)=>r.activityId==='A1');
  assert.equal(a1.floatShiftHours,20);
  assert.equal(a1.floatShiftWorkingDays,null,'unread previous calendar never becomes an 8-hour day');
  assert.equal(a1.floatShiftDaysBasis,'calendar_working_day_not_established');
});

test('T06 variance-trend activity float points carry working days of each revision calendar',async()=>{
  const {buildVarianceTrendsProjection}=await import('../packages/variance-trends/src');
  const out=buildVarianceTrendsProjection([revisionModel('R1',8,{A1:16,A2:24,B1:24,B2:48}),revisionModel('R2',12,{A1:36,A2:24,B1:0,B2:24},{B2:'completed'})] as any,
    {generatedAt:'2031-02-01',producerVersion:'t'}) as any;
  const points=(id:string)=>out.activityTrends.find((t:any)=>t.activityId===id).points;
  assert.deepEqual(points('A1').map((p:any)=>[p.revisionId,p.totalFloatHours,p.totalFloatWorkingDays]),[['R1',16,2],['R2',36,3]]);
  const b2=points('B2').find((p:any)=>p.revisionId==='R2');
  assert.equal(b2.totalFloatHours,24,'hours unchanged');assert.equal(b2.totalFloatWorkingDays,null);assert.equal(b2.floatDaysBasis,'not_applicable_completed');
});

test('T06 screens: remaining duration and revision float shift in working days; stale subtitle gone',()=>{
  const html=cmengUatHtml();
  assert.ok(!html.includes('fmt(row.remainingDurationHours)+" h"'),'remaining duration in hours only remains');
  assert.ok(html.includes('sourceWorkingDuration(row,"remainingDurationHours")'));
  assert.ok(!html.includes('planningSignedBars(floatMoves,"hours lost")'),'float movement bars in hours only remain');
  assert.ok(html.includes('" working days (each revision\'s calendar) · "'),'float shift row shows each revision working days');
  assert.ok(!html.includes('remain visible without calendar conversion'),'stale subtitle remains');
  const start=html.indexOf('function sourceWorkingDuration('),end=html.indexOf('\nfunction ',start+10);
  const sourceWorkingDuration=new Function('fmt','return '+html.slice(start,end))(String);
  assert.equal(sourceWorkingDuration({remainingDurationHours:40,remainingDurationWorkingDays:5},'remainingDurationHours'),'5 working days · 40 original h');
  assert.equal(sourceWorkingDuration({remainingDurationHours:40,remainingDurationWorkingDays:null},'remainingDurationHours'),'Working-day basis not established · 40 original h');
});
