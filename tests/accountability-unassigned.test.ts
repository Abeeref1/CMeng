import {pmcRoleOwner} from '../packages/runtime-api/src/action-priority';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {crossDomainAccountability,accountabilityModule} from '../packages/runtime-api/src/accountability-intelligence';
import {projectActionRegisterForState,moduleForProject} from '../packages/runtime-api/src/project-projections';
import type {ProjectRuntimeState} from '../packages/runtime-api/src/project-state-types';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
function fixture(){
  const state=runtimeProjects.getOrCreate('UNASSIGNED-'+randomUUID());
  const model:CanonicalScheduleModel={projectId:state.projectId,source:'xer',sourceRevisionId:'CURRENT',dataDateIso:'2031-04-15',activities:[],relationships:[],calendars:[],wbs:[],diagnostics:[]};
  state.schedules.push({role:'update',format:'xer',sourceFilename:'current.xer',sourceHashSha256:'test',uploadedAt:'2031-04-15',revision:{revisionId:'CURRENT',label:'Current',sequence:1,effectiveAt:'2031-04-15',model}} as ProjectRuntimeState['schedules'][number]);
  state.version++;return {state,model};
}
function ncr(id:string,owner:string|null=null){return {ncrId:id,status:'open' as const,severity:'major' as const,raisedIso:'2031-04-01',dueIso:'2031-04-10',closedIso:null,owner,linkedActivityId:'WORK',sourceRefs:['quality-source:'+id]};}
test('NCR without a named individual retains source, scope, due date and PMC QA/QC accountable role',()=>{
  const {state}=fixture();state.controls.ncrs.push(ncr('N1'));state.version++;
  const before=JSON.stringify(state.controls),p=crossDomainAccountability(state);
  assert.equal(p.recordActions.length,1);const a=p.recordActions[0]!;
  assert.equal(a.owner,pmcRoleOwner('ncr'));assert.equal(a.organisation,null);
  assert.equal(a.dueIso,'2031-04-10');assert.deepEqual(a.affectedScope,['WORK']);assert.deepEqual(a.sourceRefs,['quality-source:N1']);
  assert.match(a.requiredAction,/Close the NCR with corrective evidence/);assert.match(a.escalation??'',/required date is already past/);
  assert.equal(p.ownerGroups[0]!.count,1);assert.equal(p.ownerGroups[0]!.owner,pmcRoleOwner('ncr'));assert.equal(accountabilityModule(state).status,'partial');
  assert.equal(JSON.stringify(state.controls),before,'read-only projection must preserve source records');
});
test('assigning ownership changes the accountable party, not the action identity or population',()=>{
  const {state}=fixture();state.controls.ncrs.push(ncr('N1'));state.version++;
  const before=crossDomainAccountability(state);state.controls.ncrs[0]!.owner='Quality Engineer';state.version++;
  const after=crossDomainAccountability(state);assert.equal(before.recordActions.length,1);assert.equal(after.recordActions.length,1);
  assert.equal(before.recordActions[0]!.actionId,after.recordActions[0]!.actionId);assert.equal(after.recordActions[0]!.owner,'Quality Engineer');
  assert.equal(after.rows.filter(r=>r.dimension==='organisation'&&r.value==='Quality Engineer').length,1);
});
test('unassigned RFI and risk remain distinct actions; closed and future NCRs do not enter the current list',()=>{
  const {state}=fixture();state.controls.ncrs.push({...ncr('CLOSED'),status:'closed',closedIso:'2031-04-12'},{...ncr('FUTURE'),raisedIso:'2031-04-20'});
  state.controls.rfis.push({rfiId:'R1',status:'open',raisedIso:'2031-04-01',dueIso:'2031-04-10',owner:null,linkedActivityId:'WORK',sourceRefs:['rfi-source:R1']});
  state.controls.risks.push({riskId:'K1',status:'open',rating:'high',raisedIso:'2031-04-01',dueIso:'2031-04-10',owner:null,sourceRefs:['risk-source:K1']});state.version++;
  const p=crossDomainAccountability(state);assert.deepEqual(p.recordActions.map(a=>a.actionId).sort(),['accountability:RFI|R1','accountability:risk|K1'].sort());assert.deepEqual(p.recordActions.map(a=>a.owner).sort(),[pmcRoleOwner('rfi'),pmcRoleOwner('risk')].sort());
});
test('schedule pressure without a named individual is assigned to the PMC Planning Manager',()=>{
  const {state,model}=fixture();model.activities.push({projectId:state.projectId,activityId:'WORK',nativeId:'1',name:'Unassigned work',wbsId:null,calendarId:null,activityType:'task',status:'not_started',baselineStartIso:null,baselineFinishIso:null,currentStartIso:'2031-04-01',currentFinishIso:'2031-04-10',actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:8,remainingDurationHours:8,totalFloatHours:-8,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]});state.version++;
  const p=crossDomainAccountability(state);assert.equal(p.recordActions.length,1);assert.equal(p.recordActions[0]!.actionId,'accountability:schedule|WORK');assert.equal(p.recordActions[0]!.owner,pmcRoleOwner('schedule'));assert.deepEqual(p.recordActions[0]!.affectedScope,['WORK']);
});
test('one project cannot acquire another project unassigned records, and a genuine empty position stays empty',()=>{
  const {state:a}=fixture(),{state:b}=fixture();a.controls.ncrs.push(ncr('N1'));a.version++;
  assert.equal(crossDomainAccountability(a).recordActions.length,1);assert.equal(crossDomainAccountability(b).recordActions.length,0);assert.equal(accountabilityModule(b).status,'blocked');
});
test('an overdue due date alone cannot establish an undated risk as currently open',()=>{
  const {state}=fixture();
  state.controls.risks.push({riskId:'UNDATED',status:'open',rating:'high',owner:'Engineer',dueIso:'2031-04-10',sourceRefs:['retained-undated-risk']});
  state.version++;
  const before=JSON.stringify(state.controls.risks),result=accountabilityModule(state);
  assert.equal(result.status,'blocked');assert.deepEqual(crossDomainAccountability(state).recordActions,[]);
  assert.equal(JSON.stringify(state.controls.risks),before);
});

