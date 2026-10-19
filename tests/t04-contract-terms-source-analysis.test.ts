import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {contractCompletionPosition} from '../packages/runtime-api/src/contract-completion';
import {contractTermVersions,termAtEvent,contractTermSelectionFactState} from '../packages/runtime-api/src/contract-term-versions';
import {canonicalTimeClaims} from '../packages/runtime-api/src/canonical-time-claims';

// T04: contract dates and terms follow the one shared source-analytical rule.
// A unique, fully read contract candidate is used in analysis and labelled as
// read from source, not formally adopted. Competing candidates stay held. An
// adopted value is never erased or overridden; a different unadopted value is
// kept as a named source conflict. Stored basisState/authority never change.
const evidence=(projectId:string,name:string,familyKey:string,basisState='candidate',extra:Record<string,unknown>={})=>({
  documentId:projectId+':'+name,category:'contract',documentType:'main_contract',
  sourceFilename:name+'.pdf',sourceRelativePath:name+'.pdf',mediaType:'application/pdf',
  storedPath:'/nonexistent/'+name,sourceHashSha256:createHash('sha256').update(name).digest('hex'),sizeBytes:1,uploadedAt:'2031-04-30T00:00:00Z',
  authority:'candidate_only',parserState:'parsed',basisState,familyKey,logicalDocumentKey:name,supersededByDocumentId:null,
  identification:{needsReview:false},lineage:{needsReview:false},sourceRefs:[],...extra,
}) as any;
const contract=(documentId:string,role:string,text:string)=>({documentId,role,
  result:{sections:[{heading:'Contract Data',text,startPage:3,sectionKey:'s1',sourceMode:'deterministic',sourceSpans:[]}]}}) as any;
const setup=(id:string)=>{const store=new RuntimeProjectStore({durable:false});return store.getOrCreate(id);};

test('T04 completion date read from a unique clearly read contract candidate is used, state candidate, labelled not formally adopted',()=>{
  const state=setup('T04-CT-A');
  const source=evidence(state.projectId,'contract','contract:main');
  state.evidenceDocuments.push(source);
  (state.contractDocuments as any[]).push(contract(source.documentId,'main','Date for Completion: 2031-12-31'));
  const snapshot=JSON.stringify(state.evidenceDocuments);
  const position=contractCompletionPosition(state,'2031-06-30') as any;
  assert.equal(position.value,'2031-12-31','clear source date is not held behind formal adoption');
  assert.equal(position.state,'candidate','never shown as official without adoption');
  assert.equal(position.sourceAnalyticalUse,'qualified_source_read');
  assert.match(position.sourceAnalyticalNote,/not formally adopted/);
  assert.ok(position.sourceRefs.some((r:string)=>r.startsWith('evidence-document:'+source.documentId+':')));
  const basis=canonicalTimeClaims(state,true).contractTimeBasis as any;
  assert.equal(basis?.contractualCompletionIso,'2031-12-31','every page reads the same canonical time position');
  assert.equal(basis?.contractualCompletionState,'candidate');
  assert.equal(basis?.contractualCompletionSourceUse,'qualified_source_read');
  assert.match(basis?.contractualCompletionSourceNote??'',/not formally adopted/);
  assert.equal(JSON.stringify(state.evidenceDocuments),snapshot,'stored basisState and authority unchanged');
});

test('T04 competing, review-needed and superseded contract candidates stay held',()=>{
  for(const variant of ['competing','review','superseded']){
    const state=setup('T04-CT-B-'+variant);
    const a=evidence(state.projectId,'contract-a','contract:main','candidate',
      variant==='review'?{identification:{needsReview:true}}:variant==='superseded'?{supersededByDocumentId:'x'}:{});
    state.evidenceDocuments.push(a);
    (state.contractDocuments as any[]).push(contract(a.documentId,'main','Date for Completion: 2031-12-31\nRetention percentage: 5%'));
    if(variant==='competing'){
      const b=evidence(state.projectId,'contract-b','contract:main');
      state.evidenceDocuments.push(b);
      (state.contractDocuments as any[]).push(contract(b.documentId,'main','Date for Completion: 2032-01-31\nRetention percentage: 10%'));
    }
    const position=contractCompletionPosition(state,'2031-06-30') as any;
    assert.equal(position.value,null,variant+' candidate is held');
    assert.equal(position.state,'missing');
    assert.equal(position.sourceAnalyticalUse,undefined);
    assert.equal(contractTermVersions(state).length,0,variant+' candidate terms are held');
  }
});

