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

// Mechanism 14: the Dashboard answers first from the pages it shows. Every
// project value it shows equals the complete calculation of every page; the
// page-check panels (readiness, consistency, the shared action list) are
// shown only from the complete check, never from a partial one.
const pageCheckFields=new Set(['readiness','consistency','actions','issueAssessment','pageCheck','projectFacts','trend']);
test('T11 first Dashboard shows the same project values as the complete calculation of every page',()=>{
 const {projectId,state,before}=fixture();
 const fast:any=moduleForProject(projectId,'master-dashboard').data;
 const detail:any=managementSurfacesForProject(projectId)?.masterDashboard;
 assert.ok(fast&&detail);
 assert.equal(fast.projectionKey,'master_dashboard');
 assert.equal(fast.pageCheck.state,'checking');
 assert.ok(fast.metrics.length>=12,'original metric set is still on first screen');
 // The checked Dashboard page (the same route after the complete check) is the reference.
 const reference:any=moduleForProject(projectId,'master-dashboard').data;
 assert.equal(reference.pageCheck.state,'complete');
 for(const key of new Set([...Object.keys(fast),...Object.keys(reference)])){
  if(pageCheckFields.has(key))continue;
  assert.deepEqual(fast[key],reference[key],'answer-first value equals the complete calculation: '+key);
 }
 const {actions:_actions,...facts}=projectFactsForState(state);
 const {actions:checkingActions,...fastFacts}=fast.projectFacts;
 assert.deepEqual(fastFacts,facts,'the Dashboard carries the independent canonical fact producer');
 assert.equal(checkingActions.openCount.valueState,'checking','the open-action count waits for the complete check');
 for(const key of ['points','revisions','rows'])assert.deepEqual(fast.trend?.[key],detail.trend?.[key],'trend '+key);
 const checked:any=moduleForProject(projectId,'master-dashboard').data;
 assert.equal(checked.pageCheck.state,'complete');
 assert.equal(checked.readiness.total,detail.readiness.total,'the registered module population is never reduced');
 assert.deepEqual(checked.projectFacts,projectFactsForState(state),'after the check the facts are the complete facts');
 assert.ok(fast.projectDiagnosis&&fast.positionVerdict&&fast.trend&&fast.managementContext);
 assert.equal(JSON.stringify(state.schedules),before,'first Dashboard and full specialist cannot mutate original project');
});

test('T11 Dashboard never shows a partial action register: Checking pages, then the one full register',()=>{
 const src=readFileSync(join(process.cwd(),'packages/runtime-api/src/project-projections.ts'),'utf8');
 // Every certified module raises issues into the shared action register, so a
 // Dashboard built from fewer modules can never show the full action list. It
 // shows the register of the complete page check, or says Checking pages.
 // There is no reduced Dashboard action register.
 assert.doesNotMatch(src,/dashboardActionRegister|dashboardOnlyActions/);
 const {projectId,state}=fixture();
 const answer:any=moduleForProject(projectId,'master-dashboard').data;
 assert.equal(answer.actions,null,'no action list before the complete check');
 assert.equal(answer.projectFacts.actions.openCount.value,null);
 const full=projectActionRegisterForState(state);
 managementSurfacesForProject(projectId);
 const dashboard:any=moduleForProject(projectId,'master-dashboard').data;
 const accountability:any=moduleForProject(projectId,'cross-domain-accountability').data;
 assert.deepEqual(dashboard.actions,full.actions,'Dashboard action register equals the full action register');
 assert.deepEqual(dashboard.actions,managementSurfacesForProject(projectId)?.commandCenter.actions,'Dashboard and full management surfaces share one register');
 assert.equal(dashboard.projectFacts.actions.openCount.value,projectFactsForState(state).actions.openCount.value,'Dashboard open-action count equals the full calculation');
 assert.equal(accountability.actions.length+full.workflow.actions.length,full.actions.length,'Accountability team actions plus decisions are the same full register');
});
