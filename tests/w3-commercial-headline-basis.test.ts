import test from 'node:test';
import assert from 'node:assert/strict';

import {costHeadlineComparison,paymentDueBasisLabel,sumBasisLabel} from '../packages/runtime-api/src/commercial-sum-basis';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {managementVisualControl} from '../packages/runtime-api/src/management-visual-control';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {buildCommercialFoundation,type CommercialFoundationInput} from '../packages/commercial-foundation/src';
import {buildCommercialPerformance,type CommercialPerformanceInput} from '../packages/commercial-performance/src';

const fact=(value:number|null,state='established',diagnostics:string[]=[])=>({value,state,diagnostics});

function commercialFixture(variationDiagnostics:string[],variationState:string){
  return {
    currencies:[{
      currency:'SAR',
      originalContractValue:fact(210_000_000),
      currentContractValue:fact(221_780_000),
      approvedVariationAmount:fact(11_780_000,variationState,variationDiagnostics),
      pendingVariationAmount:fact(0),
      certifiedUnpaidAmount:fact(null,'missing'),
      retentionDeductedAmount:fact(null,'missing'),
      paidAmount:fact(null,'missing'),
    }],
    performance:{costControl:{positions:[{
      currency:'SAR',taxBasis:'excluding VAT',
      bac:fact(210_000_000),pv:fact(null),ev:fact(null),ac:fact(null),spi:fact(null),cpi:fact(null),cv:fact(null),sv:fact(null),
      sourceEac:fact(218_410_000),calculatedVac:fact(-8_410_000),forecastMethodState:'established',
      eacScenarios:[{method:'source_reported',value:fact(218_410_000)}],
    }]}},
    claimsNotices:{noticeTimelinessCounts:{timely:null,late:null,not_issued:null}},
  } as any;
}

// Module map as in tests/pmc-visual-control-room.test.ts.
function modules(){
  const ids=['A0','A1'];
  return new Map<string,any>([
    ['activity-analytics',{data:{rows:ids.map(activityId=>({activityId,name:activityId,wbsPath:'One workfront',status:'not_started',currentFinishIso:'2031-06-01',totalFloatHours:0}))}}],
    ['independent-forecast',{data:{drivingNetwork:{activityIds:ids,finishActivityIds:ids},activities:ids.map((activityId,i)=>({activityId,independentEarlyFinishIso:'2031-04-01',finishVarianceDays:i}))}}],
    ['milestones',{data:{rows:[{activityId:ids[0],status:'not_started'},{activityId:ids.at(-1),status:'not_started'}]}}],
  ]);
}

test('F37: cost headline compares EAC with the current approved contract, not the original budget',()=>{
  const visual=managementVisualControl(runtimeProjects.getOrCreate('W3-F37-LIKE-FOR-LIKE'),modules(),commercialFixture([],'established'));
  const cost=(visual.commercial.cost as any[])[0];
  // 218.41M EAC is 3.37M below the 221.78M current contract, although it is 8.41M above the original budget.
  assert.equal(cost.eacAboveCurrentContract,-3_370_000);
  assert.equal(cost.eacComparisonState,'established');
  assert.match(cost.currentContractComparisonBasis,/current approved contract \(original contract plus approved variations\), not the original budget/);
  assert.match(cost.currentContractComparisonBasis,/currency SAR · tax basis excluding VAT/);
  assert.deepEqual(cost.eacComparisonQueries,[]);
});

test('F37: omission-labelled variations are queried, not taken as savings',()=>{
  const visual=managementVisualControl(runtimeProjects.getOrCreate('W3-F37-OMISSION-QUERY'),modules(),
    commercialFixture(['OMISSION_SIGN_REVIEW:VO-011','OMISSION_SIGN_REVIEW:VO-014','OMISSION_SIGN_REVIEW:VO-011'],'candidate'));
  const cost=(visual.commercial.cost as any[])[0];
  assert.equal(cost.eacAboveCurrentContract,-3_370_000,'the arithmetic is kept; only its authority changes');
  assert.equal(cost.eacComparisonState,'queried');
  assert.equal(cost.eacComparisonQueries.length,1);
  assert.match(cost.eacComparisonQueries[0],/^2 omission-labelled approved variations \(VO-011, VO-014\)/);
  assert.match(cost.eacComparisonQueries[0],/before treating any as a saving/);
});

