import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runInNewContext} from 'node:vm';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {projectActionsScript} from '../packages/runtime-api/src/ui-project-actions';
const xer=(date:string,name:string)=>['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tCONTROL\t'+date,'%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt','%R\t1\t1\tA1\t'+name+'\t2031-01-01\t2031-12-31\t80\t80','%E'].join('\n');
test('one project action list follows upload, stale confirmation, adoption, new revision and independent phase decisions',async t=>{
  const root=mkdtempSync(join(tmpdir(),'project-actions-'));let gateway=await createProjectGateway(root,{maxWorkers:2}),base='';
  t.after(async()=>{await gateway.close();rmSync(root,{recursive:true,force:true});});
  const listen=async()=>{await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+(gateway.server.address() as any).port;};await listen();
  const get=async(path:string)=>{const r=await fetch(base+path);assert.equal(r.status,200);return await r.json() as any;};
  const post=(path:string,body:any)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  for(const id of ['ACTION-A','ACTION-B'])assert.equal((await post('/api/projects',{projectId:id})).status,201);
  const upload=(id:string,name:string,date='2031-08-31',phase?:string)=>fetch(base+'/api/projects/'+id+(phase?'/phases/'+phase:'')+'/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':name,'x-upload-intent':'add_update','x-schedule-role':'update','x-schedule-role-confirmed':'1'},body:xer(date,name)});
  assert.equal((await upload('ACTION-A','A first.xer')).status,201);assert.equal((await upload('ACTION-B','B first.xer')).status,201);
  const first=await get('/api/projects/ACTION-A/actions'),schedule=first.actions.find((a:any)=>a.target.type==='schedule');assert.ok(schedule.target.canConfirm);assert.match(schedule.reason,/A first.xer/);assert.doesNotMatch(JSON.stringify(first),/B first.xer/);
  assert.equal((await upload('ACTION-A','A second.xer')).status,201);
  const stale=await post('/api/projects/ACTION-A/actions/confirm-schedule',{actionId:schedule.id,expectedVersion:first.projectVersion});assert.equal(stale.status,409);assert.match((await stale.json() as any).message,/project changed/i);
  const pending=await get('/api/projects/ACTION-A/actions');assert.equal(pending.actions.filter((a:any)=>a.target.type==='schedule').length,2);
  const confirm=await post('/api/projects/ACTION-A/actions/confirm-schedule',{actionId:schedule.id,expectedVersion:pending.projectVersion});assert.equal(confirm.status,200);
  const after=await get('/api/projects/ACTION-A/actions');assert.ok(!after.actions.some((a:any)=>a.id===schedule.id));assert.equal(after.actions.filter((a:any)=>a.target.type==='schedule').length,1);assert.equal(after.actionCount,after.actions.length);
  const untouched=await get('/api/projects/ACTION-B/actions');assert.equal(untouched.actions.filter((a:any)=>a.target.type==='schedule').length,1);
  assert.equal((await upload('ACTION-A','Phase programme.xer','2032-02-29','Tower-B')).status,201);
  const phaseList=await get('/api/projects/ACTION-A/actions'),phase=phaseList.actions.find((a:any)=>a.target.phaseId==='Tower-B'&&a.target.type==='schedule');assert.ok(phase);assert.match(phase.title,/Phase Tower-B/);
  assert.equal((await post('/api/projects/ACTION-A/actions/confirm-schedule',{actionId:phase.id,expectedVersion:phaseList.projectVersion})).status,200);
  const overview=await get('/api/projects/ACTION-A/overview');assert.equal(overview.latestDataDateIso,'2031-08-31');
  await gateway.close();gateway=await createProjectGateway(root,{maxWorkers:2});await listen();const restored=await get('/api/projects/ACTION-A/actions');assert.ok(!restored.actions.some((a:any)=>a.id===phase.id||a.id===schedule.id));assert.equal(restored.actions.filter((a:any)=>a.target.type==='schedule').length,1);
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
  const first=await get('/api/projects/CONTRACT-DATE-A/actions');
  const schedule=first.actions.find((a:any)=>a.target.type==='schedule');assert.ok(schedule);
  assert.equal((await post('/api/projects/CONTRACT-DATE-A/actions/confirm-schedule',{actionId:schedule.id,expectedVersion:first.projectVersion})).status,200);
  const pending=await get('/api/projects/CONTRACT-DATE-A/actions');
  const contract=pending.actions.find((a:any)=>a.target.kind==='contract-completion');
  assert.ok(contract);assert.equal(contract.category,'confirmation');assert.equal(contract.target.type,'inline');
  assert.match(contract.resolution.instruction,/current programme finish|contractual completion date/i);
  assert.match(String(contract.target.suggestedDateIso??''),/^2031-12-31/);
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

  const {assessModuleIssues}=await import('../packages/runtime-api/src/module-issues');
  const assessment=assessModuleIssues({key:'schedule-change-report',status:'partial',reason:'A second revision is required.',dependencies:[],engineState:'ready',evidenceState:'partial',data:{state:'insufficient_history',diagnostics:['SECOND_SCHEDULE_REVISION_REQUIRED_FOR_CHANGE_COMPARISON'],systemEvidenceContract:{state:'verified_for_checked_metrics',checks:[]}}} as any,{state:'pass',failedCheckIds:[],checkCount:0,checks:[]} as any);
  const issue=assessment.issues.find((i:any)=>i.code==='SECOND_PROGRAMME_REVISION_NEEDED');assert.ok(issue);
  assert.match(issue.summary,/Previous programme needed/);assert.doesNotMatch(issue.detail,/SECOND_SCHEDULE_REVISION/);
  assert.equal(assessment.issues.filter((i:any)=>String(i.detail).includes('SECOND_SCHEDULE_REVISION_REQUIRED_FOR_CHANGE_COMPARISON')).length,0);
});

test('project action notifications ignore late responses after A to B to A and never claim zero on a failed refresh',async()=>{
  const button:any={disabled:false,innerHTML:''},notice:any={textContent:''},nav:any={textContent:''};const pending:Array<(v:any)=>void>=[];
  const ctx:any={console,owner:'A',projectRequestSeq:1,overview:{projectId:'A'},project:()=>ctx.owner,projectRequestIsCurrent:(id:string,seq:number)=>id===ctx.owner&&seq===ctx.projectRequestSeq,api:()=>new Promise(resolve=>pending.push(resolve)),fmt:String,el:(id:string)=>id==='openProjectActions'?button:id==='projectActionNotification'?notice:id==='projectActionNavCount'?nav:null};
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
