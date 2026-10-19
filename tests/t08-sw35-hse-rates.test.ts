import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalHeader} from '../packages/truth-kernel/src';
import {deliveryHsePosition} from '../packages/runtime-api/src/delivery-intelligence';
import {deliveryModule,deliveryPosition} from '../packages/runtime-api/src/delivery-projections';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';

const record=(recordId:string,fields:Record<string,string|number>)=>({recordId,fields:Object.fromEntries(Object.entries(fields).map(([k,v])=>[canonicalHeader(k),v])),receipts:[]}) as any;

test('SW-35 HSE register: with no per-incident rows, rates come from the supplied period totals and are labelled so',()=>{
 const exposure=record('EXP-AUG',{type:'exposure','exposure scope':'All site personnel','period start':'2031-08-01','period end':'2031-08-31','report date':'2031-08-31','man hours':200000,'lost time injuries':2,'frequency rate basis':1000000});
 const p=deliveryHsePosition([exposure],'2031-08-31',true);
 assert.equal(p.lostTimeInjuries,2,'supplied period injury total is used, never replaced by 0');
 assert.equal(p.frequencyRate,10,'2 / 200,000 x 1,000,000');
 assert.equal(p.injuryBasis,'period_totals');
 assert.equal(p.rateSource,'period_totals');
 assert.match(p.explanation,/Calculated from period totals/);
 // Per-incident rows, when supplied, remain the injury basis (unchanged rule).
 const incident=record('LTI-1',{type:'incident','exposure scope':'All site personnel','incident date':'2031-08-20','lost time injuries':1});
 const withIncidents=deliveryHsePosition([exposure,incident],'2031-08-31',true);
 assert.equal(withIncidents.injuryBasis,'incident_rows');
 assert.equal(withIncidents.frequencyRate,5);
 assert.doesNotMatch(withIncidents.explanation,/period totals/);
 // Exposure rows without injury totals and no incidents keep the confirmed-population rule.
 const hoursOnly=record('EXP-ONLY',{type:'exposure','exposure scope':'All site personnel','period start':'2031-08-01','period end':'2031-08-31','report date':'2031-08-31','man hours':200000,'frequency rate basis':1000000});
 assert.equal(deliveryHsePosition([hoursOnly],'2031-08-31',true).frequencyRate,0);
 assert.equal(deliveryHsePosition([hoursOnly],'2031-08-31',false).frequencyRate,null,'unconfirmed population stays unknown');
});

test('SW-35 HSE page shows the calculated rate reconciliation against the reported rates',()=>{
 const state=loadCertifiedDemoProject('SW35-'+randomUUID());
 const dataDate=deliveryPosition(state).dataDateIso!;
 assert.ok(dataDate,'demo programme has a Data Date');
 // A complete stored-document shape (cloned from the demo project) carrying only an HSE summary.
 const template=structuredClone(state.evidenceDocuments[0]) as any;
 state.evidenceDocuments=[...state.evidenceDocuments,{...template,documentId:'hse-sw35',documentType:'hse_report',basisState:'active',sourceHashSha256:'sw35-hash',
  sourceFilename:'HSE-Monthly-Report.pdf',sourceRelativePath:null,mediaType:'application/pdf',assertions:[],mapping:null,textSegments:undefined,fullTextRead:undefined,fullTextReadCheckpoint:undefined,boqTableRead:undefined,
  familyKey:'hse-sw35',logicalDocumentKey:'hse-sw35',supersededByDocumentId:null,supersedesDocumentIds:[],diagnostics:[],
  hseSummary:{producerVersion:'hse-summary-v4',sourceHashSha256:'sw35-hash',periodEndIso:dataDate,sourceRefs:['evidence-document:hse-sw35:summary'],diagnostics:[],sourceTableRead:true,
   metricBasis:'cumulative',rateBasisHours:{ltifr:1000000,trir:200000},
   metrics:{manHours:1000000,lostTimeInjuries:1,medicalTreatmentCases:2,restrictedWorkCases:1,ltifr:1.5,trir:0.8}}} as any];
 state.version++;
 const metrics=(deliveryModule(state,'delivery-hse').data as any).metrics as Array<{label:string;value:number|null;unit:string;basis:string}>;
 const ltifr=metrics.find(m=>m.label==='Recalculated LTIFR'),trir=metrics.find(m=>m.label==='Recalculated TRIR');
 assert.ok(ltifr&&trir,'the reconciliation already calculated is shown on the page');
 assert.equal(ltifr.value,1,'1 LTI / 1,000,000 h x 1,000,000');
 assert.equal(ltifr.unit,'per 1000000 hours');
 assert.match(ltifr.basis,/does not reconcile with the reported rate 1\.5/);
 assert.equal(trir.value,0.8,'(1 + 2 + 1) / 1,000,000 h x 200,000');
 assert.match(trir.basis,/reconciles with the reported rate 0\.8/);
 assert.doesNotMatch(trir.basis,/does not/);
 // Reported figures stay separate from the calculated ones.
 assert.equal(metrics.find(m=>m.label==='Reported LTIFR')!.value,1.5);
 assert.equal(metrics.find(m=>m.label==='Reported TRIR')!.value,0.8);
});
