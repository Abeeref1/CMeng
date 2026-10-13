import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runInNewContext} from 'node:vm';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {noticeReviewBasis,noticeReviewInput,reportingContractTermVersions} from '../packages/runtime-api/src/notice-review';
import {contractTermVersions,termAtEvent} from '../packages/runtime-api/src/contract-term-versions';
import {contractNoticeRules} from '../packages/runtime-api/src/contract-notice-rules';
import {assessEventNotice} from '../packages/delay-analysis-core/src';
import {projectActions} from '../packages/runtime-api/src/project-actions';
import {summarizeControlIssues} from '../packages/truth-kernel/src';
import {projectActionsScript} from '../packages/runtime-api/src/ui-project-actions';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {buildNoticesClaimsProjection,noticeComplianceAssessable} from '../packages/notices-claims/src';
import {basisReviewScript} from '../packages/runtime-api/src/ui-basis-review';
import {commercialFoundationForState} from '../packages/runtime-api/src/commercial-foundation-runtime';

function fixture(t:any){
 const root=mkdtempSync(join(tmpdir(),'notice-review-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false}),state=store.getOrCreate('NOTICE');
 const add=(id:string,text:string,role='main',page=4)=>{
  state.evidenceDocuments.push({documentId:id,sourceHashSha256:'hash-'+id,sourceFilename:id+'.pdf',uploadedAt:'2031-08-31',mediaType:'application/pdf',readinessAssertions:[],controlAssertions:[],category:'contract',basisState:role==='main'?'active':'additive',documentType:role==='main'?'main_contract':'contract_amendment'} as any);
  state.contractDocuments.push({documentId:id,role,result:{sections:[{sectionKey:'notice',text,startPage:page,sourceMode:'deterministic'}]}} as any);state.version++;
 };
 add('MAIN','Initial Claim Notice 28 calendar days after the event start\nFully Detailed Claim 81 days');
 add('AMD','Effective Date: 2031-06-01\nInitial Claim Notice 14 calendar days after the event start','amendment',9);
 const save=(choice:string,keys?:string[])=>{
  const basis=noticeReviewBasis(state),input=noticeReviewInput(state,{choice,reference:'NOTICE-CHECK',noticeSourceKeys:keys});
  state.controls.reviewDecisions={'notice-term-versions':{...input,choice,sourceFingerprint:basis.sourceFingerprint,confirmedAt:'2031-08-31',sourceRefs:basis.sourceRefs}};state.version++;
 };
 return {root,store,state,add,save};
}
const event=(startIso:string)=>({eventId:'E',title:'Access',category:'late_access',startIso,awarenessIso:null,endIso:null,responsibility:'unknown',responsibilityState:'missing',describedImpactDays:null,describedImpactState:'missing',relatedActivityIds:[],relatedClauseIdentifiers:[],evidenceRefs:[],diagnostics:[]} as any);
const assessment=(state:any,date:string)=>assessEventNotice(event(date),[],contractNoticeRules(state));

test('notice review preserves original periods and page evidence, remains editable and expires on changed source bytes',t=>{
 const {state,save}=fixture(t),before=JSON.stringify(state.contractDocuments),terms=contractTermVersions(state);
 let workflow=projectActions(state,summarizeControlIssues([]));let action=workflow.actions.find(a=>a.target.kind==='review-notice')!;
 assert.ok(action);assert.match(action.evidenceSummary!.join(' '),/28 calendar days.*page 4.*14 calendar days.*page 9/);
 const html=runInNewContext(projectActionsScript+';actionResolutionHtml(action)',{action,project:()=>state.projectId,escapeHtml:String});
 assert.match(html,/review-notice-source/);assert.match(html,/Download retained source/);assert.match(html,/Notice review reference/);
 save('confirm_versions');assert.equal(assessment(state,'2031-05-31').requiredNoticeDays,28);assert.equal(assessment(state,'2031-06-01').requiredNoticeDays,14);
 assert.deepEqual(contractTermVersions(state),terms);assert.equal(JSON.stringify(state.contractDocuments),before);
 save('refer_contracts');assert.equal(assessment(state,'2031-06-01').requiredNoticeDays,null);
 assert.equal(termAtEvent(reportingContractTermVersions(state),'noticePeriodDays','2031-06-01').value,null);
 workflow=projectActions(state,summarizeControlIssues([]));action=workflow.information.find(a=>a.target.kind==='review-notice')!;
 assert.equal(action.target.type,'inline');assert.equal(action.target.reviewChoice,'refer_contracts');assert.equal(action.target.reviewReference,'NOTICE-CHECK');
 save('confirm_versions');state.evidenceDocuments[0]!.sourceHashSha256='new-bytes';state.version++;
 assert.equal(noticeReviewBasis(state).decision,null);assert.ok(projectActions(state,summarizeControlIssues([])).actions.some(a=>a.target.kind==='review-notice'));
});

test('selecting provisions resolves only their source intervals and never extends a discarded amendment',t=>{
 const {state,save}=fixture(t),basis=noticeReviewBasis(state);
 save('choose_provisions',[basis.candidates.find(c=>c.documentId==='MAIN')!.sourceKey]);
 assert.equal(assessment(state,'2031-05-31').requiredNoticeDays,28);
 assert.equal(assessment(state,'2031-06-01').requiredNoticeDays,null);
 assert.equal(termAtEvent(reportingContractTermVersions(state),'noticePeriodDays','2031-06-01').value,null);
 assert.equal(contractNoticeRules(state,'detailed_claim')[0]!.noticePeriodDays,81);
 assert.equal(contractTermVersions(state).filter(t=>t.term==='noticePeriodDays').length,2);
 const shared=commercialFoundationForState(state).commercialTerms;
 assert.deepEqual(shared.datedTerms?.filter(t=>t.term==='noticePeriodDays').map(t=>t.value),[28]);
 assert.deepEqual(shared.noticeReview?.sourceTerms.map(t=>t.value),[28,14]);
 assert.equal(shared.noticeReview?.reference,'NOTICE-CHECK');
});

test('notice choice rejects overlapping alternatives, unknown source identities and ungrounded dates',t=>{
 const {state,add,save}=fixture(t);
 add('ALTERNATIVE','Initial Claim Notice 35 calendar days after the event start');
 assert.throws(()=>save('confirm_versions'),/overlap/);
 let basis=noticeReviewBasis(state);const main=basis.candidates.find(c=>c.documentId==='MAIN')!;
 for(const keys of [[],['invented'],[main.sourceKey,main.sourceKey]])assert.throws(()=>save('choose_provisions',keys));
 assert.throws(()=>noticeReviewInput(state,{choice:'confirm_versions',reference:''}),/reference/);
 save('choose_provisions',basis.candidates.filter(c=>c.documentId!=='ALTERNATIVE').map(c=>c.sourceKey));
 assert.equal(assessment(state,'2031-05-31').requiredNoticeDays,28);assert.equal(assessment(state,'2031-06-01').requiredNoticeDays,14);
 add('UNDATED','Initial Claim Notice 10 calendar days after the event start','amendment');
 assert.throws(()=>save('confirm_versions'),/prospective/);
 assert.equal(assessment(state,'2031-07-01').requiredNoticeDays,null,'an undated amendment cannot silently leave the original rule authoritative');
});

test('notice rules use the same explicit slash-date amendment interval as the contract term reader',t=>{
 const {state,add,save}=fixture(t);
 add('LATER','Effective from: 01/07/2031\nInitial Claim Notice 9 calendar days after the event start','amendment');
 save('confirm_versions');assert.equal(termAtEvent(reportingContractTermVersions(state),'noticePeriodDays','2031-07-01').value,9);
 assert.equal(assessment(state,'2031-07-01').requiredNoticeDays,9);
});

test('working-day provisions and missing contractual triggers cannot become calendar-day notice conclusions',t=>{
 const {state,add,save}=fixture(t);
 add('WORKING','Effective Date: 2031-07-01\nInitial Claim Notice 8 working days after the event start','amendment');
 save('confirm_versions');assert.equal(assessment(state,'2031-07-03').requiredNoticeDays,null);
 const rule=contractNoticeRules(state).find(r=>r.noticePeriodDays===8)!;assert.equal(rule.sourceDayBasis,'working');
 assert.equal(assessEventNotice(event('2031-07-03'),[],[{...rule,sourceDayBasis:undefined,triggerBasis:'not_stated'}] as any).requiredNoticeDays,null);
});

test('notice readiness and rendered source comparison retain unresolved interpretations and excluded originals',t=>{
 const {state,save}=fixture(t);
 const projection=()=>buildNoticesClaimsProjection({projectId:state.projectId,evidenceRevisionId:'R',events:[event('2031-06-03')],claims:[],notices:[],noticeRequirements:contractNoticeRules(state),diagnostics:[]},{generatedAt:'2031-08-31',producerVersion:'test'});
 assert.equal(noticeComplianceAssessable(projection()),true,'a known requirement and no issued notice is an assessable absence');
 save('refer_contracts');assert.equal(projection().noticeRequirementConflictCount,1);assert.equal(noticeComplianceAssessable(projection()),false);
 const basis=noticeReviewBasis(state);save('choose_provisions',[basis.candidates.find(c=>c.documentId==='MAIN')!.sourceKey]);
 assert.equal(noticeComplianceAssessable(projection()),false,'an uncovered source interval cannot be reported assessed');
 const position={foundation:{commercialTerms:{noticeReview:{sourceTerms:basis.candidates,reference:'SOURCE-REVIEW',treatment:'choose_provisions'}}},contractNoticeRules:contractNoticeRules(state)};
 const html=runInNewContext(basisReviewScript+';renderCommercialExceptions(position,"contract-particulars-bonds",{})',{position,escapeHtml:String,readerText:String,humanizeKey:String,fmt:String,fmtForField:(_:string,v:any)=>String(v),planningShortDate:String,currentModuleResult:{key:'contract-particulars-bonds'}});
 assert.match(html,/Retained initial notice provisions/);assert.match(html,/evidence-document:AMD:page:9/);assert.match(html,/>14</);assert.match(html,/SOURCE-REVIEW/);assert.match(html,/Review notice provisions/);
});

test('notice provision selection survives a real gateway restart and retains both source files',async t=>{
 const root=mkdtempSync(join(tmpdir(),'notice-gateway-'));let gateway:Awaited<ReturnType<typeof createProjectGateway>>|undefined;
 t.after(async()=>{await gateway?.close();rmSync(root,{recursive:true,force:true});});
 const {PDFDocument,StandardFonts}=await import('pdf-lib');
 const pdf=async(text:string)=>{const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);doc.addPage();const page=doc.addPage();text.split('\n').forEach((line,i)=>page.drawText(line,{x:35,y:720-i*25,font,size:11}));return await doc.save();};
 const store=new RuntimeProjectStore({dataDir:root,durable:false});store.getOrCreate('NOTICE-API');
 const ingest=async(role:'main'|'amendment',text:string)=>store.ingestContract({projectId:'NOTICE-API',bytes:await pdf(text),mediaType:'application/pdf',sourceFilename:role+'.pdf',role,uploadedAt:'2031-08-31'});
 await ingest('main','Initial Claim Notice 28 calendar days after the event start');
 await ingest('amendment','Effective Date: 2031-06-01\nInitial Claim Notice 14 calendar days after the event start');
 let base='';const start=async()=>{gateway=await createProjectGateway(root,{maxWorkers:1});await new Promise<void>(r=>gateway!.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+(gateway.server.address() as any).port;};await start();
 const get=async(path='/actions')=>{const r=await fetch(base+'/api/projects/NOTICE-API'+path);assert.equal(r.status,200);return await r.json() as any;};
 let workflow=await get(),action=workflow.actions.find((a:any)=>a.target.kind==='review-notice');assert.ok(action);
 const sources=(await get('/evidence/documents')).documents.map((d:any)=>[d.documentId,d.sourceHashSha256]);
 const request=(extra:any)=>fetch(base+'/api/projects/NOTICE-API/actions/confirm-review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedVersion:workflow.projectVersion,actionId:action.id,sourceFingerprint:action.reviewFingerprint,choice:'confirm_versions',reference:'NOTICE-API-CHECK',...extra})});
 for(const bad of [{expectedVersion:workflow.projectVersion-1},{sourceFingerprint:'old'},{reference:''},{choice:'invented'}])assert.equal((await request(bad)).status,409);
 const saved=await request({});assert.equal(saved.status,200,await saved.text());
 await gateway!.close();await start();workflow=await get();action=workflow.information.find((a:any)=>a.target.kind==='review-notice');assert.ok(action);assert.equal(action.target.reviewReference,'NOTICE-API-CHECK');assert.equal(action.target.noticeCandidates.length,2);
 assert.equal((await request({choice:'refer_contracts',reference:'CONTRACTS-QUERY'})).status,200);
 workflow=await get();action=workflow.information.find((a:any)=>a.target.kind==='review-notice');assert.equal(action.target.type,'inline');
 assert.equal((await request({choice:'choose_provisions',noticeSourceKeys:[action.target.noticeCandidates[0].sourceKey],reference:'SELECTED-SOURCE'})).status,200);
 assert.deepEqual((await get('/evidence/documents')).documents.map((d:any)=>[d.documentId,d.sourceHashSha256]),sources);
});