test('T04 an adopted completion date is never overridden by an unadopted amendment; the different date is a named conflict',()=>{
  const state=setup('T04-CT-C');
  const adopted=evidence(state.projectId,'contract','contract:main','active');
  const amendment=evidence(state.projectId,'amendment','contract:amendment-1');
  state.evidenceDocuments.push(adopted,amendment);
  (state.contractDocuments as any[]).push(contract(adopted.documentId,'main','Date for Completion: 2031-12-31'),
    contract(amendment.documentId,'amendment','Effective date: 2031-03-01\nRevised Date for Completion: 2032-03-31'));
  const position=contractCompletionPosition(state,'2031-06-30') as any;
  assert.equal(position.value,'2031-12-31','adopted date kept');
  assert.equal(position.state,'official');
  assert.equal(position.sourceAnalyticalUse,undefined,'adopted date is not labelled unadopted');
  assert.deepEqual(position.sourceConflicts,['UNADOPTED_SOURCE_COMPLETION_DIFFERS:2032-03-31:'+amendment.documentId]);
  assert.equal(state.evidenceDocuments[1]!.basisState,'candidate');
});

test('T04 a user-confirmed completion date is not replaced by a date read only from an unadopted contract',()=>{
  const state=setup('T04-CT-D');
  const source=evidence(state.projectId,'contract','contract:main');
  state.evidenceDocuments.push(source);
  (state.contractDocuments as any[]).push(contract(source.documentId,'main','Date for Completion: 2031-12-31'));
  state.controls.contractTimeBasis={contractualCompletionIso:'2031-11-30',contractualCompletionState:'official',officialApprovedEotDays:null,officialApprovedEotState:'missing',
    eotDayBasis:'unknown',eotDayBasisState:'missing',sourceRefs:['user-confirmation:contract-completion:1']} as any;
  const basis=canonicalTimeClaims(state,true).contractTimeBasis as any;
  assert.equal(basis.contractualCompletionIso,'2031-11-30','confirmed date kept');
  assert.equal(basis.contractualCompletionState,'official');
  assert.deepEqual(basis.contractualCompletionSourceConflicts,['UNADOPTED_SOURCE_COMPLETION_DIFFERS:2031-12-31:'+source.documentId]);
});

test('T04 contract term values read from a unique candidate are used with a not-adopted label and never reported as source authority',()=>{
  const state=setup('T04-CT-E');
  const source=evidence(state.projectId,'contract','contract:main');
  state.evidenceDocuments.push(source);
  (state.contractDocuments as any[]).push(contract(source.documentId,'main','Retention percentage: 5%\nPayment period: 56 days'));
  const versions=contractTermVersions(state);
  assert.ok(versions.length>=2,'clear contract terms are read, not held');
  assert.ok(versions.every(v=>v.sourceAnalyticalUse==='qualified_source_read'&&/not formally adopted/.test(v.sourceAnalyticalNote??'')));
  const retention=termAtEvent(versions,'retentionPercent','2031-06-30') as any;
  assert.equal(retention.state,'established');assert.equal(retention.value,5);
  assert.equal(retention.sourceAnalyticalUse,'qualified_source_read');
  assert.deepEqual(contractTermSelectionFactState(retention),{state:'established',authority:'candidate'},'never shown as source-adopted authority');
  assert.equal(state.evidenceDocuments[0]!.basisState,'candidate');
});

test('T04 an adopted contract term is never erased by a different unadopted value; the difference is a named conflict',()=>{
  const state=setup('T04-CT-F');
  const adopted=evidence(state.projectId,'contract','contract:main','active');
  const particulars=evidence(state.projectId,'particulars','contract:particulars');
  state.evidenceDocuments.push(adopted,particulars);
  (state.contractDocuments as any[]).push(contract(adopted.documentId,'main','Retention percentage: 5%'),
    contract(particulars.documentId,'amendment','Effective date: 2031-01-01\nRetention percentage: 10%'));
  const retention=termAtEvent(contractTermVersions(state),'retentionPercent','2031-06-30') as any;
  assert.equal(retention.state,'established','the adopted value is not turned into an unresolved conflict');
  assert.equal(retention.value,5,'adopted value kept');
  assert.equal(retention.sourceAnalyticalUse,undefined);
  assert.deepEqual(retention.sourceConflicts,['UNADOPTED_SOURCE_CONTRACT_TERM_DIFFERS:retentionPercent:10 %:'+particulars.documentId]);
  assert.deepEqual(contractTermSelectionFactState(retention),{state:'established',authority:'source'});
});
