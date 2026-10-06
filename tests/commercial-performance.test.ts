import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCommercialFoundation,
  type CommercialFoundationInput,
} from "../packages/commercial-foundation/src";
import {
  buildCommercialPerformance,
  type CommercialPerformanceInput,
} from "../packages/commercial-performance/src";

test('derived cost and historic EVM retain source uncertainty instead of becoming established arithmetic',()=>{
  for(const state of ['official','candidate','partial','conflicted','missing'] as const){
    const model=input();
    const original=model.costSnapshots.find(s=>s.asOf==='2026-08-31')!;
    model.costSnapshots=[{...original,asOf:'2026-07-31',state},{...original,state}];model.costMetrics=[];
    const result=buildCommercialPerformance(model),position=result.costControl.positions[0]!;
    const history=result.evmPerformance.series[0]!.points[0]!;
    for(const metric of ['cpi','spi','sv','cv'] as const){
      for(const row of [position,history]){
        const finding=row[metric];
        assert.equal(finding.state,state==='official'?'established':state);
        if(state==='conflicted'||state==='missing')assert.equal(finding.value,null);
        else assert.notEqual(finding.value,null);
      }
    }
    for(const scenario of position.eacScenarios.filter(s=>s.method!=='source_reported')){
      assert.equal(scenario.value.state,state==='official'?'established':state);
      if(state==='conflicted'||state==='missing')assert.equal(scenario.value.value,null);
      assert.equal(scenario.official,false);
    }
    assert.equal(position.ev.value,original.values.ev,'The original source value must remain available separately.');
    if(state!=='official')assert.notEqual(result.evmPerformance.state,'established');
    if(state==='candidate'||state==='partial')assert.ok(result.costControl.managementSummary.every(line=>line.startsWith('Provisional '+state+' evidence:')));
  }
});

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

test("C2B1 Cost Control keeps source EAC separate from independent forecast scenarios", () => {
  const result =
    buildCommercialPerformance(
      input(),
    );
  const cost =
    result.costControl;
  assert.equal(
    result.producerVersion,
    "commercial-performance-v1",
  );
  assert.equal(
    cost.positions.length,
    1,
  );
  const p =
    cost.positions[0]!;
  assert.equal(
    p.bac.value,
    10_000_000,
  );
  assert.equal(
    p.spi.value,
    0.9,
  );
  assert.equal(
    p.cpi.value,
    0.9375,
  );
  assert.equal(
    p.sv.value,
    -500_000,
  );
  assert.equal(
    p.cv.value,
    -300_000,
  );
  assert.equal(
    p.sourceEac.value,
    11_000_000,
  );
  assert.equal(
    p.sourceEac.authority,
    "source",
  );
  assert.equal(
    p.calculatedVac.value,
    -1_000_000,
  );
  assert.equal(
    p.varianceDecomposition
      .price.value,
    -120_000,
  );
  assert.equal(
    p.varianceDecomposition
      .quantity.value,
    -80_000,
  );
  assert.equal(
    p.varianceDecomposition
      .productivity.value,
    -100_000,
  );
  assert.deepEqual(
    p.eacScenarios.map(
      (s) => s.method,
    ),
    [
      "source_reported",
      "bac_over_cpi",
      "ac_plus_remaining_budget",
      "ac_plus_source_etc",
    ],
  );
  assert.equal(
    p.eacScenarios[0]
      ?.official,
    true,
  );
  assert.ok(
    p.eacScenarios
      .slice(1)
      .every(
        (s) =>
          s.official ===
          false,
      ),
  );
});

test("C2B1 EVM performance uses dated source snapshots and excludes future points", () => {
  const result =
    buildCommercialPerformance(
      input(),
    );
  const series =
    result.evmPerformance
      .series[0]!;
  assert.equal(
    series.pointCount,
    2,
  );
  assert.equal(
    series
      .completePvEvAcPointCount,
    2,
  );
  assert.equal(
    series.coveragePercent,
    100,
  );
  assert.equal(
    series
      .futureExcludedPointCount,
    1,
  );
  assert.equal(
    series.points[1]
      ?.cpi.value,
    0.9375,
  );
  assert.equal(
    result.evmPerformance
      .documentedVsCalculated,
    "separated",
  );
});

