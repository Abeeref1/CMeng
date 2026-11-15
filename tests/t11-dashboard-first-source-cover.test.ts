import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject,managementSurfacesForProject} from '../packages/runtime-api/src/project-projections';
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


// Mechanism 14 (owner rule, 15 Nov 2026): the Dashboard answers first. Its
// project position is complete on first open; Control Readiness, cross-page
// consistency and the shared action list come from the complete page check,
// which runs after the answer. Until it finishes they say "Checking pages" and
// never show zero, passed or green. The complete check is not reduced.
function assertCompletePosition(data:any,id:string){
  assert.equal(data.projectionKey,'master_dashboard');
  assert.ok(Array.isArray(data.metrics)&&data.metrics.length>=12,'full original management metric population');
  assert.ok(data.projectDiagnosis,'original complete Project Diagnosis is included on the first screen');
  assert.ok(data.visualControl,'original visual charts and programme-driver facts are included');
  assert.ok(data.scheduleExceptions,'original schedule exception tables retained');
  assert.ok(data.operationalReporting,'original operational evidence scope retained');
  assert.ok(data.projectFacts,'complete canonical facts from the same project');
  assert.ok(data.positionVerdict,'dashboard answers the project question immediately');
  assert.equal(data.projectId,id);
  assert.equal('viewScope' in data,false,'there is no smaller substitute dashboard');
}
function assertCheckingPages(data:any){
  assert.equal(data.pageCheck?.state,'checking','the complete page check is pending and says so');
  assert.equal(data.readiness?.state,'checking');
  for(const field of ['ready','partial','blocked','total','calculationAvailable'])
    assert.equal(data.readiness[field],null,'readiness '+field+' is not shown as a number before the check');
  assert.equal(data.consistency?.state,'checking','consistency is not shown as passed or pending-zero');
  assert.equal(data.consistency?.checkCount,null);
  assert.equal(data.actions,null,'no partial action list stands in for the shared register');
  assert.equal(data.issueAssessment,null);
  assert.equal(data.projectFacts.actions.openCount.valueState,'checking');
  assert.equal(data.projectFacts.actions.openCount.value,null);
}

test('T11 Dashboard answers first with the complete project position; page-check panels say Checking pages until the complete check finishes',()=>{
  const a=seed(8),b=seed(12);
  for(const x of [a,b]){
    const first=moduleForProject(x.id,'master-dashboard');
    assert.equal(first.key,'master-dashboard');
    assertCompletePosition(first.data,x.id);
    assertCheckingPages(first.data);
    // The complete page check (the full calculation of every page) then fills the panels.
    assert.ok(managementSurfacesForProject(x.id));
    const checked:any=moduleForProject(x.id,'master-dashboard').data;
    assertCompletePosition(checked,x.id);
    assert.equal(checked.pageCheck.state,'complete');
    assert.ok(typeof checked.readiness.total==='number'&&checked.readiness.total>=29,'the complete specialist readiness population is calculated');
    assert.ok(typeof checked.consistency.checkCount==='number'&&checked.consistency.checkCount>0,'cross-module consistency is actually checked');
    assert.ok(Array.isArray(checked.actions),'the complete shared action register');
    assert.deepEqual(checked.metrics,first.data&&(first.data as any).metrics,'the answer and the checked Dashboard show the same project values');
    assert.equal(JSON.stringify(x.state.schedules),x.before,'no original source value or adopted decision is altered');
  }
  assert.notEqual(a.id,b.id,'overlapping activity IDs across projects remain isolated');
});
test('T11 default dashboard HTTP route answers first, then the background page check fills the same route',async()=>{
  const x=seed(8);
  const server=createCmengServer();
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',()=>resolve()));
  try{
    const address=server.address() as AddressInfo;
    const base='http://127.0.0.1:'+address.port+'/api/projects/'+encodeURIComponent(x.id)+'/management/master-dashboard';
    const first=await fetch(base);
    assert.equal(first.status,200);
    assert.equal(first.headers.get('x-cmeng-page-check'),'pending','the server marks the answer as waiting for its page check');
    const firstBody:any=await first.json();
    assertCompletePosition(firstBody.data,x.id);
    assertCheckingPages(firstBody.data);
    // No button and no second request type: the same route, asked again, gets the checked Dashboard.
    let checked:any=null;
    for(let attempt=0;attempt<200&&checked?.data?.pageCheck?.state!=='complete';attempt++){
      await new Promise(resolve=>setTimeout(resolve,50));
      checked=await (await fetch(base,{headers:{'x-cmeng-page-check-poll':'1'}})).json();
    }
    assert.equal(checked?.data?.pageCheck?.state,'complete','the background page check eventually fills the panels');
    assert.ok(checked.data.readiness.total>=29,'all specialist positions');
    const explicit=await fetch(base+'?full=1');
    assert.equal(explicit.status,200);
    assert.equal(explicit.headers.get('x-cmeng-page-check'),null);
    const fullBody:any=await explicit.json();
    assert.deepEqual(fullBody.data?.projectFacts,checked.data?.projectFacts,'all canonical source facts identical');
    assert.deepEqual(fullBody.data?.metrics,firstBody.data?.metrics,'no first-open metrics were omitted');
    assert.deepEqual(fullBody.data?.readiness,checked.data?.readiness,'readiness remains fully calculated');
    assert.deepEqual(fullBody.data?.consistency,checked.data?.consistency,'same actual cross-module checks');
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
  // M14: the browser shows Checking pages and asks again until the check is done.
  assert.match(script,/function followPageCheck\(route,current\)/);
  assert.match(script,/'x-cmeng-page-check-poll':'1'/);
  assert.match(script,/Checking pages/);
});
