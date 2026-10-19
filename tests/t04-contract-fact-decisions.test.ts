import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {termAtEvent,contractTermSelectionFactState} from '../packages/runtime-api/src/contract-term-versions';
import {reportingContractTermVersions,contractFactDecisionItemsForState} from '../packages/runtime-api/src/notice-review';
import {contractFactDecisionPatch} from '../packages/runtime-api/src/contract-fact-decisions';
import {projectActionRegisterForState} from '../packages/runtime-api/src/project-projections';
import {commercialFoundationForState} from '../packages/runtime-api/src/commercial-foundation-runtime';

// T04: one decision place for contract terms whose sources disagree: both values,
// their sources and the effect; pick, type your own, change, undo; kept in the
// stored reviewDecisions; every reader (commercial terms, notices) uses the result.
const evidence=(projectId:string,name:string,familyKey:string,basisState:string)=>({
  documentId:projectId+':'+name,category:'contract',documentType:name.startsWith('amendment')?'contract_amendment':'main_contract',
  sourceFilename:name+'.pdf',sourceRelativePath:name+'.pdf',mediaType:'application/pdf',
  storedPath:'/nonexistent/'+name,sourceHashSha256:createHash('sha256').update(name).digest('hex'),sizeBytes:1,uploadedAt:'2031-04-30T00:00:00Z',
  authority:'candidate_only',parserState:'parsed',basisState,familyKey,logicalDocumentKey:name,supersededByDocumentId:null,
  identification:{needsReview:false},lineage:{needsReview:false},sourceRefs:[],
}) as any;
const contract=(documentId:string,role:string,text:string)=>({documentId,role,
  result:{sections:[{heading:'Contract Data',text,startPage:3,sectionKey:'s1',sourceMode:'deterministic',sourceSpans:[]}]}}) as any;
function fixture(store:RuntimeProjectStore,id:string,decisions?:unknown){
  const state=store.getOrCreate(id);
  state.schedules.push({role:'update',format:'xer',sourceFilename:'current.xer',sourceHashSha256:'schedule-hash',uploadedAt:'2031-07-01T00:00:00.000Z',
    revision:{revisionId:'U1',label:'Current',sequence:1,effectiveAt:'2031-06-30',model:{projectId:id,source:'xer',sourceRevisionId:'U1',dataDateIso:'2031-06-30T08:00:00',activities:[],relationships:[],wbs:[],calendars:[],diagnostics:[]}}} as any);
  const adopted=evidence(id,'contract','contract:main','active'),amendment=evidence(id,'amendment','contract:amendment-1','candidate');
  state.evidenceDocuments.push(adopted,amendment);
  (state.contractDocuments as any[]).push(contract(adopted.documentId,'main','Retention percentage: 5%\nPayment period: 56 days'),
    contract(amendment.documentId,'amendment','Effective date: 2031-03-01\nRetention percentage: 10%\nPayment period: 30 days'));
  if(decisions)store.updateControls(id,{reviewDecisions:JSON.parse(JSON.stringify(decisions))});
  return store.get(id)!;
}
const retention=(state:any)=>termAtEvent(reportingContractTermVersions(state),'retentionPercent','2031-06-30') as any;
const decisionAction=(state:any,term:string)=>{const w=projectActionRegisterForState(state).workflow;return [...w.actions,...w.information].find((a:any)=>a.id==='matter:contract-fact:'+term) as any;};
const decide=(store:RuntimeProjectStore,id:string,term:string,input:{choice:string;enteredValue?:unknown})=>{
  const state=store.get(id)!,item=contractFactDecisionItemsForState(state).find(i=>i.term===term)!;
  store.updateControls(id,contractFactDecisionPatch(state,item,input,[]));return store.get(id)!;
};

test('T04 a contract term conflict is shown in the decision place with both values, sources and effect; adopted value used until decided',()=>{
  const store=new RuntimeProjectStore({durable:false}),state=fixture(store,'CF-A');
  const action=decisionAction(state,'retentionPercent');
  assert.ok(action,'the retention conflict has one decision in the decision place');
  assert.equal(action.target.kind,'review-contract-fact');
  assert.match(action.reason,/5 %.*contract\.pdf \(adopted\).*10 %.*amendment\.pdf \(read from source; not formally adopted\)/);
  assert.match(action.reason,/Effect:/);
  assert.deepEqual(action.target.reviewOptions.map((o:any)=>o.value),['use:5|%','use:10|%','enter_value']);
  assert.equal(action.category,'confirmation');
  assert.equal(retention(state).value,5,'adopted value is used until the user decides');
  assert.ok(retention(state).sourceConflicts?.length,'the different unadopted value stays a named conflict');
});