test("C2B1 Cash Flow keeps certification separate from cash and computes funding only from dated cash evidence", () => {
  const result =
    buildCommercialPerformance(
      input(),
    );
  const cash =
    result.cashFlow
      .currencies[0]!;
  assert.equal(
    cash.certifiedIncome.value,
    1_000_000,
  );
  assert.equal(
    cash.paidIncome.value,
    900_000,
  );
  assert.equal(
    cash.actualExpenditure.value,
    1_200_000,
  );
  assert.equal(
    cash.netCashPosition.value,
    -300_000,
  );
  assert.equal(result.cashFlow.state,'established');
  assert.equal(
    cash.peakFundingNeed.value,
    1_200_000,
  );
  assert.equal(
    cash.cumulativeActualSeries
      .at(-1)?.net,
    -300_000,
  );
  assert.equal(
    cash.certifiedUnpaid.value,
    100_000,
  );
  assert.deepEqual(
    cash.cumulativePositionSeries
      .at(-1),
    {
      asOf: "2026-08-20",
      cumulativeCertifiedIncome:
        1_000_000,
      cumulativePaidIncome:
        900_000,
      cumulativeExpenditureBudget:
        2_000_000,
      cumulativeExpenditureForecast:
        1_800_000,
      cumulativeActualExpenditure:
        1_200_000,
      actualNetCash:
        -300_000,
    },
  );
  assert.deepEqual(
    cash.periodMovementSeries,
    [
      {
        period: "2026-08",
        certifiedIncome:
          1_000_000,
        paidIncome: 900_000,
        expenditureBudget:
          2_000_000,
        expenditureForecast:
          1_800_000,
        actualExpenditure:
          1_200_000,
        actualNetCashMovement:
          -300_000,
      },
    ],
  );
  assert.ok(
    cash.diagnostics.includes(
      "CERTIFIED_INCOME_IS_NOT_CASH_RECEIVED",
    ),
  );
  assert.equal(
    cash.sourceReadiness
      .certification.state,
    "ready",
  );
  assert.equal(
    cash.sourceReadiness
      .receipts.state,
    "ready",
  );
  assert.equal(
    cash.sourceReadiness
      .expenditure.state,
    "ready",
  );
  assert.equal(
    cash.sourceReadiness
      .forwardPlan.state,
    "ready",
  );
  assert.equal(
    cash.sourceReadiness
      .netCashReady,
    true,
  );
});

test("C2B1 peak funding remains unknown when one actual cash side is missing", () => {
  const value = input();
  value.payments = value.payments.map(payment => ({
    ...payment,
    paidAmount: null,
    paidAmountBasis: "unknown",
    paymentDate: null,
  }));
  const result =
    buildCommercialPerformance(
      value,
    );
  const cash =
    result.cashFlow
      .currencies[0]!;
  assert.equal(
    cash.paidIncome.value,
    null,
  );
  assert.equal(
    cash.actualExpenditure.value,
    1_200_000,
  );
  assert.equal(
    cash.netCashPosition.value,
    null,
  );
  assert.equal(
    cash.peakFundingNeed.value,
    null,
    "missing paid cash must not be treated as zero when calculating funding need",
  );
  assert.ok(
    cash.cumulativeActualSeries
      .every(
        point =>
          point.net === null,
      ),
  );
  assert.equal(
    cash.sourceReadiness
      .receipts.state,
    "missing",
  );
  assert.equal(
    cash.sourceReadiness
      .receipts.observedCount,
    0,
  );
  assert.equal(
    cash.sourceReadiness
      .expenditure.state,
    "ready",
  );
  assert.equal(
    cash.sourceReadiness
      .netCashReady,
    false,
  );
});

