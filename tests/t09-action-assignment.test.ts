import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {applyActionAssignments,actionAssignmentInput,actionAssignmentPatch} from '../packages/runtime-api/src/action-assignments';
import {apiOwnerText,apiDueIso,apiDueOverdue,pmcRoleOwner,presentMissingOwners} from '../packages/runtime-api/src/action-priority';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {ProjectAskEngine} from '../packages/runtime-api/src/ask-engine';
import {AskStore} from '../packages/runtime-api/src/ask-store';
import type {AskSession} from '../packages/project-ask/src/types';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// T09: a user-assigned owner and due date is one validated, versioned decision keyed by
// the action's identity; every consumer reads it through the shared owner helper.
test('T09 assignment: one identity, every consumer shape, overdue only before the Data Date and while open',()=>{
  const role=pmcRoleOwner('procurement',null),id='accountability-owner-group:'+encodeURIComponent(role+'|procurement-packages|active_control');
  const decision=actionAssignmentInput({actionId:id,owner:'  Jane   Smith ',dueIso:'2031-07-01'},'2031-08-02T00:00:00.000Z');
  assert.deepEqual(decision,{actionId:id,owner:'Jane Smith',dueIso:'2031-07-01',state:'assigned',decidedAt:'2031-08-02T00:00:00.000Z'});
  const patch=actionAssignmentPatch({} as any,decision);
  const body={actions:[{actionId:id,recordKey:'accountability-owner-group:'+role,owner:role,dueIso:null}],ownerGroups:[{groupId:id,owner:role}],
    workflow:{actions:[{id,owner:role,category:'follow_up'}]},other:[{actionId:'other',owner:role}],closed:[{id,owner:role,status:'Closed'}]};
  const before=JSON.stringify(body);
  const sent=presentMissingOwners(applyActionAssignments(body,patch.actionAssignments,'2031-08-01')) as any;
  assert.equal(JSON.stringify(body),before,'the calculated result is not mutated');
  for(const row of [sent.actions[0],sent.ownerGroups[0],sent.workflow.actions[0]]){
    assert.equal(apiOwnerText(row),'Jane Smith','every page shape shows the assigned owner');
    assert.equal(row.assignedDueIso,'2031-07-01');assert.equal(row.assignedOverdue,true);
    assert.equal(row.owner,null,'the calculated owner field is kept apart');
  }
  assert.equal(sent.actions[0].recordKey,'accountability-owner-group:'+role,'keys are never changed');
  assert.equal(sent.actions[0].dueIso,null,'the source due date is kept apart');
  assert.equal(apiOwnerText(sent.other[0]),'Owner not set · Accountable role: PMC Procurement Manager','another action is not affected');
  assert.equal(sent.closed[0].assignedOverdue,false,'a closed action is never overdue');
  const unknown=applyActionAssignments(body,patch.actionAssignments,null) as any;
  assert.equal(unknown.actions[0].assignedOverdue,null,'no Data Date: overdue is unknown, never false');
  const future=applyActionAssignments(body,actionAssignmentPatch({} as any,{...decision,dueIso:'2031-09-01'}).actionAssignments,'2031-08-01') as any;
  assert.equal(future.actions[0].assignedOverdue,false);
  const cleared=actionAssignmentPatch(patch as any,actionAssignmentInput({actionId:id,action:'clear'}));
  assert.deepEqual(cleared.actionAssignments,{});assert.equal(cleared.actionAssignmentHistory!.length,2);
  assert.equal(apiOwnerText(presentMissingOwners(applyActionAssignments(body,cleared.actionAssignments,'2031-08-01')).actions[0]),'Owner not set · Accountable role: PMC Procurement Manager','clear restores the missing owner');
  for(const invalid of [{actionId:id},{actionId:id,owner:'',dueIso:''},{actionId:id,dueIso:'2031-02-30'},{actionId:id,dueIso:'01/07/2031'},{actionId:id,owner:role},
    {actionId:id,owner:'<b>x</b>'},{actionId:id,owner:'x'.repeat(121)},{actionId:id,owner:'Not assigned'},{actionId:'',owner:'Jane'},{actionId:id,owner:5}])
    assert.throws(()=>actionAssignmentInput(invalid),JSON.stringify(invalid));
  assert.throws(()=>actionAssignmentPatch({} as any,actionAssignmentInput({actionId:id,action:'clear'})),/no assigned owner/);
  const script=cmengUatHtml();
  assert.ok(script.includes(apiOwnerText.toString()),'the browser uses the same helper');
  // M17.1: the save itself is proved by behaviour, not by source text: the next test
  // saves through the route and reads the stored owner back after a restart, and
  // p0a-c1-real-browser-action-save clicks [data-assign-save] in real Chrome from
  // both rendered copies and reads the stored owner back after a restart.
});

