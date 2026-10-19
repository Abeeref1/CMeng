import {runInNewContext} from './browser-context';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';

import {contractTaxBasis,dateAdditionBasisLabel,likeForLikeCertifiedRatio,registerAboveContractQueries,sumBasisLabel} from '../packages/runtime-api/src/commercial-sum-basis';
import {assessEventNotice} from '../packages/delay-analysis-core/src/notices';
import {sourceCommercialEvidence} from '../packages/runtime-api/src/source-commercial-evidence';
import {buildRegisterChecks} from '../packages/runtime-api/src/project-decision-facts';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {buildProgressScurveProjection} from '../packages/progress-scurve/src';
import {buildProgressReportProjection} from '../packages/progress-report/src';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

// ---- F36: certified work / contract is like for like ----

function evidenceInput(contractTax:string,certificateTax:string){
  const state:any={evidenceDocuments:[],controls:{bonds:[]}};
  const ledger:any={payments:[],bonds:[],costPosition:[{currency:'SAR',taxBasis:contractTax,asOf:'2027-03-31',values:{'original contract value':200_000_000},receipts:[{documentId:'COST',locator:'row:1'}]}]};
  const position:any={
    currencies:[{currency:'SAR',originalContractValue:{value:200_000_000},currentContractValue:{value:250_000_000}}],
    certificateProfile:{groups:[{currency:'SAR',taxBasis:certificateTax,certifiedTotals:{grossWork:50_000_000},certifiedCount:12,sourceRefs:['IPC']}]},
  };
  return {state,ledger,position};
}

test('F36: certified progress divides certified gross work by the original contract, not the current contract',()=>{
  const {state,ledger,position}=evidenceInput('exclusive','exclusive');
  const result:any=sourceCommercialEvidence(state,ledger,position,'2027-03-31');
  const row=result.heldEvidence.certifiedProgress.rows[0];
  // Before: 50M / 250M current contract = 20%. Gross work excludes variations, so the like-for-like base is the 200M original.
  assert.equal(row.valuePercent,25);
  assert.equal(row.contractValue,200_000_000);
  assert.equal(row.contractValueBasis,'original_contract');
  assert.match(row.basis,/divided by the same-currency original contract value on the same tax basis/);
  assert.match(row.basis,/Basis: 12 dated issued certificates · currency SAR · tax basis exclusive of tax · as of 2027-03-31/);
  assert.deepEqual(result.originalContractTaxBases[0],{currency:'SAR',value:'exclusive',state:'source',sourceRefs:['evidence-document:COST:row:1'],reason:null});
});

test('F36: a stated but different tax basis leaves the ratio not established',()=>{
  for(const [contractTax,certificateTax,reason] of [
    ['inclusive','exclusive',/Certificates are exclusive of tax but the original contract value is inclusive/],
    ['exclusive','unknown',/Certificate tax basis is not stated/],
  ] as const){
    const {state,ledger,position}=evidenceInput(contractTax,certificateTax);
    const result:any=sourceCommercialEvidence(state,ledger,position,'2027-03-31');
    assert.deepEqual(result.heldEvidence.certifiedProgress.rows,[],contractTax+'/'+certificateTax);
    assert.equal(result.heldEvidence.certifiedProgress.state,'not_calculable');
    assert.match(result.heldEvidence.certifiedProgress.notEstablished[0].reason,reason);
    assert.match(result.heldEvidence.certifiedProgress.missingInputs[0],reason);
  }
});

test('F36: a contract value that states no tax basis gives the ratio as a query, value kept',()=>{
  const {state,ledger,position}=evidenceInput('unknown','exclusive');
  const result:any=sourceCommercialEvidence(state,ledger,position,'2027-03-31');
  const row=result.heldEvidence.certifiedProgress.rows[0];
  assert.equal(row.valuePercent,25);
  assert.equal(row.state,'queried');
  assert.equal(row.query,'The contract value does not state whether it includes tax; the ratio assumes the same basis as the certificates.');
  assert.match(row.basis,/tax basis exclusive of tax \(certificates; contract value basis not stated\)/);
  assert.equal(result.heldEvidence.certifiedProgress.state,'calculated');
  const stated=evidenceInput('exclusive','exclusive');
  const established:any=sourceCommercialEvidence(stated.state,stated.ledger,stated.position,'2027-03-31');
  assert.equal(established.heldEvidence.certifiedProgress.rows[0].state,'established');
  assert.equal(established.heldEvidence.certifiedProgress.rows[0].query,null);
});

