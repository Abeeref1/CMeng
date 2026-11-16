import {moduleRegistry} from '../packages/runtime-api/src/registry';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,statSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import type {AddressInfo} from 'node:net';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject,managementSurfacesForProject,invalidateProject,prepareProgrammeResults} from '../packages/runtime-api/src/project-projections';
import {setProgrammeResultsDirectory,programmeResultStats,resetProgrammeResultStats,clearProgrammeResultMemory,readProgrammeManifest,programmeManifestCurrent} from '../packages/runtime-api/src/programme-results';
import {setPageCheckDirectory,savedPageCheck,projectSourceStamp} from '../packages/runtime-api/src/page-check-store';
import {cachedIndependentForecast} from '../packages/runtime-api/src/forecast-cache';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {createCmengServer} from '../packages/runtime-api/src/server';
import {projectDirectory,calculationRelease} from '../packages/runtime-api/src/project-catalog';
import {ProjectReadCache} from '../packages/runtime-api/src/project-read-cache';
const dashboardRoute='/management/master-dashboard';

// Mechanism 14 (owner rules, 15 Nov 2026). Programme results (CPM,
// criticality, near-critical, forecast, schedule analysis, revision
// comparisons, scope classification, BOQ-to-programme scoring) are saved by
// the content of their inputs. The Dashboard answers first; the complete page
// check runs after it and is shown only for the exact project version.

let serial=0;
function revisionModel(projectId:string,revision:number,shift=0){
  const N=60;
  return {projectId,source:'xer',sourceRevisionId:'REV-'+revision,dataDateIso:'2031-0'+(revision+1)+'-01',
    activities:Array.from({length:N},(_,i)=>({projectId,activityId:'A'+i,nativeId:String(i),name:'Work '+i,
      activityType:i===N-1?'finish_milestone':'task',status:i<revision*5?'completed':i<revision*5+3?'in_progress':'not_started',
      wbsId:'W'+(i%4),calendarId:'C',originalDurationHours:48+(i%5)*24+shift,remainingDurationHours:i<revision*5?0:48+(i%5)*24+shift,
      totalFloatHours:i%6===0?0:(i%6)*8,freeFloatHours:null,percentComplete:i<revision*5?100:i<revision*5+3?40:0,
      baselineStartIso:'2031-01-01',baselineFinishIso:'2031-09-01',currentStartIso:'2031-01-0'+(1+i%8),currentFinishIso:'2031-0'+(6+(i%3))+'-15',
      actualStartIso:i<revision*5+3?'2031-01-02':null,actualFinishIso:i<revision*5?'2031-02-01':null,forecastStartIso:null,forecastFinishIso:null,
      sourceRefs:[],diagnostics:[]})),
    relationships:Array.from({length:N-1},(_,i)=>({relationshipId:'R'+i,predecessorActivityId:'A'+i,successorActivityId:'A'+(i+1),type:'FS',lagHours:0,sourceRefs:[],diagnostics:[]})).filter((_,i)=>i%4!==3),
    wbs:Array.from({length:4},(_,i)=>({wbsId:'W'+i,name:'Area '+i,parentWbsId:null,sourceRefs:[]})),
    calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],diagnostics:[]};
}
function addRevision(state:any,projectId:string,revision:number,shift=0){
  const model=revisionModel(projectId,revision,shift);
  state.schedules.push({role:revision?'update':'baseline',format:'xer',sourceFilename:'rev'+revision+'.xer',sourceHashSha256:'hash-'+projectId+'-'+revision+'-'+shift,
    uploadedAt:model.dataDateIso,revision:{revisionId:'REV-'+revision,label:'Revision '+revision,sequence:revision+1,effectiveAt:model.dataDateIso,model}});
}
function project(revisions=2){
  const projectId='M14-SAVED-'+(++serial);
  const state:any=runtimeProjects.getOrCreate(projectId);
  for(let revision=0;revision<revisions;revision++)addRevision(state,projectId,revision);
  runtimeProjects.touch(state);
  return {projectId,state};
}
const folder=(name:string)=>mkdtempSync(join(tmpdir(),'cmeng-m14-'+name+'-'));
const dashboard=(projectId:string)=>moduleForProject(projectId,'master-dashboard').data as any;
function withoutStamps(value:unknown):unknown{
  return JSON.parse(JSON.stringify(value,(key,item)=>key==='generatedAt'?undefined:item));
}
/** A result can be saved as JSON without loss: no Map, Set, Date or non-finite number. */
function assertJsonSafe(value:unknown,path='result'){
  if(value instanceof Map||value instanceof Set||value instanceof Date)assert.fail(path+' is not plain JSON data');
  if(typeof value==='number')assert.ok(Number.isFinite(value),path+' is not a finite number');
  if(Array.isArray(value))value.forEach((item,index)=>assertJsonSafe(item,path+'['+index+']'));
  else if(value&&typeof value==='object')for(const [key,item] of Object.entries(value))assertJsonSafe(item,path+'.'+key);
}