test('T09 assignment API: assign, survives restart, stale and invalid input refused, clear restores the calculated owner',async t=>{
  const root=mkdtempSync(join(tmpdir(),'action-assign-'));let gateway=await createProjectGateway(root,{maxWorkers:1}),base='';
  t.after(async()=>{await gateway.close();rmSync(root,{recursive:true,force:true});});
  const listen=async()=>{await new Promise<void>(r=>gateway.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+(gateway.server.address() as any).port;};await listen();
  const post=(path:string,body:any,method='POST')=>fetch(base+path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post('/api/projects',{projectId:'ASSIGN-API'})).status,201);
  const path='/api/projects/ASSIGN-API';
 const upload=(date:string)=>fetch(base+path+'/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'Current.xer','x-upload-intent':'replace_current_basis'},body:['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tRECOVERY-API\t'+date,'%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt','%R\t1\t1\tA1\tConcrete work\t2031-01-01\t2031-12-31\t80\t80','%E'].join('\n')});
  assert.equal((await upload('2031-08-01')).status,201);
  const actions=async()=>{const r=await fetch(base+path+'/actions');assert.equal(r.status,200);return await r.json() as any;};
  let view=await actions();
  const target=view.actions[0];assert.ok(target,'an open action exists');
  const assign=(body:any)=>post(path+'/actions/assign',{expectedVersion:view.projectVersion,actionId:target.id,...body});
  for(const invalid of [{owner:'',dueIso:''},{dueIso:'2031-13-01'},{owner:pmcRoleOwner('schedule',null)},{actionId:'not-an-action',owner:'Jane Smith'},{expectedVersion:view.projectVersion-1,owner:'Jane Smith'},{action:'clear'}])
    assert.equal((await assign(invalid)).status,409,JSON.stringify(invalid));
  assert.equal((await post(path+'/controls',{actionAssignments:{[target.id]:{owner:'X'}}},'PUT')).status,409,'only the validated route writes assignments');
  let r=await assign({owner:'Jane Smith',dueIso:'2031-07-01'});assert.equal(r.status,200,await r.clone().text());
  const saved=await r.json() as any;assert.equal(saved.assignment.owner,'Jane Smith');assert.ok(saved.projectVersion>view.projectVersion);
  const check=async()=>{const now=await actions();const row=[...now.actions,...(now.information||[])].find((a:any)=>a.id===target.id);
    assert.equal(row.assignedOwner,'Jane Smith');assert.equal(row.assignedDueIso,'2031-07-01');assert.equal(row.assignmentState,'assigned');assert.equal(apiOwnerText(row),'Jane Smith');return now;};
  view=await check();
  assert.equal((await post(path+'/actions/assign',{expectedVersion:saved.projectVersion-1,actionId:target.id,owner:'Other Person'})).status,409,'stale version refused');
  await gateway.close();gateway=await createProjectGateway(root,{maxWorkers:1});await listen();
  view=await check();
  r=await post(path+'/actions/assign',{expectedVersion:view.projectVersion,actionId:target.id,action:'clear'});assert.equal(r.status,200,await r.clone().text());
  view=await actions();const row=[...view.actions,...(view.information||[])].find((a:any)=>a.id===target.id);
  assert.equal(row.assignedOwner,undefined);assert.equal(row.assignmentState,undefined);
  assert.equal(apiOwnerText(row),apiOwnerText({...target,assignedOwner:undefined}),'clear restores the calculated owner wording');
});

test('T09 due rule: one shared helper prefers the assigned due date; overdue only before the Data Date while open',()=>{
  const assigned={dueIso:'2031-09-30',assignmentState:'assigned',assignedDueIso:'2031-07-01',assignedOverdue:true};
  assert.equal(apiDueIso(assigned),'2031-07-01');assert.equal(apiDueOverdue(assigned,'2031-08-01'),true);
  assert.equal(apiDueOverdue({...assigned,assignedOverdue:false},'2031-08-01'),false,'closed or not yet due: the server rule decides');
  assert.equal(apiDueOverdue({...assigned,assignedOverdue:null},'2031-08-01'),null,'unknown stays unknown');
  assert.equal(apiDueIso({dueIso:'2031-09-30'}),'2031-09-30','no assignment: the action due date');
  assert.equal(apiDueIso({dueIso:'2031-09-30',assignedDueIso:'2031-07-01'}),'2031-09-30','a stale assigned field without the assigned state is ignored');
  assert.equal(apiDueOverdue({dueIso:'2031-07-01'},'2031-08-01'),true);assert.equal(apiDueOverdue({dueIso:'2031-09-01'},'2031-08-01'),false);
  assert.equal(apiDueOverdue({dueIso:null},'2031-08-01'),null);assert.equal(apiDueOverdue({dueIso:'2031-07-01'},null),null);
  const script=cmengUatHtml();
  for(const fn of [apiDueIso,apiDueOverdue])assert.ok(script.includes(fn.toString()),'the browser uses the same due rule');
  // Command Centre owner groups count overdue deadlines and the next due date with the shared rule.
  assert.match(script,/const actionDue=typeof apiDueIso==='function'\?apiDueIso\(action\):action\.dueIso;/);
  assert.match(script,/apiDueOverdue\(action,dd\)===true/);
  // Command Centre table, Accountability follow-ups and Dashboard priority actions share actionDeadlineText.
  assert.match(script,/function actionDeadlineText\(action\)\{\n const due=typeof apiDueIso==='function'\?apiDueIso\(action\):action\.dueIso/);
  assert.match(script,/planningShortDate\(typeof apiDueIso==='function'\?apiDueIso\(row\):row\.dueIso\)/,'Accountability record rows');
});

test('T09 Ask: management action tables and narrative carry the assigned owner and due date',async t=>{
  const id='ASSIGN-ASK-'+process.pid,state=loadCertifiedDemoProject(id);
  const command:any=moduleForProject(id,'command-center').data;
  assert.ok(command.actions.length>0,'fixture must have a real management action');
  const target=command.actions[0];
  runtimeProjects.updateControls(id,actionAssignmentPatch(state.controls,actionAssignmentInput({actionId:target.actionId,owner:'Jane Smith',dueIso:'2000-01-03'})));
  const root=mkdtempSync(join(tmpdir(),'assign-ask-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const user:AskSession={userId:'assign-test',workspaceId:'cmeng-projects',name:'Review Engineer',title:'Project Controls',company:'Test Company',allowModel:false};
  const answer=await new ProjectAskEngine(new AskStore(root),null).ask(id,user,{question:'Top 10 actions?'});
  const table=answer.sections.find(s=>s.authorityId==='command-center')!.tables.find(t=>t.id==='command-center.actions')!;
  const rows=table.rows as any[];
  const row=rows.find(r=>r.issue===target.issue&&r.owner==='Jane Smith');
  assert.ok(row,'the Ask table shows the assigned owner');assert.equal(row.dueDate,'2000-01-03','the Ask table shows the assigned due date');
  assert.equal(rows.filter(r=>r.owner==='Jane Smith').length,1,'only the assigned action changes');
  assert.match(JSON.stringify(answer.narrative),/owner Jane Smith; due 2000-01-03/,'the Ask narrative reads the same assignment');
});
