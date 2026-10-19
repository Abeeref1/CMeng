import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {securityInstrumentKind} from '../packages/truth-kernel/src';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {commercialCanonical} from '../packages/runtime-api/src/commercial-canonical';

// F18 (D-103): the Instrument column sets the instrument type. APG is the advance
// payment security; CAR is insurance. A non-specific column falls back only to an
// exact standard abbreviation leading the instrument's own reference.
test('F18 shared rule reads the instrument type from the column, then an exact reference abbreviation',()=>{
 assert.equal(securityInstrumentKind('APG','X-1'),'advance_payment');
 assert.equal(securityInstrumentKind('Advance Payment Guarantee','G-7'),'advance_payment');
 assert.equal(securityInstrumentKind('Bank Guarantee','APG-VLC1-0202'),'advance_payment');
 assert.equal(securityInstrumentKind('PBG','B-2'),'performance');
 assert.equal(securityInstrumentKind('Bank Guarantee','PB-01'),'performance');
 assert.equal(securityInstrumentKind('RMG','R-1'),'retention');
 assert.equal(securityInstrumentKind('CAR','CAR-01'),'insurance');
 assert.equal(securityInstrumentKind('Contractor All Risks','INS-1'),'insurance');
 assert.equal(securityInstrumentKind('Performance Bond','CAR-PARK-PB'),'performance','the stated column wins over the reference');
 assert.equal(securityInstrumentKind('Bank Guarantee','BG-0001'),'other','no specific type is stated, so none is guessed');
 assert.equal(securityInstrumentKind('Guarantee','CARPARK-1'),'other','only an exact leading abbreviation is read');
});

test('F18 a security register reads APG as advance payment, a bank guarantee referenced PB as performance and CAR as insurance',t=>{
 const dir=mkdtempSync(join(tmpdir(),'f18-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const state=loadCertifiedDemoProject('F18-'+randomUUID());
 state.schedules.at(-1)!.revision.model.dataDateIso='2031-08-31';state.evidenceDocuments=[];state.controls.bonds=[];state.version++;
 const content='Bond ID,Instrument,Amount,Currency,Expiry Date,Status\nAPG-VLC1-0202,APG,500000,SAR,2032-06-30,Active\nPB-01,Bank Guarantee,900000,SAR,2032-12-31,Active\nBG-77,Bank Guarantee,10000,SAR,2032-12-31,Active\nCAR-01,CAR,20000000,SAR,2032-12-31,Active\nINS-2,Contractor All Risks,15000000,SAR,2032-12-31,Active';
 const documentId='source-0',storedPath=join(dir,documentId+'.csv');writeFileSync(storedPath,content);
 state.evidenceDocuments.push({documentId,sourceFilename:'security-register.csv',storedPath,sourceHashSha256:createHash('sha256').update(content).digest('hex'),mediaType:'text/csv',basisState:'active',linkedArtifactId:null,category:'boq_cost',documentType:'bond_register',familyKey:documentId,uploadedAt:'2031-09-01',diagnostics:[],assertions:[]} as any);state.version++;
 const m=commercialCanonical(state);
 const kinds=Object.fromEntries((m.bonds??[]).map(b=>[b.bondId,b.kind]));
 assert.deepEqual(kinds,{'APG-VLC1-0202':'advance_payment','PB-01':'performance','BG-77':'other'});
 assert.deepEqual(m.insurances.map(i=>i.policyId).sort(),['CAR-01','INS-2']);
});
