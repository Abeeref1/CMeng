import test from 'node:test';
import assert from 'node:assert/strict';
import {buildForecastReconciliationGate,forecastCredibility} from '../packages/runtime-api/src/forecast-control';

// Owner rule (3 Nov): CMeng's own finish stays visible, but leads the management
// headline only when it is reliable (coverage, calendars, network, divergence).
const activities=(n:number,open:number)=>Array.from({length:n},(_,i)=>({activityId:'A'+i,status:i<n-open?'completed':'not_started',sourceConstraints:[]}));
const model=(n:number,open:number)=>({activities:activities(n,open),dataDateIso:'2026-09-30T17:00:00',calendars:[],relationships:[]}) as any;
const forecast=(o:{finish:string;coverage:number;assumed:number;diagnostics?:string[]}):any=>({
  calculatedCompletionIso:o.finish,independentForecastCompletionIso:o.finish,complete:o.coverage===100,activityCoveragePercent:o.coverage,
  unresolvedActivityCount:o.coverage===100?0:100,assumedCalendarOpenActivityIds:Array.from({length:o.assumed},(_,i)=>'A'+(1000-i)),
  sourceForecastCompletionIso:'2029-01-02T17:00:00',diagnostics:o.diagnostics??[],assumptions:[],activities:[]});

test('Forecast credibility: a finish from 22% of activities on unreadable calendars, 26 years after the contractor\'s finish, does not lead',()=>{
  const gate=buildForecastReconciliationGate({model:model(1000,950),forecast:forecast({finish:'2055-02-27T19:00:00Z',coverage:21.62,assumed:744}),requiredFinishIso:'2029-03-01'});
  assert.equal(gate.reliable,false);
  assert.equal(gate.managementForecastCompletionIso,null,'not the headline');
  assert.equal(gate.managementForecast.completionIso?.slice(0,10),'2055-02-27','CMeng\'s calculation stays visible');
  assert.equal(gate.managementForecast.headline.source,'contractor_programme');
  assert.equal(gate.managementForecast.headline.completionIso?.slice(0,10),'2029-01-02');
  const reasons=gate.managementForecast.notReliableReasons.join(' | ');
  assert.match(reasons,/21\.6% of the activities/);assert.match(reasons,/no readable working calendar/);assert.match(reasons,/differs from the contractor's programme finish/);
});
test('Forecast credibility: a full-coverage finish close to the contractor\'s finish leads',()=>{
  const gate=buildForecastReconciliationGate({model:model(1000,500),forecast:forecast({finish:'2029-02-10T17:00:00Z',coverage:100,assumed:0}),requiredFinishIso:'2029-03-01'});
  assert.equal(gate.reliable,true);
  assert.equal(gate.managementForecastCompletionIso?.slice(0,10),'2029-02-10');
  assert.equal(gate.managementForecast.headline.source,'cmeng_calculation');
});
test('Forecast credibility: a finish years early from 18% coverage does not say "within the contract date"',()=>{
  const c=forecastCredibility({model:model(1000,900),forecast:forecast({finish:'2027-10-19T17:00:00Z',coverage:17.94,assumed:820}),calculatedFinish:'2027-10-19T17:00:00Z',graphProblemCount:0});
  assert.ok(c.reasons.length>=2);assert.equal(c.divergenceDays,-441);
});
test('Forecast credibility: a network with many logic problems does not lead',()=>{
  const c=forecastCredibility({model:model(1000,500),forecast:forecast({finish:'2029-01-20T17:00:00Z',coverage:100,assumed:0}),calculatedFinish:'2029-01-20T17:00:00Z',graphProblemCount:40});
  assert.match(c.reasons.join(' '),/40 logic problems/);
});
