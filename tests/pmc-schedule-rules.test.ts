import test from 'node:test';
import assert from 'node:assert/strict';
import {pmcScheduleRules} from '../packages/runtime-api/src/pmc-schedule-rules';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';

test('programme rules count the correct populations, expose affected rows, and detect missing updates',()=>{
 const model=loadCertifiedDemoProject('PMC-RULES').schedules.at(-1)!.revision.model,sample=model.activities[0]!;
 model.dataDateIso='2031-08-31';model.calendars=[{calendarId:'C',name:'Eight hour days',semanticComplete:true,standardDayHours:8,weeklyWorkMinutes:[0,480,480,480,480,480,0],weeklyWorkIntervals:[1,2,3,4,5].map(dayIndex=>({dayIndex,intervals:[{start:'08:00',finish:'16:00',minutes:480}]})),sourceRefs:[]}];
 model.activities=[{...sample,activityId:'DONE',activityType:'task',status:'completed',calendarId:'C',totalFloatHours:null,actualStartIso:'2031-08-01',actualFinishIso:'2031-08-20',baselineFinishIso:'2031-08-22',baselineDateBasis:'controlled_baseline'},
 {...sample,activityId:'LONG',activityType:'task',status:'not_started',calendarId:'C',totalFloatHours:360,remainingDurationHours:400,actualStartIso:null,actualFinishIso:null,baselineFinishIso:'2031-08-22',baselineDateBasis:'controlled_baseline',sourceConstraints:[{type:'CS_MSO',dateIso:'2031-09-01'}]},
 {...sample,activityId:'NEG',activityType:'task',status:'not_started',calendarId:'NO-CALENDAR',totalFloatHours:-8,actualStartIso:null,actualFinishIso:null,baselineFinishIso:'2032-01-01',baselineDateBasis:'controlled_baseline'}];
 model.relationships=[{relationshipId:'L1',predecessorActivityId:'LONG',successorActivityId:'NEG',type:'SS',lagHours:-8,external:false,sourceRefs:[],diagnostics:[]}];
 const result=pmcScheduleRules(model,[{...model,dataDateIso:'2030-06-30'},model]);
 assert.equal(result.remainingActivityCount,2);assert.equal(result.bei.value,.5);
 for(const [key,id] of [['high_float','LONG'],['high_duration','LONG'],['hard_constraints','LONG'],['negative_float','NEG'],['calendar','NEG']])assert.deepEqual(result.checks.find(c=>c.key===key)!.activityIds,[id]);
 assert.equal(result.checks.find(c=>c.key==='float_missing')!.count,0);
 assert.equal(result.relationships.find(r=>r.type==='SS')!.count,1);assert.equal(result.negativeLags.length,1);
 assert.equal(result.updateGaps.length,1);assert.equal(result.updateGaps[0]!.calendarDays,427);
 assert.equal(result.cpli.value,null,'mixed/missing calendars do not get an invented CPLI');
});

test('CPLI uses matching calendar units for remaining length and required-date headroom',()=>{
 const model=loadCertifiedDemoProject('PMC-CPLI').schedules.at(-1)!.revision.model;
 model.dataDateIso='2031-09-01';model.calendars=[{calendarId:'C',name:'Daily eight hours',semanticComplete:true,standardDayHours:8,weeklyWorkMinutes:[480,480,480,480,480,480,480],weeklyWorkIntervals:[0,1,2,3,4,5,6].map(dayIndex=>({dayIndex,intervals:[{start:'08:00',finish:'16:00',minutes:480}]})),sourceRefs:[]}];
 model.activities=[{...model.activities[0]!,activityId:'FINISH',activityType:'finish_milestone',status:'not_started',calendarId:'C',forecastFinishIso:'2031-09-10T17:00:00Z',currentFinishIso:'2031-09-10T17:00:00Z',actualFinishIso:null}];
 const value=pmcScheduleRules(model,[], '2031-09-12').cpli;
 assert.ok(value.remainingWorkingHours!>0);assert.equal(value.totalFloatWorkingHours,16);assert.equal(value.value,(value.remainingWorkingHours!+16)/value.remainingWorkingHours!);
});