test("C2B1 Cash Flow readiness explains certified-only source evidence without relabelling AC as cash", () => {
  const value = input();
  value.payments = Array.from(
    { length: 18 },
    (_, index) => ({
      paymentId:
        "IPC-" +
        String(index + 1)
          .padStart(2, "0"),
      periodEnd:
        "2026-08-" +
        String(
          Math.min(
            index + 1,
            28,
          ),
        ).padStart(2, "0"),
      certificationDate: null,
      paymentDate: null,
      currency: "AED",
      taxBasis: "exclusive" as const,
      certifiedAmount:
        100_000 +
        index,
      certifiedAmountBasis:
        "unknown" as const,
      paidAmount: null,
      paidAmountBasis:
        "unknown" as const,
      sourceRefs: [
        "evidence-document:IPC:row:" +
          String(index + 2),
      ],
    }),
  );
  value.costMetrics = value.costMetrics.filter(
    row =>
      !/expenditure/i.test(
        row.metric,
      ),
  );
  value.costMetrics.push({
    metric: "ac",
    value: 4_800_000,
    currency: "AED",
    taxBasis: "exclusive",
    asOf: "2026-08-31",
    state: "official",
    sourceStatus: "Actual",
    amountBasis:
      "project cumulative",
    cbsId: null,
    wbsId: null,
    sourceRefs: [
      "evidence-document:COST:row:ac",
    ],
  });

  const result =
    buildCommercialPerformance(
      value,
    );
  const cash =
    result.cashFlow
      .currencies.find(
        row =>
          row.currency ===
          "AED",
      )!;

  assert.equal(
    cash.sourceReadiness
      .paymentRecordCount,
    18,
  );
  assert.equal(
    cash.sourceReadiness
      .certification.observedCount,
    18,
  );
  assert.equal(
    cash.sourceReadiness
      .certification.datedAmountCount,
    0,
  );
  assert.equal(
    cash.sourceReadiness
      .certification.basis,
    "unknown",
  );
  assert.equal(
    cash.sourceReadiness
      .certification.state,
    "missing",
  );
  assert.equal(
    cash.sourceReadiness
      .receipts.observedCount,
    0,
  );
  assert.equal(
    cash.sourceReadiness
      .receipts.paymentDateCount,
    0,
  );
  assert.equal(
    cash.sourceReadiness
      .receipts.state,
    "missing",
  );
  assert.equal(
    cash.sourceReadiness
      .expenditure.observedCount,
    0,
  );
  assert.ok(
    cash.sourceReadiness
      .expenditure.actualCostRecordCount >
      0,
  );
  assert.equal(
    cash.sourceReadiness
      .expenditure.state,
    "missing",
  );
  assert.match(
    cash.sourceReadiness
      .expenditure.consequence,
    /Actual Cost evidence exists.*not the same as cash expenditure/i,
  );
  assert.equal(
    cash.certifiedIncome.value,
    null,
    "unknown certificate series basis must still withhold the aggregate certified position",
  );
  assert.equal(
    cash.paidIncome.value,
    null,
  );
  assert.equal(
    cash.actualExpenditure.value,
    null,
  );
  assert.equal(
    cash.netCashPosition.value,
    null,
  );
  assert.equal(
    cash.sourceReadiness
      .netCashReady,
    false,
  );
  assert.equal(
    cash.sourceReadiness
      .fundingCurveReady,
    false,
  );
});

test("C2B1 Cost S-Curve uses source cumulative positions and preserves currency/tax partitions", () => {
  const result =
    buildCommercialPerformance(
      input(),
    );
  const series =
    result.costScurve
      .series[0]!;
  assert.equal(
    series.currency,
    "AED",
  );
  assert.equal(
    series.taxBasis,
    "exclusive",
  );
  assert.equal(
    series.points.length,
    2,
  );
  assert.equal(
    series
      .futureExcludedPointCount,
    1,
  );
  assert.equal(
    series.points[1]
      ?.plannedCost.value,
    5_000_000,
  );
  assert.equal(
    series.points[1]
      ?.earnedValue.value,
    4_500_000,
  );
  assert.equal(
    series.points[1]
      ?.actualCost.value,
    4_800_000,
  );
  assert.equal(
    series.points[1]
      ?.remainingCost.value,
    6_200_000,
  );
});


