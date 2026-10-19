import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {managementSurfacesForProject,moduleForProject,projectActionRegisterForState} from '../packages/runtime-api/src/project-projections';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import {projectFactsForState} from '../packages/runtime-api/src/project-facts';

let serial=0;
const fixture=()=>{
 const projectId='FIRST-FULL-DASHBOARD-'+(++serial);
 const state=runtimeProjects.getOrCreate(projectId);
 for(let revision=0;revision<2;revision++){
  // The baseline is data-dated before the update. With no adoption documents the
  // current programme is the one schedule with the latest Data Date; two schedules
  // tied on it are ambiguous and fail closed (no programme, so no diagnosis).
  const model:any={projectId,source:'xer',sourceRevisionId:'REV-'+revision,dataDateIso:revision?'2031-02-01':'2031-01-01',
   activities:Array.from({length:41},(_,i)=>({
     projectId,activityId:'A'+i,nativeId:String(i),name:'Work '+i,
     activityType:i===0?'finish_milestone':'task',wbsId:'W',calendarId:'C',
     status:'in_progress',originalDurationHours:8,remainingDurationHours:8,
     totalFloatHours:i%4===0?-8:i%4,freeFloatHours:null,percentComplete:5,
     baselineStartIso:'2031-01-01',baselineFinishIso:'2031-05-01',
     currentStartIso:'2031-01-01',currentFinishIso:revision?'2031-07-01':'2031-06-01',
     actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
     sourceRefs:[],diagnostics:[]
   })),relationships:[],wbs:[{wbsId:'W',name:'Foundation',parentWbsId:null,sourceRefs:[]}],
   calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],diagnostics:[]};
  state.schedules.push({role:revision?'update':'baseline',format:'xer',sourceFilename:'original'+revision+'.xer',
    sourceHashSha256:'fixture'+revision,uploadedAt:'2031-02-01',revision:{revisionId:'REV-'+revision,label:'Update '+revision,sequence:revision+1,effectiveAt:'2031-02-01',model}});
 }
 runtimeProjects.touch(state);
 return {projectId,state,before:JSON.stringify(state.schedules)};
};

test('T11 first Dashboard preserves complete original metrics, source facts, charts and exceptions without building specialist detail',()=>{
 const {projectId,state,before}=fixture();
 const fast:any=moduleForProject(projectId,'master-dashboard').data;
 const detail:any=managementSurfacesForProject(projectId,'full')?.masterDashboard;
 assert.ok(fast&&detail);
 assert.equal(fast.projectionKey,'master_dashboard');
 assert.ok(fast.metrics.length>=12,'original metric set is still on first screen');
 assert.equal(fast.readiness.total,detail.readiness.total,'the registered module population is never reduced');
 assert.deepEqual(fast.metrics,detail.metrics,'no project value or source authority disappears from first Dashboard');
 assert.deepEqual(fast.projectFacts,projectFactsForState(state),'the Dashboard carries the independent canonical fact producer');
 assert.deepEqual(fast.scheduleExceptions,detail.scheduleExceptions,'same full schedule totals and exception rows');
 assert.deepEqual(fast.operationalReporting,detail.operationalReporting,'same current dated registers');
 assert.deepEqual(fast.visualControl,detail.visualControl,'all first-open visual facts retained');
 assert.ok(fast.projectDiagnosis&&fast.positionVerdict&&fast.trend&&fast.managementContext);
 assert.equal(JSON.stringify(state.schedules),before,'first Dashboard and full specialist cannot mutate original project');
});

test('T11 Dashboard source uses on-demand workfront and historical detail, never a second all-module resolver',()=>{
 const src=readFileSync(join(process.cwd(),'packages/runtime-api/src/project-projections.ts'),'utf8');
 // Every certified module raises issues into the shared action register, so a
 // Dashboard that skips modules can never show the full action list. The
 // Dashboard reads the ONE shared full calculation; there is no second
 // Dashboard-only bundle, projection cache or reduced action register.
 assert.doesNotMatch(src,/dashboardBundleCache|dashboardProjectionCache|dashboardOnly|dashboardActionRegister/);
 const {projectId,state}=fixture();
 const dashboard:any=moduleForProject(projectId,'master-dashboard').data;
 const full=projectActionRegisterForState(state);
 const accountability:any=moduleForProject(projectId,'cross-domain-accountability').data;
 assert.deepEqual(dashboard.actions,full.actions,'Dashboard action register equals the full action register');
 assert.deepEqual(dashboard.actions,managementSurfacesForProject(projectId)?.commandCenter.actions,'Dashboard and full management surfaces share one register');
 assert.equal(dashboard.projectFacts.actions.openCount.value,projectFactsForState(state).actions.openCount.value,'Dashboard open-action count equals the full calculation');
 assert.equal(accountability.actions.length+full.workflow.actions.length,full.actions.length,'Accountability team actions plus decisions are the same full register');
});
