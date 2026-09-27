import test from 'node:test';
import assert from 'node:assert/strict';
import {createContext,runInContext} from 'node:vm';
import {uploadWorkScript} from '../packages/runtime-api/src/ui-upload-work';

for(const kind of ['schedule','boq','contract','evidence'])test(kind+' upload retains every file, intent and rerun target while another project uploads',async()=>{
  let selected='FIRST';const nodes=new Map<string,any>();
  const el=(id:string)=>{if(!nodes.has(id))nodes.set(id,{value:'original',checked:true,querySelectorAll:()=>[]});return nodes.get(id);};
  const requests:Array<{file:string,projectId:string,intent:string,resolve:()=>void}>=[];const recalculated:string[]=[];const refreshed:string[]=[];
  const context=createContext({Map,project:()=>selected,projectUploadJobs:new Map(),el,document:{querySelectorAll:(selector:string)=>selector==='.schedule-role'?[{dataset:{index:'0'},value:'update'},{dataset:{index:'1'},value:'update'}]:[]},escapeHtml:String,openProject(){},showProjectUpdating(){},loadEvidence:async()=>{},renderEvidenceUploadProgress(){},renderScheduleQueue(){},renderContractQueue(){},renderSimpleQueue(){},
    currentModuleResult:null,selected:'master-dashboard',localStorage:{setItem(){}},setAppView(){},loadProjectActions:async()=>{},projectActionState:null,scheduleSelection:[],boqSelection:[],contractSelection:[],evidenceSelection:[],
    uploadEvidenceFileWithProgress:(file:any,_index:number,_total:number,job:any)=>new Promise<void>(resolve=>requests.push({file:file.name,projectId:job.projectId,intent:job.intent,resolve})),
    api:async(path:string)=>{recalculated.push(path);},refresh:async()=>{refreshed.push(selected);}});
  runInContext(uploadWorkScript,context);context[kind+'Selection']=[{name:'first-1'},{name:'first-2'}];
  const first=runInContext('startProjectUpload("'+kind+'")',context);
  selected='SECOND';el(kind+'Intent').value='different';context[kind+'Selection']=[{name:'second-1'}];
  const second=runInContext('startProjectUpload("'+kind+'")',context);
  requests[0]!.resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests[2]!.projectId,'FIRST');assert.equal(requests[2]!.file,'first-2');assert.equal(requests[2]!.intent,'original');
  requests[2]!.resolve();await first;
  assert.deepEqual(refreshed,[],'finishing FIRST must not refresh SECOND');
  assert.ok(recalculated[0]?.includes('/FIRST/'));
  requests[1]!.resolve();await second;assert.deepEqual(refreshed,['SECOND']);assert.ok(recalculated[1]?.includes('/SECOND/'));
  const completed=context.projectUploadJobs.get('SECOND'),message=completed.message;
  context.updateUploadJob(completed,{state:'receiving',percent:0,message:'Waiting to receive project documents'},0,1,'');
  assert.equal(completed.message,message,'a delayed poll must not overwrite the completed upload');
  assert.equal(el('uploadMessage').textContent,message);
});

test('a failed view refresh after a saved upload does not report the file as failed or invite another upload',async()=>{
  const nodes=new Map<string,any>(),jobs=new Map();const el=(id:string)=>{if(!nodes.has(id))nodes.set(id,{value:'add_update',checked:false,querySelectorAll:()=>[]});return nodes.get(id);};let saved=0;
  const context=createContext({Map,project:()=> 'SAVED',projectUploadJobs:jobs,el,document:{querySelectorAll:()=>[]},escapeHtml:String,openProject(){},renderEvidenceUploadProgress(){},renderSimpleQueue(){},
    selected:'master-dashboard',localStorage:{setItem(){}},setAppView(){},loadProjectActions:async()=>{},projectActionState:null,scheduleSelection:[],boqSelection:[],contractSelection:[],evidenceSelection:[{name:'record.csv'}],
    uploadEvidenceFileWithProgress:async()=>{saved++;},refresh:async()=>{throw new Error('Connection interrupted');}});
  runInContext(uploadWorkScript,context);await context.startProjectUpload('evidence');
  assert.equal(saved,1);assert.equal(jobs.get('SAVED').state,'complete');assert.equal(jobs.get('SAVED').percent,100);
  assert.match(el('uploadMessage').textContent,/Documents saved/);assert.match(el('uploadMessage').textContent,/do not need to upload/);assert.doesNotMatch(el('uploadMessage').textContent,/Could not finish/);
});
