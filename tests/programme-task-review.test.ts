import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {programmeTaskReviewBasis,programmeTaskReviewInput} from '../packages/runtime-api/src/programme-task-review';
import {deliveryModule} from '../packages/runtime-api/src/delivery-projections';
import {handoverSourceComparison} from '../packages/runtime-api/src/handover-source-review';
import {emptyLinks} from '../packages/delivery-core/src/types';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {runInNewContext} from 'node:vm';
import {projectActionsScript} from '../packages/runtime-api/src/ui-project-actions';
import {deliveryScript} from '../packages/runtime-api/src/ui-delivery';

function fixture(t:any){
 const root=mkdtempSync(join(tmpdir(),'task-scope-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false}),state=store.getOrCreate('SCOPE');
 const model:any={projectId:'SCOPE',source:'xer',sourceRevisionId:'R1',dataDateIso:'2031-08-31',activities:Array.from({length:270},(_,i)=>({projectId:'SCOPE',activityId:'A'+i,nativeId:String(i),name:(i===269?'Handover':i%2?'Validation':'Testing')+' plant',wbsId:null,calendarId:null,activityType:'task',status:i<120?'completed':'not_started',baselineStartIso:null,baselineFinishIso:null,currentStartIso:'2031-08-01',currentFinishIso:'2031-10-01',actualStartIso:null,actualFinishIso:i<120?'2031-08-15':null,originalDurationHours:80,remainingDurationHours:i<120?0:80,totalFloatHours:null,freeFloatHours:null,percentComplete:i<120?100:0,sourceRefs:[],diagnostics:[]})),relationships:[],calendars:[],wbs:[],diagnostics:[]};
 state.schedules.push({role:'update',format:'xer',sourceFilename:'Current.xer',sourceHashSha256:'hash1',uploadedAt:'2031-08-31',revision:{revisionId:'R1',label:'Current',sequence:1,effectiveAt:model.dataDateIso,model}} as any);
 return {store,state,model};
}
test('reviewed task IDs drive the whole programme population and source comparison without changing source or acceptance',t=>{
 const {store,state,model}=fixture(t),original=JSON.stringify(model);
 let basis=programmeTaskReviewBasis(state,'testing')!;assert.equal(basis.rows.length,135);assert.equal(basis.additionalCandidates.length,134);assert.match(basis.basis,/not been confirmed/);
 let page=deliveryModule(state,'delivery-commissioning').data as any;assert.equal(page.metrics[0].value,135);assert.equal(page.programmeTaskScope.additionalCandidates.length,134);assert.doesNotMatch(page.managementPosition,/fallback/);
 const ids=model.activities.map((a:any)=>a.activityId),input=programmeTaskReviewInput(state,'testing',{choice:'selected_tasks',activityIds:ids,reference:'TEST-SCOPE'});
 state.controls.reviewDecisions={'programme-tasks-testing':{...input,choice:'selected_tasks',sourceFingerprint:basis.sourceFingerprint,confirmedAt:'2031-08-31',sourceRefs:basis.sourceRefs}};store.touch(state);
 page=deliveryModule(state,'delivery-commissioning').data as any;assert.equal(page.rows.length,270);assert.equal(page.metrics[0].value,270);assert.equal(page.metrics[1].value,120);assert.equal(page.programmeTaskScope.reviewed,true);assert.match(page.rows[269].basis,/TEST-SCOPE/);
 assert.equal(programmeTaskReviewBasis(state,'handover')!.rows.length,1,'testing scope does not alter handover scope');
 state.delivery={schemaVersion:1,decisions:[],populations:[],manual:[{recordId:'ASSET',projectId:state.projectId,kind:'asset',reference:'ASSET',description:'Pump',revision:'ASSET-R1',state:'governed',fields:{commissioned:'Yes'},links:emptyLinks(),receipts:[],diagnostics:[],sourceActive:true}]};store.touch(state);
 const comparison=handoverSourceComparison(state)!;assert.equal(comparison.rows.find(r=>r.key==='testing')!.denominator,270);assert.equal(comparison.rows.find(r=>r.key==='testing')!.numerator,120);
 for(const key of ['delivery-commissioning','handover-readiness','delivery-assets'])assert.deepEqual((deliveryModule(state,key).data as any).handoverSourceComparison,comparison);
 assert.equal((deliveryModule(state,'handover-readiness').data as any).handover.readinessPercent,null);assert.equal(JSON.stringify(model),original);
 state.controls.reviewDecisions!['programme-tasks-testing']!.activityIds=ids.slice(0,-1);store.touch(state);
 assert.notEqual(handoverSourceComparison(state)!.sourceFingerprint,comparison.sourceFingerprint,'moving a task between scopes changes the comparison even when their combined task set is unchanged');
 state.schedules[0]!.sourceHashSha256='changed-hash';store.touch(state);assert.equal(programmeTaskReviewBasis(state,'testing')!.decision,null);assert.equal(programmeTaskReviewBasis(state,'testing')!.rows.length,135);
});
test('task scope rejects ambiguous or invented IDs and retains explicit empty scope',t=>{
 const {store,state,model}=fixture(t),valid={choice:'selected_tasks',activityIds:['A1'],reference:'SCOPE'};
 for(const bad of [{activityIds:['unknown']},{activityIds:['A1','A1']},{activityIds:[]},{reference:''},{choice:'invented'},{choice:'no_tasks'}])assert.throws(()=>programmeTaskReviewInput(state,'testing',{...valid,...bad}));
 model.activities[0].activityType='wbs_summary';model.activities[2].activityId='A1';store.touch(state);
 assert.throws(()=>programmeTaskReviewInput(state,'testing',valid));assert.throws(()=>programmeTaskReviewInput(state,'testing',{...valid,activityIds:['A0']}));
 const basis=programmeTaskReviewBasis(state,'testing')!,input=programmeTaskReviewInput(state,'testing',{choice:'no_tasks',activityIds:[],reference:'NONE'});
 state.controls.reviewDecisions={'programme-tasks-testing':{...input,choice:'no_tasks',sourceFingerprint:basis.sourceFingerprint,confirmedAt:'2031-08-31',sourceRefs:[]}};store.touch(state);
 const page=deliveryModule(state,'delivery-commissioning').data as any;assert.equal(page.programmeTaskScope.selectedCount,0);assert.equal(page.programmeTaskScope.reference,'NONE');assert.equal(page.rows.length,0);
});
test('task scope works without asset registers, survives gateway restart and reopens for a new programme',async t=>{
 const root=mkdtempSync(join(tmpdir(),'task-scope-api-'));let gateway=await createProjectGateway(root,{maxWorkers:1}),base='';
 t.after(async()=>{await gateway.close();rmSync(root,{recursive:true,force:true});});
 const listen=async()=>{await new Promise<void>(r=>gateway.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+(gateway.server.address() as any).port;};await listen();
 const post=(path:string,body:any)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await post('/api/projects',{projectId:'TASK-REVIEW'})).status,201);
 const upload=(date:string)=>fetch(base+'/api/projects/TASK-REVIEW/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'Current.xer','x-upload-intent':'replace_current_basis'},body:['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tCONTROL\t'+date,'%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt','%R\t1\t1\tA1\tTesting plant\t2031-01-01\t2031-12-31\t80\t80','%R\t2\t1\tA2\tValidation plant\t2031-01-01\t2031-12-31\t80\t80','%E'].join('\n')});
 assert.equal((await upload('2031-08-31')).status,201);
 const get=async(path='/actions')=>{const r=await fetch(base+'/api/projects/TASK-REVIEW'+path);assert.equal(r.status,200);return await r.json() as any;};
 let workflow=await get(),action=workflow.actions.find((a:any)=>a.id==='matter:programme-tasks-testing');assert.deepEqual(action.target.reviewActivityIds,['A1']);
 const request=(values:any)=>post('/api/projects/TASK-REVIEW/actions/confirm-review',{expectedVersion:workflow.projectVersion,actionId:action.id,sourceFingerprint:action.reviewFingerprint,choice:'selected_tasks',activityIds:['A1','A2'],reference:'VALIDATION-INCLUDED',...values});
 for(const invalid of [{sourceFingerprint:'old'},{expectedVersion:workflow.projectVersion-1},{reference:''},{activityIds:['missing']}])assert.equal((await request(invalid)).status,409);
 assert.equal((await request({})).status,200);await gateway.close();gateway=await createProjectGateway(root,{maxWorkers:1});await listen();
 workflow=await get();action=workflow.information.find((a:any)=>a.id==='matter:programme-tasks-testing');assert.deepEqual(action.target.reviewActivityIds,['A1','A2']);
 const page=(await get('/delivery/modules/delivery-commissioning')).data;assert.equal(page.metrics[0].value,2);assert.equal(page.programmeTaskScope.reference,'VALIDATION-INCLUDED');assert.equal(page.handoverSourceComparison,null);
 const html=runInNewContext(projectActionsScript+';actionResolutionHtml(action)',{action,escapeHtml:String});assert.match(html,/A1\nA2/);assert.match(html,/VALIDATION-INCLUDED/);
 assert.equal((await request({activityIds:[],choice:'no_tasks',reference:'EMPTY-SCOPE'})).status,200);
 assert.equal((await get('/delivery/modules/delivery-commissioning')).data.programmeTaskScope.selectedCount,0);
 assert.equal((await upload('2031-09-30')).status,201);workflow=await get();assert.ok(workflow.actions.some((a:any)=>a.id==='matter:programme-tasks-testing'));
});
test('task scope display explains the rule and its candidate list is fully pageable',()=>{
 const nodes:Record<string,any>={},p={basis:'Names containing testing; unconfirmed.',qualification:'No formal acceptance.',selectedCount:135,sourceFilename:'Current.xer',additionalCandidates:Array.from({length:134},(_,i)=>({activityId:'V'+i,name:'Validation '+i,status:'unknown',basis:'candidate'}))};
 const html=runInNewContext(deliveryScript()+`;const html=renderProgrammeTaskScope(p);refreshDeliveryTable('programmeValidationCandidates');html`,{p,fmt:String,escapeHtml:String,humanizeKey:String,el:(id:string)=>nodes[id]??={innerHTML:'',textContent:''},document:{querySelectorAll:()=>[]}});
 assert.match(html,/unconfirmed/);assert.match(html,/Review programme task IDs/);assert.match(html,/loadModule/);assert.match(html,/No formal acceptance/);assert.match(nodes.programmeValidationCandidatesBody.innerHTML,/Validation 0/);assert.match(nodes.programmeValidationCandidatesCount.textContent,/134/);
});

test('task and milestone review submit real multiline activity IDs from the rendered editor',async()=>{
 for(const kind of ['review-programme-tasks','review-milestones']){
  const action={id:'scope',reviewFingerprint:'hash',target:{kind,reviewOptions:[],reviewActivityIds:['A1','A2']},resolution:{}},sent:any[]=[];
  const node={querySelector:(selector:string)=>({value:selector==='.review-choice'?'selected_tasks':selector==='.review-activity-ids'?' A1\r\nA2\n ':selector==='.review-reference'?'CHECK':''}),querySelectorAll:()=>[]};
  const context={action,escapeHtml:String,project:()=> 'P',document:{querySelector:()=>node},CSS:{escape:String},api:async(_url:string,request:any)=>{sent.push(JSON.parse(request.body));},refresh:async()=>{}};
  const html=runInNewContext(projectActionsScript+';actionResolutionHtml(action)',context);assert.match(html,/A1\nA2/);
  await runInNewContext(projectActionsScript+`;projectActionState={projectId:'P',status:'ready',data:{projectVersion:4,actions:[action]}};resolveReviewDecision('scope')`,{...context});
  assert.equal(sent.length,1);assert.deepEqual(sent[0].activityIds,['A1','A2']);assert.equal(sent[0].reference,'CHECK');
 }
});
