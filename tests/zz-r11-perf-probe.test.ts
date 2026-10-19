import test from 'node:test';
import {Session} from 'node:inspector';
import {gzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import {createCmengServer} from '../packages/runtime-api/src/server';

// TEMPORARY profiling probe (r11-perf). Builds the F61 adversarial project and the
// standard 8,900-activity project with fixed ids, profiles the cold Dashboard,
// prints the top self/inclusive functions and dumps every management page so the
// output before and after a performance change can be compared byte for byte.
const N=8900,DATA_DATE='2031-05-01';
const day=(offset:number)=>new Date(Date.UTC(2031,4,1)+offset*86400000).toISOString().slice(0,10);
const csv=(headers:string[],rows:string[][])=>Buffer.from([headers,...rows].map(row=>row.join(',')).join('\r\n'));
const registers:Array<{file:string;headers:string[];rows:(i:number)=>string[];count:number}>=[
 {file:'rfi_register.csv',headers:['RFI ID','Subject','Status','Raised Date','Due Date','Response Date','Owner','Linked Activity'],count:6000,
  rows:i=>['RFI-'+i,'Design clarification '+i,i%3?'Open':'Answered',day(-60+i%50),day(-20+i%40),i%3?'':day(-5),'Design Engineer '+(i%3000),'A'+(i*7%N)]},
 {file:'ncr_register.csv',headers:['NCR ID','Description','Owner','Closed Date','Status'],count:3000,
  rows:i=>['NCR-'+i,'Quality issue '+i,'QA Inspector '+(i%1500),i%4?'':day(-3),i%4?'Open':'Closed']},
 {file:'risk_register.csv',headers:['Risk ID','Description','Owner','Due Date','Status'],count:3000,
  rows:i=>['RSK-'+i,'Delivery risk '+i,'Risk Owner '+(i%1500),day(-30+i%90),i%5?'Open':'Closed']},
 {file:'variation_register.csv',headers:['Variation ID','Description','Approved Amount','Period End','Status','Currency'],count:3000,
  rows:i=>['VO-'+i,'Scope change '+i,String(1000+i),day(-200+i%180),i%3===0?'Approved':i%3===1?'Pending':'Rejected','SAR']},
 {file:'claim_register.csv',headers:['Claim ID','Event','Days Claimed','Notice Date','Status'],count:8000,
  rows:i=>['CLM-'+i,'Delay event '+i,String(1+i%30),i%6?day(-100+i%90):'',i%2?'Submitted':'Under Review']},
 {file:'procurement_register.csv',headers:['Package ID','Description','Required On Site','Forecast Delivery','Status','Linked Activity'],count:2000,
  rows:i=>['PKG-'+i,'Equipment package '+i,day(10+i%120),day(20+i%150),i%2?'Ordered':'Not Ordered','A'+(i*11%N)]},
 {file:'submittal_register.csv',headers:['Submittal ID','Submitted Date','Approval Date','Status','Procurement Package','Linked Activity'],count:2000,
  rows:i=>['SUB-'+i,day(-40+i%30),i%3?'':day(-2),i%3?'Under Review':'Approved','PKG-'+(i%2000),'A'+(i*13%N)]},
 {file:'interface_register.csv',headers:['Interface ID','Giving Party','Receiving Party','Required Deliverable','Status','Linked Activity'],count:2000,
  rows:i=>['IF-'+i,'Contractor '+(i%90),'Designer '+(i%70),'Approved drawing '+i,i%2?'Open':'Closed','A'+(i*17%N)]},
 {file:'payment_register.csv',headers:['Certificate No','Period End','Net Certified','Paid Amount','Retention','Currency','Status'],count:300,
  rows:i=>['IPC-'+i,day(-900+i*3),String(50000+i),i%4?String(50000+i):'','2500','SAR',i%4?'Paid':'Certified']},
];

async function adversarialProject(){
 const state=runtimeProjects.getOrCreate('R11-PERF-ADV'),id=state.projectId;
 const activities=Array.from({length:N},(_,i)=>({projectId:id,activityId:'A'+i,nativeId:String(i),name:'Installation Zone '+Math.floor(i/100)+' item '+i,wbsId:'W'+Math.floor(i/100),calendarId:'C',activityType:'task',
  status:i%7===0?'in_progress':'not_started',baselineStartIso:day(-120),baselineFinishIso:day(-10+i%60),currentStartIso:i%7===0?day(-30):day(5),currentFinishIso:day(30+i%200),
  actualStartIso:i%7===0?day(-30):null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:240,remainingDurationHours:240,
  totalFloatHours:i%11===0?-48:i%13,freeFloatHours:null,percentComplete:i%7===0?20:0,
  sourceConstraints:i%4===0?[{type:i%8===0?'mandatory_finish':'start_on',dateIso:day(15+i%30)}]:[],sourceRefs:[],diagnostics:[]}));
 const relationships:any[]=[];
 for(let i=1;i<N;i++)if(i%3&&(i-1)%5)relationships.push({relationshipId:'R'+i,predecessorActivityId:'A'+(i-1),successorActivityId:'A'+i,type:'FS',lagHours:i%2?-16:24,sourceRefs:[],diagnostics:[]});
 const wbs=Array.from({length:89},(_,i)=>({wbsId:'W'+i,name:'Area '+i,parentWbsId:null,sourceRefs:[]}));
 for(let r=0;r<3;r++){
  const revisionId='ADV-REV-'+r,model={projectId:id,source:'xer',sourceRevisionId:revisionId,dataDateIso:r===2?DATA_DATE:day(-30*(2-r)),activities:activities.map(a=>({...a,currentFinishIso:day(30+(a.nativeId as any)%200+r)})),relationships,wbs,calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],diagnostics:[]};
  state.schedules.push({role:r?'update':'baseline',format:'xer',sourceFilename:revisionId+'.xer',sourceHashSha256:revisionId,uploadedAt:model.dataDateIso,revision:{revisionId,label:revisionId,sequence:r+1,effectiveAt:model.dataDateIso,model}} as any);
 }
 (state as any).testProject=true;runtimeProjects.touch(state);
 for(const register of registers){
  await runtimeProjects.ingestEvidenceFile({projectId:id,sourceFilename:register.file,sourceRelativePath:register.file,mediaType:'text/csv',
   bytes:csv(register.headers,Array.from({length:register.count},(_,i)=>register.rows(i))),uploadedAt:DATA_DATE+'T00:00:00.000Z',uploadIntent:'add_update'});
 }
 await runtimeProjects.refreshSpreadsheetRegisters(id);
 return id;
}

