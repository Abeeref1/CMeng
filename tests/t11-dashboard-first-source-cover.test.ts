import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import {sourceScheduleCompletionBases} from '../packages/schedule-analysis-core/src';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createCmengServer} from '../packages/runtime-api/src/server';
import type {AddressInfo} from 'node:net';

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


test('T11 original full management dashboard is complete on first open, not a limited source cover',()=>{
  const a=seed(8),b=seed(12);
  for(const x of [a,b]){
    const result=moduleForProject(x.id,'master-dashboard');
    const data:any=result.data;
    assert.equal(result.key,'master-dashboard');
    assert.equal(data.projectionKey,'master_dashboard');
    assert.ok(Array.isArray(data.metrics)&&data.metrics.length>=12,'full original management metric population');
    assert.ok(data.readiness&&typeof data.readiness.total==='number'&&data.readiness.total>=29,
      'the complete specialist readiness population is calculated and not replaced with missing/zero placeholders');
    assert.ok(data.consistency&&typeof data.consistency.checkCount==='number','cross-module consistency is actually checked');
    assert.ok(data.projectDiagnosis,'original complete Project Diagnosis is included on the first screen');
    assert.ok(data.visualControl,'original visual charts and programme-driver facts are included');
    assert.ok(data.scheduleExceptions,'original schedule exception tables retained');
    assert.ok(data.operationalReporting,'original operational evidence scope retained');
    assert.ok(data.projectFacts,'complete canonical facts from the same project');
    assert.ok(data.positionVerdict,'dashboard still answers the project question immediately');
    assert.equal(data.projectId,x.id);
    assert.equal('viewScope' in data,false,'there is no smaller substitute dashboard');
    assert.equal(JSON.stringify(x.state.schedules),x.before,'no original source value or adopted decision is altered');
  }
  assert.notEqual(a.id,b.id,'overlapping activity IDs across projects remain isolated');
});
test('T11 default dashboard HTTP route equals complete module and explicit full read, without a button',async()=>{
  const x=seed(8);
  const server=createCmengServer();
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',()=>resolve()));
  try{
    const address=server.address() as AddressInfo;
    const base='http://127.0.0.1:'+address.port+'/api/projects/'+encodeURIComponent(x.id)+'/management/master-dashboard';
    const first=await fetch(base);
    assert.equal(first.status,200);
    const firstBody:any=await first.json();
    assert.ok(firstBody.data?.readiness?.total>=29,'first GET includes all specialist positions');
    assert.ok(firstBody.data?.projectDiagnosis,'first GET has the original diagnosis');
    assert.ok(firstBody.data?.visualControl,'first GET has the original charts and tables');
    assert.ok(firstBody.data?.metrics?.length>=12,'first GET has original management metrics');
    assert.equal(firstBody.data?.viewScope,undefined,'no source-only cover');
    const explicit=await fetch(base+'?full=1');
    assert.equal(explicit.status,200);
    const fullBody:any=await explicit.json();
    assert.deepEqual(fullBody.data?.projectFacts,firstBody.data?.projectFacts,'all canonical source facts identical');
    assert.deepEqual(fullBody.data?.metrics,firstBody.data?.metrics,'no first-open metrics were omitted');
    assert.deepEqual(fullBody.data?.readiness,firstBody.data?.readiness,'readiness remains fully calculated');
    assert.deepEqual(fullBody.data?.consistency,firstBody.data?.consistency,'same actual cross-module checks');
    assert.equal(JSON.stringify(x.state.schedules),x.before);
  }finally{
    await new Promise<void>((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
  }
});
test('T11 browser always displays the complete management visualization on first open',()=>{
  const script=cmengUatHtml();
  const serverSource=readFileSync(join(process.cwd(),'packages/runtime-api/src/server.ts'),'utf8');
  assert.match(serverSource,/const result = moduleForProject\(projectId,key\);/);
  assert.doesNotMatch(serverSource,/masterDashboardCoverForProject\(projectId\)/);
  assert.doesNotMatch(script,/loadCompleteMasterDashboard\(/);
  assert.doesNotMatch(script,/data\?\.viewScope==='source_position'/);
  assert.match(script,/renderPmcControlRoom\(data\)/);
  assert.match(script,/renderDashboardExceptions\(data\)/);
  assert.match(script,/renderDashboardDecisions\(data\)/);
  assert.match(script,/renderDashboardTrend\(data\)/);
  assert.match(script,/renderOperationalReporting\(data\.operationalReporting\)/);
});
