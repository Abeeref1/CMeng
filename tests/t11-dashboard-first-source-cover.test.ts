import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {masterDashboardCoverForProject} from '../packages/runtime-api/src/project-projections';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import {sourceScheduleCompletionBases} from '../packages/schedule-analysis-core/src';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {readFileSync} from 'node:fs';

let sequence=0;
function seed(hours:number){
  const id='DASHBOARD-COVER-SOURCE-'+(++sequence);
  const state=runtimeProjects.getOrCreate(id);
  const model:any={
    projectId:id,source:'xer',sourceRevisionId:'REV-'+id,dataDateIso:'2031-04-01',
    activities:Array.from({length:9},(_,i)=>({
      projectId:id,activityId:'A-'+i,nativeId:String(i),name:'Original task '+i,
      activityType:'task',status:'not_started',wbsId:'W',calendarId:'C',
      originalDurationHours:hours,remainingDurationHours:hours,totalFloatHours:i%2===0?0:-hours,
      freeFloatHours:null,percentComplete:0,
      baselineStartIso:'2031-04-01',baselineFinishIso:'2031-04-14',
      currentStartIso:'2031-04-01',currentFinishIso:i%3===0?'2031-06-01':'2031-05-01',
      actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
      sourceRefs:[],diagnostics:[],
    })),
    relationships:[],wbs:[{wbsId:'W',name:'Original scope',parentWbsId:null,sourceRefs:[]}],
    calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],diagnostics:[],
  };
  state.schedules.push({role:'update',format:'xer',sourceFilename:'original.xer',
    sourceHashSha256:'fixture-'+id,uploadedAt:'2031-04-02',revision:{
      revisionId:'REV-'+id,label:'Submitted update',sequence:1,effectiveAt:'2031-04-01',model,
    }});
  runtimeProjects.touch(state);
  return {id,state,model,before:JSON.stringify(state.schedules)};
}

test('T11 first dashboard calculates sourced metrics without materializing every specialist output',()=>{
  const a=seed(8),b=seed(12);
  for(const x of [a,b]){
    const answer=masterDashboardCoverForProject(x.id)!;
    assert.equal(answer.key,'master-dashboard');
    assert.ok(answer.data,'source cover exists');
    const data:any=answer.data;
    assert.equal(data.viewScope,'source_position');
    assert.equal(data.projectId,x.id);
    assert.equal(data.projectVersion,x.state.version);
    assert.ok(data.positionVerdict,'must answer the management question');
    assert.equal(data.metrics.find((m:any)=>m.key==='submitted-programme-finish')?.value,
      sourceScheduleCompletionBases(x.model).find(row=>row.basis==='forecast')?.dateIso??null,
      'the cover uses the untouched source forecast');
    assert.ok(!('readiness' in data),'uncomputed 29-module assurance must never be reported as zero or ready');
    assert.ok(!('consistency' in data),'missing cross-module check is never a fictional pass');
    assert.equal(JSON.stringify(x.state.schedules),x.before,'source revisions must remain immutable');
  }
  assert.notEqual(a.id,b.id,'different source projects');
});

test('T11 dashboard first request and explicit full-read path are distinct, without weakening full report routes',()=>{
  const backend=readFileSync(new URL('../packages/runtime-api/src/server.ts',import.meta.url),'utf8');
  const ui=cmengUatHtml();
  assert.match(backend,/key==='master-dashboard'&&source\.searchParams\.get\('full'\)!=='1'/);
  assert.match(backend,/masterDashboardCoverForProject\(projectId\)/);
  assert.match(backend,/moduleForProject\(projectId,key\)/,'the exact original full path must remain available');
  assert.match(ui,/function loadCompleteMasterDashboard\(/);
  assert.match(ui,/full=1/,'full detail opens only after explicit interaction');
  assert.match(ui,/data\?\.viewScope==='source_position'/);
});