test('M14-1 no saved page-check result: the Dashboard answers with Checking pages, never zero or passed',()=>{
  setPageCheckDirectory(folder('no-check'));
  try{
    const {projectId}=project();
    const data=dashboard(projectId);
    assert.ok(data.positionVerdict&&data.metrics.length>=12&&data.projectDiagnosis&&data.visualControl,'the project position is answered');
    assert.equal(data.pageCheck.state,'checking');
    assert.match(data.pageCheck.reason,/complete page check is running/);
    assert.equal(data.readiness.state,'checking');
    for(const field of ['ready','partial','blocked','total','calculationAvailable'])assert.equal(data.readiness[field],null,field);
    assert.equal(data.consistency.state,'checking');
    assert.equal(data.consistency.checkCount,null);
    assert.equal(data.actions,null);
    assert.equal(data.issueAssessment,null);
    assert.equal(data.projectFacts.actions.openCount.valueState,'checking');
  }finally{setPageCheckDirectory(undefined);}
});

test('M14-2 a page check saved for an older project version or other sources is never shown as current',()=>{
  const checks=folder('old-check');
  setPageCheckDirectory(checks);
  try{
    const {projectId,state}=project();
    const checkedVersion=state.version;
    managementSurfacesForProject(projectId);
    const stamp=projectSourceStamp(state);
    const saved=savedPageCheck(projectId,checkedVersion,stamp);
    assert.ok(saved,'the complete check is saved for its version');
    // A fresh worker (no calculation in memory) shows the saved check at once.
    invalidateProject(projectId);setPageCheckDirectory(checks);
    const reopened=dashboard(projectId);
    assert.equal(reopened.pageCheck.state,'complete');
    assert.equal(reopened.pageCheck.projectVersion,saved!.projectVersion);
    assert.deepEqual(reopened.readiness,withoutStamps(saved!.readiness));
    assert.deepEqual(reopened.actions,withoutStamps(saved!.actions));
    // A new programme revision: the old check is never shown as current.
    addRevision(state,projectId,2);runtimeProjects.touch(state);
    assert.notEqual(state.version,checkedVersion);
    const changed=dashboard(projectId);
    assert.equal(changed.pageCheck.state,'checking');
    assert.equal(changed.pageCheck.projectVersion,state.version);
    assert.equal(changed.readiness.total,null);
    assert.equal(changed.actions,null);
    // The store itself: version, sources and calculation release must all match.
    setPageCheckDirectory(checks);
    assert.equal(savedPageCheck(projectId,state.version,projectSourceStamp(state)),null,'new version');
    assert.ok(savedPageCheck(projectId,checkedVersion,stamp),'its own version only');
    assert.equal(savedPageCheck(projectId,checkedVersion,'another-project-with-the-same-name'),null,'same name and version, other sources');
    const file=join(checks,createHash('sha256').update(projectId).digest('hex')+'.json');
    writeFileSync(file,JSON.stringify({...JSON.parse(readFileSync(file,'utf8')),release:'older-calculation-release'}));
    setPageCheckDirectory(checks);
    assert.equal(savedPageCheck(projectId,checkedVersion,stamp),null,'a check from another calculation release');
  }finally{setPageCheckDirectory(undefined);}
});

