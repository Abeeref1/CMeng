import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
import type {ProjectRuntimeState} from '../packages/runtime-api/src/project-state-types';

// Mechanism 4 (no self-comparison), matrix 15 Nov 2026: when the only programme
// is the baseline, its rows carry no baseline dates, so no page shows movement
// or variance of the programme against itself. After the first update the
// baseline is a different file and movement is measured against it.
function programme(id:string,revision:string,finish:string):CanonicalScheduleModel{
  return {projectId:id,source:'xer',sourceRevisionId:revision,dataDateIso:'2031-04-01T08:00:00',wbs:[],relationships:[],diagnostics:[],
    calendars:[{calendarId:'C',name:'Eight-hour day',standardDayHours:8,semanticComplete:true,sourceRefs:[]}],
    activities:[
      {projectId:id,activityId:'WORK',nativeId:'1',name:'Works',wbsId:null,calendarId:'C',activityType:'task',status:'not_started',
       baselineStartIso:'2031-04-10',baselineFinishIso:'2031-05-01',currentStartIso:'2031-04-10',currentFinishIso:finish,actualStartIso:null,actualFinishIso:null,
       forecastStartIso:null,forecastFinishIso:null,originalDurationHours:120,remainingDurationHours:120,totalFloatHours:0,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]},
      {projectId:id,activityId:'DONE',nativeId:'2',name:'Completion',wbsId:null,calendarId:'C',activityType:'finish_milestone',status:'not_started',
       baselineStartIso:'2031-05-01',baselineFinishIso:'2031-05-01',currentStartIso:finish,currentFinishIso:finish,actualStartIso:null,actualFinishIso:null,
       forecastStartIso:null,forecastFinishIso:null,originalDurationHours:0,remainingDurationHours:0,totalFloatHours:0,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]}]} as CanonicalScheduleModel;
}
const baselineFields=(key:string,row:any)=>key==='milestones'?[row.baselineDateIso,row.varianceDays]:key==='activity-analytics'?[row.baselineFinishIso,row.finishVarianceDays]:[row.baselineFinishIso];

test('a baseline-only programme is never compared with itself',()=>{
  const state=runtimeProjects.getOrCreate('SELF-BASELINE-'+randomUUID());
  state.schedules.push({role:'baseline',format:'xer',sourceFilename:'Baseline.xer',sourceHashSha256:'BASE',uploadedAt:'2031-04-01',
    revision:{revisionId:'BASE',label:'Baseline',sequence:1,effectiveAt:'2031-04-01',model:programme(state.projectId,'BASE','2031-05-01')}} as ProjectRuntimeState['schedules'][number]);
  state.version++;
  for(const key of ['milestones','activity-analytics','lookahead-schedule']){
    const data=moduleForProject(state.projectId,key).data as any;
    assert.equal(data.baselineComparison.state,'unresolved',key);
    for(const row of data.rows??[])assert.deepEqual(baselineFields(key,row).filter(v=>v!==null&&v!==undefined),[],key+' '+row.activityId);
  }
  // After the first update the baseline is a different file: movement is measured.
  state.schedules.push({role:'update',format:'xer',sourceFilename:'Update.xer',sourceHashSha256:'UPD',uploadedAt:'2031-05-01',
    revision:{revisionId:'UPD',label:'Update 1',sequence:2,effectiveAt:'2031-04-15',model:{...programme(state.projectId,'UPD','2031-05-09'),dataDateIso:'2031-04-15T08:00:00'}}} as ProjectRuntimeState['schedules'][number]);
  state.version++;
  const milestones=moduleForProject(state.projectId,'milestones').data as any;
  assert.equal(milestones.baselineComparison.state,'established');
  const done=milestones.rows.find((r:any)=>r.activityId==='DONE');
  assert.ok(done&&done.baselineDateIso&&done.varianceDays>0,JSON.stringify(done));
});
