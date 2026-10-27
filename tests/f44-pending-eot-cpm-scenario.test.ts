import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {pendingEotScenario} from '../packages/runtime-api/src/pending-eot-scenario';
import {extractContractLdTerms} from '../packages/contract-commercial/src';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {contractTimeProject,contractTimeModel,PENDING_CLAIMS,EXTENDED_COMPLETION,PROGRAMME_FINISH} from './f33-f44-contract-time-fixture';
import {countText} from '../packages/runtime-api/src/count-text';

// F44: the pending EOT scenario is a CMeng CPM calculation. With the 21
// pending assessed days awarded, the contract completion moves from 21 Sep to
// 12 Oct 2027; the CPM is run with that date as the required finish and gives
// the completion float and the days late against it, and the delay-damages
// effect. Judged by the independent solver in tools/independent.
const requireCjs=createRequire(__filename);
const {solve}=requireCjs(resolve(process.cwd(),'tools/independent/cpm-solver.cjs'));
const SCENARIO_DATE='2027-10-12';
const ldTerms=extractContractLdTerms({sections:[{text:'Contractual Completion 08 September 2027\nDelay Damages USD 10000 per day',heading:'Time for Completion',
  startPage:12,sectionKey:'completion',sourceMode:'deterministic',sourceSpans:[]}],pdf:{pages:[]}} as any);

/** Independent solver: the same network plus a zero-duration contract marker
 * that starts on or after the given contract date; the completion milestone's
 * free float to that marker is its float against the contract date, and the
 * marker's push past the date is the lateness. */
function independent(contractDateIso:string){
  const r=solve({dataDate:'2027-03-01T00:00:00Z',calendars:[{id:'C24',workDays:[0,1,2,3,4,5,6],startHour:0,hoursPerDay:24,holidays:[]}],
    activities:[{id:'A100',calendar:'C24',duration:3816,remaining:2400,actualStart:'2027-01-01T00:00:00Z'},{id:'A200',calendar:'C24',duration:2856},
      {id:'M900',calendar:'C24',duration:0},{id:'CONTRACT',calendar:'C24',duration:0,constraint:{type:'start_on_or_after',date:contractDateIso+'T00:00:00Z'}}],
    relationships:[{pred:'A100',succ:'A200',type:'FS'},{pred:'A200',succ:'M900',type:'FS'},{pred:'M900',succ:'CONTRACT',type:'FS'}]});
  const m900=r.activities.find((a:any)=>a.id==='M900'),marker=r.activities.find((a:any)=>a.id==='CONTRACT');
  return {finishIso:m900.earlyFinish as string,floatHours:m900.freeFloatHours as number,
    lateHours:(Date.parse(marker.earlyStart)-Date.parse(contractDateIso+'T00:00:00Z'))/3600000};
}

test('F44 pending EOT scenario: CMeng CPM finish, float and days late equal the independent solver',()=>{
  const s=pendingEotScenario({model:contractTimeModel('F44-UNIT'),cpmPublishable:true,governingCompletionIso:EXTENDED_COMPLETION,pendingCount:2,pendingAssessedDays:21,ldTerms})!;
  assert.equal(s.method,'cmeng_cpm');
  assert.equal(s.scenarioContractCompletionIso,SCENARIO_DATE,'21 Sep 2027 + 21 calendar days');
  const ind=independent(SCENARIO_DATE),now=independent(EXTENDED_COMPLETION);
  assert.equal(s.cpmCompletionIso,ind.finishIso.slice(0,10));
  assert.equal(s.cpmCompletionIso,PROGRAMME_FINISH);
  assert.equal(s.completionFloatHoursAgainstScenario,ind.floatHours,'CPM completion float against the scenario date');
  assert.equal(s.completionFloatHoursAgainstScenario,144);
  assert.equal(s.scenarioDaysLate,-6);assert.equal(-s.scenarioDaysLate!*24,ind.floatHours);
  assert.equal(s.currentDaysLate,15);assert.equal(s.currentDaysLate!*24,now.lateHours);
  assert.deepEqual(s.completionActivityIds,['A200','M900']);
  assert.equal(s.delayDamages.state,'calculated');
  assert.equal(s.delayDamages.currency,'USD');
  assert.equal(s.delayDamages.currentAmount,150000,'15 days x USD 10,000');
  assert.equal(s.delayDamages.scenarioAmount,0,'no days late against the scenario date');
  assert.equal(s.delayDamages.effectAmount,150000);
});

