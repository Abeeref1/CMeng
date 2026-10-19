import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {bindProjectFacts,projectFactConsumerMismatches} from '../packages/runtime-api/src/project-fact-consumers';
import {contractTimeProject,PENDING_CLAIMS,CONTRACT_COMPLETION,EXTENDED_COMPLETION} from './f33-f44-contract-time-fixture';

// F33 follow-up: the Completion Forecast required finish is bound to the shared
// governing date. When an EOT is awarded but the extended date is unknown, the
// required finish stays unknown; before, the binding fell back to the original
// contract date.
const fact=(value:unknown)=>({value,state:value===null?'missing':'confirmed',complete:value!==null,basis:'test',sourceRefs:[],diagnostics:[]});
const facts=(time:{contractual:string|null;awarded:number|null;extended:string|null;governing:string|null})=>({time:{
  contractualCompletionIso:fact(time.contractual),awardedEotDays:fact(time.awarded),
  extendedContractCompletionIso:fact(time.extended),governingContractCompletionIso:fact(time.governing)}}) as any;
const forecastPage=(requiredFinishIso:string|null)=>({requiredFinishIso,forecastTaxonomy:{contractualCompletion:{completionIso:requiredFinishIso}}});

test('F33b awarded EOT with an unknown extended date: the required finish stays unknown, never the original date',()=>{
  const bound:any=bindProjectFacts('independent-forecast',forecastPage(null),facts({contractual:CONTRACT_COMPLETION,awarded:13,extended:null,governing:null}));
  assert.equal(bound.requiredFinishIso,null,'before: the original contract date 2027-09-08');
  assert.equal(bound.forecastTaxonomy.contractualCompletion.completionIso,null);
  assert.deepEqual(projectFactConsumerMismatches(bound),[]);
});

test('F33b common cases keep the same required finish: extended date with an award, contract date without one',()=>{
  const awarded:any=bindProjectFacts('independent-forecast',forecastPage(EXTENDED_COMPLETION),facts({contractual:CONTRACT_COMPLETION,awarded:13,extended:EXTENDED_COMPLETION,governing:EXTENDED_COMPLETION}));
  assert.equal(awarded.requiredFinishIso,EXTENDED_COMPLETION);
  assert.equal(awarded.forecastTaxonomy.contractualCompletion.completionIso,EXTENDED_COMPLETION);
  const none:any=bindProjectFacts('independent-forecast',forecastPage(CONTRACT_COMPLETION),facts({contractual:CONTRACT_COMPLETION,awarded:null,extended:null,governing:CONTRACT_COMPLETION}));
  assert.equal(none.requiredFinishIso,CONTRACT_COMPLETION);
  assert.equal(none.forecastTaxonomy.contractualCompletion.completionIso,CONTRACT_COMPLETION);
  // Full page path on real projects: same figures as before.
  for(const [projectId,expected] of [[contractTimeProject({claims:PENDING_CLAIMS}),EXTENDED_COMPLETION],[contractTimeProject({eot:false}),CONTRACT_COMPLETION]] as const){
    const d:any=moduleForProject(projectId,'independent-forecast').data;
    assert.equal(d.projectFacts.time.governingContractCompletionIso.value,expected);
    assert.equal(d.requiredFinishIso,expected);
    assert.equal(d.forecastTaxonomy.contractualCompletion.completionIso,expected);
    assert.deepEqual(projectFactConsumerMismatches(d),[]);
  }
});