test('F36: conflicting stated contract tax bases leave the ratio not established',()=>{
  const ev=(taxBasis:string,ref:string)=>({currency:'SAR',amount:200,taxBasis,sourceRefs:[ref]});
  const r=likeForLikeCertifiedRatio({currency:'SAR',certifiedGrossWork:50,certificateTaxBasis:'exclusive',originalContract:200,contractTax:contractTaxBasis([ev('exclusive','a'),ev('inclusive','b')],'SAR',200)});
  assert.equal(r.state,'not_established');
  assert.equal(r.valuePercent,null);
  assert.match(r.reason!,/different tax bases/);
});

test('F36: contract tax basis comes only from a source that states it for the same amount',()=>{
  const ev=(amount:number,taxBasis:string,ref:string)=>({currency:'SAR',amount,taxBasis,sourceRefs:[ref]});
  assert.equal(contractTaxBasis([ev(200,'exclusive','a')],'SAR',200).value,'exclusive');
  assert.equal(contractTaxBasis([ev(201,'exclusive','a')],'SAR',200).state,'not_stated','a different amount is not this contract value');
  assert.equal(contractTaxBasis([ev(200,'exclusive','a'),ev(200,'inclusive','b')],'SAR',200).state,'conflicted');
  assert.equal(contractTaxBasis([ev(200,'exclusive','a')],'SAR',null).state,'not_established');
  const r=likeForLikeCertifiedRatio({currency:'SAR',certifiedGrossWork:null,certificateTaxBasis:'exclusive',originalContract:200,contractTax:contractTaxBasis([ev(200,'exclusive','a')],'SAR',200)});
  assert.equal(r.valuePercent,null,'unknown certified work is never 0%');
  assert.equal(r.state,'not_established');
});

// ---- F37: package register value above the contract sum is queried ----

test('F37: a package register subtotal above the current contract sum becomes a dashboard query',()=>{
  const commercial={currencies:[{currency:'SAR',currentContractValue:{value:221_780_000,state:'established'}}]};
  const checks=buildRegisterChecks(commercial,{},null,[
    {currency:'SAR',amount:200_000_000,sourceRefs:['pkg:1'],recordId:'P1'},
    {currency:'SAR',amount:92_500_000,sourceRefs:['pkg:2'],recordId:'P2'},
  ]);
  const queries=registerAboveContractQueries(checks.checkedRows.filter((r:any)=>String(r.register).startsWith('Procurement package register')));
  assert.equal(queries.length,1);
  assert.equal(queries[0]!.excess,70_720_000);
  assert.match(queries[0]!.text,/Procurement package register · sourced subtotal \(2 records\) totals 292,500,000 SAR, above the current contract sum 221,780,000 SAR by 70,720,000 SAR; reconcile/);
  const within=buildRegisterChecks(commercial,{},null,[{currency:'SAR',amount:100,sourceRefs:['pkg:1'],recordId:'P1'}]);
  assert.deepEqual(registerAboveContractQueries(within.checkedRows),[],'no query without an excess');
});

const html=cmengUatHtml();
const script=html.match(/<script>([\s\S]*?)<\/script>/)![1]!;
const source=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
function functions(names:string[]){
  return source.statements.filter(isFunctionDeclaration).filter(node=>node.name&&names.includes(node.name.text)).map(node=>node.getText(source)).join('\n');
}