test("C2B1 project-cumulative payment series are converted to deltas before cash aggregation", () => {
  const value = input();
  value.payments = [
    {paymentId:'opening',periodEnd:'2026-07-01',certificationDate:'2026-07-01',paymentDate:'2026-07-01',currency:'AED',taxBasis:'exclusive',certifiedAmount:0,paidAmount:0,certifiedAmountBasis:'project_cumulative',paidAmountBasis:'project_cumulative',sourceRefs:['evidence-document:opening']},
    {
      paymentId: "IPC-01",
      periodEnd: "2026-07-31",
      certificationDate: "2026-08-01",
      paymentDate: "2026-08-05",
      currency: "AED",
      taxBasis: "exclusive",
      certifiedAmount: 600_000,
      certifiedAmountBasis: "project_cumulative",
      paidAmount: 500_000,
      paidAmountBasis: "project_cumulative",
      sourceRefs: ["evidence-document:IPC:row:2"],
    },
    {
      paymentId: "IPC-02",
      periodEnd: "2026-08-31",
      certificationDate: "2026-08-20",
      paymentDate: "2026-08-25",
      currency: "AED",
      taxBasis: "exclusive",
      certifiedAmount: 1_000_000,
      certifiedAmountBasis: "project_cumulative",
      paidAmount: 900_000,
      paidAmountBasis: "project_cumulative",
      sourceRefs: ["evidence-document:IPC:row:3"],
    },
  ];
  const result = buildCommercialPerformance(value);
  const cash = result.cashFlow.currencies.find(row => row.currency === "AED")!;
  assert.equal(cash.certifiedIncome.value, 1_000_000);
  assert.equal(cash.paidIncome.value, 900_000);
  const paidEntries = cash.entries.filter(row => row.kind === "paid_income");
  assert.deepEqual(paidEntries.map(row => row.amount.value), [500_000, 400_000]);
  assert.ok(paidEntries.every(row => row.amount.basis.method === "project_cumulative_payment_delta"));
});

test("C2B1 unknown or certificate-cumulative payment basis fails closed instead of creating project cash totals", () => {
  const value = input();
  value.payments = [
    {
      paymentId: "IPC-01",
      periodEnd: "2026-08-31",
      certificationDate: "2026-08-20",
      paymentDate: "2026-08-25",
      currency: "AED",
      taxBasis: "exclusive",
      certifiedAmount: 1_000_000,
      certifiedAmountBasis: "certificate_cumulative",
      paidAmount: 900_000,
      paidAmountBasis: "unknown",
      sourceRefs: ["evidence-document:IPC:row:2"],
    },
  ];
  value.costMetrics = value.costMetrics.map(row =>
    /expenditure/i.test(row.metric)
      ? {...row, amountBasis: "unknown"}
      : row
  );
  const result = buildCommercialPerformance(value);
  const cash = result.cashFlow.currencies.find(row => row.currency === "AED")!;
  assert.equal(cash.certifiedIncome.value, null);
  assert.equal(cash.paidIncome.value, null);
  assert.equal(cash.actualExpenditure.value, null);
  assert.equal(cash.netCashPosition.value, null);
  assert.ok(cash.diagnostics.some(code => code.includes("CERTIFIED_SERIES_CERTIFICATE_CUMULATIVE_NOT_AGGREGATED")));
  assert.ok(cash.diagnostics.some(code => code.includes("PAID_SERIES_UNKNOWN_NOT_AGGREGATED")));
  assert.ok(cash.diagnostics.some(code => code.includes("ACTUAL_EXPENDITURE_UNKNOWN_NOT_AGGREGATED")));
});

test("C2B1 unknown tax basis withholds derived cost arithmetic while retaining source values", () => {
  const value = input();
  value.costSnapshots = value.costSnapshots.map(snapshot => ({
    ...snapshot,
    taxBasis: "unknown",
  }));
  value.costMetrics = value.costMetrics.map(row => ({
    ...row,
    taxBasis: "unknown",
  }));
  const result = buildCommercialPerformance(value);
  const position = result.costControl.positions[0]!;
  assert.equal(position.bac.value, 10_000_000);
  assert.equal(position.ev.value, 4_500_000);
  assert.equal(position.ac.value, 4_800_000);
  assert.equal(position.sourceEac.value, 11_000_000);
  assert.equal(position.spi.value, null);
  assert.equal(position.cpi.value, null);
  assert.equal(position.sv.value, null);
  assert.equal(position.cv.value, null);
  assert.equal(position.calculatedVac.value, null);
  assert.ok(position.diagnostics.includes("UNKNOWN_TAX_BASIS_DERIVED_COST_ARITHMETIC_WITHHELD"));
  const evm = result.evmPerformance.series[0]!;
  assert.ok(evm.points.every(point => point.spi.value === null && point.cpi.value === null));
  const curve = result.costScurve.series[0]!;
  assert.ok(curve.points.every(point => point.remainingCost.value === null));
});


