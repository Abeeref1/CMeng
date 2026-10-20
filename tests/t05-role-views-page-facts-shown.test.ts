import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from './browser-context';

// SW-05 and SW-08. Role views are built by the shipped browser renderer from
// the project facts the opened page already holds. The separate overview role
// summary is only a fallback and is empty until its caches are warm.
const fact=(value:unknown,basis='Accepted source')=>({value,basis,state:value===null?'missing':'confirmed'});
// The overview role summary as it is published before its action and fact
// caches are warm: no decisions, no currency rows, no metrics.
const coldOverview={roleLensContext:{planning:{criticalCount:null},controls:{},projectDirector:{actions:[]},programDirector:{},
  executive:{contractualCompletionIso:null,submittedCompletionIso:null,forecastCompletionIso:null,metrics:[],commercialByCurrency:[],decisions:[]}}};
const pageFacts=(currencies:unknown[])=>({
  time:{contractualCompletionIso:fact('2031-10-01'),extendedContractCompletionIso:fact('2031-11-01'),awardedEotDays:fact(31)},
  schedule:{submittedProgrammeCompletionIso:fact('2031-11-15'),criticalActivityCount:fact(147),nearCriticalActivityCount:fact(22),negativeFloatActivityCount:fact(12)},
  actions:{openCount:fact(9)},
  commercial:{currencies},
});
const executive=(data:unknown)=>String(runInNewContext('experienceRoleLensContext("executive",data)',{data,overview:coldOverview}));

test('SW-05 executive role view uses the page action register and facts, not the empty overview summary',()=>{
  const action={issue:'Approve recovery funding for package 4',owner:'Project Director',dueIso:'2031-09-03',sourceDueIso:'2031-08-20',sourceOverdueDays:14,authority:'Client',organisation:'Main contractor'};
  const withRegister={projectFacts:pageFacts([]),projectDiagnosis:{actionRegister:{total:9,actions:[action]}}};
  const html=executive(withRegister);
  assert.match(html,/Decisions requiring ownership/,'the held action register is placed as decisions');
  assert.match(html,/Approve recovery funding for package 4/);
  assert.match(html,/Project Director/);
  // Confirmed dates come from the page facts.
  assert.match(html,/Contractual completion<\/span><strong>[^<]*2031/);
  // N5: the executive tile shows the governing contract date (Oct 1), the same
  // as the overall view, and the date with awarded EOT under its own label.
  assert.match(html,/Contractual completion<\/span><strong>[^<]*Oct[^<]*1, 2031/);
  assert.match(html,/Contract including awarded EOT<\/span><strong>[^<]*Nov[^<]*1, 2031/);
  // No currency rows is an unestablished commercial position, never "0 positions".
  assert.match(html,/Currency positions<\/span><strong class="unavailable">Not established/);
  assert.doesNotMatch(html,/Currency positions<\/span><strong>0</);

  // A page that holds only the confirmed open-action count states that count
  // instead of showing an empty decision area.
  const countOnly=executive({projectFacts:pageFacts([])});
  assert.match(countOnly,/9 open management actions are recorded/);

  // A warm overview summary that already carries decisions is not replaced.
  const warm={...coldOverview,roleLensContext:{...coldOverview.roleLensContext,executive:{...coldOverview.roleLensContext.executive,decisions:[{description:'Overview decision',accountableOwner:'PD',state:'open'}]}}};
  const warmHtml=String(runInNewContext('experienceRoleLensContext("executive",data)',{data:withRegister,overview:warm}));
  assert.match(warmHtml,/Overview decision/);
  assert.doesNotMatch(warmHtml,/Approve recovery funding/);
});

test('SW-08 executive role view places held contract values, awarded EOT and the forecast',()=>{
  const currencies=[
    {currency:'AED',originalContractValue:fact(120000000,'Signed contract sum'),currentContractValue:fact(125500000,'Original contract value plus approved variations only.')},
    {currency:'USD',originalContractValue:fact(4000000,'Signed contract sum'),currentContractValue:fact(null,'Original contract value plus approved variations only.')},
  ];
  const html=executive({projectFacts:pageFacts(currencies),completionPosition:{independentFinishIso:'2031-12-20'}});
  // Each currency on its own row; never summed across currencies.
  assert.match(html,/<td>Original contract value · AED<\/td><td>120000000<\/td><td>AED<\/td>/);
  assert.match(html,/<td>Current contract value · AED<\/td><td>125500000<\/td><td>AED<\/td>/);
  assert.match(html,/<td>Original contract value · USD<\/td><td>4000000<\/td><td>USD<\/td>/);
  // Unknown stays unknown.
  assert.match(html,/<td>Current contract value · USD<\/td><td>Not established<\/td>/);
  assert.doesNotMatch(html,/129500000|124000000/,'currencies are never added together');
  assert.match(html,/<td>Awarded EOT<\/td><td>31<\/td><td>d<\/td>/);
  assert.match(html,/<td>Negative-float activities<\/td><td>12<\/td>/);
  // The forecast row was cut by a fixed six-row cap although the page held it.
  assert.match(html,/<td>CMeng forecast \/ recalculation<\/td><td>2031-12-20<\/td>/);
  assert.match(html,/Currency positions<\/span><strong>2</);
});
