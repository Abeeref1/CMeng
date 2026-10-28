import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {HseReportSummary} from '../packages/runtime-api/src/hse-report-evidence';
import {parseHseStatisticsTable,parseHseSummary,hseReportPosition,hseRateDecisionInput} from '../packages/runtime-api/src/hse-report-evidence';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {buildForecastReconciliationGate} from '../packages/runtime-api/src/forecast-control';

test('retained REEM PDF monthly table reconciles cumulative hours and all recordable incident types',()=>{
 const source=JSON.parse(readFileSync('tests/fixtures/reem-112-hse-native.json','utf8'));
 const summary=parseHseStatisticsTable(source.text,source.sourceHash,source.documentId)!;
 assert.equal(summary.periods!.length,24);assert.equal(summary.periodEndIso,'2026-08-31');
 assert.equal(summary.metrics.manHours,831000);assert.equal(summary.metrics.lostTimeInjuries,1);
 assert.equal(summary.metrics.medicalTreatmentCases,5);assert.equal(summary.metrics.restrictedWorkCases,1);
 assert.equal(summary.metrics.firstAidCases,21);assert.equal(summary.metrics.nearMisses,57);
 assert.equal(summary.monthlyMetrics!.manHours,11720);assert.equal(summary.metrics.trir,1.68);
 const state=loadCertifiedDemoProject('HSE-PDF-REPAIR');state.evidenceDocuments=[{documentId:source.documentId,documentType:'hse_report',basisState:'active',sourceHashSha256:source.sourceHash,
   hseSummary:{producerVersion:'hse-summary-v2',periodEndIso:null,metrics:{manHours:null}},fullTextRead:{sourceHashSha256:source.sourceHash,result:{complete:true,failedPages:0,unresolvedPages:0,pages:[{text:source.text}]}}} as any];state.version++;
 const position=hseReportPosition(state,'2026-08-31');
 assert.equal(position.metrics.manHours,831000);assert.equal(position.rates.basisEstablished,true);
 assert.equal(Number(position.rates.calculatedTrir!.toFixed(2)),1.68);assert.equal(Number(position.rates.calculatedLtifr!.toFixed(2)),1.2);
 assert.equal(position.diagnostics.includes('HSE_TRIR_RECONCILIATION_REQUIRED'),false);
 assert.equal(hseReportPosition(state,'2026-07-31').metrics.manHours,819280);
 assert.equal(state.evidenceDocuments[0]!.hseSummary!.periodEndIso,null,'do not rewrite retained imported evidence');
});

test('a partial exposure extract does not invent cumulative incident counts',()=>{
 const header='Month Exposure hrs (month) Exposure hrs (cumulative) LTI MTC RWC First aid Near miss LTIFR (cum) TRIR (cum)';
 const summary=parseHseStatisticsTable(header+'\nJan 2033 1200 5000 0 1 0 2 4 0 40','x','page:1')!;
 assert.equal(summary.metrics.manHours,5000);assert.equal(summary.monthlyMetrics!.medicalTreatmentCases,1);
 assert.equal(summary.metrics.medicalTreatmentCases,null);assert.ok(summary.diagnostics.includes('HSE_CUMULATIVE_CASE_POPULATION_INCOMPLETE'));
 assert.equal(parseHseStatisticsTable('Jan 2033 1200 5000 0 1 0 2 4 0 40','x','page:1'),null);
});

test('applied source constraints keep the calculated forecast usable; unapplied constraints qualify it (P0-B: never erase it)',()=>{
 const forecast:any={independentForecastCompletionIso:'2033-12-31',activityCoveragePercent:100,calculatedActivityCount:1,unresolvedActivityCount:0,
  diagnostics:['SOURCE_CONSTRAINTS_APPLIED:1'],activities:[{activityId:'A',calendarMode:'source_calendar',status:'calculated',finishVarianceDays:42}]};
 const model:any={activities:[{activityId:'A',sourceConstraints:[{type:'finish_on_or_before',dateIso:'2033-12-31'}]}]};
 const gate=buildForecastReconciliationGate({forecast,model,requiredFinishIso:null});
 assert.equal(gate.usable,true);assert.equal(gate.publishable,false);assert.equal(gate.managementForecastCompletionIso,'2033-12-31');
 assert.equal(gate.checks.find(c=>c.key==='source_constraints')!.state,'passed');
 const unapplied=buildForecastReconciliationGate({forecast:{...forecast,diagnostics:[]},model,requiredFinishIso:null});
 assert.equal(unapplied.managementForecastCompletionIso,'2033-12-31','an unapplied constraint qualifies the finish; it does not erase it');
 assert.equal(unapplied.checks.find(c=>c.key==='source_constraints')!.state,'review_required');
 assert.ok(unapplied.managementForecast.qualifications.some(q=>q.code==='constraints_not_applied'&&q.action));
});


