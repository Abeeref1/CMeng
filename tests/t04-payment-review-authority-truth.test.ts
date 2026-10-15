import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceCommercialEvidence} from '../packages/runtime-api/src/source-commercial-evidence';
import type {ProjectRuntimeState} from '../packages/runtime-api/src/project-state-types';

// Independent cash source and certified register rows: a bank receipt is not
// itself the issued certificate, and multiple documents can share its number.
const receipt=(documentId:string)=>({documentId,locator:'row:1'});
const certificate=(documentId:string,issuedDate:string,currency='SAR')=>({
 paymentId:'IPC-009',certificationDate:issuedDate,periodEnd:'2032-02-01',
 sourceStatus:'certified',receipt:receipt(documentId),
 amounts:{netCertifiedAmount:{value:900,currency,taxBasis:'inclusive'}}
});
const payment=(currency:string|null='SAR')=>({
 paymentId:'IPC-009',paymentReference:'BANK-EXACT',paymentDate:'2032-03-03',
 receipt:receipt('BANK'),
 amounts:{paidAmount:{value:400,currency,taxBasis:'inclusive'}}
});
const position={certificateProfile:{groups:[]},currencies:[]};
const evaluate=(certificates:unknown[],targets:string[]=[],currency:string|null='SAR')=>{
 const state={
  projectId:'OTHER-INDEPENDENT-PAYMENT-TEST',version:12,evidenceDocuments:[],controls:{},
  linkCandidateReviews:targets.map(targetId=>({
   kind:'payment_certificate',state:'confirmed',basisVersion:12,
   sourceId:'BANK:row:1',targetId:targetId+':row:1'
  }))
 } as unknown as ProjectRuntimeState;
 const ledger={payments:[...certificates,payment(currency)]};
 const before=JSON.stringify({state,ledger});
 const result=sourceCommercialEvidence(state,ledger,position,'2032-04-30').paymentLinkage;
 assert.equal(JSON.stringify({state,ledger}),before,'persisted choice and sources are read-only');
 assert.equal(result.total,1,'the bank receipt is one source row');
 return result;
};

test('T04/T07 a confirmed but incompatible source selection cannot fall back to another matching certificate number',()=>{
 const result=evaluate([certificate('A','2032-02-29','SAR'),certificate('B','2032-02-29','USD')],['B']);
 assert.equal(result.linked,0);
 assert.equal(result.rows[0]?.state,'unlinked');
 assert.equal(result.rows[0]?.certificateReference,null);
 assert.match(result.rows[0]?.basis??'',/Saved certificate source selection/);
});

test('T04/T07 missing or invalid reviewed certificate remains unlinked even when an unreviewed matching source exists',()=>{
 const result=evaluate([certificate('A','2032-02-29'),certificate('B','2032-02-30')],['B']);
 assert.equal(result.linked,0);
 assert.equal(result.rows[0]?.state,'unlinked');
});

test('T04/T07 missing payment currency cannot establish a reviewed same-currency receipt by business number',()=>{
 const result=evaluate([certificate('A','2032-02-29'),certificate('B','2032-03-20')],['B'],null);
 assert.equal(result.linked,0);
 assert.equal(result.rows[0]?.state,'unlinked');
 assert.match(result.rows[0]?.basis??'',/currency must be established/);
});

test('T04/T07 two contradictory confirmed source decisions stay disputed even if one currency matches',()=>{
 const result=evaluate([certificate('A','2032-02-29','SAR'),certificate('B','2032-02-29','USD')],['A','B']);
 assert.equal(result.linked,0);
 assert.equal(result.rows[0]?.state,'ambiguous');
 assert.match(result.rows[0]?.basis??'',/Conflicting confirmed/);
});

test('T04/T07 one valid saved relationship links only its dated, same-currency issued source',()=>{
 const result=evaluate([certificate('A','2032-02-29','SAR'),certificate('B','2032-02-29','SAR')],['B']);
 assert.equal(result.linked,1);
 assert.equal(result.rows[0]?.state,'linked');
 assert.deepEqual(result.rows[0]?.sourceRefs,['BANK:row:1','B:row:1']);
});

test('T04/T07 absence of source decision preserves exact unique business-reference linkage',()=>{
 const result=evaluate([certificate('A','2032-02-29')]);
 assert.equal(result.linked,1);
 assert.equal(result.rows[0]?.state,'linked');
 assert.deepEqual(result.rows[0]?.sourceRefs,['BANK:row:1','A:row:1']);
});