function standardProject(){
 const ITEMS=896;
 const state=runtimeProjects.getOrCreate('R11-PERF-STD'),id=state.projectId;
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
 return id;
}

const post=(session:Session,method:string,params?:object)=>new Promise<any>((resolve,reject)=>session.post(method,params??{},(error,result)=>error?reject(error):resolve(result)));

function summarise(label:string,profile:any){
 const byId=new Map<number,any>();for(const node of profile.nodes)byId.set(node.id,node);
 const parent=new Map<number,number>();for(const node of profile.nodes)for(const child of node.children??[])parent.set(child,node.id);
 const key=(node:any)=>{const f=node.callFrame;return (f.functionName||'(anon)')+' '+String(f.url).replace(/^.*\/dist\//,'').replace(/^file:\/\//,'')+':'+(f.lineNumber+1);};
 const self=new Map<string,number>(),incl=new Map<string,number>(),edges=new Map<string,Map<string,number>>();let total=0;
 for(let i=0;i<profile.samples.length;i++){
  const ms=(profile.timeDeltas[i]??0)/1000;total+=ms;
  let node=byId.get(profile.samples[i]);if(!node)continue;
  const k=key(node);self.set(k,(self.get(k)??0)+ms);
  const seen=new Set<string>(),seenEdge=new Set<string>();let child:string|null=null;
  for(let id:number|undefined=node.id;id!==undefined;id=parent.get(id)){const n=byId.get(id);const kk=key(n);
   if(child!==null&&child!==kk&&!seenEdge.has(child+'<'+kk)){seenEdge.add(child+'<'+kk);const m=edges.get(child)??new Map<string,number>();m.set(kk,(m.get(kk)??0)+ms);edges.set(child,m);}
   child=kk;if(seen.has(kk))continue;seen.add(kk);incl.set(kk,(incl.get(kk)??0)+ms);}
 }
 console.log('R11PROF '+label+' total sampled '+total.toFixed(0)+' ms');
 for(const [k,ms] of [...self].sort((a,b)=>b[1]-a[1]).slice(0,70))console.log('R11PROF '+label+' self '+ms.toFixed(0).padStart(7)+' '+k);
 for(const [k,ms] of [...incl].sort((a,b)=>b[1]-a[1]).filter(([k])=>!/^\(root\)|^\(program\)|^\(garbage/.test(k)).slice(0,160))console.log('R11PROF '+label+' incl '+ms.toFixed(0).padStart(7)+' '+k);
 for(const [k,ms] of [...incl].sort((a,b)=>b[1]-a[1]).filter(([k])=>!/^\(root\)|^\(program\)|^\(garbage|node:|server\.js|runMicrotasks/.test(k)).slice(0,90))
  for(const [caller,cms] of [...(edges.get(k)??new Map<string,number>())].sort((a,b)=>b[1]-a[1]).slice(0,4))console.log('R11PROF '+label+' caller '+ms.toFixed(0).padStart(7)+' '+k+' <= '+cms.toFixed(0)+' '+caller);
}

test('r11-perf probe: profile cold Dashboard and dump management pages',{timeout:1_800_000},async t=>{
 const server=createCmengServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
 const root='http://127.0.0.1:'+(server.address() as any).port;
 const session=new Session();session.connect();
 await post(session,'Profiler.enable');await post(session,'Profiler.setSamplingInterval',{interval:1000});
 for(const [label,build] of [['ADV',adversarialProject],['STD',async()=>standardProject()]] as const){
  const b0=performance.now();const id=await build();
  console.log('R11TIME '+label+' built in '+(performance.now()-b0).toFixed(0)+' ms');
  const P='/api/projects/'+encodeURIComponent(id);
  const timed=async(path:string)=>{const start=performance.now();const response=await fetch(root+P+path);const text=await response.text();return {status:response.status,text,ms:performance.now()-start};};
  process.env.CMENG_PROFILE_PERF='1';
  await post(session,'Profiler.start');
  const cold=await timed('/management/master-dashboard');
  const {profile}=await post(session,'Profiler.stop');
  delete process.env.CMENG_PROFILE_PERF;
  const warm=await timed('/management/master-dashboard');
  console.log('R11TIME '+label+' dashboard cold '+cold.ms.toFixed(0)+' ms, warm '+warm.ms.toFixed(0)+' ms, '+Buffer.byteLength(cold.text)+' bytes');
  summarise(label,profile);
  const pages=['/management/master-dashboard','/management/command-center','/management/master-control-programme','/management/source-quality',
   '/management/cross-domain-accountability','/management-surfaces','/overview','/director-position','/actions'];
  for(const path of pages){
   const page=path==='/management/master-dashboard'?cold:await timed(path);
   console.log('R11TIME '+label+' '+path+' '+page.ms.toFixed(0)+' ms status '+page.status+' bytes '+Buffer.byteLength(page.text));
   const data=gzipSync(Buffer.from(page.text)).toString('base64');
   for(let i=0,n=Math.ceil(data.length/60000);i<n;i++)console.log('R11CHUNK '+label+' '+path+' '+i+' '+n+' '+data.slice(i*60000,(i+1)*60000));
  }
 }
 session.disconnect();
});