test('Cash cannot merge tax partitions or invent an opening cumulative transaction',()=>{
 const v=input(); const base=v.payments[0]!;
 v.payments=[{...base,taxBasis:'exclusive',paidAmountBasis:'project_cumulative'},{...base,paymentId:'inclusive',taxBasis:'inclusive',paidAmount:7}];
 const result=buildCommercialPerformance(v).cashFlow.currencies;
 const exclusive=result.find(r=>r.currency==='AED'&&r.taxBasis==='exclusive')!;
 const inclusive=result.find(r=>r.currency==='AED'&&r.taxBasis==='inclusive')!;
 assert.equal(exclusive.paidIncome.value,null);
 assert.ok(exclusive.diagnostics.includes('CUMULATIVE_OPENING_BASIS_REQUIRED'));
 assert.equal(inclusive.paidIncome.value,7);assert.equal(inclusive.actualExpenditure.value,null);
});

test('BAC over CPI uses the unrounded source ratio',()=>{
 const v=input();v.costSnapshots=[{...v.costSnapshots[0]!,values:{bac:7800000000,ev:740000000,ac:825000000}}];
 const p=buildCommercialPerformance(v).costControl.positions[0]!;
 const eac=p.eacScenarios.find(s=>s.method==='bac_over_cpi')!;
 assert.ok(Math.abs(eac.value.value!-7800000000/(740000000/825000000))<0.01);
});


test('Stage 1 carries established cash movements across unrelated dates and withholds incomplete series',()=>{
  const data=input();
  const complete=buildCommercialPerformance(data).cashFlow.currencies[0]!;
  // Independent transaction ledger: certification 10 Aug is not cash, an
  // expenditure of 1.2m on 15 Aug precedes the 0.9m receipt on 20 Aug.
  assert.equal(complete.peakFundingNeed.value,1_200_000);
  assert.equal(complete.cumulativeActualSeries.find(row=>row.asOf==='2026-08-15')!.net,-1_200_000);
  assert.equal(complete.cumulativeActualSeries.find(row=>row.asOf==='2026-08-20')!.net,-300_000);
  data.payments.push({...data.payments[0]!,paymentId:'IPC-UNKNOWN',paymentDate:'2026-08-22',paidAmount:null});
  const missing=buildCommercialPerformance(data).cashFlow.currencies[0]!;
  assert.equal(missing.netCashPosition.value,null);assert.equal(missing.peakFundingNeed.value,null);
  assert.ok(missing.cumulativeActualSeries.every(row=>row.net===null),'missing applicable cash must not become zero movement');
  const undated=input();undated.payments[0]!.paymentDate=null;
  assert.equal(buildCommercialPerformance(undated).cashFlow.currencies[0]!.peakFundingNeed.value,null);
  const candidate=input();candidate.costMetrics.find(row=>row.metric==='actual expenditure')!.state='candidate';
  assert.equal(buildCommercialPerformance(candidate).cashFlow.currencies[0]!.netCashPosition.value,null);
});

test('Unknown cash tax basis withholds combined cash arithmetic',()=>{
  const data=input();
  data.payments=data.payments.map(row=>({...row,taxBasis:'unknown'}));
  data.costMetrics=data.costMetrics.map(row=>({...row,taxBasis:'unknown'}));
  const cash=buildCommercialPerformance(data).cashFlow.currencies;
  assert.ok(cash.length>0);
  assert.ok(cash.every(row=>row.netCashPosition.value===null&&row.certifiedUnpaid.value===null));
  assert.ok(cash.every(row=>row.sourceReadiness.netCashReady===false));
});

