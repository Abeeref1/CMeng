import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {buildCommercialFoundation} from '../packages/commercial-foundation/src';
import {buildCommercialPerformance} from '../packages/commercial-performance/src';
import {performancePaymentFromCanonical} from '../packages/runtime-api/src/commercial-performance-runtime';
import type {PaymentStageRecord} from '../packages/runtime-api/src/commercial-canonical';

test('cash flow matches independently frozen complete and incomplete multi-partition ledgers',()=>{
  const {compare}=require('../../scripts/compare-independent-cash-flow.cjs');
  const reference=JSON.parse(readFileSync(join(process.cwd(),'tests/fixtures/cash-flow-retained.json'),'utf8'));
  const failures=compare(reference).filter((r:any)=>!r.pass);
  assert.deepEqual(failures.map((r:any)=>({id:r.id,differences:r.differences})),[]);
});

test('canonical payment adaptation preserves authority and keeps different receipt currencies and tax bases separate',()=>{
  for(const state of ['official','candidate','partial','conflicted','missing'] as const){
    for(const [currency,taxBasis] of [['USD','exclusive'],['AED','inclusive'],['AED','exclusive']] as const){
      const certified={value:1000,currency:'AED',taxBasis:'exclusive' as const,amountBasis:'incremental',state:'official' as const,asOf:'2035-03-01',receipts:[]};
      const row={paymentId:'P1',periodEnd:'2035-03-01',certificationDate:'2035-03-02',paymentDate:'2035-03-03',
        certifiedAmountBasis:'incremental',paidAmountBasis:'incremental',amounts:{employerCertifiedAmount:certified,paidAmount:{...certified,value:800,currency,taxBasis,state}}} as unknown as PaymentStageRecord;
      const payment=performancePaymentFromCanonical(row);
      assert.equal(payment.paidState,state);assert.equal(payment.paidCurrency,currency);assert.equal(payment.paidTaxBasis,taxBasis);
      const base={projectId:'CASH-SCOPE',generatedAt:'2035-04-01T00:00:00Z',dataDateIso:'2035-03-31'};
      const foundation=buildCommercialFoundation({...base,contractValue:null,contractValueCandidates:[],variations:[],contractTimeBasis:null,ldTerms:null,contractSections:[],amendments:[],costMetrics:[],payments:[]});
      const result=buildCommercialPerformance({...base,foundation,costSnapshots:[],costMetrics:[],payments:[payment]});
      const receipt=result.cashFlow.currencies.find(p=>p.currency===currency&&p.taxBasis===taxBasis)!;
      assert.equal(receipt.paidIncome.value,800);
      assert.equal(receipt.paidIncome.state,state==='official'?'established':state==='missing'?'partial':state);
      const sameBasis=currency==='AED'&&taxBasis==='exclusive';
      for(const partition of result.cashFlow.currencies)assert.equal(partition.certifiedUnpaid.value,sameBasis&&state==='official'?200:null);
      if(!sameBasis){
        assert.equal(result.cashFlow.currencies.length,2);
        assert.equal(result.cashFlow.currencies.find(p=>p.currency==='AED'&&p.taxBasis==='exclusive')!.paidIncome.value,null);
        assert.equal(receipt.certifiedIncome.value,null);
      }
    }
  }
});
