import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {buildNegativeFloatConstraint} from '../packages/runtime-api/src/project-decision-facts';
import {decisionFactsScript} from '../packages/runtime-api/src/ui-decision-facts';

// F33: the completion constraint that gives the most negative float (-88 h) is
// named with its activity, constraint type and date.
const act=(activityId:string,totalFloatHours:number|null,sourceConstraints:any[]=[],status='not_started')=>({activityId,name:activityId+' name',activityType:'task',status,totalFloatHours,sourceConstraints});
const show=(analysis:any)=>String(runInNewContext(decisionFactsScript+'\nrenderDecisionAnalysis("pmo-analysis",{decisionAnalysis:analysis});',{
  escapeHtml:(s:unknown)=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),readerText:(s:unknown)=>String(s),planningShortDate:(s:string)=>s.slice(0,10)}));

test('F33 the late-date constraint at the most negative float is named with activity, type and date',()=>{
  const result=buildNegativeFloatConstraint({activities:[act('FIRE',-88),act('HANDOVER-B',-88,[{type:'CS_MEOB',dateIso:'2036-09-12T17:00:00'}]),act('OTHER',40,[{type:'CS_MEOB',dateIso:'2036-12-01'}]),act('DONE',-200,[],'completed')]})!;
  assert.equal(result.lowestFloatHours,-88);
  assert.equal(result.state,'named');
  assert.deepEqual(result.constraints,[{activityReference:'HANDOVER-B',activityName:'HANDOVER-B name',type:'CS_MEOB',typeLabel:'Finish on or before',dateIso:'2036-09-12'}]);
  const text=show({kind:'management_commercial',completionConstraints:[],negativeFloatConstraint:result});
  assert.match(text,/Most negative float -88 h/);
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
