import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {buildNegativeFloatConstraint} from '../packages/runtime-api/src/project-decision-facts';
import {decisionFactsScript} from '../packages/runtime-api/src/ui-decision-facts';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// F33: the completion constraint that gives the most negative float (-88 h) is
// named with its activity, constraint type and date.
const act=(activityId:string,totalFloatHours:number|null,sourceConstraints:any[]=[],status='not_started')=>({activityId,name:activityId+' name',activityType:'task',status,totalFloatHours,sourceConstraints,calendarId:'C8'});
// N7: the float is shown with the shared float-days helper of the assembled page script.
const page=cmengUatHtml(),shared=(name:string)=>{const start=page.indexOf('function '+name+'(');assert.ok(start>0,name);return page.slice(start,page.indexOf('\n}',start)+2);};
const show=(analysis:any)=>String(runInNewContext(shared('sourceWorkingFloat')+'\n'+shared('sourceWorkingFloatField')+'\n'+decisionFactsScript+'\nrenderDecisionAnalysis("pmo-analysis",{decisionAnalysis:analysis});',{
  escapeHtml:(s:unknown)=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),readerText:(s:unknown)=>String(s),planningShortDate:(s:string)=>s.slice(0,10),fmt:(v:unknown)=>String(v),analysis}));

test('F33 the late-date constraint at the most negative float is named with activity, type and date',()=>{
  const result=buildNegativeFloatConstraint({activities:[act('FIRE',-88),act('HANDOVER-B',-88,[{type:'CS_MEOB',dateIso:'2036-09-12T17:00:00'}]),act('OTHER',40,[{type:'CS_MEOB',dateIso:'2036-12-01'}]),act('DONE',-200,[],'completed')]})!;
  assert.equal(result.lowestFloatHours,-88);
  assert.equal(result.state,'named');
  assert.deepEqual(result.constraints,[{activityReference:'HANDOVER-B',activityName:'HANDOVER-B name',type:'CS_MEOB',typeLabel:'Finish on or before',dateIso:'2036-09-12'}]);
  const text=show({kind:'management_commercial',completionConstraints:[],negativeFloatConstraint:result});
  // N7: days with the day type when the activities at that float share one calendar day length; hours stay as the audit.
  assert.deepEqual(result.lowestFloatCalendarIds,['C8'],'the calendars of the activities at the lowest float');
  assert.match(text,/Most negative float Working-day basis not established · -88 original h/,'no working-day length attached: said so, never an 8-hour day');
  assert.match(show({kind:'management_commercial',completionConstraints:[],negativeFloatConstraint:{...result,lowestFloatWorkingDays:-11,lowestFloatDaysBasis:'source_activity_calendar'}}),/Most negative float -11 working days · -88 original h/);
  assert.match(show({kind:'management_commercial',completionConstraints:[],negativeFloatConstraint:{...result,lowestFloatWorkingDays:null,lowestFloatDaysBasis:'mixed_calendar_day_lengths'}}),/Most negative float -88 original h · activities on different calendars/);
  assert.doesNotMatch(text,/-88 h\b/);
  assert.match(text,/Finish on or before 2036-09-12 on HANDOVER-B name \(HANDOVER-B\)/);
});

test('F33 an unnamed source constraint stays unknown and positive float names nothing',()=>{
  const unknown=buildNegativeFloatConstraint({activities:[act('FIRE',-88),act('NEXT',-88,[{type:'CS_MSOA',dateIso:'2036-01-01'}])]})!;
  assert.equal(unknown.state,'not_identified_in_source');
  assert.deepEqual(unknown.constraints,[]);
  assert.match(show({kind:'management_commercial',completionConstraints:[],negativeFloatConstraint:unknown}),/does not name the constraint that sets it/);
  assert.equal(buildNegativeFloatConstraint({activities:[act('A',0),act('B',16)]}),null);
  assert.equal(buildNegativeFloatConstraint({activities:[act('A',null)]}),null);
  assert.equal(show({kind:'management_commercial',completionConstraints:[],negativeFloatConstraint:null}),'');
});
