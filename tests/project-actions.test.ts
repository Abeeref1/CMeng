import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runInNewContext} from 'node:vm';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {projectActionsScript,projectActionsStyles} from '../packages/runtime-api/src/ui-project-actions';
import {createSourceFile, ScriptTarget, isFunctionDeclaration} from 'typescript';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
// Real list-total and count-text helpers from the built page script (T05), loaded the same way other tests load page helpers.
const countHelpers=(()=>{const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;const source=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
  return 'let responsePopulationRoot=null,responsePopulationIndex=new WeakMap(),responseRowPopulationIndex=new WeakMap();\n'+source.statements.filter(isFunctionDeclaration).filter(n=>['indexResponsePopulations','listTotal','knownScreenCount','screenCountText'].includes(n.name?.text??'')).map(n=>n.getText(source)).join('\n')+'\n';})();
const xer=(date:string,name:string)=>['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tCONTROL\t'+date,'%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt','%R\t1\t1\tA1\t'+name+'\t2031-01-01\t2031-12-31\t80\t80','%E'].join('\n');
test('uncertain document classification reaches Project Review and stays editable after restart',async t=>{
 const root=mkdtempSync(join(tmpdir(),'classification-review-'));let gateway=await createProjectGateway(root,{maxWorkers:1}),base='';
 t.after(async()=>{await gateway.close();rmSync(root,{recursive:true,force:true});});
 const listen=async()=>{await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+(gateway.server.address() as any).port;};await listen();
 const post=(path:string,body:any)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await post('/api/projects',{projectId:'TYPE-REVIEW'})).status,201);
 assert.equal((await fetch(base+'/api/projects/TYPE-REVIEW/evidence/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'Uncertain.txt'},body:'A source document awaiting a detailed content review.'})).status,201);
 const get=async(path='/actions')=>{const r=await fetch(base+'/api/projects/TYPE-REVIEW'+path);assert.equal(r.status,200);return await r.json() as any;};
 const original=(await get('/evidence/documents')).documents[0];assert.equal(original.identification.needsReview,true);assert.equal(original.classificationReview.reviewRequired,true);
 let workflow=await get(),action=workflow.actions.find((a:any)=>a.target.kind==='review-document-classification');assert.ok(action);
 const sourceUrl=base+'/api/projects/TYPE-REVIEW/evidence/documents/'+encodeURIComponent(original.documentId)+'/source?hash='+original.sourceHashSha256;
 const sourceResponse=await fetch(sourceUrl);assert.equal(sourceResponse.status,200);assert.equal(await sourceResponse.text(),'A source document awaiting a detailed content review.');assert.match(sourceResponse.headers.get('content-disposition')??'',/attachment/);
 assert.equal((await fetch(sourceUrl+'wrong')).status,409);
 const request=(values:any)=>post('/api/projects/TYPE-REVIEW/actions/confirm-review',{expectedVersion:workflow.projectVersion,actionId:action.id,sourceFingerprint:action.reviewFingerprint,choice:'cost_evm_report',reference:'TYPE-CHECK-1',...values});
 assert.equal((await request({expectedVersion:workflow.projectVersion-1})).status,409);assert.equal((await request({sourceFingerprint:'stale'})).status,409);
 assert.equal((await request({choice:'invented_type'})).status,409);assert.equal((await request({reference:''})).status,409);
 assert.equal((await request({})).status,200);
 let document=(await get('/evidence/documents')).documents[0];assert.equal(document.documentType,'cost_evm_report');assert.equal(document.classificationReview.reviewRequired,false);
 assert.equal(document.sourceHashSha256,original.sourceHashSha256);assert.deepEqual(document.identification,original.identification);
 // M1.2: the confirmed type re-applies the basis: the only cost report in its family is in use.
 assert.equal(original.basisState,'historical');assert.equal(document.basisState,'active');
 await gateway.close();gateway=await createProjectGateway(root,{maxWorkers:1});await listen();
 workflow=await get();action=workflow.information.find((a:any)=>a.target.kind==='review-document-classification');assert.ok(action);assert.equal(action.target.reviewChoice,'cost_evm_report');assert.equal(action.target.reviewReference,'TYPE-CHECK-1');
 const html=runInNewContext(projectActionsScript+';actionResolutionHtml(action)',{action,escapeHtml:String,project:()=> 'TYPE-REVIEW'});assert.match(html,/Download retained source/);assert.match(html,/Source review reference/);assert.match(html,/cost_evm_report" selected/);
 assert.equal((await request({choice:'supporting_document',reference:'TYPE-CHECK-2'})).status,200);
 document=(await get('/evidence/documents')).documents[0];assert.equal(document.documentType,'supporting_document');assert.equal(document.classificationHistory.length,2);assert.equal(document.classificationDecision.originalDocumentType,original.documentType);assert.deepEqual(document.identification,original.identification);assert.equal(document.basisState,original.basisState);
});
test('project actions require decisions only for non-current programme candidates and remain project/phase scoped',async t=>{
  const root=mkdtempSync(join(tmpdir(),'project-actions-'));let gateway=await createProjectGateway(root,{maxWorkers:2}),base='';
  t.after(async()=>{await gateway.close();rmSync(root,{recursive:true,force:true});});
  const listen=async()=>{await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+(gateway.server.address() as any).port;};await listen();
  const get=async(path:string)=>{const r=await fetch(base+path);assert.equal(r.status,200);return await r.json() as any;};
  const post=(path:string,body:any)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  for(const id of ['ACTION-A','ACTION-B'])assert.equal((await post('/api/projects',{projectId:id})).status,201);
  const upload=(id:string,name:string,date='2031-08-31',phase?:string)=>fetch(base+'/api/projects/'+id+(phase?'/phases/'+phase:'')+'/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':name,'x-upload-intent':'add_update','x-schedule-role':'update','x-schedule-role-confirmed':'1'},body:xer(date,name)});
  assert.equal((await upload('ACTION-A','A first.xer')).status,201);assert.equal((await upload('ACTION-B','B first.xer')).status,201);
  const initial=await get('/api/projects/ACTION-A/actions');
  assert.equal(initial.actions.filter((a:any)=>a.target.type==='schedule').length,0,'submitted-current ordinary update must not create a confirmation task');
  assert.doesNotMatch(JSON.stringify(initial),/B first.xer/);

  assert.equal((await upload('ACTION-A','A same.xer','2031-08-31')).status,201);
  const pending=await get('/api/projects/ACTION-A/actions');
  const schedule=pending.actions.find((a:any)=>a.target.type==='schedule'&&/A same\.xer/.test(a.reason));
  assert.ok(schedule);assert.equal(schedule.target.canConfirm,true);

  assert.equal((await upload('ACTION-A','A later.xer','2031-09-30')).status,201);
  const stale=await post('/api/projects/ACTION-A/actions/confirm-schedule',{actionId:schedule.id,expectedVersion:pending.projectVersion});
  assert.equal(stale.status,409);assert.match((await stale.json() as any).message,/project changed/i);

  const refreshed=await get('/api/projects/ACTION-A/actions');
  const stillPending=refreshed.actions.find((a:any)=>a.id===schedule.id);
  assert.ok(stillPending);assert.equal((await post('/api/projects/ACTION-A/actions/confirm-schedule',{actionId:stillPending.id,expectedVersion:refreshed.projectVersion})).status,200);
  const after=await get('/api/projects/ACTION-A/actions');assert.ok(!after.actions.some((a:any)=>a.id===schedule.id));assert.equal(after.actionCount,after.actions.length);

  const untouched=await get('/api/projects/ACTION-B/actions');assert.equal(untouched.actions.filter((a:any)=>a.target.type==='schedule').length,0);
  assert.equal((await upload('ACTION-A','Phase programme.xer','2032-02-29','Tower-B')).status,201);
  const phaseList=await get('/api/projects/ACTION-A/actions');
  assert.ok(!phaseList.actions.some((a:any)=>a.target.phaseId==='Tower-B'&&a.target.type==='schedule'),'first dated phase update is submitted-current within its phase');
  const overview=await get('/api/projects/ACTION-A/overview');assert.equal(overview.latestDataDateIso,'2031-08-31');

  await gateway.close();gateway=await createProjectGateway(root,{maxWorkers:2});await listen();
  const restored=await get('/api/projects/ACTION-A/actions');
  assert.ok(!restored.actions.some((a:any)=>a.id===schedule.id));
  assert.ok(!restored.actions.some((a:any)=>a.target.phaseId==='Tower-B'&&a.target.type==='schedule'));
});

