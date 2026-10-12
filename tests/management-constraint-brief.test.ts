import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {decisionFactsScript} from '../packages/runtime-api/src/ui-decision-facts';

const show=(rows:unknown[])=>{
  const context:any={
    escapeHtml:(s:unknown)=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),
    readerText:(s:unknown)=>String(s),
    planningShortDate:(s:string)=>s.slice(0,10),
    output:'',
  };
  runInNewContext(decisionFactsScript+'\noutput=renderDecisionAnalysis("pmo-analysis",{decisionAnalysis:{kind:"management_commercial",completionConstraints:inputs}});',
    {...context,inputs:rows},
  );
  // The sandbox returns the result of the script's last assignment.
  return String(runInNewContext(decisionFactsScript+'\nrenderDecisionAnalysis("pmo-analysis",{decisionAnalysis:{kind:"management_commercial",completionConstraints:inputs}});',
    {...context,inputs:rows}));
};

test('S-26: an explicit submitted completion constraint is named with its type, date and authority',()=>{
  const text=show([{activityReference:'PROJECT-COMPLETE',activityName:'Project Completion',typeLabel:'Finish on or after',dateIso:'2027-01-14',basis:'Submitted current programme; not a contract amendment'}]);
  assert.match(text,/Project Completion/);
  assert.match(text,/PROJECT-COMPLETE/);
  assert.match(text,/Finish on or after/);
  assert.match(text,/2027-01-14/);
  assert.match(text,/do not amend the contractual completion date/);
});
test('S-26: a missing source constraint is not invented',()=>assert.equal(show([]),''));