test('T04 pick, type your own, change and undo each update every reader and survive a restart',()=>{
  const store=new RuntimeProjectStore({durable:false});fixture(store,'CF-B');
  // Pick the unadopted value: used, labelled not formally adopted, user-confirmation reference.
  let state=decide(store,'CF-B','retentionPercent',{choice:'use:10|%'});
  let selected=retention(state);
  assert.equal(selected.value,10);assert.equal(selected.state,'established');
  assert.equal(contractTermSelectionFactState(selected).authority,'candidate','a picked unadopted value is never shown as adopted');
  assert.ok(selected.sourceRefs.some((r:string)=>r.startsWith('user-confirmation:contract-fact:retentionPercent:')));
  assert.equal(selected.sourceConflicts,undefined);
  assert.equal((commercialFoundationForState(state).commercialTerms as any).retentionPercent.value,10,'commercial terms read the decided value');
  assert.equal(decisionAction(state,'retentionPercent').category,'information');
  assert.ok(decisionAction(state,'retentionPercent').target.reviewOptions.some((o:any)=>o.value==='undo'));
  // Restart: a fresh store with only the stored (serialised) decisions gives the same value.
  const restarted=fixture(new RuntimeProjectStore({durable:false}),'CF-B',state.controls.reviewDecisions);
  assert.equal(retention(restarted).value,10,'kept after restart');
  // Type your own value.
  state=decide(store,'CF-B','retentionPercent',{choice:'enter_value',enteredValue:'7.5'});
  selected=retention(state);
  assert.equal(selected.value,7.5);assert.equal(selected.unit,'%');
  assert.equal(contractTermSelectionFactState(selected).authority,'candidate');
  assert.match(selected.versions[0].sourceAnalyticalNote,/not formally adopted/);
  assert.match(selected.sourceAnalyticalNote,/Entered by the user/,'a typed value is labelled as the user\'s, never as read from source');
  assert.equal((commercialFoundationForState(state).commercialTerms as any).retentionPercent.value,7.5);
  assert.equal(retention(fixture(new RuntimeProjectStore({durable:false}),'CF-B',state.controls.reviewDecisions)).value,7.5,'typed value kept after restart');
  // Change to the adopted value.
  state=decide(store,'CF-B','retentionPercent',{choice:'use:5|%'});
  assert.equal(retention(state).value,5);
  // Undo restores the prior (source) state, including the named conflict.
  state=decide(store,'CF-B','retentionPercent',{choice:'undo'});
  assert.equal(state.controls.reviewDecisions?.['contract-fact:retentionPercent'],undefined);
  assert.equal(retention(state).value,5);assert.ok(retention(state).sourceConflicts?.length);
  assert.equal(decisionAction(state,'retentionPercent').category,'confirmation');
  // Other terms are untouched by this decision.
  assert.equal((termAtEvent(reportingContractTermVersions(state),'paymentPeriodDays','2031-06-30') as any).value,56);
});

test('T04 the notice period decision reaches the notices page terms and leaves earlier dates unchanged',()=>{
  const store=new RuntimeProjectStore({durable:false}),state=store.getOrCreate('CF-N');
  const adopted=evidence('CF-N','contract','contract:main','active'),amendment=evidence('CF-N','amendment','contract:amendment-1','candidate');
  state.schedules.push({role:'update',format:'xer',sourceFilename:'current.xer',sourceHashSha256:'schedule-hash',uploadedAt:'2031-07-01T00:00:00.000Z',
    revision:{revisionId:'U1',label:'Current',sequence:1,effectiveAt:'2031-06-30',model:{projectId:'CF-N',source:'xer',sourceRevisionId:'U1',dataDateIso:'2031-06-30T08:00:00',activities:[],relationships:[],wbs:[],calendars:[],diagnostics:[]}}} as any);
  state.evidenceDocuments.push(adopted,amendment);
  (state.contractDocuments as any[]).push(contract(adopted.documentId,'main','Notice period: 28 days'),contract(amendment.documentId,'amendment','Effective date: 2031-03-01\nNotice period: 14 days'));
  assert.equal((commercialFoundationForState(state).commercialTerms as any).noticePeriodDays.value,28,'adopted notice period used until decided');
  const item=contractFactDecisionItemsForState(state).find(i=>i.term==='noticePeriodDays');
  assert.ok(item,'notice period conflict offered');
  store.updateControls('CF-N',contractFactDecisionPatch(state,item!,{choice:'use:14|days'},[]));
  const after=store.get('CF-N')!;
  assert.equal((termAtEvent(reportingContractTermVersions(after),'noticePeriodDays','2031-06-30') as any).value,14);
  // The notices page reads the notice period from the shared commercial terms.
  const notice=(commercialFoundationForState(after).commercialTerms as any).noticePeriodDays;
  assert.equal(notice.value,14,'the notices page reads the decided notice period');
  assert.ok(notice.basis.sourceRefs.some((r:string)=>r.startsWith('user-confirmation:contract-fact:noticePeriodDays:')));
  assert.equal(notice.authority,'candidate','never shown as formally adopted');
  // Dates before the decided interval still read the adopted provision.
  assert.equal((termAtEvent(reportingContractTermVersions(after),'noticePeriodDays','2031-02-01') as any).value,28);
});

test('T04 a stale decision is refused and never applied after the sources change',()=>{
  const store=new RuntimeProjectStore({durable:false});fixture(store,'CF-S');
  const state=decide(store,'CF-S','retentionPercent',{choice:'use:10|%'});
  const old=contractFactDecisionItemsForState(state).find(i=>i.term==='retentionPercent')!;
  assert.throws(()=>contractFactDecisionPatch(state,old,{choice:'use:99|%'},[]),/Select one of the available decisions/);
  assert.throws(()=>contractFactDecisionPatch(state,old,{choice:'enter_value',enteredValue:''},[]),/Enter the value/);
  // A source change detaches the decision: the source reading returns and the decision is asked again.
  const second=evidence('CF-S','amendment-2','contract:amendment-2','candidate');
  state.evidenceDocuments.push(second);
  (state.contractDocuments as any[]).push(contract(second.documentId,'amendment','Effective date: 2031-04-01\nRetention percentage: 3%'));
  store.updateControls('CF-S',{});
  const changed=store.get('CF-S')!;
  const item=contractFactDecisionItemsForState(changed).find(i=>i.term==='retentionPercent');
  if(item){
    assert.notEqual(item.fingerprint,old.fingerprint,'the old fingerprint no longer matches');
    assert.equal(item.decision,null,'the stale decision is not applied');
  }
  assert.ok(!(retention(changed).sourceRefs??[]).some((r:string)=>r.startsWith('user-confirmation:')),'stale decision never applied');
});
