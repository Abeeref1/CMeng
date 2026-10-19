import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runInNewContext} from 'node:vm';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {projectActionsScript} from '../packages/runtime-api/src/ui-project-actions';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';

// SW-37 / rule C2: a missing contract value or approved EOT the user can supply
// has an input in Actions required, saved as a user confirmation, and never
// replaces a value that is already held.
const xer=(date:string,name:string)=>['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tCONTROL\t'+date,'%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt','%R\t1\t1\tA1\t'+name+'\t2031-01-01\t2031-12-31\t80\t80','%E'].join('\n');

test('missing contract value and approved EOT days get inline inputs, close on save and persist as user confirmations',async t=>{
  const root=mkdtempSync(join(tmpdir(),'missing-value-inputs-'));let gateway=await createProjectGateway(root,{maxWorkers:1}),base='';
  t.after(async()=>{await gateway.close();rmSync(root,{recursive:true,force:true});});
  const listen=async()=>{await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+(gateway.server.address() as any).port;};await listen();
  const post=(path:string,body:any)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const get=async(path:string)=>{const r=await fetch(base+path);assert.equal(r.status,200);return await r.json() as any;};
  assert.equal((await post('/api/projects',{projectId:'INPUT-A'})).status,201);
  assert.equal((await fetch(base+'/api/projects/INPUT-A/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'Current programme.xer','x-upload-intent':'add_update','x-schedule-role':'update','x-schedule-role-confirmed':'1'},body:xer('2031-08-31','Current programme')})).status,201);
  const route='/api/projects/INPUT-A/actions/confirm-missing-value';

  let pending=await get('/api/projects/INPUT-A/actions');
  const value=pending.actions.find((a:any)=>a.target.kind==='contract-value');
  const eot=pending.actions.find((a:any)=>a.target.kind==='approved-eot-days');
  assert.ok(value,'missing contract value must offer an inline input action');assert.ok(eot,'missing approved EOT days must offer an inline input action');
  for(const action of [value,eot]){
    assert.equal(action.category,'confirmation');assert.equal(action.target.type,'inline');assert.equal(action.resolution.requiresUserAction,true);
    assert.ok(action.findings.length>0&&action.findings.every((f:any)=>f.kind==='missing_information'),'the input carries the missing-information findings it answers');
  }
  assert.ok(value.findings.some((f:any)=>/contractValue|contractCurrency/.test(f.field??'')));
  assert.ok(eot.findings.some((f:any)=>/approvedEotDays/.test(f.field??'')));
  // The screen shows the fields and the save control.
  const html=(action:any)=>runInNewContext(projectActionsScript+';actionResolutionHtml(action)',{action,escapeHtml:String,project:()=>'INPUT-A'}) as string;
  assert.match(html(value),/action-missing-amount/);assert.match(html(value),/action-missing-currency/);assert.match(html(value),/data-resolve-missing-value=/);
  assert.match(html(eot),/action-missing-days/);

  // Validation: stale version, invented or empty values are refused and nothing is saved.
  const send=(action:any,body:any,version=pending.projectVersion)=>post(route,{actionId:action.id,expectedVersion:version,...body});
  assert.equal((await send(value,{amount:'1250000',currency:'SAR'},pending.projectVersion-1)).status,409);
  assert.equal((await send(value,{amount:'',currency:'SAR'})).status,409);
  assert.equal((await send(value,{amount:'-5',currency:'SAR'})).status,409);
  assert.equal((await send(value,{amount:'1250000',currency:'riyal'})).status,409);
  assert.equal((await send(eot,{days:''})).status,409,'an empty award is unknown, never zero');
  assert.equal((await send(eot,{days:'-3'})).status,409);
  assert.equal((await send(eot,{days:'2.5'})).status,409);
  assert.equal((await post(route,{actionId:'matter:commercial',expectedVersion:pending.projectVersion,amount:'1',currency:'SAR'})).status,409,'only an open input action accepts a value');
  assert.ok((await get('/api/projects/INPUT-A/actions')).actions.some((a:any)=>a.id===value.id));

  const saved=await send(value,{amount:'1,250,000',currency:'sar'});assert.equal(saved.status,200);
  const receipt=await saved.json() as any;
  assert.deepEqual(receipt.value,{amount:1250000,currency:'SAR',sourceRefs:['user-confirmation:contract-value:SAR:1250000']});
  pending=await get('/api/projects/INPUT-A/actions');
  assert.ok(!pending.actions.some((a:any)=>a.target.kind==='contract-value'),'the contract value input closes once saved');
  assert.ok(pending.actions.some((a:any)=>a.target.kind==='approved-eot-days'),'the other input stays open');
  // A held value is never replaced through the input route.
  assert.equal((await send(value,{amount:'999',currency:'USD'},pending.projectVersion)).status,409);

  const eotNow=pending.actions.find((a:any)=>a.target.kind==='approved-eot-days');
  const savedEot=await send(eotNow,{days:'0'},pending.projectVersion);assert.equal(savedEot.status,200);
  const eotReceipt=await savedEot.json() as any;
  assert.equal(eotReceipt.value,0,'a confirmed zero award is a known zero');assert.ok(eotReceipt.sourceRefs.includes('user-confirmation:approved-eot-days:0'));
  pending=await get('/api/projects/INPUT-A/actions');
  assert.ok(!pending.actions.some((a:any)=>a.target.kind==='approved-eot-days'),'the EOT input closes once saved');

  // Kept after restart, still user-confirmed, and still closed.
  await gateway.close();gateway=await createProjectGateway(root,{maxWorkers:1});await listen();
  const restored=await get('/api/projects/INPUT-A/actions');
  assert.ok(!restored.actions.some((a:any)=>['contract-value','approved-eot-days'].includes(a.target.kind)));
  assert.equal((await post(route,{actionId:eotNow.id,expectedVersion:restored.projectVersion,days:'40'})).status,409);
});

test('an adopted source contract value or approved EOT is never overwritten by the input',async()=>{
  const {missingValueInputPatch,openMissingValueInputs}=await import('../packages/runtime-api/src/missing-value-inputs');
  const state=runtimeProjects.getOrCreate('INPUT-ADOPTED-'+process.pid);
  const sourceValue={amount:84000000,currency:'AED',sourceRefs:['evidence-document:contract-1:contract-value:page:3']};
  state.controls.contractValue=sourceValue;
  state.controls.contractTimeBasis={contractualCompletionIso:'2031-12-30T00:00:00.000Z',contractualCompletionState:'official',officialApprovedEotDays:45,officialApprovedEotState:'official',eotDayBasis:'calendar_days',eotDayBasisState:'official',sourceRefs:['evidence-document:det-1:row:2']} as any;
  const before=JSON.stringify(state.controls);
  assert.equal(openMissingValueInputs(state).size,0,'held values open no input');
  assert.throws(()=>missingValueInputPatch(state,'contract-value',{amount:'1',currency:'SAR'}),/already established/);
  assert.throws(()=>missingValueInputPatch(state,'approved-eot-days',{days:'10'}),/already established/);
  assert.equal(JSON.stringify(state.controls),before);
  // With nothing held, the patch is user-confirmed and leaves the adopted completion date as it was.
  state.controls.contractValue=null;
  state.controls.contractTimeBasis={...state.controls.contractTimeBasis!,officialApprovedEotDays:null,officialApprovedEotState:'missing'};
  const patch=missingValueInputPatch(state,'approved-eot-days',{days:'12'});
  assert.equal(patch.contractTimeBasis!.officialApprovedEotDays,12);
  assert.equal(patch.contractTimeBasis!.contractualCompletionIso,'2031-12-30T00:00:00.000Z');
  assert.equal(patch.contractTimeBasis!.contractualCompletionState,'official');
  assert.deepEqual(patch.contractTimeBasis!.sourceRefs,['evidence-document:det-1:row:2','user-confirmation:approved-eot-days:12']);
});
