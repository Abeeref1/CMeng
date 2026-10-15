import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceCommercialEvidence} from '../packages/runtime-api/src/source-commercial-evidence';
import type {ProjectRuntimeState} from '../packages/runtime-api/src/project-state-types';

// Original commercial source records, not inferred activity or row positions.
const project=()=>({
 projectId:'INDEPENDENT-PAYMENT-TRUTH',version:1,
 evidenceDocuments:[],linkCandidateReviews:[],controls:{}
}) as unknown as ProjectRuntimeState;
const cert=(documentId:string,paymentId:string,certificationDate:string,paymentDate:string)=>({
 paymentId,certificationDate,periodEnd:'2032-02-01',paymentDate,
 paymentReference:'BANK-'+documentId,sourceStatus:'certified',
 receipt:{documentId,locator:'source:row:1'},
 amounts:{
  netCertifiedAmount:{value:900,currency:'SAR',taxBasis:'inclusive'},
  grossCertifiedAmount:{value:1000,currency:'SAR',taxBasis:'inclusive'},
  paidAmount:{value:400,currency:'SAR',taxBasis:'inclusive'}
 }
});
const position={certificateProfile:{groups:[]},currencies:[]};
const evaluate=(payments:unknown[],cutoff='2032-04-30')=>
 sourceCommercialEvidence(project(),{payments},position,cutoff).paymentLinkage;

test('T07 exact valid source certificate date permits genuine dated payment linkage without changing source',()=>{
 const rows=[cert('DOC-A','IPC-009','2032-02-29','2032-03-03')];
 const before=JSON.stringify(rows);
 const result=evaluate(rows);
 assert.equal(result.total,1);
 assert.equal(result.linked,1);
 assert.equal(result.rows[0]?.state,'linked');
 assert.equal(result.rows[0]?.certificateReference,'IPC-009');
 assert.equal(JSON.stringify(rows),before);
});

test('T07 impossible source certificate day cannot become a certified payment match',()=>{
 const bad=[cert('DOC-B','IPC-009','2032-02-30','2032-03-03')];
 const result=evaluate(bad);
 assert.equal(result.linked,0,'an impossible calendar day does not certify cash');
 assert.equal(result.rows[0]?.state,'unlinked');
 assert.equal(result.rows[0]?.certificateReference,null);
});

test('T07 a payment before certificate issue is not falsely reconciled',()=>{
 const early=[cert('DOC-C','IPC-009','2032-03-20','2032-03-03')];
 const result=evaluate(early);
 assert.equal(result.linked,0);
 assert.equal(result.rows[0]?.state,'unlinked');
});

test('T07 same certificate number across different source receipts remains ambiguous',()=>{
 const a=cert('DOC-D','IPC-009','2032-02-29','2032-03-03');
 const b=cert('DOC-E','IPC-009','2032-02-29','2032-03-03');
 const result=evaluate([a,b]);
 assert.equal(result.total,2);
 assert.equal(result.linked,0);
 assert.ok(result.rows.every(row=>row.state==='ambiguous'));
});

test('T07 future payment does not inflate current linked cash or source population',()=>{
 const future=[cert('DOC-F','IPC-009','2032-05-01','2032-05-04')];
 const result=evaluate(future);
 assert.equal(result.total,0);
 assert.equal(result.linked,0);
 assert.equal(result.rows[0]?.state,'future');
});

test('T05/T07 reporting Data Date absent cannot convert retained payment evidence into a zero or certified current linkage',()=>{
 const rows=[cert('DOC-G','IPC-009','2032-02-29','2032-03-03')];
 const state=project();
 const result=sourceCommercialEvidence(state,{payments:rows},position,null).paymentLinkage;
 assert.equal(result.total,null,'current population is unknown without an as-of date');
 assert.equal(result.linked,null,'missing basis is not zero linked');
 assert.equal(result.unlinked,null,'missing basis is not zero unlinked');
 assert.equal(result.coveragePercent,null);
 assert.equal(result.rows.length,1,'original source payment remains inspectable');
 assert.equal(result.rows[0]?.state,'cutoff_missing');
 assert.equal(result.rows[0]?.certificateReference,null,'no current certification inferred');
});