test('Project Review does not publish team records and Accountability retains their evidence',()=>{
 const {state}=fixture();state.controls.ncrs.push(ncr('NCR-BOUNDARY'));state.version++;
 const baseline=crossDomainAccountability(state);
 assert.equal(baseline.recordActions.length,1);
 const register=projectActionRegisterForState(state);
 assert.ok(register.actions.some(a=>a.actionId.startsWith('accountability-owner-group:')),'ranked source team action retained');
 assert.equal(register.workflow.actionCount,register.workflow.actions.length);
 assert.ok(register.workflow.actions.every(a=>(a.category==='confirmation'||a.category==='review')&&a.resolution?.requiresUserAction),'Project Review contains only decisions');
 assert.ok(!register.workflow.actions.some(a=>a.id.startsWith('accountability-owner-group:')));
 const team=(moduleForProject(state.projectId,'cross-domain-accountability').data as any).actions as any[];
 assert.ok(team.some(a=>a.actionId.startsWith('accountability-owner-group:')),'Accountability retains original group');
 assert.ok(team.every(a=>!register.workflow.actions.some(d=>d.id===a.actionId)),'no duplicate authority decisions in team list');
 assert.ok(baseline.recordActions[0]!.sourceRefs.includes('quality-source:NCR-BOUNDARY'));
});

test('owner groups aggregate source ageing and escalation without inventing an action deadline',()=>{
 const {state}=fixture();state.controls.ncrs.push(ncr('OVERDUE'),{...ncr('FUTURE-DUE'),dueIso:'2031-04-20'});state.version++;
 const before=JSON.stringify(state.controls),p=crossDomainAccountability(state),group=p.actions[0]!;
 assert.equal(group.dueIso,null);assert.equal(group.sourceDueIso,'2031-04-10');assert.equal(group.sourceOverdueDays,5);assert.equal(group.sourceOverdueCount,1);
 assert.match(group.escalation??'',/1 overdue source record/);assert.match(group.escalation??'',/Agree a follow-up deadline/);
 assert.equal(p.ownerGroups[0]!.overdueRecordCount,1);assert.equal(p.ownerGroups[0]!.worstOverdueDays,5);
 assert.equal(p.recordActions.find(a=>a.actionId.endsWith('FUTURE-DUE'))!.dueIso,'2031-04-20');
 assert.equal(JSON.stringify(state.controls),before);
 const shared=projectActionRegisterForState(state).actions.find(a=>a.actionId===group.actionId)!;
 assert.equal(shared.dueIso,null);assert.equal(shared.sourceDueIso,group.sourceDueIso);assert.equal(shared.escalation,group.escalation);
});