test('Stage 1 cash totals preserve candidate authority and disclose incomplete current populations',()=>{
  for(const [metric,key] of [
    ['actual expenditure','actualExpenditure'],
    ['expenditure budget','expenditureBudget'],
    ['expenditure forecast','expenditureForecast'],
  ] as const){
    const data=input();data.costMetrics.find(row=>row.metric===metric)!.state='candidate';
    const cash=buildCommercialPerformance(data).cashFlow.currencies[0]!;
    assert.equal(cash[key].state,'candidate',metric+' cannot become an established total');
    assert.equal(cash[key].authority,'candidate');
    assert.ok(cash[key].value!==null,'candidate source value stays available for review');
    assert.equal(cash[key].independent,null);
    if(metric==='actual expenditure')assert.equal(cash.sourceReadiness.expenditure.state,'partial');
    else assert.equal(cash.sourceReadiness.forwardPlan.state,'partial');
  }
  const cumulative=input();
  const actual=cumulative.costMetrics.find(row=>row.metric==='actual expenditure')!;
  actual.amountBasis='project_cumulative';
  cumulative.costMetrics.push({...actual,value:0,asOf:'2026-08-01',state:'candidate'});
  const candidateOpening=buildCommercialPerformance(cumulative).cashFlow.currencies[0]!;
  assert.equal(candidateOpening.actualExpenditure.state,'candidate');
  assert.ok(candidateOpening.entries.filter(row=>row.kind==='actual_expenditure').every(row=>row.amount.state==='candidate'));
  assert.equal(candidateOpening.peakFundingNeed.value,null);

  const incomplete=input();incomplete.payments.push({...incomplete.payments[0]!,paymentId:'IPC-MISSING',paidAmount:null});
  const partial=buildCommercialPerformance(incomplete).cashFlow.currencies[0]!;
  assert.equal(partial.paidIncome.value,900_000);
  assert.equal(partial.paidIncome.state,'partial');
  assert.equal(partial.paidIncome.independent,null);
  assert.equal(partial.sourceReadiness.receipts.state,'partial');
  assert.equal(partial.netCashPosition.value,null);
  for(const state of ['conflicted','partial'] as const){
    const data=input();data.costMetrics.find(row=>row.metric==='actual expenditure')!.state=state;
    const cash=buildCommercialPerformance(data).cashFlow.currencies[0]!;
    assert.equal(cash.actualExpenditure.state,state);
    assert.equal(cash.actualExpenditure.independent,null);
    assert.equal(cash.sourceReadiness.expenditure.state,'partial');
    assert.equal(cash.netCashPosition.value,null);
  }
});


test('A qualified single cost snapshot remains available without certifying trend readiness', () => {
  const data = input();
  data.costSnapshots = [{...data.costSnapshots[0]!, state: 'partial'}];
  const result = buildCommercialPerformance(data);
  assert.equal(result.costControl.state, 'partial');
  assert.equal(result.evmPerformance.state, 'partial');
  assert.equal(result.costScurve.state, 'partial');
  assert.ok(result.costControl.positions[0]!.sourceEac.value !== null);
  assert.equal(result.costScurve.series[0]!.points.length, 1);
});

test("Batch G EVM future exclusions stay partitioned by currency and tax basis", () => {
  const value = input();
  const base = value.costSnapshots[0]!;
  value.costSnapshots = [
    {...base, currency:"AED", taxBasis:"exclusive", asOf:"2026-07-31"},
    {...base, currency:"AED", taxBasis:"exclusive", asOf:"2026-09-30"},
    {...base, currency:"USD", taxBasis:"exclusive", asOf:"2026-07-31"},
    {...base, currency:"USD", taxBasis:"exclusive", asOf:"2026-09-30"},
    {...base, currency:"USD", taxBasis:"exclusive", asOf:"2026-10-31"},
  ];
  const result = buildCommercialPerformance(value);
  const aed = result.evmPerformance.series.find(row=>row.currency==="AED"&&row.taxBasis==="exclusive")!;
  const usd = result.evmPerformance.series.find(row=>row.currency==="USD"&&row.taxBasis==="exclusive")!;
  assert.equal(aed.futureExcludedPointCount, 1);
  assert.equal(usd.futureExcludedPointCount, 2);
  assert.ok(!JSON.stringify(result).match(/NaN|Infinity/));
});

test("Batch G preserves EVM minimum-point and unofficial EAC controls", () => {
  const value = input();
  value.costSnapshots = [value.costSnapshots[0]!];
  const result = buildCommercialPerformance(value);
  assert.equal(result.evmPerformance.state, "partial");
  assert.equal(result.evmPerformance.series[0]!.points.length, 1);
  const scenarios = result.costControl.positions[0]!.eacScenarios;
  assert.ok(scenarios.filter(row=>row.method!=="source_reported").every(row=>row.official===false));
});
