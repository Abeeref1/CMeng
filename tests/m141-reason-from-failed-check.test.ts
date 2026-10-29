import test from 'node:test';
import assert from 'node:assert/strict';
import {positionVerdict} from '../packages/runtime-api/src/position-review';
import {forecastFailedChecks} from '../packages/runtime-api/src/project-projections';

// M14.1 invariant: the reason shown is the check that failed, read from that
// check's own result. It is never the first entry of a fixed list or a generic
// fallback while a more specific failed check is known.

test('M14.1: every failed forecast check is named from its own diagnostic, in any combination',()=>{
  const checks:Array<[string,RegExp]>=[
    ['SCHEDULE_GRAPH_DUPLICATE_ACTIVITY_IDS:A100,A200',/A100, A200 appears more than once/],
    ['SCHEDULE_GRAPH_CYCLES:B1,B2',/loop through B1, B2/],
    ['SCHEDULE_GRAPH_SELF_LOOPS:C7',/C7 is linked to itself/],
    ['SCHEDULE_GRAPH_BROKEN_PREDECESSORS:D4',/D4 point to activities that are not in the programme/],
    ['CPM_EXTERNAL_RELATIONSHIP_UNRESOLVED:R9',/1 link goes to another project/],
    ['CALENDAR_WORK_PATTERN_NOT_ESTABLISHED:CAL1',/usable working-time pattern/],
    ['CALENDAR_SEMANTICS_UNRESOLVED:CAL2',/clear meaning/],
  ];
  // Each check alone, and every pair: each failed check is named, and none that did not fail.
  for(let i=0;i<checks.length;i++)for(let j=i;j<checks.length;j++){
    const used=i===j?[checks[i]!]:[checks[i]!,checks[j]!];
    const text=forecastFailedChecks(used.map(c=>c[0])).join('; ');
    for(const [,pattern] of used)assert.match(text,pattern,'named: '+text);
    for(const [code,pattern] of checks)if(!used.some(u=>u[0]===code))assert.doesNotMatch(text,pattern,'not failed, not named: '+text);
  }
  assert.deepEqual(forecastFailedChecks(['SOME_OTHER_NOTE']),[],'nothing failed: nothing named');
});

const dashboard=(time:Record<string,unknown>,metrics:Array<{key:string;value:unknown}>=[])=>positionVerdict({key:'master-dashboard',data:{metrics,projectFacts:{time}},status:'partial',reason:null,dependencies:[]} as any);

test('M14.1: the contract comparison reason is the input that is missing',()=>{
  // A confirmed contract date with an unresolved EOT position: never "no date confirmed".
  const eot=dashboard({contractualCompletionIso:{value:'2030-01-31'},governingContractCompletionIso:{value:null,basis:'The awarded extension of time is not established.'},independentDaysAfterCurrentContract:{value:null},submittedDaysAfterCurrentContract:{value:null}},[{key:'submitted-programme-finish',value:'2030-06-01'}]);
  assert.doesNotMatch(eot.text,/no contractual completion date has been confirmed/);
  assert.match(eot.text,/governs after awarded extensions of time is not established/);
  assert.match(String(eot.nextAction),/extension of time/);
  // No contract date at all: that is the reason.
  const none=dashboard({contractualCompletionIso:{value:null},independentDaysAfterCurrentContract:{value:null},submittedDaysAfterCurrentContract:{value:null}},[{key:'submitted-programme-finish',value:'2030-06-01'}]);
  assert.match(none.text,/no contractual completion date has been confirmed/);
  // A governing date but no programme finish: the programme is the reason.
  const noFinish=dashboard({contractualCompletionIso:{value:'2030-01-31'},governingContractCompletionIso:{value:'2030-02-28'},independentDaysAfterCurrentContract:{value:null},submittedDaysAfterCurrentContract:{value:null}});
  assert.match(noFinish.text,/no programme finish is available/);
  assert.doesNotMatch(noFinish.text,/no contractual completion date/);
});
