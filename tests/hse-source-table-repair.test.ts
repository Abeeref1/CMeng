import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHseStatisticsTable,hseReportPosition} from '../packages/runtime-api/src/hse-report-evidence';
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

test('applied source constraints keep the calculated forecast usable while unapplied constraints block it',()=>{
 const forecast:any={independentForecastCompletionIso:'2033-12-31',activityCoveragePercent:100,calculatedActivityCount:1,unresolvedActivityCount:0,
  diagnostics:['SOURCE_CONSTRAINTS_APPLIED:1'],activities:[{activityId:'A',calendarMode:'source_calendar',status:'calculated',finishVarianceDays:42}]};
 const model:any={activities:[{activityId:'A',sourceConstraints:[{type:'finish_on_or_before',dateIso:'2033-12-31'}]}]};
 const gate=buildForecastReconciliationGate({forecast,model,requiredFinishIso:null});
 assert.equal(gate.usable,true);assert.equal(gate.publishable,false);assert.equal(gate.managementForecastCompletionIso,'2033-12-31');
 assert.equal(gate.checks.find(c=>c.key==='source_constraints')!.state,'passed');
 assert.equal(buildForecastReconciliationGate({forecast:{...forecast,diagnostics:[]},model,requiredFinishIso:null}).managementForecastCompletionIso,null);
});
