import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import {createCmengServer} from '../packages/runtime-api/src/server';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
const N=8900,ITEMS=896;
function scaleProject(){
 // Project codes are upper case; the schedule must name the same project.
 const state=runtimeProjects.getOrCreate('F61-SCALE-'+randomUUID().slice(0,8).toUpperCase()),id=state.projectId;
 const activities=Array.from({length:N},(_,i)=>({projectId:id,activityId:'A'+i,nativeId:String(i),name:'Installation Zone '+Math.floor(i/100),wbsId:'W'+Math.floor(i/100),calendarId:'C',activityType:'task',status:'not_started',
  baselineStartIso:'2031-01-01',baselineFinishIso:'2031-12-01',currentStartIso:'2031-01-01',currentFinishIso:'2031-12-01',actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
  originalDurationHours:8000,remainingDurationHours:8000,totalFloatHours:i%13,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]}));
 const relationships:any[]=[];
 for(let i=1;i<N;i++)if(i%100)relationships.push({relationshipId:'R'+i,predecessorActivityId:'A'+(i-1),successorActivityId:'A'+i,type:'FS',lagHours:-7900,sourceRefs:[],diagnostics:[]});
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


test('W6B probe: what grew in /management-surfaces',async t=>{
 const {id}=scaleProject();
 const server=createCmengServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
 const base='http://127.0.0.1:'+(server.address() as any).port+'/api/projects/'+encodeURIComponent(id);
 for(const path of ['/management/master-dashboard','/management/command-center','/management/master-control-programme','/management/source-quality','/management-surfaces']){
  const text=await (await fetch(base+path)).text(),body=JSON.parse(text);
  console.log('W6B '+path+' '+Buffer.byteLength(text)+' bytes; projectFacts keys '+(text.match(/"projectFacts":/g)??[]).length+'; overBudget '+body.responsePaging?.overBudget);
  const big:Array<[number,string]>=[];
  const walk=(v:any,p:string,d:number)=>{if(!v||typeof v!=='object'||d>6)return;const s=JSON.stringify(v).length;if(s>50000)big.push([s,p]);for(const [k,x] of Object.entries(v))walk(x,p+'/'+k,d+1);};
  walk(body,'',0);big.sort((a,b)=>b[0]-a[0]);for(const [s,p] of big.slice(0,25))console.log('W6B   '+path+p+' '+s);
 }
 const pages=['master-dashboard','command-center','master-control-programme','source-quality'].map(k=>[k,(moduleForProject(id,k) as any)?.data?.projectFacts] as const);
 const first=JSON.stringify(pages[0]![1]);
 for(const [k,f] of pages){
  const same=JSON.stringify(f)===first;console.log('W6B facts '+k+' identical '+same+' size '+JSON.stringify(f??null).length);
  if(!same&&f&&pages[0]![1])for(const key of new Set([...Object.keys(f),...Object.keys(pages[0]![1])])){
   const a=JSON.stringify((pages[0]![1] as any)[key]),b=JSON.stringify((f as any)[key]);if(a!==b)console.log('W6B   differs '+k+'.'+key+' '+String(a).slice(0,200)+' | '+String(b).slice(0,200));
  }
 }
});
