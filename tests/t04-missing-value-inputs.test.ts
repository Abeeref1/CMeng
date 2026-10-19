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

// Shared fixture: a project with a dated programme and an applicable amendment.
const amendedProject=(id:string)=>{
  const {RuntimeProjectStore}=require('../packages/runtime-api/src/project-state') as typeof import('../packages/runtime-api/src/project-state');
  const state=new RuntimeProjectStore({durable:false}).getOrCreate(id);
  state.schedules.push({role:'update',format:'xer',sourceFilename:'current.xer',sourceHashSha256:'schedule-hash',uploadedAt:'2026-09-01T00:00:00.000Z',
    revision:{revisionId:'U1',label:'Current',sequence:1,effectiveAt:'2026-08-31',model:{projectId:id,source:'xer',sourceRevisionId:'U1',dataDateIso:'2026-08-31T08:00:00',activities:[],relationships:[],wbs:[],calendars:[],diagnostics:[]}}} as any);
  state.evidenceDocuments.push({documentId:'AMD',category:'contract',documentType:'contract_amendment',sourceFilename:'amendment.pdf',sourceHashSha256:'amd-hash',uploadedAt:'2026-09-01T00:00:00.000Z',basisState:'additive',linkedArtifactId:null,diagnostics:[]} as any);
  state.contractDocuments.push({documentId:'AMD',role:'amendment',result:{sections:[{text:'Effective Date 15 August 2026\nRevised Contractual Completion 31 March 2030',startPage:1,sectionKey:'preamble',sourceMode:'deterministic',sourceSpans:[],kind:'preamble',status:'verified',diagnostics:[]}],pdf:{pages:[]}}} as any);
  state.version++;
  return state;
};

test('the shared time position keeps a user-entered award when an amendment applies with no determinations, the same value as the reporting basis',async()=>{
  const {missingValueInputPatch,heldMissingValue}=await import('../packages/runtime-api/src/missing-value-inputs');
  const {canonicalTimeClaims}=await import('../packages/runtime-api/src/canonical-time-claims');
  const {reportingTimeBasis}=await import('../packages/runtime-api/src/source-review-decisions');
  const state=amendedProject('INPUT-AMEND-'+process.pid);
  const before=canonicalTimeClaims(state,true).contractTimeBasis!;
  assert.equal(before.overlapResolution,'unresolved','the amendment branch applies');assert.match(before.contractualCompletionIso??'',/^2030-03-31/);
  assert.equal(before.officialApprovedEotDays,null,'no determinations: the award is unknown');
  assert.equal(heldMissingValue(state,'approved-eot-days'),null);
  state.controls.contractTimeBasis=missingValueInputPatch(state,'approved-eot-days',{days:'12'}).contractTimeBasis!;state.version++;
  const shared=canonicalTimeClaims(state,true).contractTimeBasis!;
  assert.equal(shared.overlapResolution,'unresolved','still the amendment branch');assert.match(shared.contractualCompletionIso??'',/^2030-03-31/,'the amended completion still governs');
  assert.equal(shared.officialApprovedEotDays,12,'the shared time position keeps the user-entered award');
  assert.equal(shared.officialApprovedEotState,'official');
  assert.ok(shared.sourceRefs.includes('user-confirmation:approved-eot-days:12'),'and its user-confirmation reference');
  assert.equal(reportingTimeBasis(state,shared)?.officialApprovedEotDays,12,'one value on every page');
  assert.equal(heldMissingValue(state,'approved-eot-days'),12);
});

test('rebuilding from a claims register keeps a user-entered award unless the register establishes an award, which replaces it and drops its reference',async()=>{
  const {rebuildDerivedControls}=await import('../packages/runtime-api/src/evidence-control-adapters');
  // The rebuild reads each active document's derived controls. The claims
  // adapter yields a time basis only when the register establishes an award.
  const run=(id:string,derived:Record<string,unknown>)=>{
    const state=amendedProject(id);
    state.controls.contractTimeBasis={contractualCompletionIso:null,contractualCompletionState:'missing',officialApprovedEotDays:12,officialApprovedEotState:'official',
      eotDayBasis:'unknown',eotDayBasisState:'missing',sourceRefs:['user-confirmation:approved-eot-days:12']} as any;
    state.evidenceDocuments.push({documentId:id+'-REG',category:'risk_claims_procurement',documentType:'delay_eot_claims_register',sourceFilename:'claims.csv',sourceHashSha256:'reg-hash',
      uploadedAt:'2026-09-02T00:00:00.000Z',basisState:'active',linkedArtifactId:null,diagnostics:[]} as any);
    (state.derivedControlsByDocument as any)[id+'-REG']=derived;
    state.version++;rebuildDerivedControls(state);
    return state.controls.contractTimeBasis!;
  };
  const kept=run('INPUT-REBUILD-NONE-'+process.pid,{});
  assert.equal(kept.officialApprovedEotDays,12,'a register with no determinations does not wipe the entered award');
  assert.equal(kept.officialApprovedEotState,'official');
  assert.ok(kept.sourceRefs.includes('user-confirmation:approved-eot-days:12'));
  const replaced=run('INPUT-REBUILD-AWARD-'+process.pid,{contractTimeBasis:{contractualCompletionIso:null,contractualCompletionState:'missing',officialApprovedEotDays:26,officialApprovedEotState:'official',
    eotDayBasis:'calendar_days',eotDayBasisState:'official',sourceRefs:['evidence-document:REG:row:2']}});
  assert.equal(replaced.officialApprovedEotDays,26,'a source award governs');
  assert.ok(replaced.sourceRefs.includes('evidence-document:REG:row:2'));
  assert.ok(!replaced.sourceRefs.some(ref=>ref.startsWith('user-confirmation:approved-eot-days:')),'the replaced user value no longer claims to be the source');
});
