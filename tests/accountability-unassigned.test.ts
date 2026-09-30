import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {crossDomainAccountability,accountabilityModule} from '../packages/runtime-api/src/accountability-intelligence';
import type {ProjectRuntimeState} from '../packages/runtime-api/src/project-state-types';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
function fixture(){
  const state=runtimeProjects.getOrCreate('UNASSIGNED-'+randomUUID());
  const model:CanonicalScheduleModel={projectId:state.projectId,source:'xer',sourceRevisionId:'CURRENT',dataDateIso:'2031-04-15',activities:[],relationships:[],calendars:[],wbs:[],diagnostics:[]};
  state.schedules.push({role:'update',format:'xer',sourceFilename:'current.xer',sourceHashSha256:'test',uploadedAt:'2031-04-15',revision:{revisionId:'CURRENT',label:'Current',sequence:1,effectiveAt:'2031-04-15',model}} as ProjectRuntimeState['schedules'][number]);
  state.version++;return {state,model};
}
function ncr(id:string,owner:string|null=null){return {ncrId:id,status:'open' as const,severity:'major' as const,raisedIso:'2031-04-01',dueIso:'2031-04-10',closedIso:null,owner,linkedActivityId:'WORK',sourceRefs:['quality-source:'+id]};}
test('unassigned NCR stays actionable with its source, scope, due date and escalation',()=>{
  const {state}=fixture();state.controls.ncrs.push(ncr('N1'));state.version++;
  const before=JSON.stringify(state.controls),p=crossDomainAccountability(state);
  assert.equal(p.actions.length,1);const a=p.actions[0]!;
  assert.equal(a.owner,null);assert.equal(a.organisation,null);
  assert.equal(a.dueIso,'2031-04-10');assert.deepEqual(a.affectedScope,['WORK']);assert.deepEqual(a.sourceRefs,['quality-source:N1']);
  assert.match(a.requiredAction,/Assign an accountable party/);assert.match(a.escalation??'',/required date is already past/);
  assert.match(p.managementPosition,/1 still need ownership/);assert.equal(accountabilityModule(state).status,'partial');
  assert.equal(JSON.stringify(state.controls),before,'read-only projection must preserve source records');
});
test('assigning ownership changes the accountable party, not the action identity or population',()=>{
  const {state}=fixture();state.controls.ncrs.push(ncr('N1'));state.version++;
  const before=crossDomainAccountability(state);state.controls.ncrs[0]!.owner='Quality Engineer';state.version++;
  const after=crossDomainAccountability(state);assert.equal(before.actions.length,1);assert.equal(after.actions.length,1);
  assert.equal(before.actions[0]!.actionId,after.actions[0]!.actionId);assert.equal(after.actions[0]!.owner,'Quality Engineer');
  assert.equal(after.rows.filter(r=>r.dimension==='organisation'&&r.value==='Quality Engineer').length,1);
});
test('unassigned RFI and risk remain distinct actions; closed and future NCRs do not enter the current list',()=>{
  const {state}=fixture();state.controls.ncrs.push({...ncr('CLOSED'),status:'closed',closedIso:'2031-04-12'},{...ncr('FUTURE'),raisedIso:'2031-04-20'});
  state.controls.rfis.push({rfiId:'R1',status:'open',raisedIso:'2031-04-01',dueIso:'2031-04-10',owner:null,linkedActivityId:'WORK',sourceRefs:['rfi-source:R1']});
  state.controls.risks.push({riskId:'K1',status:'open',rating:'high',raisedIso:'2031-04-01',dueIso:'2031-04-10',owner:null,sourceRefs:['risk-source:K1']});state.version++;
  const p=crossDomainAccountability(state);assert.deepEqual(p.actions.map(a=>a.actionId).sort(),['accountability:RFI|R1','accountability:risk|K1'].sort());assert.ok(p.actions.every(a=>a.owner===null));
});
test('schedule pressure without ownership or scope classification stays an unassigned programme action',()=>{
  const {state,model}=fixture();model.activities.push({projectId:state.projectId,activityId:'WORK',nativeId:'1',name:'Unassigned work',wbsId:null,calendarId:null,activityType:'task',status:'not_started',baselineStartIso:null,baselineFinishIso:null,currentStartIso:'2031-04-01',currentFinishIso:'2031-04-10',actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:8,remainingDurationHours:8,totalFloatHours:-8,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]});state.version++;
  const p=crossDomainAccountability(state);assert.equal(p.actions.length,1);assert.equal(p.actions[0]!.actionId,'accountability:schedule|WORK');assert.equal(p.actions[0]!.owner,null);assert.deepEqual(p.actions[0]!.affectedScope,['WORK']);
});
test('one project cannot acquire another project unassigned records, and a genuine empty position stays empty',()=>{
  const {state:a}=fixture(),{state:b}=fixture();a.controls.ncrs.push(ncr('N1'));a.version++;
  assert.equal(crossDomainAccountability(a).actions.length,1);assert.equal(crossDomainAccountability(b).actions.length,0);assert.equal(accountabilityModule(b).status,'blocked');
});