test('missing contractual completion becomes one inline confirmation action and persists the confirmed date',async t=>{
  const root=mkdtempSync(join(tmpdir(),'contract-completion-action-'));let gateway=await createProjectGateway(root,{maxWorkers:1}),base='';
  t.after(async()=>{await gateway.close();rmSync(root,{recursive:true,force:true});});
  const listen=async()=>{await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+(gateway.server.address() as any).port;};await listen();
  const post=(path:string,body:any)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const get=async(path:string)=>{const r=await fetch(base+path);assert.equal(r.status,200);return await r.json() as any;};
  assert.equal((await post('/api/projects',{projectId:'CONTRACT-DATE-A'})).status,201);
  const upload=await fetch(base+'/api/projects/CONTRACT-DATE-A/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'Current programme.xer','x-upload-intent':'add_update','x-schedule-role':'update','x-schedule-role-confirmed':'1'},body:xer('2031-08-31','Current programme')});
  assert.equal(upload.status,201);
  const pending=await get('/api/projects/CONTRACT-DATE-A/actions');
  assert.equal(pending.actions.filter((a:any)=>a.target.type==='schedule').length,0,'ordinary submitted-current schedule must not require manual confirmation');
  const contract=pending.actions.find((a:any)=>a.target.kind==='contract-completion');
  assert.ok(contract);assert.equal(contract.category,'confirmation');assert.equal(contract.target.type,'inline');
  assert.match(contract.resolution.instruction,/current programme finish|contractual completion date/i);
  assert.ok(Object.hasOwn(contract.target,'suggestedDateIso'));
  const saved=await post('/api/projects/CONTRACT-DATE-A/actions/confirm-contract-completion',{actionId:contract.id,expectedVersion:pending.projectVersion,dateIso:'2031-12-30'});
  assert.equal(saved.status,200);const receipt=await saved.json() as any;assert.equal(receipt.contractualCompletionIso,'2031-12-30T00:00:00.000Z');
  const after=await get('/api/projects/CONTRACT-DATE-A/actions');assert.ok(!after.actions.some((a:any)=>a.target.kind==='contract-completion'));
  await gateway.close();gateway=await createProjectGateway(root,{maxWorkers:1});await listen();
  const restored=await get('/api/projects/CONTRACT-DATE-A/actions');assert.ok(!restored.actions.some((a:any)=>a.target.kind==='contract-completion'));
});

test('missing contract date stays a review state and single-revision change limitation uses business wording',async()=>{
  const {positionVerdict}=await import('../packages/runtime-api/src/position-review');
  const verdict=positionVerdict({key:'master-dashboard',status:'ready',reason:null,dependencies:[],data:{metrics:[{key:'submitted-programme-finish',value:'2031-12-31T00:00:00.000Z'},{key:'contract-finish',value:null}]}} as any);
  assert.equal(verdict.rag,'amber');assert.match(verdict.text,/Programme analysis remains available/);assert.match(verdict.nextAction,/Actions required/);

  const {projectActions}=await import('../packages/runtime-api/src/project-actions');
  const {summarizeControlIssues}=await import('../packages/truth-kernel/src');
  const candidateState=(await import('../packages/runtime-api/src/project-state')).runtimeProjects.getOrCreate('CONTRACT-CANDIDATE-PROPAGATION');
  const candidateAssessment=summarizeControlIssues([{code:'MISSING_SOURCE_VALUE',kind:'missing_information',summary:'Contractual Completion Date',detail:'The contractual completion date is not established.',action:'Confirm the applicable contract completion date.',owner:'Project evidence owner',moduleKeys:['master-dashboard'],sourceRefs:[],checkIds:[],evidencePaths:['contract.contractualCompletionDate']}]);
  const candidateAction=projectActions(candidateState,candidateAssessment,{completionPosition:{submittedFinishIso:'2028-01-12T00:00:00.000Z'}}).actions.find((a:any)=>a.target.kind==='contract-completion');
  assert.ok(candidateAction);assert.equal(candidateAction!.target.suggestedDateIso,'2028-01-12T00:00:00.000Z');

  const {assessModuleIssues}=await import('../packages/runtime-api/src/module-issues');
  const assessment=assessModuleIssues({key:'schedule-change-report',status:'partial',reason:'A second revision is required.',dependencies:[],engineState:'ready',evidenceState:'partial',data:{state:'insufficient_history',diagnostics:['SECOND_SCHEDULE_REVISION_REQUIRED_FOR_CHANGE_COMPARISON'],systemEvidenceContract:{state:'verified_for_checked_metrics',checks:[]}}} as any,{state:'pass',failedCheckIds:[],checkCount:0,checks:[]} as any);
  const issue=assessment.issues.find((i:any)=>i.code==='SECOND_PROGRAMME_REVISION_NEEDED');assert.ok(issue);
  assert.match(issue.summary,/Previous programme needed/);assert.doesNotMatch(issue.detail,/SECOND_SCHEDULE_REVISION/);
  assert.equal(assessment.issues.filter((i:any)=>String(i.detail).includes('SECOND_SCHEDULE_REVISION_REQUIRED_FOR_CHANGE_COMPARISON')).length,0);
});

test('project action notifications ignore late responses after A to B to A and never claim zero on a failed refresh',async()=>{
  const button:any={disabled:false,innerHTML:''},notice:any={textContent:''},nav:any={textContent:''};const pending:Array<(v:any)=>void>=[];
  const ctx:any={console,owner:'A',projectRequestSeq:1,overview:{projectId:'A'},project:()=>ctx.owner,projectRequestIsCurrent:(id:string,seq:number)=>id===ctx.owner&&seq===ctx.projectRequestSeq,api:()=>new Promise(resolve=>pending.push(resolve)),URLSearchParams,fmt:String,el:(id:string)=>id==='openProjectActions'?button:id==='projectActionNotification'?notice:id==='projectActionNavCount'?nav:null};
  runInNewContext(projectActionsScript,ctx);
  const old=ctx.loadProjectActions();ctx.owner='B';ctx.projectRequestSeq++;ctx.resetProjectActions();ctx.owner='A';ctx.projectRequestSeq++;const latest=ctx.loadProjectActions();
  pending[1]!({projectId:'A',projectVersion:2,actionCount:3,actions:[]});await latest;assert.match(button.innerHTML,/>3</);
  pending[0]!({projectId:'A',projectVersion:1,actionCount:99,actions:[]});await old;assert.match(button.innerHTML,/>3</);assert.doesNotMatch(button.innerHTML,/99/);
  ctx.api=()=>Promise.reject(new Error('Unavailable'));await ctx.loadProjectActions();assert.match(notice.textContent,/could not be refreshed/);assert.doesNotMatch(button.innerHTML,/>0</);
});

test('unrelated missing commercial inputs remain visible together without creating page-navigation tasks',async()=>{
  const {runtimeProjects}=await import('../packages/runtime-api/src/project-state');
  const {projectActions}=await import('../packages/runtime-api/src/project-actions');
  const {summarizeControlIssues}=await import('../packages/truth-kernel/src');
  const state=runtimeProjects.getOrCreate('GROUPED-ACTION-REVIEW');
  const items=['currency','retention','paymentPeriod'].map(field=>({code:'MISSING_SOURCE_VALUE',kind:'missing_information' as const,summary:field,detail:'Missing '+field,action:'Provide '+field,owner:'Project evidence owner' as const,moduleKeys:['contract-particulars-bonds'],sourceRefs:[],checkIds:[],evidencePaths:['contract.'+field]}));
  const result=projectActions(state,summarizeControlIssues(items));
  assert.equal(result.information.reduce((n,a)=>n+(a.requestCount??0),0),3);
  assert.ok(result.information.every(a=>a.target.type==='inline'));
  assert.equal(result.information.flatMap(a=>a.findings??[]).length,3);
  assert.ok(!result.actions.some(a=>a.target.type==='module'));
});


test('review grouping does not confuse data-quality metadata with Quality or contractor with Contract',async()=>{
  const {projectReviewGroup}=await import('../packages/runtime-api/src/project-review-groups');
  const {runtimeProjects}=await import('../packages/runtime-api/src/project-state');
  const state=runtimeProjects.getOrCreate('DOMAIN-GROUPING');
  const contractDuplicate:any={code:'SOURCE_QUALITY',kind:'data_quality',summary:'data · data quality',detail:'CONTRACT_DUPLICATE_SECTION_INSTANCE:clause:1',action:'Review source',owner:'Project evidence owner',moduleKeys:['pmo-analysis'],sourceRefs:[],checkIds:[],evidencePaths:['data']};
  const contractorProgress:any={code:'MISSING_SOURCE_VALUE',kind:'missing_information',summary:'progress Bases · contractor Reported · information missing',detail:'The required source value is not established.',action:'Provide contractor reported progress',owner:'Project evidence owner',moduleKeys:['progress-report'],sourceRefs:[],checkIds:[],evidencePaths:['data.progressBases.contractorReported']};
  assert.notEqual(projectReviewGroup(contractDuplicate,state).key,'quality','generic data-quality diagnostics are not construction Quality records');
  assert.notEqual(projectReviewGroup(contractorProgress,state).key,'commercial','contractor-reported progress is not a Contract/Commercial matter');
});

test('one payment conflict does not turn unrelated missing fields into one corrected-file demand',async()=>{
  const {projectActions}=await import('../packages/runtime-api/src/project-actions');
  const {runtimeProjects}=await import('../packages/runtime-api/src/project-state');
  const {summarizeControlIssues}=await import('../packages/truth-kernel/src');
  const state=runtimeProjects.getOrCreate('PAYMENT-ACTION-SPLIT');
  const issues:any[]=[
    {code:'SOURCE_CONFLICT',kind:'source_conflict',summary:'rows · component Arithmetic · source conflict',detail:'One certificate arithmetic does not reconcile.',action:'Reconcile the retained source record.',owner:'Project evidence owner',moduleKeys:['payments'],sourceRefs:['evidence-document:IPC:row:3'],checkIds:[],evidencePaths:['data.focus.paymentRegister.rows[*].componentArithmetic']},
    {code:'MISSING_SOURCE_VALUE',kind:'missing_information',summary:'amounts · application Amount · information missing',detail:'Application amount is not supplied.',action:'Supply only if required.',owner:'Project evidence owner',moduleKeys:['payments'],sourceRefs:['evidence-document:IPC:row:3'],checkIds:[],evidencePaths:['data.focus.paymentRegister.rows[*].amounts.applicationAmount']}
  ];
  const result=projectActions(state,summarizeControlIssues(issues));
  const correction=result.actions.find((a:any)=>a.id==='matter:payments:correction');
  const information=result.information.find((a:any)=>a.id==='matter:payments:information');
  assert.ok(correction);assert.equal(correction!.requestCount,1);assert.equal(correction!.findings?.[0]?.kind,'source_conflict');
  assert.equal(correction!.correctionRecords?.[0]?.locator,'Row 3');
  assert.match(correction!.reason,/only the listed fields need correction/);
  assert.ok(information);assert.equal(information!.requestCount,1);assert.equal(information!.findings?.[0]?.kind,'missing_information');
});

test('Project Review displays decisions only, and directs the team register to Accountability',()=>{
 const sample={projectId:'REVIEW',actionCount:1,userDecisionCount:1,teamFollowUpCount:8,checkedAt:'2026-10-12',pageSize:25,matchedActionCount:1,
 actions:[{id:'matter:completion',category:'confirmation',title:'Confirm contractual completion date',reason:'Contractual date not established',recordCount:1,owner:'Project Director',resolution:{kind:'confirm',requiresUserAction:true,instruction:'Confirm the contractual date.',completionRule:'Saved'},target:{type:'inline',kind:'contract-completion',suggestedDateIso:null,label:'Confirm'}},
 {id:'accountability-owner-group:procurement',category:'follow_up',title:'898 open procurement records',reason:'Review the register with its owner.',recordCount:898,owner:'Procurement Manager',dueIso:'2025-12-11',resolution:{kind:'information',requiresUserAction:false,instruction:'Review individual records.',completionRule:'Closed from register'},target:{type:'module',moduleKey:'procurement',label:'Open supporting record'}}],information:[],systemCheckCount:0};
 const script=countHelpers+projectActionsScript+'\nprojectActionState={projectId:"REVIEW",status:"ready",data:'+JSON.stringify(sample)+'};renderProjectActionList()';
 const html=runInNewContext(script,{project:()=> 'REVIEW',fmt:String,escapeHtml:String,formatDocumentTime:()=> 'now',planningShortDate:String});
 assert.match(html,/1 decision needs your review/);
 assert.match(html,/Confirm the contractual date/);
 assert.ok(html.includes('data-action-module="cross-domain-accountability"'),'all team work is reachable via Accountability');
 assert.doesNotMatch(html,/898 open procurement records|Earliest due date in this group|PROJECT-TEAM FOLLOW-UP/);
 assert.doesNotMatch(html,/data-action-module="procurement"|project-team follow-up groups/);
 assert.ok(!html.includes('What you need to do:</b> Review individual records'));
});

test('Existing contract and amendment findings are visible before any replacement upload',()=>{
 const issue={code:'SOURCE_QUALITY',kind:'source_conflict',summary:'Notice obligation differs',detail:'Main contract: 28 days; amendment: 14 days. Applicable date needs review.',moduleKeys:['notice-compliance'],sourceRefs:[]};
 const sample={projectId:'REVIEW',actionCount:1,userDecisionCount:1,teamFollowUpCount:0,checkedAt:'2026-10-12',pageSize:25,matchedActionCount:1,
 actions:[{id:'matter:claims:correction',category:'review',title:'Claims and notice obligations',reason:'Read the retained evidence before deciding whether correction is needed.',recordCount:2,owner:'Project evidence owner',resolution:{kind:'upload',requiresUserAction:true,instruction:'Upload corrected evidence',completionRule:'After new upload'},target:{type:'upload',uploadMode:'evidence',label:'Upload evidence'},correctionRecords:[{source:'Main Contract.pdf',locator:'Page 1'},{source:'Amendment.pdf',locator:'Page 1'}],findings:[issue]}],information:[],systemCheckCount:0};
 const script=countHelpers+projectActionsScript+'\nprojectActionState={projectId:"REVIEW",status:"ready",data:'+JSON.stringify(sample)+'};renderProjectActionList()';
 const html=runInNewContext(script,{project:()=> 'REVIEW',fmt:String,escapeHtml:String,readerText:String,readerIssue:()=>({title:'Contract notice periods differ',owner:'Contracts Manager'}),renderActionFindings:()=>'',formatDocumentTime:()=> 'now',planningShortDate:String});
 assert.ok(html.includes('What CMeng found in the documents already provided'));
 assert.ok(html.includes('Contract notice periods differ'));
 assert.ok(html.includes('Main contract: 28 days; amendment: 14 days'));
 assert.ok(html.indexOf('What CMeng found')<html.indexOf('Upload replacement only if needed'));
 assert.ok(html.includes('Documents and locations to examine'));
 assert.ok(!html.includes('What needs your response:</b> Upload corrected evidence'));
});


test('Shared specialist-page management summary uses established figures, never inserts zero for missing values',()=>{
 const {experienceScript}=require('../packages/runtime-api/src/ui-experience');
 const result=runInNewContext(experienceScript+';experienceManagementReading("progress-report",{facts:[{label:"Schedule progress",value:72,display:"72%"},{label:"Earned value",value:null,display:"Not established"}],review:"Confirm the missing cost data before calculating CPI.",note:"Progress and cost are different measures."})',{escapeHtml:String});
 assert.ok(result.includes('Established from project records:'));
 assert.ok(result.includes('Schedule progress: <strong>72%</strong>'));
 assert.ok(result.includes('Not yet established:</b> Earned value'));
 assert.ok(result.includes('Confirm the missing cost data'));
 assert.ok(!result.includes('Earned value: <strong>0'));
});

test('procurement date decision can be saved, revised and restored through the action endpoint',async t=>{
 const root=mkdtempSync(join(tmpdir(),'procurement-date-action-'));let gateway=await createProjectGateway(root,{maxWorkers:1}),base='';
 t.after(async()=>{await gateway.close();rmSync(root,{recursive:true,force:true});});
 const listen=async()=>{await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+(gateway.server.address() as any).port;};await listen();
 const post=(path:string,body:any)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const get=async()=>{const r=await fetch(base+'/api/projects/DATE-BASIS/actions');assert.equal(r.status,200);return await r.json() as any;};
 assert.equal((await post('/api/projects',{projectId:'DATE-BASIS'})).status,201);
 assert.equal((await fetch(base+'/api/projects/DATE-BASIS/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'Current.xer','x-upload-intent':'add_update','x-schedule-role':'update','x-schedule-role-confirmed':'1'},body:xer('2031-08-31','Installation').replace('target_start_date\ttarget_end_date','early_start_date\tearly_end_date')})).status,201);
 assert.equal((await fetch(base+'/api/projects/DATE-BASIS/evidence/uploads',{method:'POST',headers:{'content-type':'text/csv','x-source-filename':'Procurement.csv'},body:'Package ID,Description,Required On Site,Forecast Delivery,Status,Linked Activity\nP1,Pump,2031-09-05,2031-09-02,Ordered,A1'})).status,201);
 let workflow=await get();let action=workflow.actions.find((a:any)=>a.target.kind==='review-procurement-date');assert.ok(action);
 const request=(choice:string)=>post('/api/projects/DATE-BASIS/actions/confirm-review',{expectedVersion:workflow.projectVersion,actionId:action.id,sourceFingerprint:action.reviewFingerprint,choice});
 assert.equal((await request('programme')).status,200);workflow=await get();action=workflow.information.find((a:any)=>a.target.kind==='review-procurement-date');assert.equal(action.target.reviewChoice,'programme');
 assert.equal((await request('register')).status,200);workflow=await get();action=workflow.information.find((a:any)=>a.target.kind==='review-procurement-date');assert.equal(action.target.reviewChoice,'register');
 await gateway.close();gateway=await createProjectGateway(root,{maxWorkers:1});await listen();
 workflow=await get();assert.equal(workflow.information.find((a:any)=>a.target.kind==='review-procurement-date').target.reviewChoice,'register');
});

test('risk review rejects stale evidence, updates shared reporting and remains editable after restart',async t=>{
 const root=mkdtempSync(join(tmpdir(),'risk-review-action-'));let gateway=await createProjectGateway(root,{maxWorkers:1}),base='';
 t.after(async()=>{await gateway.close();rmSync(root,{recursive:true,force:true});});
 const listen=async()=>{await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+(gateway.server.address() as any).port;};await listen();
 const post=(path:string,body:any)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const get=async(path='/actions')=>{const r=await fetch(base+'/api/projects/RISK-REVIEW'+path);assert.equal(r.status,200);return await r.json() as any;};
 assert.equal((await post('/api/projects',{projectId:'RISK-REVIEW'})).status,201);
 assert.equal((await fetch(base+'/api/projects/RISK-REVIEW/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'Current.xer','x-upload-intent':'add_update','x-schedule-role':'update','x-schedule-role-confirmed':'1'},body:xer('2031-08-31','Current')})).status,201);
 assert.equal((await fetch(base+'/api/projects/RISK-REVIEW/evidence/uploads',{method:'POST',headers:{'content-type':'text/csv','x-source-filename':'Risk Register.csv'},body:'Risk ID,Description,Status,Probability,Impact,Score,Rating,Owner\nR1,Access,Open,2,3,6,High,Owner\nR2,Design,Closed,2,3,6,Low,Owner'})).status,201);
 let workflow=await get();let action=workflow.actions.find((a:any)=>a.target.kind==='review-risk-snapshot');assert.ok(action);
 const request=(values:any)=>post('/api/projects/RISK-REVIEW/actions/confirm-review',{expectedVersion:workflow.projectVersion,actionId:action.id,sourceFingerprint:action.reviewFingerprint,...values});
 assert.equal((await request({choice:'confirm_snapshot',asOfIso:'2031-02-30'})).status,409);
 assert.equal((await request({choice:'confirm_snapshot',asOfIso:'2031-08-20',sourceFingerprint:'stale'})).status,409);
 assert.equal((await request({choice:'confirm_snapshot',asOfIso:'2031-08-20',expectedVersion:workflow.projectVersion-1})).status,409);
 assert.equal((await request({choice:'confirm_snapshot',asOfIso:'2031-08-20'})).status,200);
 workflow=await get();action=workflow.actions.find((a:any)=>a.target.kind==='review-risk');assert.ok(action);
 assert.equal((await request({choice:'enter_matrix',matrixText:'7=Moderate'})).status,409);
 assert.equal((await request({choice:'enter_matrix',matrixText:'6=Moderate'})).status,200);
 let risk=await get('/schedule/modules/risk-register');
 assert.equal(risk.data.currentRecordCount,2);
 assert.deepEqual(risk.data.rows.map((r:any)=>r.suppliedRating),['High','Low']);
 assert.deepEqual(risk.data.rows.map((r:any)=>r.reportingRating),['Moderate','Moderate']);
 assert.equal(risk.data.validation.state,'consistent_in_checked_scores');
 await gateway.close();gateway=await createProjectGateway(root,{maxWorkers:1});await listen();
 workflow=await get();action=workflow.information.find((a:any)=>a.target.kind==='review-risk');assert.ok(action);
 assert.equal(action.resolution.requiresUserAction,false);assert.equal(action.target.reviewMatrixText,'6=Moderate');
 const script=countHelpers+projectActionsScript+'\nprojectActionState={projectId:"RISK-REVIEW",status:"ready",data:'+JSON.stringify({...workflow,actions:[],information:[action]})+'};renderProjectActionList()';
 const html=runInNewContext(script,{project:()=> 'RISK-REVIEW',fmt:String,escapeHtml:String,formatDocumentTime:()=> 'now',planningShortDate:String,renderActionFindings:()=>''});
 assert.match(html,/action-information action-review-recorded/);assert.match(html,/6=Moderate<\/textarea>/);
 assert.match(projectActionsStyles,/\.action-information\.action-review-recorded \.action-resolution\{display:grid\}/);
 assert.equal((await request({choice:'keep_source_ratings'})).status,200);
 risk=await get('/schedule/modules/risk-register');assert.deepEqual(risk.data.rows.map((r:any)=>r.reportingRating),['High','Low']);
});

test('EOT review validates additional days and reference and retains a manual contractual basis',async t=>{
 const root=mkdtempSync(join(tmpdir(),'eot-review-action-'));const gateway=await createProjectGateway(root,{maxWorkers:1});
 t.after(async()=>{await gateway.close();rmSync(root,{recursive:true,force:true});});
 await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+(gateway.server.address() as any).port;
 const post=(path:string,body:any)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await post('/api/projects',{projectId:'EOT-REVIEW'})).status,201);
 const basis={contractualCompletionIso:'2031-12-31',contractualCompletionState:'official',officialApprovedEotDays:20,officialApprovedEotState:'official',eotDayBasis:'calendar_days',eotDayBasisState:'official',incorporatedEotDays:90,additionalApprovedEotDays:null,overlapResolution:'unresolved',registerDeterminationDays:20,registerDeterminationCount:2,sourceRefs:['governed:Engineer determination and amendment']};
 assert.equal((await fetch(base+'/api/projects/EOT-REVIEW/controls',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({contractTimeBasis:basis})})).status,200);
 const get=async()=>await (await fetch(base+'/api/projects/EOT-REVIEW/actions')).json() as any;
 let workflow=await get(),action=workflow.actions.find((a:any)=>a.target.kind==='review-eot-overlap');assert.ok(action);
 const request=(values:any)=>post('/api/projects/EOT-REVIEW/actions/confirm-review',{expectedVersion:workflow.projectVersion,actionId:action.id,sourceFingerprint:action.reviewFingerprint,choice:'confirm_additional_days',...values});
 for(const additionalDays of ['',-1,21,'bad'])assert.equal((await request({additionalDays,reference:'Engineer decision'})).status,409);
 // C9 / R2: a supporting reference is kept when given, not required.
 assert.equal((await request({additionalDays:0,reference:'Engineer decision'})).status,200);
 workflow=await get();action=workflow.information.find((a:any)=>a.target.kind==='review-eot-overlap');assert.equal(action.target.reviewAdditionalDays,0);
 assert.equal((await request({additionalDays:12,reference:'Revised Engineer decision'})).status,200);
 workflow=await get();action=workflow.information.find((a:any)=>a.target.kind==='review-eot-overlap');assert.equal(action.target.reviewAdditionalDays,12);
});

test('HSE rate review is editable after gateway restart and preserves reported values',async t=>{
 const root=mkdtempSync(join(tmpdir(),'hse-review-action-'));let gateway=await createProjectGateway(root,{maxWorkers:1}),base='';
 t.after(async()=>{await gateway.close();rmSync(root,{recursive:true,force:true});});
 const listen=async()=>{await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+(gateway.server.address() as any).port;};await listen();
 const post=(path:string,body:any)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await post('/api/projects',{projectId:'HSE-REVIEW'})).status,201);
 assert.equal((await fetch(base+'/api/projects/HSE-REVIEW/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'Update.xer','x-upload-intent':'replace_current_basis'},body:xer('2031-08-31','Current work')})).status,201);
 assert.equal((await fetch(base+'/api/projects/HSE-REVIEW/evidence/uploads',{method:'POST',headers:{'content-type':'text/csv','x-source-filename':'HSE Statistics.csv'},body:'Report Date,Man Hours,LTI,MTC,Restricted Work Cases,First Aid Cases,Near Misses,TRIR,LTIFR\n2031-08-31,10250000,1,5,0,21,74,0.29,0.1'})).status,201);
 const get=async(suffix='/actions')=>{const r=await fetch(base+'/api/projects/HSE-REVIEW'+suffix);assert.equal(r.status,200);return await r.json() as any;};
 let workflow=await get(),action=workflow.actions.find((a:any)=>a.target.kind==='review-hse-rates');assert.ok(action);
 const request=(values:any)=>post('/api/projects/HSE-REVIEW/actions/confirm-review',{expectedVersion:workflow.projectVersion,actionId:action.id,sourceFingerprint:action.reviewFingerprint,choice:'confirm_rates',reference:'HSE-CHECK-1',...values});
 assert.equal((await request({reviewedRates:{trir:0.59}})).status,409);
 assert.equal((await request({sourceFingerprint:'stale'})).status,409);
 assert.equal((await request({expectedVersion:workflow.projectVersion-1})).status,409);
 assert.equal((await request({reviewedRates:{trir:0.59,trirBasisHours:1000000,ltifr:0.1,ltifrBasisHours:1000000}})).status,200);
 let page=await get('/delivery/modules/delivery-hse');assert.equal(page.data.reportedHse.reportingRates.trir,0.59);assert.equal(page.data.reportedHse.rates.reportedRates.trir,0.29);
 assert.equal(page.data.reportedHse.reportedPeriodRows[0].firstAidCases,21);assert.equal(page.data.reportedHse.reportedPeriodRows[0].nearMisses,74);
 await gateway.close();gateway=await createProjectGateway(root,{maxWorkers:1});await listen();
 workflow=await get();action=workflow.information.find((a:any)=>a.target.kind==='review-hse-rates');assert.ok(action);assert.equal(action.target.reviewedRates.trir,0.59);assert.equal(action.target.reviewReference,'HSE-CHECK-1');
 const html=runInNewContext(projectActionsScript+';actionResolutionHtml(action)',{action,escapeHtml:String});assert.match(html,/review-hse-trir/);assert.match(html,/value="0.59"/);assert.match(html,/HSE-CHECK-1/);
 assert.equal((await request({choice:'keep_reported',reference:'HSE-CHECK-2'})).status,200);
 page=await get('/delivery/modules/delivery-hse');assert.equal(page.data.reportedHse.reportingRates.trir,0.29);assert.equal(page.data.reportedHse.rates.reportedRates.trir,0.29);
 const management=await get('/management/command-center');assert.equal(management.data.sourceInterpretation.hse.reportingRates.trir,0.29);assert.equal(management.data.sourceInterpretation.hse.review.decision.reference,'HSE-CHECK-2');
});

test('programme milestone review persists without editing source types and expires with a new source',async t=>{
 const root=mkdtempSync(join(tmpdir(),'milestone-review-'));let gateway=await createProjectGateway(root,{maxWorkers:1}),base='';
 t.after(async()=>{await gateway.close();rmSync(root,{recursive:true,force:true});});
 const listen=async()=>{await new Promise<void>(r=>gateway.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+(gateway.server.address() as any).port;};await listen();
 const post=(path:string,body:any)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await post('/api/projects',{projectId:'MILESTONE-REVIEW'})).status,201);
 const upload=(date:string)=>fetch(base+'/api/projects/MILESTONE-REVIEW/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'Current.xer','x-upload-intent':'replace_current_basis'},body:xer(date,'Construction work')});
 assert.equal((await upload('2031-08-31')).status,201);
 const get=async(suffix='/actions')=>{const r=await fetch(base+'/api/projects/MILESTONE-REVIEW'+suffix);assert.equal(r.status,200);return await r.json() as any;};
 let workflow=await get(),action=workflow.actions.find((a:any)=>a.target.kind==='review-milestones');assert.ok(action);
 const before=(await get('/schedule/modules/milestones')).data;assert.equal(before.populationState,'partial');assert.equal(before.milestoneCount,0);
 assert.equal(before.exposure.value,null);assert.equal(before.challenge.items.find((r:any)=>r.metric==='milestone_count').independent.value,null);
 const request=(values:any)=>post('/api/projects/MILESTONE-REVIEW/actions/confirm-review',{expectedVersion:workflow.projectVersion,actionId:action.id,sourceFingerprint:action.reviewFingerprint,choice:'track_key_dates',activityIds:['A1'],reference:'PLANNER-CHECK-1',...values});
 for(const invalid of [{expectedVersion:workflow.projectVersion-1},{sourceFingerprint:'old'},{activityIds:['NONEXISTENT']},{activityIds:[]},{reference:''},{choice:'no_programme_milestones'}])assert.equal((await request(invalid)).status,409);
 assert.equal((await request({})).status,200);
 const selected=(await get('/schedule/modules/milestones')).data;
 assert.equal(selected.systemEvidenceContract?.state,'verified_for_checked_metrics');assert.equal(selected.sourceMilestoneCount,0);assert.equal(selected.reviewedKeyDateCount,1);assert.equal(selected.milestoneCount,1);
 assert.equal(selected.rows[0].activityType,'unknown');assert.equal(selected.rows[0].identificationBasis,'reviewed_key_date');
 assert.equal(selected.rows[0].activityId,'A1');assert.equal(selected.populationState,'partial');
 const progress=(await get('/schedule/modules/progress-report')).data;assert.equal(progress.milestones.milestoneCount,1,'shared progress uses the reviewed watchlist');
 await gateway.close();gateway=await createProjectGateway(root,{maxWorkers:1});await listen();
 workflow=await get();action=workflow.information.find((a:any)=>a.target.kind==='review-milestones');assert.ok(action);assert.deepEqual(action.target.reviewActivityIds,['A1']);
 const html=runInNewContext(projectActionsScript+';actionResolutionHtml(action)',{action,escapeHtml:String});assert.match(html,/review-activity-ids/);assert.match(html,/PLANNER-CHECK-1/);assert.match(html,/A1/);
 assert.equal((await request({choice:'no_programme_milestones',activityIds:[],reference:'PLANNER-CHECK-2'})).status,200);
 const empty=(await get('/schedule/modules/milestones')).data;assert.equal(empty.milestoneCount,0);assert.equal(empty.populationState,'established');assert.equal(empty.unknownActivityTypeCount,1);assert.equal(empty.review.reference,'PLANNER-CHECK-2');
 assert.equal(empty.exposure.value,0);assert.equal(empty.exposure.absenceConfirmed,true);
 assert.equal(empty.challenge.items.find((r:any)=>r.metric==='milestone_count').independent.value,0);
 const diagnosis=(await get('/schedule/modules/pmo-analysis')).data.projectDiagnosis;assert.equal(diagnosis.milestoneExposure.absenceConfirmed,true);
 const pressure=(await get('/schedule/modules/delay-claims')).data.delayEotEvidenceChain.programmeContext;assert.equal(pressure.pressuredMilestoneCount,0);assert.equal(pressure.milestonePopulationState,'established');
 assert.equal((await upload('2031-09-30')).status,201);
 const changed=(await get('/schedule/modules/milestones')).data;assert.equal(changed.populationState,'partial');assert.equal(changed.review.choice,null);assert.equal(changed.reviewedKeyDateCount,0);
 assert.equal((await get('/schedule/modules/delay-claims')).data.delayEotEvidenceChain.programmeContext.pressuredMilestoneCount,null);
 workflow=await get();assert.ok(workflow.actions.some((a:any)=>a.target.kind==='review-milestones'));
});

test('location review persists through restart and source replacement reopens the same candidate decision',async t=>{
 const root=mkdtempSync(join(tmpdir(),'location-review-api-'));let gateway=await createProjectGateway(root,{maxWorkers:1}),base='';
 t.after(async()=>{await gateway.close();rmSync(root,{recursive:true,force:true});});
 const listen=async()=>{await new Promise<void>(r=>gateway.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+(gateway.server.address() as any).port;};await listen();
 const post=(path:string,body:any)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await post('/api/projects',{projectId:'LOC-REVIEW'})).status,201);
 const schedule=(date:string)=>xer(date,'Concrete work').replace('%T\tTASK','%T\tPROJWBS\n%F\twbs_id\tproj_id\tparent_wbs_id\twbs_name\n%R\tW1\t1\t\tManufacturing North\n%T\tTASK').replace('task_name\ttarget_start_date','task_name\twbs_id\ttarget_start_date').replace('Concrete work\t2031','Concrete work\tW1\t2031');
 const upload=(date:string)=>fetch(base+'/api/projects/LOC-REVIEW/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'Current.xer','x-upload-intent':'replace_current_basis'},body:schedule(date)});
 assert.equal((await upload('2031-08-31')).status,201);
 const get=async(suffix='/actions')=>{const r=await fetch(base+'/api/projects/LOC-REVIEW'+suffix);assert.equal(r.status,200);return await r.json() as any;};
 let workflow=await get(),action=workflow.actions.find((a:any)=>a.target.kind==='review-locations');assert.ok(action);
 const request=(values:any)=>post('/api/projects/LOC-REVIEW/actions/confirm-review',{expectedVersion:workflow.projectVersion,actionId:action.id,sourceFingerprint:action.reviewFingerprint,choice:'confirm_wbs_locations',locationAssignmentsText:'W1',reference:'LOC-CHECK',...values});
 for(const invalid of [{expectedVersion:workflow.projectVersion-1},{sourceFingerprint:'old'},{locationAssignmentsText:'INVALID'},{reference:''}])assert.equal((await request(invalid)).status,409);
 assert.equal((await request({})).status,200);
 let projection=(await get('/schedule/modules/scope-classification')).data;assert.equal(projection.rows[0].location,'Manufacturing North');assert.equal(projection.rows[0].classificationBasis.location,'user_reviewed');
 await gateway.close();gateway=await createProjectGateway(root,{maxWorkers:1});await listen();workflow=await get();action=workflow.information.find((a:any)=>a.target.kind==='review-locations');assert.ok(action);assert.equal(action.target.reviewLocationsText,'W1 | Manufacturing North');
 const html=runInNewContext(projectActionsScript+';actionResolutionHtml(action)',{action,escapeHtml:String});assert.match(html,/review-location-assignments/);assert.match(html,/LOC-CHECK/);
 projection=(await get('/schedule/modules/scope-classification')).data;assert.equal(projection.rows[0].location,'Manufacturing North');
 assert.equal((await upload('2031-09-30')).status,201);workflow=await get();assert.ok(workflow.actions.some((a:any)=>a.target.kind==='review-locations'));
 projection=(await get('/schedule/modules/scope-classification')).data;assert.equal(projection.rows[0].location,null);
});

test('asset/programme source review remains editable after restart without creating handover acceptance',async t=>{
 const root=mkdtempSync(join(tmpdir(),'handover-source-api-'));let gateway=await createProjectGateway(root,{maxWorkers:1}),base='';
 t.after(async()=>{await gateway.close();rmSync(root,{recursive:true,force:true});});
 const listen=async()=>{await new Promise<void>(r=>gateway.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+(gateway.server.address() as any).port;};await listen();
 const post=(path:string,body:any)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await post('/api/projects',{projectId:'ASSET-REVIEW'})).status,201);
 const upload=(date:string)=>fetch(base+'/api/projects/ASSET-REVIEW/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'Current.xer','x-upload-intent':'replace_current_basis'},body:xer(date,'Testing and handover work')});
 assert.equal((await upload('2031-08-31')).status,201);
 assert.equal((await fetch(base+'/api/projects/ASSET-REVIEW/evidence/uploads',{method:'POST',headers:{'content-type':'text/csv','x-source-filename':'Assets.csv'},body:'Asset ID,Tag Installed,Commissioned\nA1,Yes,Yes\nA2,Yes,No'})).status,201);
 const get=async(suffix='/actions')=>{const r=await fetch(base+'/api/projects/ASSET-REVIEW'+suffix);assert.equal(r.status,200);return await r.json() as any;};
 // M13.1: the choice orders the presentation only, so it is information (still saveable), never a required action.
 let workflow=await get(),action=workflow.information.find((a:any)=>a.target.kind==='review-handover-sources');assert.ok(action);assert.ok(!workflow.actions.some((a:any)=>a.target.kind==='review-handover-sources'));
 const request=(values:any)=>post('/api/projects/ASSET-REVIEW/actions/confirm-review',{expectedVersion:workflow.projectVersion,actionId:action.id,sourceFingerprint:action.reviewFingerprint,choice:'asset_focus',reference:'ASSET-CHECK',...values});
 for(const invalid of [{sourceFingerprint:'old'},{expectedVersion:workflow.projectVersion-1},{choice:'accepted'},{reference:''}])assert.equal((await request(invalid)).status,409);
 assert.equal((await request({})).status,200);
 await gateway.close();gateway=await createProjectGateway(root,{maxWorkers:1});await listen();
 workflow=await get();action=workflow.information.find((a:any)=>a.target.kind==='review-handover-sources');assert.ok(action);assert.equal(action.target.reviewChoice,'asset_focus');assert.equal(action.target.reviewReference,'ASSET-CHECK');
 const page=(await get('/delivery/modules/handover-readiness')).data;assert.equal(page.handover.readinessPercent,null);assert.equal(page.handoverSourceComparison.rows[0].source,'asset_register');assert.equal(page.handoverSourceComparison.rows[0].numerator,2);assert.equal(page.handoverSourceComparison.rows[0].denominator,2);
 const html=runInNewContext(projectActionsScript+';actionResolutionHtml(action)',{action,escapeHtml:String});assert.match(html,/Source basis review reference/);
 assert.equal((await request({choice:'keep_separate',reference:'ASSET-CHECK-2'})).status,200);
 assert.equal((await upload('2031-09-30')).status,201);workflow=await get();assert.ok(workflow.information.some((a:any)=>a.target.kind==='review-handover-sources'&&a.target.reviewChoice===null),'changed sources: the old choice no longer applies; the review is offered again as information');
});
