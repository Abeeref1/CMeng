import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewScheduleCalendarBasis} from '../packages/runtime-api/src/schedule-calendar-review';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
test('elapsed-day duration convention is detected on a different project and remains a reconciliation rather than delay',()=>{
 const m:CanonicalScheduleModel={projectId:'ANOTHER-PROJECT',source:'xer',sourceRevisionId:'R9',dataDateIso:'2030-01-10',wbs:[],relationships:[],diagnostics:[],
 calendars:[{calendarId:'FIVE',name:'Five day eight hour',semanticComplete:true,standardDayHours:8,weeklyWorkMinutes:[0,480,480,480,480,480,0],weeklyWorkIntervals:[2,3,4,5,6].map(dayIndex=>({dayIndex,intervals:[{start:'08:00',finish:'16:00',minutes:480}]})),sourceRefs:[]}],
 activities:[{projectId:'ANOTHER-PROJECT',activityId:'DONE',nativeId:'1',name:'Completed task',activityType:'task',calendarId:'FIVE',wbsId:null,status:'completed',baselineStartIso:null,baselineFinishIso:null,currentStartIso:null,currentFinishIso:null,forecastStartIso:null,forecastFinishIso:null,actualStartIso:'2030-01-04T08:00:00',actualFinishIso:'2030-01-07T08:00:00',originalDurationHours:24,remainingDurationHours:0,totalFloatHours:0,freeFloatHours:0,percentComplete:100,sourceRefs:[],diagnostics:[]}]};
 const r=reviewScheduleCalendarBasis(m);assert.equal(r.state,'calendar_basis_difference');assert.equal(r.population.denominator,1);assert.equal(r.elapsedDayMatchCount,1);assert.equal(r.assignedCalendarMismatchCount,1);assert.match(r.interpretation,/not proof.*delay causation/);
 const unknown=structuredClone(m);unknown.activities[0]!.calendarId='ABSENT';assert.equal(reviewScheduleCalendarBasis(unknown).population.denominator,0);assert.equal(reviewScheduleCalendarBasis(unknown).state,'not_established');
});
