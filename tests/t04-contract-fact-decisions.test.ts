import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {termAtEvent,contractTermSelectionFactState} from '../packages/runtime-api/src/contract-term-versions';
import {reportingContractTermVersions,contractFactDecisionItemsForState} from '../packages/runtime-api/src/notice-review';
import {contractFactDecisionPatch,completionDecisionItem,completionDecisionPatch} from '../packages/runtime-api/src/contract-fact-decisions';
import {canonicalTimeClaims} from '../packages/runtime-api/src/canonical-time-claims';
import {reportingTimeBasis,contractValueReview,reportingContractValue,contractValueEntryInput} from '../packages/runtime-api/src/source-review-decisions';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
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
  // A complete reader result shape (the action register reads clauses and diagnostics too).
  result:{sourceType:'pdf',physicalComplete:true,semanticComplete:true,clauses:[],diagnostics:[],
    sections:[{heading:'Contract Data',text,startPage:3,sectionKey:'s1',sourceMode:'deterministic',sourceSpans:[]}]}}) as any;
// A real parsed programme (the action register reads the full schedule model).
const xer=(project:string,date:string)=>new TextEncoder().encode(['ERMHDR\t23.12',
  '%T\tPROJECT','%F\tproj_id\tproj_short_name\tdata_date','%R\t1\t'+project+'\t'+date,
  '%T\tPROJWBS','%F\twbs_id\tproj_id\twbs_short_name','%R\t10\t1\tROOT',
  '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct',
  '%R\t100\t1\t10\tA100\tMain works\tTK_Active\t'+date+'\t2031-12-30\t'+date+'\t2031-12-30\t240\t160\t16\t35','%E'].join('\n'));