test('M14-4 a programme revision change recalculates only the results whose inputs changed',()=>{
  const results=folder('dependency');
  setProgrammeResultsDirectory(results);
  try{
    const {projectId,state}=project(2);
    resetProgrammeResultStats();
    dashboard(projectId);
    const first=programmeResultStats();
    assert.ok(first['independent-forecast']!.computed>=2,'each revision CPM is calculated once');
    // An evidence change that does not touch the programme: a new project
    // version, no programme result recalculated.
    runtimeProjects.touch(state);invalidateProject(projectId);clearProgrammeResultMemory();resetProgrammeResultStats();
    dashboard(projectId);
    const unchanged=programmeResultStats();
    for(const [kind,stat] of Object.entries(unchanged))assert.equal(stat.computed,0,kind+' is reused when its inputs did not change');
    assert.ok(Object.values(unchanged).some(stat=>stat.disk>0),'results are read from the saved files');
    // A new programme revision: only the new revision and its comparison are calculated.
    addRevision(state,projectId,2,24);runtimeProjects.touch(state);invalidateProject(projectId);clearProgrammeResultMemory();resetProgrammeResultStats();
    dashboard(projectId);
    const changed=programmeResultStats();
    assert.equal(changed['independent-forecast']!.computed,1,'only the new revision CPM is calculated');
    // Unchanged revisions keep their saved CPM results (their forecast snapshot
    // and windows view are read; their full CPM is not needed at all).
    const savedCpmReads=(changed['independent-forecast']?.disk??0)+(changed['forecast-snapshot']?.disk??0)+(changed['forecast-summary']?.disk??0);
    assert.ok(savedCpmReads>=1,'unchanged revisions keep their saved CPM results');
    for(const kind of ['forecast-snapshot','forecast-summary'])assert.ok((changed[kind]?.computed??0)<=1,kind+' is made only for the new revision');
    assert.equal(changed['revision-comparison']!.computed,1,'only the new adjacent comparison');
    assert.ok(changed['revision-comparison']!.disk>=1,'the unchanged comparison is reused');
  }finally{setProgrammeResultsDirectory(undefined);rmSync(results,{recursive:true,force:true});}
});

test('M14-5 saved CPM results are identical to an on-demand recalculation, and so is the whole Dashboard',()=>{
  const {state,projectId}=project(2);
  const model=state.schedules.at(-1).revision.model;
  const clone=()=>JSON.parse(JSON.stringify(model));
  const results=folder('identity');
  try{
    setProgrammeResultsDirectory(null);
    const onDemand=cachedIndependentForecast(clone(),'stamp');
    assertJsonSafe(withoutStamps(onDemand));
    setProgrammeResultsDirectory(results);resetProgrammeResultStats();
    const saved=cachedIndependentForecast(clone(),'stamp');
    assert.equal(programmeResultStats()['independent-forecast']!.computed,1);
    clearProgrammeResultMemory();resetProgrammeResultStats();
    const read=cachedIndependentForecast(clone(),'stamp');
    assert.equal(programmeResultStats()['independent-forecast']!.disk,1,'read back from the saved file');
    assert.deepEqual(JSON.parse(JSON.stringify(read)),JSON.parse(JSON.stringify(onDemand)),'saved CPM equals the on-demand CPM');
    assert.deepEqual(JSON.parse(JSON.stringify(saved)),JSON.parse(JSON.stringify(onDemand)));
    // The whole Dashboard: calculated and saved, read back, and calculated on demand.
    const fresh=()=>{state.schedules=JSON.parse(JSON.stringify(state.schedules));invalidateProject(projectId);clearProgrammeResultMemory();};
    fresh();const calculated=withoutStamps(dashboard(projectId));
    fresh();resetProgrammeResultStats();const fromSaved=withoutStamps(dashboard(projectId));
    const stats=programmeResultStats();
    for(const [kind,stat] of Object.entries(stats))assert.equal(stat.computed,0,kind+' read back, not recalculated');
    setProgrammeResultsDirectory(null);fresh();const onDemandDashboard=withoutStamps(dashboard(projectId));
    assert.deepEqual(fromSaved,calculated,'Dashboard from saved results equals the Dashboard that saved them');
    assert.deepEqual(fromSaved,onDemandDashboard,'Dashboard from saved results equals an on-demand Dashboard');
    // Every page: calculated from saved results and on demand, the same values.
    const everyPage=()=>Object.fromEntries(moduleRegistry.map(page=>[page.key,withoutStamps(moduleForProject(projectId,page.key))]));
    setProgrammeResultsDirectory(results);fresh();everyPage();
    fresh();resetProgrammeResultStats();const pagesFromSaved=everyPage();
    assert.ok(Object.values(programmeResultStats()).every(stat=>stat.computed===0),'every page read the saved results');
    setProgrammeResultsDirectory(null);fresh();const pagesOnDemand=everyPage();
    for(const page of moduleRegistry)assert.deepEqual(pagesFromSaved[page.key],pagesOnDemand[page.key],'page from saved results equals on demand: '+page.key);
  }finally{setProgrammeResultsDirectory(undefined);rmSync(results,{recursive:true,force:true});}
});

