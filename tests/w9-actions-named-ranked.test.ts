import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {crossDomainAccountability} from '../packages/runtime-api/src/accountability-intelligence';
import {prioritizeActions,safetyAction} from '../packages/runtime-api/src/action-priority';
import type {ProjectRuntimeState} from '../packages/runtime-api/src/project-state-types';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

function fixture(){
  const state=runtimeProjects.getOrCreate('W9-ACTIONS-'+randomUUID());
  const model:CanonicalScheduleModel={projectId:state.projectId,source:'xer',sourceRevisionId:'CURRENT',dataDateIso:'2031-04-15',activities:[],relationships:[],calendars:[],wbs:[],diagnostics:[]};
  state.schedules.push({role:'update',format:'xer',sourceFilename:'current.xer',sourceHashSha256:'test',uploadedAt:'2031-04-15',revision:{revisionId:'CURRENT',label:'Current',sequence:1,effectiveAt:'2031-04-15',model}} as ProjectRuntimeState['schedules'][number]);
  model.activities.push({projectId:state.projectId,activityId:'WORK',nativeId:'1',name:'Basement waterproofing',wbsId:null,calendarId:null,activityType:'task',status:'not_started',baselineStartIso:null,baselineFinishIso:null,currentStartIso:'2031-04-01',currentFinishIso:'2031-04-10',actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:8,remainingDurationHours:8,totalFloatHours:-8,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]} as any);
  state.controls.ncrs.push({ncrId:'NCR-0259',status:'open',severity:'major',raisedIso:'2031-04-01',dueIso:'2031-04-10',closedIso:null,owner:null,linkedActivityId:'WORK',sourceRefs:['quality-source:NCR-0259']} as any);
  state.controls.rfis.push({rfiId:'RFI-0660',status:'open',raisedIso:'2031-04-01',dueIso:'2031-04-10',owner:null,linkedActivityId:'WORK',sourceRefs:['rfi-source:RFI-0660']} as any);
  state.controls.rfis.push({rfiId:'RFI-0680',status:'open',raisedIso:'2031-04-01',dueIso:'2031-04-12',owner:null,linkedActivityId:'WORK',sourceRefs:['rfi-source:RFI-0680']} as any);
  state.version++;
  return state;
}

test('F54 the activity action names the NCR and RFIs linked to it, read from the source records',()=>{
  const p=crossDomainAccountability(fixture());
  const activity=p.recordActions.find(a=>a.actionId==='accountability:schedule|WORK')!;
  assert.ok(activity,'activity action present');
  // Before: "WORK · Basement waterproofing · Activity has ..." with no blocker named.
  assert.match(activity.issue,/Linked records: /);
  for(const ref of ['NCR-0259','RFI-0660','RFI-0680'])assert.ok(activity.issue.includes(ref),'activity action names '+ref);
  assert.equal(activity.actionId,'accountability:schedule|WORK','identity unchanged by the wording');
});

test('F54 owner group actions name their records, not only a count',()=>{
  const p=crossDomainAccountability(fixture());
  const design=p.actions.find(a=>a.owningModule==='delivery-design')!;
  assert.ok(design,'design group action present');
  // Before: "Design records requiring attention (2 records)".
  assert.match(design.issue,/\(2 records\): RFI-06[68]0, RFI-06[68]0$/);
  const quality=p.actions.find(a=>a.owningModule==='delivery-quality')!;
  assert.match(quality.issue,/\(1 records\): NCR-0259$/);
});

test('F51 one action per owner/register chain and every member stays reachable through its group',()=>{
  const p=crossDomainAccountability(fixture());
  const groupIds=new Set(p.ownerGroups.map(g=>g.groupId));
  assert.equal(p.actions.length,p.ownerGroups.length,'one action per chain');
  for(const a of p.actions)assert.ok(groupIds.has(a.actionId),'action '+a.actionId+' is its group');
  const members=p.ownerGroups.flatMap(g=>g.memberActionIds);
  assert.deepEqual([...members].sort(),p.recordActions.map(a=>a.actionId).sort(),'every record action is a member of exactly one group');
});

test('F51 ranking by consequence: completion first, then money, then safety, then severity',()=>{
  const row=(id:string,extra:Record<string,unknown>)=>({actionId:id,recordKey:id,issue:id,consequence:null,affectedScope:[],affectedMilestones:[],owner:'Owner',organisation:null,
    requiredAction:'Act',dueIso:null,escalation:null,severity:'high',authority:'source',sourceRefs:[],moneyAtRisk:[],owningModule:null,...extra}) as any;
  const model={activities:[{activityId:'LATE',status:'not_started',totalFloatHours:-40,activityType:'task',calendarId:null}],relationships:[]} as any;
  const ranked=prioritizeActions([
    row('risk|ROUTINE',{severity:'critical'}),
    row('hse|PERMIT-1',{}),
    row('procurement|PKG-1',{moneyAtRisk:[{amount:500000,currency:'SAR'}]}),
    row('rfi|LATE-RFI',{affectedScope:['LATE']}),
  ],model).map(a=>a.actionId);
  // Before: the safety record ranked below a routine critical-severity record.
  assert.deepEqual(ranked,['rfi|LATE-RFI','procurement|PKG-1','hse|PERMIT-1','risk|ROUTINE']);
  assert.equal(safetyAction({recordKey:'hse|PERMIT-1',owningModule:null}),true);
  assert.equal(safetyAction({recordKey:'risk|K1',owningModule:'delivery-risks'}),false);
  assert.equal(safetyAction({recordKey:'review|x',owningModule:'hse-performance'}),true);
});