test('F37: the Dashboard cost tile shows the like-for-like comparison, omission queries and the package query',()=>{
  const data:any={
    metrics:[
      {key:'contract-finish',value:null},{key:'submitted-programme-finish',value:null},{key:'independent-forecast-finish',value:null},
      {key:'submitted-vs-contract',value:null},{key:'independent-vs-contract',value:null},{key:'progress-position',value:null},{key:'schedule-spi',value:null},
    ],
    visualControl:{
      progress:{scopeComparison:null,progressBases:null},
      commercial:{
        positions:[{currency:'SAR',originalContractValue:{value:210_000_000,state:'established'},currentContractValue:{value:221_780_000,state:'candidate'}}],
        cost:[{currency:'SAR',bac:210_000_000,bestEac:218_410_000,bestEacBasis:'source_reported',currentContractValue:221_780_000,eacAboveCurrentContract:-3_370_000,
          eacComparisonState:'queried',eacComparisonQueries:['2 omission-labelled approved variations (VO-011, VO-014) carry a sign that is not confirmed; confirm before treating any as a saving or an addition.'],
          currentContractComparisonBasis:'Compares source-reported EAC with the current approved contract (original contract plus approved variations), not the original budget.'}],
        registerQueries:[{currency:'SAR',register:'Procurement package register · sourced subtotal',excess:70_720_000,text:'Procurement package register · sourced subtotal totals 292,500,000 SAR, above the current contract sum.'}],
      },
      sourceInventory:{domains:[]},claims:{},boqScope:{candidateLongLeadCount:null}
    },
    delivery:{sourceAvailability:{}},operationalReporting:{counts:{}},sourceInterpretation:{hse:{metrics:{}}},variationReconciliation:[],reportingContract:{dataDateIso:'2027-03-31'}
  };
  const code=functions(['pmcDefined','pmcFirst','pmcMetric','pmcSource','pmcMoney','pmcDays','pmcCard','pmcSourceValue','renderPmcControlRoom']);
  const output=runInNewContext(code+';renderPmcControlRoom(data)',{
    data,fmtExecutive:(value:any)=>String(value),fmt:(value:any)=>value==null?'Unresolved':String(value),
    planningShortDate:(value:any)=>value==null?'Unresolved':String(value),
    managementModuleLink:(key:string,label:string)=>'<button data-module="'+key+'">'+label+'</button>',
    escapeHtml:(value:any)=>String(value??''),overview:{latestDataDateIso:'2027-03-31'}
  });
  assert.match(output,/EAC below current contract/);
  assert.doesNotMatch(output,/above original budget/);
  assert.match(output,/Comparison queried/);
  assert.match(output,/not the original budget/);
  assert.match(output,/VO-011, VO-014/);
  assert.match(output,/292,500,000 SAR, above the current contract sum/);
});

// ---- F27: day, date and hour sums use the same shared basis label ----

test('F27: non-money sums show records and date only; money sums keep currency and tax',()=>{
  assert.equal(sumBasisLabel({records:'12 approved weekly usage periods',asOf:'2027-03-31'}),'Basis: 12 approved weekly usage periods · as of 2027-03-31');
  assert.equal(sumBasisLabel({records:'x',currency:null,taxBasis:null,asOf:null}),'Basis: x · currency not established · tax basis not established · as of not established');
});

test('F27: a date addition states the start date and the exact days added',()=>{
  assert.equal(dateAdditionBasisLabel({label:'contract completion',startIso:'2027-01-31',resultIso:'2027-09-21',asOf:'2026-08-31'}),
    'Basis: contract completion 2027-01-31 + 233 calendar days of awarded EOT · as of 2026-08-31');
  assert.equal(dateAdditionBasisLabel({label:'contract completion',startIso:null,resultIso:'2027-09-21',asOf:null}),
    'Basis: contract completion not established + awarded EOT days not established · as of not established');
});

test('F27: elapsed notice days carry the dated trigger they count from',()=>{
  const event:any={eventId:'CLM-003-EV',category:'late_access',startIso:'2026-01-01',awarenessIso:'2026-01-05'};
  const rule:any={requirementId:'R-20.1',noticeKind:'claim_notice',eventCategories:[],noticePeriodDays:28,effectiveFromIso:null,effectiveToIso:null,triggerBasis:'awareness',state:'official',clauseIdentifiers:[],evidenceRefs:[]};
  const notice:any={noticeId:'N-3',kind:'claim_notice',eventId:'CLM-003-EV',claimId:null,actualIssuedAt:'2026-02-18',actualReceivedAt:null,plannedAt:null,subject:null,clauseIdentifiers:[],evidenceRefs:[],diagnostics:[]};
  const a=assessEventNotice(event,[notice],[rule]);
  assert.equal(a.elapsedDays,44);
  assert.equal(a.elapsedFromIso,'2026-01-05');
  assert.equal(a.elapsedFromBasis,'awareness');
  const b=assessEventNotice(event,[notice],[{...rule,triggerBasis:'event_start'}]);
  assert.equal(b.elapsedDays,48);
  assert.equal(b.elapsedFromIso,'2026-01-01');
  assert.equal(b.elapsedFromBasis,'event_start');
});