test('F37: unknown current contract leaves the comparison not established',()=>{
  const r=costHeadlineComparison({eac:218_410_000,eacBasis:'source_reported',currentContract:fact(null,'missing'),approvedVariation:null,currency:'SAR',taxBasis:'excluding VAT'});
  assert.equal(r.difference,null);
  assert.equal(r.state,'not_established');
});

test('F37: missing tax basis on the forecast is queried',()=>{
  const r=costHeadlineComparison({eac:100,eacBasis:'cmeng_scenario',currentContract:fact(90),approvedVariation:fact(0),currency:'SAR',taxBasis:null});
  assert.equal(r.difference,10);
  assert.equal(r.state,'queried');
  assert.match(r.basis,/CMeng scenario EAC/);
  assert.match(r.basis,/tax basis not established/);
});

test('F27: one shared basis label names records, currency, tax basis and date; unknown stays not established',()=>{
  assert.equal(sumBasisLabel({records:'12 dated certificates',currency:'SAR',taxBasis:'excluding VAT',asOf:'2027-03-31'}),
    'Basis: 12 dated certificates · currency SAR · tax basis excluding VAT · as of 2027-03-31');
  assert.equal(sumBasisLabel({records:'',currency:null,taxBasis:undefined,asOf:' '}),
    'Basis: records not established · currency not established · tax basis not established · as of not established');
});

test('F36: payment due date shows the rule that produced it; unknown period stays not established',()=>{
  assert.equal(paymentDueBasisLabel({value:'2027-04-09',state:'established',basis:{method:'certification_date_plus_contract_payment_period'}},'2027-03-12'),
    'Certificate date 2027-03-12 + 28-day contract payment period');
  assert.equal(paymentDueBasisLabel({value:'2027-04-09',state:'candidate',basis:{method:'certification_date_plus_contract_payment_period'}},'2027-03-12'),
    'Certificate date 2027-03-12 + 28-day contract payment period · period candidate, not approved');
  assert.equal(paymentDueBasisLabel({value:'2027-04-01',state:'established',basis:{method:'explicit_source_due_date'}},'2027-03-12'),'Source due date');
  assert.equal(paymentDueBasisLabel({value:null,state:'missing',basis:{method:'certification_date_plus_contract_payment_period'},action:'Confirm the contract payment period.'},'2027-03-12'),
    'Due date not established: Confirm the contract payment period.');
  assert.equal(paymentDueBasisLabel(null,null),'Due date not established: contract payment period or certificate date not established');
});

