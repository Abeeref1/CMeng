import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {buildRegisterChecks} from '../packages/runtime-api/src/project-decision-facts';
import {decisionFactsScript} from '../packages/runtime-api/src/ui-decision-facts';

const fact=(value:number|null,state='established')=>({value,state,sourceRefs:value===null?[]:['source:row:1']});
const currency=(code:string,contract:number|null,gross:number|null,net:number|null,paid:number|null,pending:number|null)=>({
 currency:code,currentContractValue:fact(contract,'candidate'),grossCertifiedAmount:fact(gross),
 netCertifiedAmount:fact(net),paidAmount:fact(paid),pendingVariationAmount:fact(pending)
});
test('S-35 reports comparable values even when none exceeds qualified current contract',()=>{
 const review=buildRegisterChecks({currencies:[currency('QAR',221776000,196034538,166629358,156730345,0)]},{},{items:[]});
 assert.equal(review.count,0,'No invented over-contract flags');
 assert.equal(review.checkedCount,4,'Four actual source amounts checked, including a real zero');
 assert.equal(review.checkedRows.find((r:any)=>r.register==='Gross issued certificates')?.registerTotal,196034538);
 assert.equal(review.checkedRows.every((r:any)=>r.currency==='QAR'),true);
 assert.equal(review.checkedRows.every((r:any)=>r.contractAuthorityState==='candidate'),true);
 assert.equal(review.checkedRows.find((r:any)=>r.register==='Pending variations')?.registerTotal,0);
});
test('S-35 exceptions remain and preserve the actual amount and currency',()=>{
 const review=buildRegisterChecks({currencies:[currency('SAR',100,125,80,null,null),currency('AED',500,null,null,null,null)]},{},{items:[
  {currency:'SAR',contractValue:10,sourceRefs:['boq:A']},
  {currency:'AED',contractValue:700,sourceRefs:['boq:other']},
 ]});
 assert.equal(review.count,2);
 assert.equal(review.checkedCount,4);
 assert.deepEqual(review.rows.map((r:any)=>[r.register,r.currency,r.excess]),[
  ['Gross issued certificates','SAR',25],['Priced BOQ items','AED',200]]);
 assert.equal(review.checkedRows.some((r:any)=>r.register==='Paid receipts'),false,'Missing receipt never becomes 0');
});
test('S-35 visible decision displays examined sources when exception count is zero',()=>{
 const review=buildRegisterChecks({currencies:[currency('QAR',100,80,null,null,null)]},{},{items:[]});
 const html=runInNewContext(decisionFactsScript+\`\nrenderDecisionAnalysis('commercial-overview',{decisionAnalysis:{kind:'register_reconciliation',registerValueChecks:input}});\`,{
  input:review,
  planningKpis:(rows:any)=>JSON.stringify(rows),
  escapeHtml:(x:any)=>String(x),
  decisionPanel:(title:string,_basis:string,kind:string,rows:any[])=>'TABLE:'+kind+':'+rows.length+':'+title,
  managementModuleLink:()=>''
 });
 assert.match(String(html),/TABLE:registerReviews:1/);
 assert.doesNotMatch(String(html),/TABLE:registers:/,'No false exception table is emitted');
});