test('F27: notice days, actual hours and commercial sums on the page go through the one shared label',()=>{
  assert.equal((script.match(/sumBasisLabel\(\{records:"notice "/g)||[]).length,2,'both notice-day tables');
  assert.match(script,/"Actual labor hours"[^\n]*sumBasisLabel\(\{records:p\.actualHoursBasis==="programme_recorded"\?"programme-recorded \(P6 actual hours\)[^\n]*:weekly\?/);
  assert.match(script,/function sumBasisLabel\(/);
});

// Schedule fixture copied verbatim from tests/batch-d-completion.test.ts (not exported there).
const calendar:any={calendarId:'C1',name:'5d',semanticComplete:true,weeklyWorkIntervals:[{dayIndex:1,intervals:[{start:'08:00',finish:'16:00',minutes:480}]}],sourceRefs:[]};
function schedule():CanonicalScheduleModel{return {projectId:'D',source:'schedule_xlsx',sourceRevisionId:'R1',dataDateIso:'2030-01-05',calendars:[calendar],wbs:[],relationships:[],diagnostics:[],activities:[{projectId:'D',activityId:'A1',nativeId:'1',name:'Work',wbsId:null,calendarId:'C1',activityType:'task',status:'in_progress',baselineStartIso:'2030-01-01',baselineFinishIso:'2030-01-10',currentStartIso:'2030-01-01',currentFinishIso:'2030-01-12',actualStartIso:'2030-01-01',actualFinishIso:null,forecastStartIso:'2030-01-01',forecastFinishIso:'2030-01-12',originalDurationHours:80,remainingDurationHours:40,totalFloatHours:8,freeFloatHours:null,percentComplete:25,sourceRefs:[],diagnostics:[]}]};}

test('F36: the Progress report keeps a queried certified value and carries its query to the headline',()=>{
 const model=schedule();
 const scurve=buildProgressScurveProjection(model,{generatedAt:'2030-01-05',producerVersion:'D'});
 const dummy:any={producerVersion:'x',projectId:'D',sourceRevisionId:'R1',result:{projectId:'D',sourceRevisionId:'R1',dataDateIso:'2030-01-05',population:{sourceActivityCount:1,executableActivityCount:1,excludedActivityCount:0,excludedByType:{wbsSummaryCount:0,levelOfEffortCount:0,otherExcludedCount:0},basis:'execution_control_population'},activityCount:1,relationshipCount:0,graph:{complete:true,openStartActivityIds:[],openFinishActivityIds:[]},float:{criticalCount:0,nearCriticalCount:0,negativeFloatCount:0,coveragePercent:100},status:{completed:0,inProgress:1,notStarted:0,unknown:0},progress:{durationWeightedPercentComplete:{value:25,coveragePercent:100}},diagnostics:[]}};
 const milestones:any={producerVersion:'m',projectId:'D',sourceRevisionId:'R1',milestoneCount:0,completedCount:0,openCount:0,lateOpenCount:0};
 const look:any={producerVersion:'l',projectId:'D',sourceRevisionId:'R1',windowDays:42,incompleteActivityCount:1,datedIncompleteActivityCount:1,currentDateCoveragePercent:100,overdueCount:0};
 const forecast:any={producerVersion:'f',projectId:'D',sourceRevisionId:'R1',sourceForecastCompletionIso:null,independentForecastCompletionIso:null,forecastVarianceDays:null,origin:'unresolved',complete:false,activityCoveragePercent:null,diagnostics:[]};
 const query='The contract value does not state whether it includes tax; the ratio assumes the same basis as the certificates.';
 const p=buildProgressReportProjection({generatedAt:'2030-01-05',producerVersion:'D',scheduleAnalytics:dummy,milestones,lookAhead:look,progressScurve:scurve,independentForecast:forecast,
  progressEvidence:{certified:{valuePercent:30,sourceRefs:['ipc'],asOfIso:'2030-01-05',basis:'Certified gross work divided by the original contract value.',query}}});
 assert.equal(p.progressBases.certified.valuePercent,30,'the value is kept');
 assert.equal(p.progressBases.certified.query,query);
 assert.equal(p.progressBases.certified.basis,'Certified gross work divided by the original contract value.');
 assert.equal(p.headlineProgress.key,'certified');
 assert.match(p.headlineProgress.basis,/Query: The contract value does not state whether it includes tax/);
 const plain=buildProgressReportProjection({generatedAt:'2030-01-05',producerVersion:'D',scheduleAnalytics:dummy,milestones,lookAhead:look,progressScurve:scurve,independentForecast:forecast,
  progressEvidence:{certified:{valuePercent:30,sourceRefs:['ipc'],asOfIso:'2030-01-05'}}});
 assert.equal(plain.progressBases.certified.query,undefined);
 assert.doesNotMatch(plain.headlineProgress.basis,/Query:/);
 // The Progress page line names the query next to the value.
 assert.match(script,/x\[1\]\.query\?" · queried":""/);
 assert.match(script,/x\[1\]\.query\?"Query: "\+x\[1\]\.query:"separate source basis"/);
});