test('M14-6a the upload/migration path saves the results the Dashboard then reads without recalculating',()=>{
  const results=folder('migration');
  setProgrammeResultsDirectory(results);
  try{
    const {projectId,state}=project(3);
    const prepared=prepareProgrammeResults(projectId)!;
    assert.equal(prepared.projectVersion,state.version);
    const manifest=readProgrammeManifest(results);
    assert.ok(programmeManifestCurrent(manifest,state.version,results),'the manifest records this project version');
    assert.equal(manifest!.files.length,prepared.files);
    assert.ok(manifest!.files.some(file=>file.startsWith('independent-forecast-'))&&manifest!.files.some(file=>file.startsWith('revision-comparison-')));
    const before=new Map(readdirSync(results).map(name=>[name,statSync(join(results,name)).mtimeMs]));
    clearProgrammeResultMemory();resetProgrammeResultStats();
    const data=dashboard(projectId);
    assert.equal(data.pageCheck.state,'checking','no Dashboard was prepared by the migration');
    for(const [kind,stat] of Object.entries(programmeResultStats()))assert.equal(stat.computed,0,kind+' comes from the migration, not the Dashboard');
    const after=new Map(readdirSync(results).map(name=>[name,statSync(join(results,name)).mtimeMs]));
    for(const [name,time] of before)if(name!=='manifest.json')assert.equal(after.get(name),time,'saved result unchanged: '+name);
  }finally{setProgrammeResultsDirectory(undefined);rmSync(results,{recursive:true,force:true});}
});

