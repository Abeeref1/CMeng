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

test('cash flow downloads: every JSON and Excel figure matches the frozen answers; Excel columns are found by field key, not heading',async()=>{
  // T12: Excel headings are reader words ('Paid income · value'); the comparer
  // used to look up the raw heading 'currency' and crashed on column -1.
  const {compare,compareExports}=require('../../scripts/compare-independent-cash-flow.cjs');
  const reference=JSON.parse(readFileSync(join(process.cwd(),'tests/fixtures/cash-flow-retained.json'),'utf8'));
  const partitions=reference.cases.slice(0,20).reduce((n:number,c:any)=>n+c.expected.length,0);
  const results=compare(reference),counts=await compareExports(reference,results);
  assert.deepEqual(results.filter((r:any)=>!r.pass).map((r:any)=>({id:r.id,differences:r.differences})),[]);
  assert.equal(counts.exportChecks,partitions*12,'six figures, in JSON and in Excel, for every partition');
  assert.equal(counts.fieldKeyChecks,Math.min(20,reference.cases.length)*8,'currency, tax basis and six value columns per workbook');
  // A wrong figure is still caught in both downloads (the check is not vacuous).
  const mutated=JSON.parse(JSON.stringify(reference)),first=mutated.cases[0].expected[0];
  first.netCashPosition=typeof first.netCashPosition==='number'?first.netCashPosition+1:1;
  const mutatedResults=compare(mutated);await compareExports(mutated,mutatedResults);
  const fields=mutatedResults[0].differences.map((d:any)=>d.field),prefix=first.currency+'/'+first.taxBasis+'/netCashPosition';
  assert.ok(fields.includes('json/'+prefix)&&fields.includes('xlsx/'+prefix),fields.join(', '));
  // A figure the export no longer carries is a failed check, never a crash or a pass.
  const dropped=compare(reference);for(const partition of dropped[1].actual.currencies)delete partition.peakFundingNeed;
  await compareExports(reference,dropped);
  assert.equal(dropped[1].pass,false);
  assert.ok(dropped[1].differences.some((d:any)=>d.field==='xlsx/fieldKey/peakFundingNeed.value'));
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
