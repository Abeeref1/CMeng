import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import {createCmengServer} from '../packages/runtime-api/src/server';
import {pageProjectResponse,jsonPointer,PROJECT_SCREEN_MAX_BYTES} from '../packages/runtime-api/src/response-paging';

// F45 / F61: one synthetic project at the observed live scale (8,900 activities,
// 896 BOQ item curves with dated installed quantities, many leads). Every
// management response stays under the 2 MB screen budget; nothing is removed
// (true totals and pointers reach every row) and the bundle carries the shared
// project facts once instead of once per page.
const N=8900,ITEMS=896;
function scaleProject(){
 const id='F61-SCALE-'+randomUUID(),state=runtimeProjects.getOrCreate(id);
 const activities=Array.from({length:N},(_,i)=>({projectId:id,activityId:'A'+i,nativeId:String(i),name:'Installation Zone '+Math.floor(i/100),wbsId:'W'+Math.floor(i/100),calendarId:'C',activityType:'task',status:'not_started',
  baselineStartIso:'2031-01-01',baselineFinishIso:'2031-12-01',currentStartIso:'2031-01-01',currentFinishIso:'2031-12-01',actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
  originalDurationHours:8000,remainingDurationHours:8000,totalFloatHours:i%13,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]}));
 const relationships:any[]=[];
 for(let i=1;i<N;i++)if(i%100)relationships.push({relationshipId:'R'+i,predecessorActivityId:'A'+(i-1),successorActivityId:'A'+i,type:'FS',lagHours:i%2?-7900:0,sourceRefs:[],diagnostics:[]});
 const wbs=Array.from({length:89},(_,i)=>({wbsId:'W'+i,name:'Area '+i,parentWbsId:null,sourceRefs:[]}));
 for(let r=0;r<3;r++){
  const revisionId='REV-'+r,model={projectId:id,source:'xer',sourceRevisionId:revisionId,dataDateIso:'2031-0'+(4+r)+'-01',activities:activities.map(a=>({...a})),relationships,wbs,calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],diagnostics:[]};
  state.schedules.push({role:r?'update':'baseline',format:'xer',sourceFilename:revisionId+'.xer',sourceHashSha256:revisionId,uploadedAt:model.dataDateIso,revision:{revisionId,label:revisionId,sequence:r+1,effectiveAt:model.dataDateIso,model}} as any);
 }
 const installedSnapshots:any[]=[];
 for(let i=0;i<ITEMS;i++)for(let m=1;m<=5;m++)installedSnapshots.push({snapshotId:'S'+i+'-'+m,asOfIso:'2031-0'+m+'-01',quantityItemId:'BQ'+i,installedQuantity:m*2,sourceRefs:[]});
 state.quantities={projectId:id,boqRevisionId:'BOQ',scheduleRevisionId:'REV-2',
  items:Array.from({length:ITEMS},(_,i)=>({quantityItemId:'BQ'+i,itemNumber:'BQ.'+i,section:'Area '+(i%89),description:'Installation item '+i,unit:'m3',contractQuantity:20,sourceRefs:[],diagnostics:[]})),
  allocations:Array.from({length:ITEMS},(_,i)=>({allocationId:'AL'+i,quantityItemId:'BQ'+i,activityId:'A'+(i*9),allocatedQuantity:20,sourceRefs:[]})),installedSnapshots,diagnostics:[]} as any;
 (state as any).testProject=true;runtimeProjects.touch(state);
 return {id,leads:relationships.filter(r=>r.lagHours<0).length};
}

test('F61 management pages and bundle stay under 2 MB at 8,900 activities and 896 item curves; nothing removed',async t=>{
 const {id,leads}=scaleProject();
 const server=createCmengServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
 const base='http://127.0.0.1:'+(server.address() as any).port+'/api/projects/'+encodeURIComponent(id);
 const timed=async(path:string)=>{const start=performance.now();const response=await fetch(base+path);const text=await response.text();return {status:response.status,text,ms:performance.now()-start};};
 const cold=await timed('/management/master-dashboard');const warm=await timed('/management/master-dashboard');
 console.log('F61 dashboard timing (8,900 activities, 896 item curves): cold '+cold.ms.toFixed(0)+' ms, warm '+warm.ms.toFixed(0)+' ms, '+Buffer.byteLength(cold.text)+' bytes');
 assert.equal(cold.status,200);
 for(const path of ['/management/master-dashboard','/management/command-center','/management/master-control-programme','/management/source-quality','/management-surfaces','/schedule/modules/installed-quantities']){
  const page=path==='/management/master-dashboard'?cold:await timed(path);
  const bytes=Buffer.byteLength(page.text),body=JSON.parse(page.text);
  console.log('F61 '+path+': '+bytes+' bytes');
  assert.equal(page.status,200,path);
  assert.ok(bytes<=2_000_000,path+' is '+bytes+' bytes');
  assert.notEqual(body.responsePaging?.overBudget,true,path+' flagged over budget');
  if(path==='/management-surfaces'){
   assert.equal((page.text.match(/"projectFacts":/g)??[]).length,1,'the bundle carries the shared project facts once');
   for(const key of ['masterDashboard','commandCenter','masterControlProgramme','sourceQuality'])assert.equal(body[key].projectFactsRef,'/projectFacts',key);
   assert.ok(body.projectFacts?.programmeQuality,'shared facts are present in the bundle');
  }else if(path.startsWith('/management/')){
   // Leads stay countable and reachable: first page shown, true total and pointer recorded.
   const lagPointer='/data/projectFacts/programmeQuality/negativeLags';
   const table=body.responsePaging.tables.find((row:any)=>row.pointer===lagPointer);
   assert.equal(table?.total,leads,path+' negative-lag total');
   assert.equal(jsonPointer(body,lagPointer+'/0/relationshipId'),'R1');
   const params=new URLSearchParams({source:'/api/projects/'+encodeURIComponent(id)+path,pointer:lagPointer,offset:String(leads-1),limit:'25'});
   const last=await (await fetch(base+'/record-page?'+params)).json() as any;
   assert.equal(last.total,leads);assert.equal(last.rows.length,1);assert.equal(last.rows[0].relationshipId,'R8899');
  }else{
   assert.equal(body.data.series.length,25);
   assert.equal(body.responsePaging.tables.find((row:any)=>row.pointer==='/data/series').total,ITEMS);
  }
 }
});

test('F61 a page still larger than the budget after paging is flagged, never silent',()=>{
 const facts={time:{note:{value:'x'.repeat(5000),state:'confirmed'}}};
 const paged=pageProjectResponse({key:'k',data:{projectFacts:facts,rows:[{a:1}]}},'/api/projects/P/management/master-dashboard',1000) as any;
 assert.equal(paged.responsePaging.overBudget,true);
 assert.equal(paged.responsePaging.budgetBytes,1000);
 assert.equal(paged.data.projectFacts.time.note.value.length,5000,'facts are not cut to meet the budget');
 const small=pageProjectResponse({key:'k',data:{projectFacts:facts,rows:[{a:1}]}},'/api/projects/P/management/master-dashboard') as any;
 assert.equal(small.responsePaging.overBudget,undefined);
});