test('F44 a scenario that is still late keeps the CPM float negative and the remaining damages',()=>{
  const s=pendingEotScenario({model:contractTimeModel('F44-LATE'),cpmPublishable:true,governingCompletionIso:EXTENDED_COMPLETION,pendingCount:1,pendingAssessedDays:5,ldTerms})!;
  const ind=independent('2027-09-26');
  assert.equal(s.scenarioContractCompletionIso,'2027-09-26');
  assert.equal(s.scenarioDaysLate,10);assert.equal(s.scenarioDaysLate!*24,ind.lateHours);
  assert.equal(s.completionFloatHoursAgainstScenario,-240);
  assert.equal(s.delayDamages.scenarioAmount,100000);assert.equal(s.delayDamages.effectAmount,50000);
});

test('F44 date arithmetic only as the labelled fallback; unknown inputs stay unknown',()=>{
  const fallback=pendingEotScenario({model:contractTimeModel('F44-FALLBACK'),cpmPublishable:false,governingCompletionIso:EXTENDED_COMPLETION,pendingCount:2,pendingAssessedDays:21,ldTerms})!;
  assert.equal(fallback.method,'date_arithmetic_fallback');
  assert.equal(fallback.scenarioContractCompletionIso,SCENARIO_DATE);
  assert.equal(fallback.cpmCompletionIso,null);assert.equal(fallback.scenarioDaysLate,null);assert.equal(fallback.delayDamages.effectAmount,null);
  assert.match(fallback.basis,/^Date arithmetic only/);
  const unknown=pendingEotScenario({model:contractTimeModel('F44-UNKNOWN'),cpmPublishable:true,governingCompletionIso:EXTENDED_COMPLETION,pendingCount:2,pendingAssessedDays:null,ldTerms})!;
  assert.equal(unknown.method,'unavailable');assert.equal(unknown.scenarioContractCompletionIso,null);
  assert.equal(pendingEotScenario({model:null,cpmPublishable:false,governingCompletionIso:EXTENDED_COMPLETION,pendingCount:0,pendingAssessedDays:null,ldTerms}),null);
});

test('F44 every page carries the CPM pending EOT scenario and the EOT page shows it',()=>{
  const projectId=contractTimeProject({claims:PENDING_CLAIMS});
  for(const key of ['eot-assessment','master-dashboard','pmo-analysis']){
    const pipeline=(moduleForProject(projectId,key).data as any).projectFacts.claims.pipeline;
    assert.equal(pipeline.pendingCount,2,key);assert.equal(pipeline.pendingAssessedDays,21,key);
    assert.equal(pipeline.pendingScenarioCompletionIso,SCENARIO_DATE,key);
    const s=pipeline.pendingEotScenario;
    assert.equal(s.method,'cmeng_cpm',key);
    assert.equal(s.governingCompletionIso,EXTENDED_COMPLETION,key);
    assert.equal(s.cpmCompletionIso,PROGRAMME_FINISH,key);
    assert.equal(s.scenarioDaysLate,-6,key);assert.equal(s.currentDaysLate,15,key);
    assert.equal(s.delayDamages.effectAmount,150000,key);
  }
  const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const ast=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
  const fn=ast.statements.filter(isFunctionDeclaration).filter(n=>['renderPendingEotScenario'].includes(n.name?.text??'')).map(n=>n.getText(ast)).join('\n');
  const show=(p:unknown)=>String(runInNewContext(fn+';renderPendingEotScenario(p)',{countText,p,escapeHtml:String,fmt:(v:unknown)=>String(v),planningShortDate:(v:unknown)=>String(v).slice(0,10)}));
  const pipeline=(moduleForProject(projectId,'eot-assessment').data as any).projectFacts.claims.pipeline;
  const html=show(pipeline);
  assert.match(html,/Pending EOT scenario \(CMeng CPM\)/);
  assert.match(html,/contract completion moves to <b>2027-10-12<\/b>/);
  assert.match(html,/CMeng CPM finish 2027-10-06 is then 6 days early \(completion float 144 h\)/);
  assert.match(html,/against 15 days late on 2027-09-21 today/);
  assert.match(html,/USD 150000 now, USD 0 in the scenario, a reduction of USD 150000/);
  const labelled=show({...pipeline,pendingEotScenario:{...pipeline.pendingEotScenario,method:'date_arithmetic_fallback'}});
  assert.match(labelled,/Date arithmetic only: the CMeng CPM forecast is not publishable/);
  assert.doesNotMatch(labelled,/CMeng CPM finish/);
});