test('F36/F37: the browser page embeds the shared due-date rule and uses the shared cost comparison state',()=>{
  const html=cmengUatHtml();
  assert.match(html,/function paymentDueBasisLabel\(/);
  assert.match(html,/paymentDueBasisLabel\(row\.lifecycle\?\.paymentDueDate,row\.lifecycle\?\.certificationDate\)/);
  assert.match(html,/costQueried\?"Comparison queried"/);
  // The embedded function is self-contained and runs in a fresh context.
  const fn=new Function(html.match(/function paymentDueBasisLabel\([\s\S]*?\n}\n/)![0]+'; return paymentDueBasisLabel;')();
  assert.equal(fn({value:'2027-04-09',state:'established',basis:{method:'certification_date_plus_contract_payment_period'}},'2027-03-12'),
    'Certificate date 2027-03-12 + 28-day contract payment period');
});

test('F37: the BAC variance line states it is against the original budget only, not an overrun headline',()=>{
  const result=buildCommercialPerformance(input());
  const lines=result.costControl.managementSummary.filter(line=>/BAC/.test(line));
  assert.ok(lines.length>0,'fixture has a negative VAC');
  for(const line of lines){
    assert.doesNotMatch(line,/indicates an overrun/);
    assert.match(line,/above the original budget \(BAC\) only; approved variations are excluded, so this is not the current-contract comparison\./);
  }
});

// Fixture copied verbatim from tests/commercial-performance.test.ts (not exported there).
function foundation() {
  const input:
    CommercialFoundationInput = {
      projectId: "C2B1-UAT",
      generatedAt:
        "2026-09-21T12:00:00.000Z",
      dataDateIso: "2026-08-31",
      contractValue: null,
      contractValueCandidates: [],
      variations: [],
      contractTimeBasis: null,
      ldTerms: null,
      contractSections: [],
      amendments: [],
      costMetrics: [],
      payments: [],
    };
  return buildCommercialFoundation(
    input,
  );
}

function input():
  CommercialPerformanceInput {
  const sourceRefs = [
    "evidence-document:COST:row:2",
  ];
  return {
    projectId: "C2B1-UAT",
    generatedAt:
      "2026-09-21T12:00:00.000Z",
    dataDateIso: "2026-08-31",
    foundation:
      foundation(),
    costSnapshots: [
      {
        currency: "AED",
        taxBasis: "exclusive",
        asOf: "2026-07-31",
        state: "official",
        values: {
          bac: 10_000_000,
          pv: 4_000_000,
          ev: 3_800_000,
          ac: 4_200_000,
          eac: 10_800_000,
          etc: 6_600_000,
          vac: -800_000,
        },
        sourceRefs,
        diagnostics: [],
      },
      {
        currency: "AED",
        taxBasis: "exclusive",
        asOf: "2026-08-31",
        state: "official",
        values: {
          bac: 10_000_000,
          pv: 5_000_000,
          ev: 4_500_000,
          ac: 4_800_000,
          eac: 11_000_000,
          etc: 6_200_000,
          vac: -1_000_000,
        },
        sourceRefs,
        diagnostics: [],
      },
      {
        currency: "AED",
        taxBasis: "exclusive",
        asOf: "2026-09-30",
        state: "candidate",
        values: {
          bac: 10_000_000,
          pv: 6_000_000,
          ev: 5_800_000,
          ac: 6_100_000,
        },
        sourceRefs: [
          "evidence-document:FUTURE:row:2",
        ],
        diagnostics: [],
      },
    ],
    costMetrics: [
      {
        metric: "price variance",
        value: -120_000,
        currency: "AED",
        taxBasis: "exclusive",
        asOf: "2026-08-31",
        state: "official",
        sourceStatus: "Approved",
        amountBasis: "incremental",
        cbsId: "C01",
        wbsId: "W01",
        sourceRefs,
      },
      {
        metric: "quantity variance",
        value: -80_000,
        currency: "AED",
        taxBasis: "exclusive",
        asOf: "2026-08-31",
        state: "official",
        sourceStatus: "Approved",
        amountBasis: "incremental",
        cbsId: "C01",
        wbsId: "W01",
        sourceRefs,
      },
      {
        metric: "productivity variance",
        value: -100_000,
        currency: "AED",
        taxBasis: "exclusive",
        asOf: "2026-08-31",
        state: "official",
        sourceStatus: "Approved",
        amountBasis: "incremental",
        cbsId: "C01",
        wbsId: "W01",
        sourceRefs,
      },
      {
        metric: "expenditure budget",
        value: 2_000_000,
        currency: "AED",
        taxBasis: "exclusive",
        asOf: "2026-08-15",
        state: "official",
        sourceStatus: "Approved",
        amountBasis: "incremental",
        cbsId: null,
        wbsId: null,
        sourceRefs,
      },
      {
        metric: "expenditure forecast",
        value: 1_800_000,
        currency: "AED",
        taxBasis: "exclusive",
        asOf: "2026-08-15",
        state: "official",
        sourceStatus: "Forecast",
        amountBasis: "incremental",
        cbsId: null,
        wbsId: null,
        sourceRefs,
      },
      {
        metric: "actual expenditure",
        value: 1_200_000,
        currency: "AED",
        taxBasis: "exclusive",
        asOf: "2026-08-15",
        state: "official",
        sourceStatus: "Actual",
        amountBasis: "incremental",
        cbsId: null,
        wbsId: null,
        sourceRefs,
      },
    ],
    payments: [
      {
        paymentId: "IPC-01",
        periodEnd: "2026-08-01",
        certificationDate:
          "2026-08-10",
        paymentDate:
          "2026-08-20",
        currency: "AED",
        taxBasis: "exclusive",
        certifiedAmount:
          1_000_000,
        certifiedAmountBasis:
          "incremental",
        paidAmount: 900_000,
        paidAmountBasis:
          "incremental",
        sourceRefs: [
          "evidence-document:IPC:row:2",
        ],
      },
    ],
  };
}