test('HSE reported-period totals, incomplete case counts and source-bound rate reviews remain distinct',()=>{
 const state=loadCertifiedDemoProject('HSE-SOURCE-REVIEW'),text='Report date: 2026-09-30\nMan hours: 10250000\nLost Time Injuries: 1\nMedical Treatment Cases: 5\nFirst Aid Cases: 21\nNear Misses: 74\nTRIR: 0.29\nLTIFR: 0.1';
 const summary=parseHseSummary(text,'hse-hash','source:summary');
 state.evidenceDocuments=[{documentId:'hse',documentType:'hse_report',basisState:'active',sourceHashSha256:'hse-hash',hseSummary:summary} as any];state.version++;
 const before=JSON.stringify(state.evidenceDocuments),p=hseReportPosition(state,'2026-09-30');
 assert.equal(p.reportedPeriodRows[0]!.firstAidCases,21);assert.equal(p.reportedPeriodRows[0]!.nearMisses,74);assert.equal(p.monthlyRows.length,0);
 assert.match(p.reportedPeriodRows[0]!.basis,/basis unconfirmed/);assert.equal(p.rates.restrictedWorkCases,null);assert.equal(p.rates.recordablePopulationComplete,false);assert.match(p.rates.comparisons[0]!.comparisonBasis,/Minimum/);assert.equal(p.rates.calculatedTrir,null);
 assert.equal(p.review.required,true);assert.equal(p.reportingRates.trir,0.29);
 const reviewed=hseRateDecisionInput({choice:'confirm_rates',reference:'HSE-REVIEW-1',reviewedRates:{trir:0.59,trirBasisHours:1000000,ltifr:0.1,ltifrBasisHours:1000000}});
 state.controls.reviewDecisions={'hse-rate-basis':{...reviewed,choice:'confirm_rates',sourceFingerprint:p.review.sourceFingerprint,confirmedAt:'2026-10-01',sourceRefs:p.sourceRefs}};state.version++;
 const chosen=hseReportPosition(state,'2026-09-30');assert.equal(chosen.reportingRates.trir,0.59);assert.equal(chosen.rates.reportedRates.trir,0.29);assert.equal(chosen.metrics.trir,0.29);assert.match(chosen.review.basis,/User-confirmed/);
 assert.equal(JSON.stringify(state.evidenceDocuments),before);assert.equal(hseReportPosition(state,'2026-10-31').review.decision,null,'changed reporting date invalidates the review');
 state.evidenceDocuments[0]!.sourceHashSha256='new-hse-hash';state.version++;assert.equal(hseReportPosition(state,'2026-09-30').review.decision,null,'changed source hash invalidates the review');
 assert.equal(parseHseSummary(text+'\nRestricted Work Cases: 2','x','source').metrics.restrictedWorkCases,2);
});

test('HSE review validates rates, exposure bases and a supporting reference without inventing missing rates',()=>{
 assert.throws(()=>hseRateDecisionInput({choice:'keep_reported',reference:''}),/reference/);
 for(const rates of [{trir:-1,trirBasisHours:200000},{trir:'bad',trirBasisHours:200000},{trir:0.3,trirBasisHours:0},{trir:0.3},{trirBasisHours:200000},{}])assert.throws(()=>hseRateDecisionInput({choice:'confirm_rates',reference:'R1',reviewedRates:rates}));
 assert.deepEqual(hseRateDecisionInput({choice:'confirm_rates',reference:'R1',reviewedRates:{trir:0,trirBasisHours:200000}}),{reference:'R1',reviewedRates:{trir:0,trirBasisHours:200000,ltifr:null,ltifrBasisHours:null}});
 assert.deepEqual(hseRateDecisionInput({choice:'keep_reported',reference:'R1'}),{reference:'R1'});
});

test('rate reconciliation uses the explicit source basis and checks LTIFR independently',()=>{
 const state=loadCertifiedDemoProject('HSE-BASIS');
 const summary:HseReportSummary={producerVersion:'hse-summary-v4',sourceHashSha256:'rates',periodEndIso:'2026-09-30',metrics:{manHours:1000000,lostTimeInjuries:1,medicalTreatmentCases:1,restrictedWorkCases:0,trir:2,ltifr:0.1},rateBasisHours:{trir:200000,ltifr:1000000},sourceRefs:['source:rates'],diagnostics:[]};
 state.evidenceDocuments=[{documentId:'rates',sourceHashSha256:'rates',documentType:'hse_report',basisState:'active',hseSummary:summary} as any];state.version++;
 let p=hseReportPosition(state,'2026-09-30');
 assert.ok(Math.abs(p.rates.calculatedTrir!-0.4)<1e-12);assert.equal(p.rates.calculatedLtifr,1);assert.equal(p.review.required,true);
 assert.ok(p.diagnostics.includes('HSE_TRIR_RECONCILIATION_REQUIRED'));assert.ok(p.diagnostics.includes('HSE_LTIFR_RECONCILIATION_REQUIRED'));
 summary.metrics.trir=0.4;state.version++;p=hseReportPosition(state,'2026-09-30');
 assert.equal(p.diagnostics.includes('HSE_TRIR_RECONCILIATION_REQUIRED'),false);assert.equal(p.review.required,true);
 summary.metrics.ltifr=1;state.version++;p=hseReportPosition(state,'2026-09-30');assert.equal(p.review.required,false);
});
