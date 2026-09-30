import test from 'node:test';
import assert from 'node:assert/strict';

import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {moduleFeatureAvailability} from '../packages/runtime-api/src/feature-availability';

const html=cmengUatHtml();
const script=html.match(/<script>([\s\S]*?)<\/script>/)![1]!;

test('Management Brief is decision-oriented and not a repeated activity dump',()=>{
  assert.match(script,/What is driving the current position/);
  assert.match(script,/Milestones to protect/);
  assert.match(script,/What changed since the previous programme/);
  assert.match(script,/Decisions and actions/);
  assert.match(script,/Distinct WBS\/workfront concentrations/);
});

test('Programme Review and Activity Review have distinct purposes',()=>{
  assert.match(script,/Programme Review = whole-programme control/);
  assert.match(script,/Use Activity Review for individual activity filtering/);
  assert.match(script,/Activity Review = detailed investigation/);
  assert.match(script,/Programme-level conclusions remain in Programme Review and Management Brief/);
});

test('Look-Ahead renders forward work separately from overdue backlog',()=>{
  assert.match(script,/6-week execution view · forward window/);
  assert.match(script,/Overdue backlog/);
  assert.match(script,/overdue backlog is controlled separately/i);
  assert.match(script,/Forward-window interventions/);
});

test('Milestones and Near-Critical lead with management control before technical analytics',()=>{
  const milestoneControl=script.indexOf('Milestones requiring management control');
  const milestoneAnalytics=script.indexOf('Milestone analytics & source-float detail');
  assert.ok(milestoneControl>=0&&milestoneAnalytics>milestoneControl);

  const coverage=script.indexOf('Float classification coverage:');
  const nearControl=script.indexOf('Work packages closest to critical');
  const nearAnalytics=script.indexOf('Float analytics & classification detail');
  assert.ok(coverage>=0&&nearControl>coverage&&nearAnalytics>nearControl);
});

test('revision/change/trend features require the right comparison population',()=>{
  assert.equal(moduleFeatureAvailability('revision-trend',{points:[{}]}).state,'evidence_only');
  assert.equal(moduleFeatureAvailability('revision-trend',{points:[{},{}]}).state,'active');
  assert.equal(moduleFeatureAvailability('variance-trends',{points:[{}]}).state,'evidence_only');
  assert.equal(moduleFeatureAvailability('variance-trends',{points:[{},{}]}).state,'active');
  assert.equal(moduleFeatureAvailability('schedule-change-report',{toRevisionId:'R2',changedActivities:[]}).state,'evidence_only');
  assert.equal(moduleFeatureAvailability('schedule-change-report',{fromRevisionId:'R1',toRevisionId:'R2',changedActivities:[]}).state,'active');

  assert.match(script,/Programme Changes requires a controlled revision pair/);
  assert.match(script,/Revision History is available, but a trend is not yet established/);
  assert.match(script,/Variance Trend is not yet a trend/);
});
