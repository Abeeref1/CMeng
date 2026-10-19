import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import {createCmengServer} from '../packages/runtime-api/src/server';
import {jsonPointer} from '../packages/runtime-api/src/response-paging';

// F61 adversarial: every list is large at once. 8,900 activities with
// constraints, open starts and open ends, and thousands of RFIs, NCRs, risks,
// variations, claims, procurement, submittal and interface records, all
// ingested through the real evidence path. Every management page must stay
// under 2 MB without the over-budget flag, and every paged list must keep its
// true total and stay reachable through record-page.
const N=8900,DATA_DATE='2031-05-01';
const day=(offset:number)=>new Date(Date.UTC(2031,4,1)+offset*86400000).toISOString().slice(0,10);
// Plain cells (no commas or quotes in any value), so no field needs quoting.
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
 const state=runtimeProjects.getOrCreate('F61-ADV-'+randomUUID().slice(0,8).toUpperCase()),id=state.projectId;
 const activities=Array.from({length:N},(_,i)=>({projectId:id,activityId:'A'+i,nativeId:String(i),name:'Installation Zone '+Math.floor(i/100)+' item '+i,wbsId:'W'+Math.floor(i/100),calendarId:'C',activityType:'task',
  status:i%7===0?'in_progress':'not_started',baselineStartIso:day(-120),baselineFinishIso:day(-10+i%60),currentStartIso:i%7===0?day(-30):day(5),currentFinishIso:day(30+i%200),
  actualStartIso:i%7===0?day(-30):null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:240,remainingDurationHours:240,
  totalFloatHours:i%11===0?-48:i%13,freeFloatHours:null,percentComplete:i%7===0?20:0,
  sourceConstraints:i%4===0?[{type:i%8===0?'mandatory_finish':'start_on',dateIso:day(15+i%30)}]:[],sourceRefs:[],diagnostics:[]}));
 // Every third activity has no predecessor and every fifth has no successor (open starts and ends).
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

/** Arrays longer than one page that the response sends in full without a paging entry. */
function unpagedLongLists(body:any){
 const paged=new Set<string>((body?.responsePaging?.tables??[]).map((row:any)=>row.pointer));
 const found:Array<[string,number,number]>=[];
 const walk=(value:any,pointer:string)=>{
  if(!value||typeof value!=='object')return;
  if(Array.isArray(value)){
   if(value.length>25&&!paged.has(pointer))found.push([pointer,value.length,Buffer.byteLength(JSON.stringify(value))]);
   value.forEach((item,i)=>walk(item,pointer+'/'+i));return;
  }
  for(const [key,item] of Object.entries(value))if(key!=='responsePaging')walk(item,pointer+'/'+key.replace(/~/g,'~0').replace(/\//g,'~1'));
 };
 walk(body,'');return found.sort((a,b)=>b[2]-a[2]);
}
function largest(body:any){
 const out:Array<[number,string]>=[];
 const walk=(value:any,pointer:string,depth:number)=>{if(!value||typeof value!=='object'||depth>7)return;const size=Buffer.byteLength(JSON.stringify(value));if(size>60_000)out.push([size,pointer]);
  for(const [key,item] of Object.entries(value))walk(item,pointer+'/'+key,depth+1);};
 walk(body,'',0);return out.sort((a,b)=>b[0]-a[0]).slice(0,14);
}

test('F61 adversarial project: every management page under 2 MB, not over budget, every paged list reachable',async t=>{
 const built=performance.now();
 const id=await adversarialProject();
 console.log('F61-ADV project built and ingested in '+(performance.now()-built).toFixed(0)+' ms');
 const server=createCmengServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
 const P='/api/projects/'+encodeURIComponent(id),root='http://127.0.0.1:'+(server.address() as any).port;
 const timed=async(path:string)=>{const start=performance.now();const response=await fetch(root+path);const text=await response.text();return {status:response.status,text,ms:performance.now()-start};};
 const cold=await timed(P+'/management/master-dashboard'),warm=await timed(P+'/management/master-dashboard');
 console.log('F61-ADV dashboard timing: cold '+cold.ms.toFixed(0)+' ms, warm '+warm.ms.toFixed(0)+' ms');
 const pages=['/management/master-dashboard','/management/command-center','/management/master-control-programme','/management/source-quality',
  '/management/cross-domain-accountability','/management-surfaces','/overview','/director-position','/actions'];
 const problems:string[]=[];
 for(const path of pages){
  const page=path==='/management/master-dashboard'?cold:await timed(P+path);
  if(page.status!==200){problems.push(path+' HTTP '+page.status+' '+page.text.slice(0,300));continue;}
  const body=JSON.parse(page.text),bytes=Buffer.byteLength(page.text),paging=body.responsePaging;
  console.log('F61-ADV '+path+': '+bytes+' bytes, overBudget '+String(paging?.overBudget??false)+', paged lists '+(paging?.tables?.length??0));
  for(const [size,pointer] of largest(body))console.log('F61-ADV   large '+path+pointer+' '+size);
  for(const [pointer,length,size] of unpagedLongLists(body).slice(0,30))console.log('F61-ADV   unpaged '+path+pointer+' rows '+length+' bytes '+size);
  if(bytes>2_000_000)problems.push(path+' is '+bytes+' bytes');
  // No list that grows with the source records is sent in full. Chart time
  // series (one point per period) are bounded by the programme dates.
  for(const [pointer,length] of unpagedLongLists(body))
   if(length>100&&!/\/(?:points|series|periods|weeklyTotals|monthlyPoints|monthlySeries|chartPoints|curvePoints|evmPoints|monthlyEvmPoints|actualSnapshots)$/.test(pointer))problems.push(path+pointer+' sends '+length+' rows unpaged');
  if(paging?.overBudget===true)problems.push(path+' flagged over budget');
  // Every paged list keeps its true total and its later rows stay reachable.
  // The bundle repeats the page projections; its lists are fetched through each page's own route.
  for(const table of path==='/management-surfaces'?[]:(paging?.tables??[]).filter((row:any)=>row.kind==='array'&&row.shown<row.total).slice(0,40)){
   const params=new URLSearchParams({source:P+path,pointer:table.pointer,offset:String(table.total-1),limit:'25'});
   const detail=await (await fetch(root+P+'/record-page?'+params)).json() as any;
   if(detail.total!==table.total||!Array.isArray(detail.rows)||detail.rows.length!==1)problems.push(path+table.pointer+' last row not reachable: total '+detail.total+' vs '+table.total);
   if(jsonPointer(body,table.pointer)!==undefined&&!Array.isArray(jsonPointer(body,table.pointer)))problems.push(path+table.pointer+' preview is not a list');
  }
 }
 assert.deepEqual(problems,[]);
});
