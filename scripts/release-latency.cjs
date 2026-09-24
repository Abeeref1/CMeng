/* Fresh server process and fresh HTTP requests. Startup analysis is measured
   separately and must complete before readiness. No pre-test dashboard request. */
const {mkdtempSync,rmSync,writeFileSync}=require('node:fs');
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
(async()=>{
 const started=performance.now();const port=18000+Math.floor(Math.random()*10000);const env={...process.env,PORT:String(port),HOST:'127.0.0.1'};
 const child=spawn(process.execPath,['dist/packages/runtime-api/src/server.js'],{cwd:process.cwd(),env,stdio:['ignore','pipe','pipe']});let log='',errors='';
 try{
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Startup preparation exceeded 60 seconds')),60000);child.stdout.on('data',chunk=>{log+=chunk;if(log.includes('CMeng runtime listening')){clearTimeout(timeout);resolve();}});child.stderr.on('data',c=>errors+=c);child.on('exit',code=>{clearTimeout(timeout);reject(new Error('Startup failed '+code+' '+errors));});});
  const preparationMs=performance.now()-started;const base='http://127.0.0.1:'+port,cold=performance.now();
  const shell=await fetch(base+'/');assert.equal(shell.status,200);await shell.text();
  const portfolio=await (await fetch(base+'/api/portfolio')).json();
  const overview=await (await fetch(base+'/api/projects/'+projectId+'/overview')).json();
  const dashboard=await (await fetch(base+'/api/projects/'+projectId+'/management/master-dashboard')).json();
  assert.ok(dashboard.data?.positionVerdict,'dashboard is fully calculated, not a loading placeholder');
  assert.ok(overview.moduleStates?.length===29);assert.ok(JSON.stringify(portfolio).includes(projectId));
  const coldRequestMs=performance.now()-cold;
  const result={scope:'Fresh server; first shell, portfolio, overview and fully calculated dashboard requests',activityCount:12500,revisionCount:3,preparationMs,coldRequestMs,targetMs:COLD_DASHBOARD_TARGET_MS,passed:coldRequestMs<=COLD_DASHBOARD_TARGET_MS};
  console.log(JSON.stringify(result));if(process.env.CMENG_LATENCY_RESULT)writeFileSync(process.env.CMENG_LATENCY_RESULT,JSON.stringify(result,null,2));
  assert.ok(result.passed,'Cold dashboard request target exceeded');
 }finally{child.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{rmSync(root,{recursive:true,force:true});});
