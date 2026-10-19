import {runInNewContext} from './browser-context';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';

import {contractTaxBasis,likeForLikeCertifiedRatio,registerAboveContractQueries} from '../packages/runtime-api/src/commercial-sum-basis';
import {sourceCommercialEvidence} from '../packages/runtime-api/src/source-commercial-evidence';
import {buildRegisterChecks} from '../packages/runtime-api/src/project-decision-facts';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

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

test('F36: different or unstated tax bases leave the ratio not established',()=>{
  for(const [contractTax,certificateTax,reason] of [
    ['inclusive','exclusive',/Certificates are exclusive of tax but the original contract value is inclusive/],
    ['unknown','exclusive',/No source states the tax basis of the original contract value/],
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

test('F36: contract tax basis comes only from a source that states it for the same amount',()=>{
  const ev=(amount:number,taxBasis:string,ref:string)=>({currency:'SAR',amount,taxBasis,sourceRefs:[ref]});
  assert.equal(contractTaxBasis([ev(200,'exclusive','a')],'SAR',200).value,'exclusive');
  assert.equal(contractTaxBasis([ev(201,'exclusive','a')],'SAR',200).state,'not_established','a different amount is not this contract value');
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