test('M14-6b the release speed test waits for the real migration and keeps every timed Dashboard cold',()=>{
  const script=readFileSync(join(process.cwd(),'scripts/release-latency.cjs'),'utf8');
  assert.match(script,/CMENG_BACKGROUND_WARMUP:'0'/,'no background page warm-up in the timed server');
  assert.match(script,/\/programme-results'\)\)\.json\(\)\)\.state/,'waits on the server migration status');
  assert.match(script,/states\.every\(state=>state==='current'\)/);
  const wait=script.indexOf('programmeResultsPreparationMs=');
  const firstDashboard=script.indexOf('management/master-dashboard');
  const coldTimer=script.indexOf('const cold=performance.now()');
  assert.ok(wait>0&&coldTimer>wait,'the timers start after the migration');
  assert.ok(firstDashboard>coldTimer,'no Dashboard is requested before the timers');
  assert.doesNotMatch(script,/programme-results\/[^'"]*\/prepare/,'the test does not prepare results itself: the server migration does');
});

test('M14-6c the internal preparation route is closed without the worker key',async()=>{
  const server=createCmengServer();
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',()=>resolve()));
  try{
    const base='http://127.0.0.1:'+(server.address() as AddressInfo).port;
    const response=await fetch(base+'/internal/programme-results/ANY/prepare',{method:'POST'});
    assert.equal(response.status,403);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

function xer(id:string,count:number){
  const lines=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+id+'\t2031-04-01','%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tEight hour calendar\tMon-Fri 08:00-16:00','%T\tTASK','%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt'];
  for(let i=0;i<count;i++)lines.push(['%R',i,1,1,'A'+i,id+' work '+i,'TK_NotStart','2031-04-01','2031-06-01',8,8,i%7].join('\t'));
  return [...lines,'%E'].join('\n');
}

test('M14-3/6 gateway: migration saves programme results, the Dashboard answers first, the background check fills it',{timeout:180000},async()=>{
  const root=mkdtempSync(join(tmpdir(),'cmeng-m14-gateway-'));
  const previous=process.env.CMENG_BACKGROUND_WARMUP;process.env.CMENG_BACKGROUND_WARMUP='0';
  const gateway=await createProjectGateway(root,{maxWorkers:2});
  await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+(gateway.server.address() as AddressInfo).port;
  try{
    const id='M14-GATEWAY';
    assert.equal((await fetch(base+'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:id})})).status,201);
    const upload=await fetch(base+'/api/projects/'+id+'/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'programme.xer','x-upload-intent':'replace_current_basis','x-schedule-role':'update'},body:xer(id,40)});
    assert.equal(upload.status,201,await upload.text());
    // Server readiness is separate from calculation readiness: the service answers while the project is prepared.
    let status:any=null;
    for(let attempt=0;attempt<600&&status?.state!=='current';attempt++){
      await new Promise(resolve=>setTimeout(resolve,100));
      status=await (await fetch(base+'/api/projects/'+id+'/programme-results')).json();
    }
    assert.equal(status.state,'current','the gateway migration saved the programme results of this version');
    const version=status.projectVersion;
    const folderPath=join(projectDirectory(root,id),'programme-results');
    assert.ok(programmeManifestCurrent(readProgrammeManifest(folderPath),version,folderPath));
    const route='/api/projects/'+id+dashboardRoute;
    const reads=new ProjectReadCache(projectDirectory(root,id));
    assert.equal(await reads.get(calculationRelease(),version,route),null,'no Dashboard is prepared before it is requested');
    const health=await (await fetch(base+'/health')).json() as any;
    assert.equal(health.programmeResults.current>=1,true);
    // The Dashboard answers first and says the page check is running.
    const first=await fetch(base+route);
    assert.equal(first.status,200);
    assert.equal(first.headers.get('x-cmeng-page-check'),'pending');
    const firstBody=await first.json() as any;
    assert.equal(firstBody.data.pageCheck.state,'checking');
    assert.ok(firstBody.data.positionVerdict);
    // The background page check fills the panels; the browser's poll never starts a calculation.
    let polled:any=firstBody;
    for(let attempt=0;attempt<600&&polled?.data?.pageCheck?.state!=='complete';attempt++){
      await new Promise(resolve=>setTimeout(resolve,100));
      polled=await (await fetch(base+route,{headers:{'x-cmeng-page-check-poll':'1'}})).json();
    }
    assert.equal(polled.data.pageCheck.state,'complete','the background complete page check finished');
    assert.ok(polled.data.readiness.total>=29);
    assert.ok(Array.isArray(polled.data.actions));
    assert.deepEqual(polled.data.metrics,firstBody.data.metrics,'the same project values before and after the check');
    assert.ok(await reads.get(calculationRelease(),version,route),'the checked Dashboard is kept for this version');
    const again=await fetch(base+route);
    assert.equal(again.headers.get('x-cmeng-page-check'),null);
    assert.equal((await again.json() as any).data.pageCheck.state,'complete');
  }finally{
    await gateway.close();
    if(previous===undefined)delete process.env.CMENG_BACKGROUND_WARMUP;else process.env.CMENG_BACKGROUND_WARMUP=previous;
    rmSync(root,{recursive:true,force:true});
  }
});

test('M14-7 the Dashboard screen sends what the Dashboard shows and keeps every stated total',()=>{
  const {dashboardScreenView,DASHBOARD_DRIVER_GROUPS_SHOWN,DASHBOARD_GROUP_ACTIVITY_IDS_SHOWN}=require('../packages/runtime-api/src/dashboard-view');
  const groups=Array.from({length:30},(_,g)=>({wbs:'W'+g,activityCount:20,activityIds:Array.from({length:20},(_,i)=>'A'+g+'-'+i),
    activityNames:Array.from({length:20},(_,i)=>'Name '+i),lowestFloatHours:g,milestoneIds:['M'+g],packageCandidates:[],consequence:'c'}));
  const result={key:'master-dashboard',data:{metrics:[{key:'m',value:1}],visualControl:{schedule:{priorityGroups:groups,criticalCount:4},progress:{x:1}},
    trend:{schemaVersion:'1.0',projectionKey:'forecast_history',points:[{dataDateIso:'2031-01-01'}],reportingContract:{populations:{big:[1,2,3]}},challenge:{}}}};
  const view=dashboardScreenView(result);
  const shown=view.data.visualControl.schedule;
  assert.equal(shown.priorityGroupTotal,30,'the number of driver groups is kept');
  assert.equal(shown.priorityGroups.length,DASHBOARD_DRIVER_GROUPS_SHOWN);
  assert.deepEqual(shown.priorityGroups.map((g:any)=>g.wbs),groups.slice(0,12).map(g=>g.wbs),'the same lowest-float groups, in order');
  for(const group of shown.priorityGroups){
    assert.equal(group.activityIds.length,DASHBOARD_GROUP_ACTIVITY_IDS_SHOWN);
    assert.equal(group.activityIdTotal,20,'each group keeps its activity total');
    assert.equal('activityNames' in group,false);
    assert.equal(group.activityCount,20);
  }
  assert.equal(shown.criticalCount,4,'other schedule values are unchanged');
  assert.deepEqual(view.data.visualControl.progress,{x:1});
  assert.deepEqual(Object.keys(view.data.trend),['schemaVersion','projectionKey','points']);
  assert.deepEqual(view.data.metrics,result.data.metrics);
  assert.equal(result.data.visualControl.schedule.priorityGroups.length,30,'the calculation itself is not changed');
  const ui=readFileSync(join(process.cwd(),'packages/runtime-api/src/ui.ts'),'utf8');
  assert.match(ui,/const idTotal=group\.activityIdTotal\?\?listTotal\(group\.activityIds\)/,'the browser states the activity total');
  assert.match(ui,/Showing the 12 lowest-float driver groups of/);
  const server=readFileSync(join(process.cwd(),'packages/runtime-api/src/server.ts'),'utf8');
  assert.match(server,/resolveModuleKey\(key\)==='master-dashboard'\?dashboardScreenView\(publicModuleResult\(result,key\)\)/,'only the Dashboard screen route is shaped');
});

test('M14-8 a page calculated on demand gets the same integrity check and challenge as when every page is calculated at once',()=>{
  const {loadCertifiedDemoProject}=require('../packages/runtime-api/src/demo-project');
  const state=loadCertifiedDemoProject('M14-ON-DEMAND-PAGE-'+(++serial));
  dashboard(state.projectId);
  const page:any=moduleForProject(state.projectId,'variance-trends');
  const points=(page.data?.points??page.data?.rows??[]).filter((p:any)=>typeof p?.projectCompletionVarianceDays==='number');
  assert.ok(points.length>0,'the demo programme has a finish movement to challenge');
  const item=page.data.challenge.items.find((i:any)=>i.metricKey==='schedule_variance_days'||/finish-date movement/i.test(i.label??i.metric??''))??page.data.challenge.items[0];
  assert.equal(item.independent.state,'calculated','the challenge reads the page being calculated, not an empty slot');
  assert.ok(page.data.systemEvidenceContract?.checks?.length>0,'the integrity check ran on the page');
});
