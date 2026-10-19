import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {projectFactsForState} from '../packages/runtime-api/src/project-facts';
import {crossDomainAccountability} from '../packages/runtime-api/src/accountability-intelligence';
import {pmcRoleOwner} from '../packages/runtime-api/src/action-priority';
import {capacityInputStatus,resourceUtilizationCapacity} from '../packages/runtime-api/src/project-input-status';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';

// F07 (D-064, D-078, D-107, D-178, D-209, D-215, D-216): calendars, capacity and
// risk owners are one shared status. Each page shows the same state for the
// same project as the project facts.
let serial=0;
function fixture(){
  const projectId='V1-F07-SHARED-INPUTS-'+(++serial);
  const state:any=runtimeProjects.getOrCreate(projectId);
  const N=40;
  // Even activities use a supplied calendar; odd ones name a calendar the file does not contain.
  const activities=Array.from({length:N},(_,i)=>({projectId,activityId:'F07-'+i,nativeId:String(i),name:'Zone '+Math.floor(i/10),
    wbsId:'AW'+Math.floor(i/10),calendarId:i%2===0?'C0':'NOT-IN-FILE',activityType:'task',status:i<4?'completed':'not_started',
    baselineStartIso:'2031-01-01',baselineFinishIso:'2031-02-01',currentStartIso:'2031-01-01',currentFinishIso:'2031-06-01',
    actualStartIso:i<4?'2031-01-01':null,actualFinishIso:i<4?'2031-02-01':null,forecastStartIso:null,forecastFinishIso:null,
    originalDurationHours:24,remainingDurationHours:i<4?0:24,totalFloatHours:i%5,freeFloatHours:null,percentComplete:i<4?100:0,
    sourceRefs:[],diagnostics:[]}));
  const model:any={projectId,source:'xer',sourceRevisionId:'F07-REV',dataDateIso:'2031-04-01',activities,relationships:[],
    wbs:[0,1,2,3].map(i=>({wbsId:'AW'+i,name:'Area '+i,parentWbsId:null,sourceRefs:[]})),
    calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C0'}],diagnostics:[]};
  state.schedules.push({role:'baseline',format:'xer',sourceFilename:'F07.xer',sourceHashSha256:'F07',uploadedAt:'2031-04-01',
    revision:{revisionId:'F07-REV',label:'F07-REV',sequence:1,effectiveAt:'2031-04-01',model}});
  const risk=(riskId:string,owner:string|null)=>({riskId,status:'open',rating:'high',raisedIso:'2031-03-01',dueIso:'2031-05-01',owner,sourceRefs:['risk-source:'+riskId]});
  state.controls.risks.push(risk('RK-NAMED','Risk Engineer'),risk('RK-TBD','TBD'),risk('RK-BLANK',null));
  state.testProject=true;
  runtimeProjects.touch(state);
  return {projectId,state};
}

test('F07: a risk owner is the same on the risk register, delivery risks, Accountability and the project facts',()=>{
  const {projectId,state}=fixture();
  const expected:Record<string,string>={'RK-NAMED':'Risk Engineer','RK-TBD':pmcRoleOwner('risk'),'RK-BLANK':pmcRoleOwner('risk')};
  const register=moduleForProject(projectId,'risk-register').data as any;
  const delivery=moduleForProject(projectId,'delivery-risks').data as any;
  const accountability=crossDomainAccountability(runtimeProjects.getOrCreate(projectId));
  for(const [riskId,owner] of Object.entries(expected)){
    const registerRow=register.rows.find((r:any)=>r.riskId===riskId);
    assert.ok(registerRow,riskId+' is on the risk register');
    assert.equal(registerRow.owner,owner,riskId+' owner on the risk register');
    const deliveryRow=(delivery.rows??[]).find((r:any)=>r.riskId===riskId);
    assert.ok(deliveryRow,riskId+' is on the delivery risks page');
    assert.equal(deliveryRow.owner,owner,riskId+' owner on the delivery risks page');
    const action=accountability.recordActions.find(a=>a.actionId==='accountability:risk|'+riskId);
    assert.ok(action,riskId+' is an Accountability action');
    assert.equal(action.owner,owner,riskId+' owner on Accountability');
  }
  // The source owner text stays beside the shared owner (submitted value kept apart).
  assert.equal(register.rows.find((r:any)=>r.riskId==='RK-TBD').sourceOwner,'TBD');
  const facts=projectFactsForState(state).inputs!;
  assert.equal(facts.riskOwners.recordCount,3);
  assert.equal(facts.riskOwners.namedOwnerCount,1);
  assert.equal(facts.riskOwners.missingOwnerCount,2);
});

test('F07: the calendar prerequisite and calendar count are the same on every page as the project facts',()=>{
  const {projectId,state}=fixture();
  const calendar=projectFactsForState(state).inputs!.calendar;
  // Hand count: 36 open activities (4 completed); the 18 even ones use calendar C0 from the file.
  assert.equal(calendar.openActivityCount,36);
  assert.equal(calendar.calendarActivityCount,18);
  assert.equal(calendar.unresolvedCalendarActivityCount,18);
  assert.equal(calendar.state,'partial');
  const challenge=moduleForProject(projectId,'challenge-contract').data as any;
  const prerequisite=challenge.featureAvailability.prerequisites.find((p:any)=>p.key==='calendar_working_time');
  assert.equal(prerequisite.established,true,'readable calendars confirmed in the facts are confirmed on Delivery challenge');
  const checks=challenge.boqFeasibility?.programmeChecks;
  if(checks)assert.equal(checks.calendarActivityCount,calendar.calendarActivityCount,'feasibility uses the same calendar count');
});

test('F07: capacity status on the resource page equals the project facts, and candidate capacity is never promoted',()=>{
  const {projectId,state}=fixture();
  const capacity=projectFactsForState(state).inputs!.capacity;
  const resource=moduleForProject(projectId,'resource-utilization').data as any;
  assert.deepEqual(resource.capacityStatus,capacity,'resource page capacity state = project facts');
  assert.equal(capacity.state,'missing');
  assert.equal(capacity.capacityCoveragePercent,null,'unknown capacity stays unknown, not 0');
  const candidate={state:'candidate' as const,resourceCount:12,comparableRowCount:24,capacityCoveragePercent:80,plannedUtilizationPercent:95,actualUtilizationPercent:90,utilizationByUnit:[{unit:'h'}]};
  const shared=resourceUtilizationCapacity({assignedResourceCount:12,capacityBasedResourceCount:3,capacityCoveragePercent:25},candidate);
  assert.equal(shared.fields.plannedUtilizationPercent,null,'candidate utilization is not shown as confirmed');
  assert.equal(shared.fields.capacityCoveragePercent,25,'candidate weekly coverage does not replace the schedule coverage');
  assert.equal(shared.status,'partial');
  assert.equal(capacityInputStatus(candidate).state,'candidate');
  const governed=resourceUtilizationCapacity({assignedResourceCount:12,capacityBasedResourceCount:3,capacityCoveragePercent:25},{...candidate,state:'available'});
  assert.equal(governed.fields.plannedUtilizationPercent,95);
  assert.equal(governed.fields.capacityCoveragePercent,80);
  assert.equal(governed.status,'ready');
});
