import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcilePaymentEvidence} from '../packages/runtime-api/src/payment-reconciliation';

const receipt={documentId:'IPC',sourceHash:'h',revision:'r',locator:'row:2',basisState:'active',authority:'source_record'} as any;
const money=(value:number|null)=>({value,currency:'USD',taxBasis:'exclusive',amountBasis:'incremental',state:value===null?'missing':'official',asOf:'2042-08-15',receipts:[receipt]}) as any;
const row=(other:string)=>({cells:{
  'payment source status':'Posted','paid allocation basis':'certificate cumulative',
  'payment reference':'PAY-1','payment date':'2042-08-15','other deductions':other,
},receipt}) as any;

function amounts(other:number,net:number){
  return {
    grossWork:money(1_290_000),
    variations:money(40_000),
    retentionDeduction:money(60_000),
    advanceRecovery:money(20_000),
    otherDeduction:money(other),
    taxAmount:money(0),
    netCertifiedAmount:money(net),
    paidAmount:money(1_000_000),
    outstandingAmount:money(net-1_000_000),
  } as any;
}

test('IPC match includes variations, retention, advance recovery and other deductions',()=>{
  const result=reconcilePaymentEvidence(row('20000'),amounts(20_000,1_230_000),'2042-08-20');
  assert.ok(result.componentArithmetic);
  assert.equal(result.componentArithmetic.state,'matched');
  assert.equal(result.componentArithmetic.calculatedNet,1_230_000);
  assert.equal(result.componentArithmetic.difference,0);
  assert.deepEqual(result.componentArithmetic.omittedComponents,[]);
});

test('IPC cannot say matched when a stated net omits a component',()=>{
  const result=reconcilePaymentEvidence(row('0'),amounts(0,1_230_000),'2042-08-20');
  assert.ok(result.componentArithmetic);
  assert.equal(result.componentArithmetic.calculatedNet,1_250_000);
  assert.equal(result.componentArithmetic.state,'conflicted');
  assert.equal(result.componentArithmetic.difference,-20_000);
});