async function programmeFixture(store:RuntimeProjectStore,id:string){
  await store.ingestSchedule({projectId:id,bytes:xer(id,'2031-06-30'),mediaType:'text/plain',sourceFilename:'Current_Programme.xer',sourceRelativePath:'Schedules/Current_Programme.xer',
    role:'update',roleConfirmed:true,label:'Current programme',uploadedAt:'2031-07-01T10:00:00Z',uploadIntent:'add_update'} as any);
  store.adoptSchedule(id,store.get(id)!.schedules[0]!.revision.revisionId);
  return fixture(store,id,undefined,false);
}
function fixture(store:RuntimeProjectStore,id:string,decisions?:unknown,withMinimalSchedule=true){
  const state=store.getOrCreate(id);
  if(withMinimalSchedule)state.schedules.push({role:'update',format:'xer',sourceFilename:'current.xer',sourceHashSha256:'schedule-hash',uploadedAt:'2031-07-01T00:00:00.000Z',
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

test('T04 a contract term conflict is shown in the decision place with both values, sources and effect; adopted value used until decided',async()=>{
  const store=new RuntimeProjectStore({durable:false}),state=await programmeFixture(store,'CF-A');
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

test('T04 pick, type your own, change and undo each update every reader and survive a restart',async()=>{
  const store=new RuntimeProjectStore({durable:false});await programmeFixture(store,'CF-B');
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

// (a) Contractual completion date: one decision, applied to the canonical time
// position and to reportingTimeBasis together so every page reads the same date.
function completionFixture(store:RuntimeProjectStore,id:string,decisions?:unknown){
  const state=store.getOrCreate(id);
  state.schedules.push({role:'update',format:'xer',sourceFilename:'current.xer',sourceHashSha256:'schedule-hash',uploadedAt:'2031-07-01T00:00:00.000Z',
    revision:{revisionId:'U1',label:'Current',sequence:1,effectiveAt:'2031-06-30',model:{projectId:id,source:'xer',sourceRevisionId:'U1',dataDateIso:'2031-06-30T08:00:00',activities:[],relationships:[],wbs:[],calendars:[],diagnostics:[]}}} as any);
  const adopted=evidence(id,'contract','contract:main','active'),amendment=evidence(id,'amendment','contract:amendment-1','candidate');
  state.evidenceDocuments.push(adopted,amendment);
  (state.contractDocuments as any[]).push(contract(adopted.documentId,'main','Date for Completion: 2031-12-31'),
    contract(amendment.documentId,'amendment','Effective date: 2031-03-01\nRevised Date for Completion: 2032-03-31'));
  if(decisions)store.updateControls(id,{reviewDecisions:JSON.parse(JSON.stringify(decisions))});
  return store.get(id)!;
}
const completionDates=(state:any)=>{
  const canonical=canonicalTimeClaims(state,true).contractTimeBasis as any;
  const reporting=reportingTimeBasis(state,canonical) as any;
  return {canonical:canonical?.contractualCompletionIso?.slice(0,10)??null,reporting:reporting?.contractualCompletionIso?.slice(0,10)??null,canonicalBasis:canonical,reportingBasis:reporting};
};
const decideCompletion=(store:RuntimeProjectStore,id:string,input:{choice:string;enteredDateIso?:unknown})=>{
  const state=store.get(id)!,item=completionDecisionItem(state)!;
  store.updateControls(id,completionDecisionPatch(state,item,input,[]));return store.get(id)!;
};

test('T04 completion date: conflict offered with both dates; pick, type, change, undo reach canonical and reporting readers alike',()=>{
  const store=new RuntimeProjectStore({durable:false});let state=completionFixture(store,'CF-C');
  const item=completionDecisionItem(state);
  assert.ok(item,'the different unadopted completion date is offered as a decision');
  assert.deepEqual(item!.candidates.map(c=>[c.date,c.adopted]),[['2031-12-31',true],['2032-03-31',false]]);
  let dates=completionDates(state);
  assert.deepEqual([dates.canonical,dates.reporting],['2031-12-31','2031-12-31'],'adopted date used until decided');
  // Pick the unadopted date.
  state=decideCompletion(store,'CF-C',{choice:'use:2032-03-31'});dates=completionDates(state);
  assert.deepEqual([dates.canonical,dates.reporting],['2032-03-31','2032-03-31'],'every reader shows the decided date');
  assert.equal(dates.canonicalBasis.contractualCompletionState,'candidate','never shown as formally adopted');
  assert.match(dates.canonicalBasis.contractualCompletionSourceNote,/not formally adopted/);
  assert.ok(dates.canonicalBasis.sourceRefs.some((r:string)=>r.startsWith('user-confirmation:contract-fact:contractualCompletion:')));
  // Type your own date.
  state=decideCompletion(store,'CF-C',{choice:'enter_value',enteredDateIso:'2032-06-30'});dates=completionDates(state);
  assert.deepEqual([dates.canonical,dates.reporting],['2032-06-30','2032-06-30']);
  assert.throws(()=>completionDecisionPatch(state,completionDecisionItem(state)!,{choice:'enter_value',enteredDateIso:'2032-02-30'},[]),/valid contractual completion date/);
  // Change back to the adopted date, then undo: the prior source state returns.
  state=decideCompletion(store,'CF-C',{choice:'use:2031-12-31'});
  assert.equal(completionDates(state).canonical,'2031-12-31');
  state=decideCompletion(store,'CF-C',{choice:'undo'});dates=completionDates(state);
  assert.deepEqual([dates.canonical,dates.reporting],['2031-12-31','2031-12-31']);
  assert.equal(dates.canonicalBasis.contractualCompletionState,'official');
  assert.ok(!dates.canonicalBasis.sourceRefs.some((r:string)=>r.startsWith('user-confirmation:contract-fact:')),'undo leaves no decision reference');
  assert.equal(completionDecisionItem(state)!.decision,null);
});

test('T04 completion and term decisions survive a fresh durable store (restart)',()=>{
  const dataDir=mkdtempSync(join(tmpdir(),'cmeng-t04-contract-fact-'));
  try{
    const first=new RuntimeProjectStore({dataDir,durable:true});
    completionFixture(first,'CF-R');
    let state=decideCompletion(first,'CF-R',{choice:'use:2032-03-31'});
    const savedDecisions=JSON.parse(JSON.stringify(state.controls.reviewDecisions));
    const second=new RuntimeProjectStore({dataDir,durable:true});
    const restored=second.get('CF-R');
    assert.ok(restored,'project restored from disk');
    assert.deepEqual(restored!.controls.reviewDecisions?.['contract-fact:contractualCompletion'],savedDecisions['contract-fact:contractualCompletion'],'decision kept after restart');
    // Same sources after restart give the same decided date on every reader.
    const again=completionFixture(new RuntimeProjectStore({durable:false}),'CF-R',restored!.controls.reviewDecisions);
    const dates=completionDates(again);
    assert.deepEqual([dates.canonical,dates.reporting],['2032-03-31','2032-03-31']);
  }finally{rmSync(dataDir,{recursive:true,force:true});}
});

// (c) Contract value and currency: type your own and undo on the existing decision.
test('T04 contract value decision: type your own amount and currency, change and undo',()=>{
  const store=new RuntimeProjectStore({durable:false}),state=store.getOrCreate('CF-V');
  state.contract={semanticComplete:true,pdf:{pages:[]},sections:[
    {sectionKey:'amount-1',kind:'clause',text:'Accepted Contract Amount AED 1,000',startPage:1,diagnostics:[]},
    {sectionKey:'amount-2',kind:'clause',text:'Contract Sum SAR 1,200',startPage:2,diagnostics:[]},
  ].map((s,index)=>({...s,sourceSpans:[{sourceKind:'pdf_page',sourceIndex:index+1,start:0,end:40}],status:'verified',sourceMode:'deterministic'}))} as any;
  const review=contractValueReview(state);
  assert.equal(review.candidates.length,2);assert.equal(reportingContractValue(state),null);
  assert.throws(()=>contractValueEntryInput({enteredValue:'1500',enteredCurrency:'dirham'}),/three-letter currency/);
  assert.throws(()=>contractValueEntryInput({enteredValue:'',enteredCurrency:'AED'}),/positive amount/);
  store.updateControls('CF-V',{reviewDecisions:{'contract-value':{sourceFingerprint:review.sourceFingerprint,choice:'enter_value',...contractValueEntryInput({enteredValue:'1,500',enteredCurrency:'usd'}),confirmedAt:'2031-07-01T00:00:00Z',sourceRefs:[]}}});
  const typed=reportingContractValue(store.get('CF-V')!) as any;
  assert.deepEqual([typed.amount,typed.currency],[1500,'USD'],'the typed amount and currency are used');
  assert.ok(typed.sourceRefs.some((r:string)=>r.startsWith('user-confirmation:contract-value:')));
  assert.equal(store.get('CF-V')!.controls.contractValue,null,'the governed control is never overwritten');
  store.updateControls('CF-V',{reviewDecisions:{'contract-value':{sourceFingerprint:review.sourceFingerprint,choice:'value:SAR:1200',confirmedAt:'2031-07-01T00:00:00Z',sourceRefs:[]}}});
  assert.deepEqual([(reportingContractValue(store.get('CF-V')!) as any).currency,(reportingContractValue(store.get('CF-V')!) as any).amount],['SAR',1200]);
  store.updateControls('CF-V',{reviewDecisions:{}});
  assert.equal(reportingContractValue(store.get('CF-V')!),null,'undo restores the undecided state');
});

// Route: a stale project version and a decision that is no longer open are refused.
test('T04 confirm-review refuses a stale version and a contract decision that is not open',async t=>{
  const root=mkdtempSync(join(tmpdir(),'contract-fact-route-'));const gateway=await createProjectGateway(root,{maxWorkers:1});
  t.after(async()=>{await gateway.close();rmSync(root,{recursive:true,force:true});});
  await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+(gateway.server.address() as any).port;
  const post=(path:string,body:any)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post('/api/projects',{projectId:'ROUTE-CF'})).status,201);
  const workflow=await (await fetch(base+'/api/projects/ROUTE-CF/actions')).json() as any;
  const version=workflow.projectVersion??workflow.version;
  const stale=await post('/api/projects/ROUTE-CF/actions/confirm-review',{expectedVersion:(typeof version==='number'?version:0)-1,actionId:'matter:contract-fact:retentionPercent',sourceFingerprint:'x',choice:'use:5|%'});
  assert.equal(stale.status,409);assert.match((await stale.json() as any).message,/changed/);
  const notOpen=await post('/api/projects/ROUTE-CF/actions/confirm-review',{expectedVersion:version,actionId:'matter:contract-fact:contractualCompletion',sourceFingerprint:'x',choice:'use:2031-12-31'});
  assert.equal(notOpen.status,409,'no decision is saved when the conflict is not open');
});