test('workload totals distinguish incomplete due dates, risk populations and activity links from recorded zeros',()=>{
 const {state}=fixture();
 state.controls.ncrs.push({...ncr('LATE','Quality Engineer'),linkedActivityId:'WORK'},
  {...ncr('FUTURE-DUE','Quality Engineer'),dueIso:'2031-04-20',linkedActivityId:'WORK'},
  {...ncr('NO-DUE-OR-LINK','Quality Engineer'),dueIso:null,linkedActivityId:null});
 state.controls.risks.push(...Array.from({length:600},(_,i)=>({riskId:'UNDATED-'+i,status:'open' as const,rating:'high' as const,owner:'Risk Engineer',dueIso:'2031-04-10',sourceRefs:['retained-risk:'+i]})));
 state.version++;const before=JSON.stringify(state.controls),p=crossDomainAccountability(state),row=p.rows.find(r=>r.dimension==='owner'&&r.value==='Quality Engineer')!;
 assert.equal(p.actions[0]!.sourceOverdueCount,null);assert.equal(p.actions[0]!.knownSourceOverdueCount,1);assert.equal(p.actions[0]!.sourceUnknownDueRecordCount,1);
 assert.equal(p.ownerGroups[0]!.overdueRecordCount,null);assert.equal(p.ownerGroups[0]!.knownOverdueRecordCount,1);
 assert.equal(row.openIssueCount,3);assert.equal(row.overdueCount,null);assert.equal(row.knownOverdueCount,1);assert.equal(row.unknownDueRecordCount,1);
 assert.equal(row.openRiskCount,null);assert.equal(row.knownOpenRiskCount,0);assert.equal(row.affectedActivityCount,null);assert.equal(row.knownLinkedActivityCount,1);assert.equal(row.unlinkedRecordCount,1);
 assert.equal(p.recordActions.find(a=>a.actionId.endsWith('NO-DUE-OR-LINK'))!.sourceOverdueDays,null);
 assert.equal(p.recordActions.find(a=>a.actionId.endsWith('FUTURE-DUE'))!.sourceOverdueDays,0,'a valid future due date is a known non-overdue position');
 assert.equal(p.recordActions.filter(a=>a.actionId.includes('UNDATED-')).length,0,'excluded risks are not manufactured into current owner actions');
 assert.equal(JSON.stringify(state.controls),before);
 state.controls.ncrs=state.controls.ncrs.filter(r=>r.ncrId==='FUTURE-DUE');
 state.controls.risks=[{riskId:'CLOSED',status:'closed',rating:'high',raisedIso:'2031-04-01',closedIso:'2031-04-10',dueIso:null,owner:'Risk Engineer',sourceRefs:['closed-risk']}];state.version++;
 const complete=crossDomainAccountability(state).rows.find(r=>r.dimension==='owner'&&r.value==='Quality Engineer')!;
 assert.equal(complete.overdueCount,0);assert.equal(complete.unknownDueRecordCount,0);assert.equal(complete.openRiskCount,0);assert.equal(complete.affectedActivityCount,1);
});

test('source register groups use the owning register for grouped and review actions',async()=>{
 const {groupActionsByOwnerRegister}=await import('../packages/runtime-api/src/action-priority');
 const {state}=fixture();state.controls.ncrs.push(ncr('N1'));state.version++;
 const grouped=crossDomainAccountability(state).actions[0]!,original=JSON.stringify(grouped);
 const rows=groupActionsByOwnerRegister([grouped,{...grouped,actionId:'review-1',recordKey:'review|classification',owningModule:'source-quality'}]);
 assert.ok(rows.some(r=>r.register==='delivery-quality'));assert.ok(rows.some(r=>r.register==='source-quality'));assert.ok(rows.every(r=>!r.register.includes('accountability-owner-group')&&r.register!=='review'));
 assert.equal(rows.reduce((sum,r)=>sum+r.total,0),2);assert.ok(rows.every(r=>r.actionIds.length===r.total));assert.equal(JSON.stringify(grouped),original);
 const module:any=moduleForProject(state.projectId,'cross-domain-accountability');assert.ok(module.data.ownerRegisterGroups.some((r:any)=>r.register==='delivery-quality'));assert.ok(module.data.ownerRegisterGroups.every((r:any)=>!r.register.includes('accountability-owner-group')));
});

test('Accountability browser retains unknown totals beside their confirmed subsets',async()=>{
 const {runInNewContext}=await import('./browser-context');
 const {state}=fixture();state.controls.ncrs.push({...ncr('UNKNOWN','Quality Engineer'),dueIso:null,linkedActivityId:null});state.version++;
 const data=crossDomainAccountability(state),html=runInNewContext('renderAccountabilityVisual(data)',{data,currentModuleResult:{key:'cross-domain-accountability',data}});
 assert.match(html,/Not established<br><small>0 confirmed in retained records/);assert.match(html,/Not established<br><small>0 linked activities recorded/);assert.match(html,/incomplete domain records/);
 assert.doesNotMatch(html,/NaN|undefined/);
});
