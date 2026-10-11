/* Fresh server process and fresh HTTP requests. Startup analysis is measured
   separately and must complete before readiness. No pre-test dashboard request. */
const {mkdtempSync,rmSync,writeFileSync,readFileSync}=require('node:fs');
const {tmpdir}=require('node:os');const {join}=require('node:path');
const {spawn}=require('node:child_process');const {performance}=require('node:perf_hooks');const assert=require('node:assert/strict');
const root=mkdtempSync(join(tmpdir(),'cmeng-release-latency-'));
process.env.CMENG_DATA_DIR=root;process.env.CMENG_OCR_ENABLED='0';delete process.env.CMENG_TEST_MODE;delete process.env.NODE_TEST_CONTEXT;
const {runtimeProjects}=require('../dist/packages/runtime-api/src/project-state');
const {ELAPSED_24H_CALENDAR}=require('../dist/packages/schedule-cpm/src/calendar');
const {COLD_DASHBOARD_TARGET_MS}=require('../dist/packages/runtime-api/src/release-latency');
const projectId='RELEASE-SCALE';const state=runtimeProjects.getOrCreate(projectId);
for(let revision=0;revision<3;revision++){
 const id='REV-'+revision,activities=Array.from({length:12500},(_,i)=>({projectId,activityId:'A'+i,nativeId:String(i),name:'Work '+i,wbsId:'W'+Math.floor(i/125),calendarId:'C',activityType:'task',status:'not_started',baselineStartIso:'2031-01-01',baselineFinishIso:'2031-06-01',currentStartIso:'2031-01-01',currentFinishIso:'2031-06-'+String(1+revision).padStart(2,'0'),actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:24,remainingDurationHours:24,totalFloatHours:i%7,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]}));
 const relationships=activities.slice(1).filter((_,i)=>(i+1)%125!==0).map(a=>({relationshipId:'R'+a.nativeId,predecessorActivityId:'A'+(Number(a.nativeId)-1),successorActivityId:a.activityId,type:'FS',lagHours:0,sourceRefs:[],diagnostics:[]}));
 const model={projectId,source:'xer',sourceRevisionId:id,dataDateIso:'2031-0'+(2+revision)+'-01',activities,relationships,wbs:Array.from({length:100},(_,i)=>({wbsId:'W'+i,name:'Package '+i,parentWbsId:null,sourceRefs:[]})),calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],diagnostics:[]};
 state.schedules.push({role:revision?'update':'baseline',format:'xer',sourceFilename:id+'.xer',sourceHashSha256:id,uploadedAt:'2031-04-01',revision:{revisionId:id,label:id,sequence:revision+1,effectiveAt:model.dataDateIso,model}});
}
runtimeProjects.touch(state);
// Project shapes are based on the observed 8,100 / 8,900 activity cohorts,
// the source-revision counts and operational register burdens on live projects.
// These are deterministic synthetic records; no customer documents are copied.
// Include real shape dimensions omitted by the historical 20k task-only test.
const coldProfiles=[
 {activities:8900,revisions:4,calendars:6,boqItems:650,registerRecords:450,packages:210},
 {activities:8100,revisions:3,calendars:4,boqItems:360,registerRecords:240,packages:100},
 {activities:8900,revisions:3,calendars:7,boqItems:580,registerRecords:380,packages:180},
 {activities:8100,revisions:4,calendars:5,boqItems:480,registerRecords:300,packages:135},
];
const accountabilityProjectIds=coldProfiles.map((shape,projectIndex)=>{
 const id='ACCOUNTABILITY-SCALE-'+(projectIndex+1),accountabilityState=runtimeProjects.getOrCreate(id);
 const activities=Array.from({length:shape.activities},(_,i)=>{
  const zone=Math.floor(i/100),trade=i%5===0?'Mechanical':i%3===0?'Electrical':'Civil';
  return {projectId:id,activityId:'ACC-'+projectIndex+'-'+i,nativeId:String(i),
   name:'Installation '+trade+' Zone '+zone,wbsId:'AW'+zone,calendarId:'C'+i%shape.calendars,
   activityType:'task',status:'not_started',baselineStartIso:'2031-01-01',
   baselineFinishIso:'2031-02-01',currentStartIso:'2031-01-01',currentFinishIso:'2031-03-01',
   actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
   originalDurationHours:24,remainingDurationHours:24,totalFloatHours:i%17===0?-8:i%13,
   freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]};
 });
 const relationships=[];
 for(let i=1;i<shape.activities;i++){
  if(i%100!==0)relationships.push({relationshipId:'R'+projectIndex+'-'+i,
   predecessorActivityId:activities[i-1].activityId,successorActivityId:activities[i].activityId,
   type:'FS',lagHours:0,sourceRefs:[],diagnostics:[]});
  if(i>5&&i%3===0)relationships.push({relationshipId:'D'+projectIndex+'-'+i,
   predecessorActivityId:activities[i-5].activityId,successorActivityId:activities[i].activityId,
   type:'FS',lagHours:0,sourceRefs:[],diagnostics:[]});
 }
 const wbs=Array.from({length:Math.ceil(shape.activities/100)},(_,i)=>({
  wbsId:'AW'+i,name:'Civil Electrical Mechanical Area '+i,
  parentWbsId:null,sourceRefs:[]}));
 const calendars=Array.from({length:shape.calendars},(_,i)=>({...ELAPSED_24H_CALENDAR,calendarId:'C'+i}));
 for(let revision=0;revision<shape.revisions;revision++){
  const revisionId='ACC-REV-'+projectIndex+'-'+revision;
  const model={projectId:id,source:'xer',sourceRevisionId:revisionId,
   dataDateIso:'2031-04-'+String(revision+1).padStart(2,'0'),
   activities:activities.map(row=>({...row,currentFinishIso:'2031-03-'+String(revision+1).padStart(2,'0')})),
   relationships,wbs,calendars,diagnostics:[]};
  accountabilityState.schedules.push({role:revision?'update':'baseline',format:'xer',
   sourceFilename:revisionId+'.xer',sourceHashSha256:revisionId,uploadedAt:model.dataDateIso,
   revision:{revisionId,label:revisionId,sequence:revision+1,effectiveAt:model.dataDateIso,model}});
 }
 const lastRevision='ACC-REV-'+projectIndex+'-'+(shape.revisions-1);
 accountabilityState.quantities={
  projectId:id,boqRevisionId:'BOQ-'+projectIndex,scheduleRevisionId:lastRevision,
  items:Array.from({length:shape.boqItems},(_,i)=>({
   quantityItemId:'BQ-'+projectIndex+'-'+i,itemNumber:'BQ.'+i,
   section:'Civil Electrical Mechanical Area '+Math.floor(i%shape.activities/100),
   description:'Installation '+(i%5===0?'Mechanical':i%3===0?'Electrical':'Civil')+' Zone '+Math.floor(i%shape.activities/100),
   unit:'m3',contractQuantity:20,sourceRefs:[],diagnostics:[]})),
  allocations:[],installedSnapshots:[],diagnostics:[]};
 const emptyLinks=()=>({activityIds:[],boqItemIds:[],packageIds:[],supplierIds:[],
  locationIds:[],assetIds:[],recordIds:[],riskIds:[],claimIds:[],noticeIds:[],
  variationIds:[],boqAllocations:[]});
 accountabilityState.delivery={schemaVersion:1,decisions:[],populations:[],
  manual:Array.from({length:shape.registerRecords},(_,i)=>{
   const isPackage=i<shape.packages,kind=isPackage?'package':i%2===0?'quality':'submittal';
   return {recordId:'D-'+projectIndex+'-'+i,projectId:id,kind,
    reference:'R-'+i,description:'Construction '+kind+' Zone '+i%100,
    revision:'REV-1',state:'governed',
    fields:{'record reference':'R-'+i,status:'open','required on site':'2031-03-20',
     'forecast delivery':'2031-05-20',description:'Construction '+kind},
    links:{...emptyLinks(),activityIds:['ACC-'+projectIndex+'-'+(i%shape.activities)]},
    receipts:[],diagnostics:[],sourceActive:true};
  })};
 accountabilityState.testProject=true;runtimeProjects.touch(accountabilityState);return id;
});
(async()=>{
 const started=performance.now();const port=18000+Math.floor(Math.random()*10000);const env={...process.env,PORT:String(port),HOST:'127.0.0.1',CMENG_PROFILE_PERF:'1'};
 const child=spawn(process.execPath,['dist/packages/runtime-api/src/project-gateway.js'],{cwd:process.cwd(),env,stdio:['ignore','pipe','pipe']});let log='',errors='';
 try{
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Startup preparation exceeded 60 seconds')),60000);child.stdout.on('data',chunk=>{log+=chunk;if(log.includes('CMeng runtime listening')){clearTimeout(timeout);resolve();}});child.stderr.on('data',c=>errors+=c);child.on('exit',code=>{clearTimeout(timeout);reject(new Error('Startup failed '+code+' '+errors));});});
  const preparationMs=performance.now()-started;const base='http://127.0.0.1:'+port,cold=performance.now();
  const routeTimings={};let routeStart=performance.now();
  const shell=await fetch(base+'/');assert.equal(shell.status,200);await shell.text();routeTimings.shellMs=performance.now()-routeStart;
  routeStart=performance.now();
  const portfolio=await (await fetch(base+'/api/portfolio')).json();routeTimings.portfolioMs=performance.now()-routeStart;
  routeStart=performance.now();
  const overview=await (await fetch(base+'/api/projects/'+projectId+'/overview')).json();routeTimings.overviewMs=performance.now()-routeStart;
  routeStart=performance.now();
  const dashboard=await (await fetch(base+'/api/projects/'+projectId+'/management/master-dashboard')).json();routeTimings.dashboardMs=performance.now()-routeStart;
  assert.ok(dashboard.data?.positionVerdict,'dashboard is fully calculated, not a loading placeholder');
  assert.ok(overview.moduleStates?.length===29);assert.ok(!JSON.stringify(portfolio).includes(projectId),'Synthetic benchmark must not leak into the live portfolio');
  const coldRequestMs=performance.now()-cold;
  const testProjects=await (await fetch(base+'/api/test-projects')).json();
  assert.ok(JSON.stringify(testProjects).includes(projectId),'The test benchmark must remain visible on its separate test endpoint');
  const uploadProject='UPLOAD-20000';
  const lines=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tUPLOAD-20000\t2031-04-01','%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tEight hour calendar\tMon-Fri 08:00-16:00','%T\tTASK','%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt'];
  for(let i=0;i<20000;i++)lines.push(['%R',i,1,1,'A'+i,'Work '+i,'TK_NotStart','2031-04-01','2031-06-01',8,8,i%7].join('\t'));
  lines.push('%E');
  let peakRssBytes=null;
  const sampleMemory=()=>{try{const rss=/^VmRSS:\s+(\d+) kB/m.exec(readFileSync('/proc/'+child.pid+'/status','utf8'));if(rss)peakRssBytes=Math.max(peakRssBytes??0,Number(rss[1])*1024);}catch{}};
  sampleMemory();const memoryBeforeUploadBytes=peakRssBytes;const sampler=setInterval(sampleMemory,20);
  let uploadResponseMs,uploadToReadyMs,firstDashboardMs;
  try{
    const uploadStart=performance.now();
    const response=await fetch(base+'/api/projects/'+uploadProject+'/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'misleading-baseline-1990.xer','x-upload-intent':'replace_current_basis','x-schedule-role':'update'},body:lines.join('\n')});
    assert.equal(response.status,201,await response.text());uploadResponseMs=performance.now()-uploadStart;
    const firstStart=performance.now();
    const first=await (await fetch(base+'/api/projects/'+uploadProject+'/management/master-dashboard')).json();
    assert.ok(first.data?.positionVerdict,'20,000-activity dashboard contains resolved analysis');
    firstDashboardMs=performance.now()-firstStart;uploadToReadyMs=performance.now()-uploadStart;sampleMemory();
  }finally{clearInterval(sampler);}
  // Four genuinely cold management calculations, requested concurrently.
  // Warm-view speed must not make an unprepared project appear compliant.
  const coldShapesStart=performance.now();
  const coldShapeRows=await Promise.all(accountabilityProjectIds.map(async (id,index)=>{
    const started=performance.now();
    const response=await fetch(base+'/api/projects/'+id+'/management/master-dashboard',{signal:AbortSignal.timeout(120000)});
    const body=await response.json();
    assert.equal(response.status,200,'Cold management HTTP '+id);
    assert.ok(body.data?.positionVerdict,'Cold dashboard must be calculated '+id);
    return {projectId:id,shape:coldProfiles[index],durationMs:performance.now()-started};
  }));
  const coldShapesWallMs=performance.now()-coldShapesStart;
  const coldShapesMaxMs=Math.max(...coldShapeRows.map(row=>row.durationMs));
  const coldShapesPassed=coldShapesWallMs<=COLD_DASHBOARD_TARGET_MS&&coldShapesMaxMs<=COLD_DASHBOARD_TARGET_MS;
  const accountabilityStart=performance.now();
  const accountabilityConcurrent=await Promise.all(accountabilityProjectIds.map(async accountabilityProjectId=>{
    const started=performance.now();
    const response=await fetch(base+'/api/projects/'+accountabilityProjectId+'/management/cross-domain-accountability',{signal:AbortSignal.timeout(30000)});
    const body=await response.json();
    const elapsedMs=performance.now()-started;
    assert.equal(response.status,200,'Accountability HTTP '+accountabilityProjectId);
    assert.equal(body.data?.projectId,accountabilityProjectId,'Accountability project identity '+accountabilityProjectId);
    assert.ok((body.data?.recordActionCount??0)>0,'Accountability retains the full source-record denominator '+accountabilityProjectId);
    return {projectId:accountabilityProjectId,elapsedMs,recordActionCount:body.data.recordActionCount,ownerGroupCount:body.data.actions?.length??null};
  }));
  const accountabilityWallMs=performance.now()-accountabilityStart;
  const accountabilityMaxMs=Math.max(...accountabilityConcurrent.map(row=>row.elapsedMs));
  const accountabilityPassed=accountabilityMaxMs<=COLD_DASHBOARD_TARGET_MS&&accountabilityWallMs<=COLD_DASHBOARD_TARGET_MS;
  const profileLines=log.split('\n');
  const profileEvents=profileLines.filter(line=>line.includes('"event":"project_resolution_profile"')).map(line=>{try{return JSON.parse(line)}catch{return null}}).filter(Boolean);
  const managementProfileEvents=profileLines.filter(line=>line.includes('"event":"management_surface_profile"')).map(line=>{try{return JSON.parse(line)}catch{return null}}).filter(Boolean);
  const bundleProfileEvents=profileLines.filter(line=>line.includes('"event":"project_bundle_profile"')).map(line=>{try{return JSON.parse(line)}catch{return null}}).filter(Boolean);
  const diagnosisProfileEvents=profileLines.filter(line=>line.includes('"event":"project_diagnosis_profile"')).map(line=>{try{return JSON.parse(line)}catch{return null}}).filter(Boolean);
  const lookaheadProfileEvents=profileLines.filter(line=>line.includes('"event":"lookahead_profile"')).map(line=>{try{return JSON.parse(line)}catch{return null}}).filter(Boolean);
  const coldBreakdownEvents=profileLines.filter(line=>['lookahead_cold_breakdown','delivery_cold_profile','quantity_mapping_profile','independent_cpm_profile','management_visual_profile'].some(event=>line.includes('"event":"'+event+'"'))).map(line=>{try{return JSON.parse(line)}catch{return null}}).filter(Boolean);
  const result={scope:'Fresh server, actual HTTP upload, first calculated dashboard and four concurrent Accountability projects',activityCount:20000,priorColdGate:{activityCount:12500,revisionCount:3,preparationMs,coldRequestMs,routeTimings},coldProjectShapes:{profiles:coldShapeRows,wallMs:coldShapesWallMs,maxProjectMs:coldShapesMaxMs,passed:coldShapesPassed},accountabilityConcurrency:{projectCount:accountabilityProjectIds.length,activityCountPerProject:5000,wallMs:accountabilityWallMs,maxProjectMs:accountabilityMaxMs,rows:accountabilityConcurrent,passed:accountabilityPassed},profileEvents,managementProfileEvents,bundleProfileEvents,diagnosisProfileEvents,lookaheadProfileEvents,coldBreakdownEvents,uploadResponseMs,uploadToReadyMs,firstDashboardMs,memoryBeforeUploadBytes,peakRssBytes,peakRssMiB:peakRssBytes===null?null:peakRssBytes/1024/1024,targetMs:COLD_DASHBOARD_TARGET_MS,passed:coldRequestMs<=COLD_DASHBOARD_TARGET_MS&&uploadToReadyMs<=COLD_DASHBOARD_TARGET_MS&&firstDashboardMs<=COLD_DASHBOARD_TARGET_MS&&accountabilityPassed&&coldShapesPassed};
  console.log(JSON.stringify(result));if(process.env.CMENG_LATENCY_RESULT)writeFileSync(process.env.CMENG_LATENCY_RESULT,JSON.stringify(result,null,2));
  assert.ok(result.passed,'Cold workflow, upload-to-ready, first-dashboard or four-project Accountability target exceeded');
 }finally{
  if(child.exitCode===null&&child.signalCode===null){
    child.kill();
    await new Promise(resolve=>{
      const timer=setTimeout(resolve,2000);
      child.once('exit',()=>{clearTimeout(timer);resolve();});
    });
  }
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});});
