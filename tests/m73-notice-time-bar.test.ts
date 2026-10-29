import test from 'node:test';
import assert from 'node:assert/strict';
import {noticeBlocksEvent} from '../packages/eot-assessment/src/projector';

// M7.3 invariant: only a late or missing notice under a confirmed (official)
// rule can time-bar an event. No rule, conflicting rules, a missing date or a
// candidate rule never bars it.
test('M7.3: only an official notice rule can time-bar an event',()=>{
  const policy:any={requireTimelyNoticeWhenOfficialRequirementExists:true};
  const row=(noticeTimeliness:string,noticeRequirementState:string|null)=>({eventId:'E',noticeTimeliness,noticeRequirementState}) as any;
  assert.equal(noticeBlocksEvent(row('requirement_missing',null),policy),false,'no rule: not barred');
  assert.equal(noticeBlocksEvent(row('requirement_conflicted',null),policy),false,'conflicting rules: review, not barred');
  assert.equal(noticeBlocksEvent(row('event_date_missing','official'),policy),false,'missing date: not barred');
  assert.equal(noticeBlocksEvent(row('late','candidate'),policy),false,'candidate rule cannot time-bar');
  assert.equal(noticeBlocksEvent(row('not_issued','provisional'),policy),false,'provisional rule cannot time-bar');
  assert.equal(noticeBlocksEvent(row('late','official'),policy),true,'late under an official rule is barred');
  assert.equal(noticeBlocksEvent(row('not_issued','official'),policy),true);
  assert.equal(noticeBlocksEvent(row('timely','official'),policy),false);
  assert.equal(noticeBlocksEvent(row('late','official'),{requireTimelyNoticeWhenOfficialRequirementExists:false} as any),false,'the policy can switch the bar off');
});
