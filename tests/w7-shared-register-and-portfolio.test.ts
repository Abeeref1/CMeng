import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {RuntimeProjectStore,runtimeProjects} from '../packages/runtime-api/src/project-state';
import {changeDelivery,deliveryRecords,deliveryStore} from '../packages/runtime-api/src/delivery-records';
import {deliveryModule} from '../packages/runtime-api/src/delivery-projections';
import {deliveryScript} from '../packages/runtime-api/src/ui-delivery';
import {attachProjectFacts,projectFactsForState} from '../packages/runtime-api/src/project-facts';
import {projectFactConsumerMismatches} from '../packages/runtime-api/src/project-fact-consumers';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {portfolioProjectRow} from '../packages/runtime-api/src/server';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import type {DeliveryKind,DeliveryRecord} from '../packages/delivery-core/src/types';

// Fixture helpers copied from tests/delivery-authority.test.ts (a test file cannot be imported without running it).
const calendar='(0||CalendarData()((0||DaysOfWeek()('+Array.from({length:7},(_,i)=>'(0||'+(i+1)+'()((0||0(s|08:00|f|16:00)())))').join('')+'))(0||Exceptions()())))';
function deliveryProgramme(date='2031-08-31',count=2){return ['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tDELIVERY\t'+date,'%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tWorking calendar\t'+calendar,'%T\tTASK','%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt',...Array.from({length:count},(_,i)=>'%R\t'+(i+1)+'\t1\t1\tA'+(i+1)+'\tEquipment installation '+(i+1)+'\tTK_NotStart\t2031-09-30 08:00\t2031-10-10 16:00\t80\t80\t16'),'%E'].join('\n');}
async function fixture(t:any){const dir=mkdtempSync(join(tmpdir(),'delivery-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate('DELIVERY-A');
 await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(deliveryProgramme()),mediaType:'text/plain',sourceFilename:'Current.xer',uploadedAt:'2031-09-01',uploadIntent:'replace_current_basis'});
 async function upload(name:string,content:string){return store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(content),mediaType:'text/csv',sourceFilename:name,uploadedAt:'2031-09-01'});}
 function change(input:any){const result=changeDelivery(state,{expectedVersion:state.version,...input});store.touch(state);return result;}
 function create(kind:DeliveryKind,reference:string,fields:any={},links:any={}){change({action:'create',kind,fields:{'record reference':reference,description:reference,...fields}});const r=deliveryStore(state).manual.at(-1)!;change({action:'review',recordId:r.recordId,sourceRevision:r.revision,state:'governed',fields:{},links,note:'Reviewed source and project applicability.'});return deliveryRecords(state).records.find(q=>q.recordId===r.recordId)!;}
 function review(r:DeliveryRecord,fields:any={},other:any={}){change({action:'review',recordId:r.recordId,sourceRevision:r.revision,state:'governed',fields,note:'Reviewed amendment.',...other});return deliveryRecords(state).records.find(q=>q.recordId===r.recordId)!;}
 function population(kind:DeliveryKind,scopeId:string|null=null){change({action:'confirm_population',kind,scopeId,note:'Complete source register and applicable obligations reconciled.'});}
 return {dir,store,state,upload,change,create,review,population};
}

const metric=(data:any,label:string)=>data.metrics.find((m:any)=>m.label===label);
// The page reader dates R3 from "Submitted Date"; the shared register reader
// (Dashboard, project facts) does not, so R3 is undated there. Before F04 the
// page said 3 open while the Dashboard said 2.
const RFI='RFI ID,Subject,Status,Raised Date,Submitted Date,Due Date\nR1,Overdue query,Open,2031-08-01,,2031-08-10\nR2,Live query,Open,2031-08-01,,2031-09-15\nR3,Submitted only,Open,,2031-08-05,2031-09-20';

test('F04 RFI & Design open and overdue counts are the shared register counts the Dashboard reads',async t=>{
 const f=await fixture(t);
 await f.upload('RFI.csv',RFI);
 const facts=projectFactsForState(f.state);
 assert.equal(facts.controls.openRfiCount.value,2,'shared register: R1 and R2 are dated open RFIs');
 assert.equal(facts.controls.overdueRfiCount.value,1);
 const page=attachProjectFacts(f.state,deliveryModule(f.state,'delivery-design')).data as any;
 assert.equal(metric(page,'Open records').value,facts.controls.openRfiCount.value,'page open count = Dashboard open RFIs');
 assert.equal(metric(page,'Overdue records').value,facts.controls.overdueRfiCount.value);
 assert.equal(page.registerIdentity,'rfi id','every record on the page comes from the RFI register');
 assert.equal(metric(page,'Open records').basis,facts.controls.openRfiCount.basis);
 assert.deepEqual(projectFactConsumerMismatches(page),[]);
 assert.ok(page.projectFactBindings.some((b:any)=>b.fact==='controls.openRfiCount'&&/^metrics\.\d+\.value$/.test(b.path)));
});

test('F04 a mixed design population keeps its own count and shows the shared RFI counts beside it',async t=>{
 const f=await fixture(t);
 await f.upload('RFI.csv',RFI);
 f.create('design','DD-01',{'raised date':'2031-08-02',status:'Open'});
 const facts=projectFactsForState(f.state);
 const page=attachProjectFacts(f.state,deliveryModule(f.state,'delivery-design')).data as any;
 assert.equal(page.registerIdentity,null,'a manual design record is not an RFI register row');
 assert.equal(metric(page,'Open RFIs').value,facts.controls.openRfiCount.value);
 assert.equal(metric(page,'Overdue RFIs').value,facts.controls.overdueRfiCount.value);
 assert.deepEqual(projectFactConsumerMismatches(page),[]);
});

test('F04 NCR page counts are the shared NCR register counts',async t=>{
 const f=await fixture(t);
 await f.upload('NCR.csv','NCR ID,Description,Responsible,Status,Raised Date,Submitted Date,Due Date\nN1,Weld,QA Manager,Open,2031-08-01,,2031-08-10\nN2,Paint,QA Manager,Open,,2031-08-03,2031-09-10');
 const facts=projectFactsForState(f.state);
 const page=attachProjectFacts(f.state,deliveryModule(f.state,'delivery-quality')).data as any;
 assert.equal(metric(page,'Open records').value,facts.controls.openNcrCount.value,'page open count = Dashboard open NCRs');
 assert.equal(metric(page,'Overdue records').value,facts.controls.overdueNcrCount.value);
 assert.equal(page.registerIdentity,'ncr id');
 assert.deepEqual(projectFactConsumerMismatches(page),[]);
});

test('F04 each RFI cell names the source field it reads; Not established only where the register lacks the field',async t=>{
 const f=await fixture(t);
 await f.upload('RFI.csv',RFI);
 const row=(deliveryModule(f.state,'delivery-design').data as any).rows.find((r:any)=>r.reference==='R1');
 assert.deepEqual(row.cellSources,{reference:'rfi id',description:'subject',discipline:null,'fields.severity':null,sourceStatus:'status',
  dueDate:'due date',owner:null,'programmeContext.activityIds':null});
 assert.equal(row.dueDate,'2031-08-10','the register has the due date, so the cell has it');
 assert.equal(row.discipline,null,'the register has no Discipline column');
 const ui=runInNewContext(deliveryScript()+';({due:deliveryCellSource(row,"dueDate"),discipline:deliveryCellSource(row,"discipline"),computed:deliveryCellSource(row,"overdue")})',
  {Intl,row,escapeHtml:(s:unknown)=>String(s)});
 assert.equal(ui.due,' title="Source field: due date"');
 assert.equal(ui.discipline,' title="Not in the source register"');
 assert.equal(ui.computed,'','calculated cells are not attributed to one source field');
});

// F09: the Portfolio card and the Dashboard read the same forecast and claim count.
let serial=0;
// Submitted dates follow the programme logic, so the CMeng recalculation agrees
// with them (usable) but no contract finish exists, so the Dashboard does not
// publish it. Before F09 the card showed that unpublished recalculation as
// "Calculated programme finish" while the Dashboard showed the submitted finish.
const day=(n:number)=>new Date(Date.UTC(2031,3,1)+n*86400000).toISOString().slice(0,10);
function scheduleProject(delayClaims?:any){
 const projectId='W7-PORTFOLIO-'+(++serial);
 const state:any=runtimeProjects.getOrCreate(projectId);
 const N=60;
 const activities=Array.from({length:N},(_,i)=>({projectId,activityId:'W7-'+i,nativeId:String(i),name:'Zone '+Math.floor(i/20),wbsId:'AW'+Math.floor(i/20),calendarId:'C0',
  activityType:'task',status:'not_started',baselineStartIso:'2031-01-01',baselineFinishIso:'2031-02-01',currentStartIso:day(i),currentFinishIso:day(i+1),
  actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:24,remainingDurationHours:24,totalFloatHours:i%7,freeFloatHours:null,
  percentComplete:0,sourceRefs:[],diagnostics:[]}));
 const relationships=activities.slice(1).map((a,i)=>({relationshipId:'R'+i,predecessorActivityId:activities[i]!.activityId,successorActivityId:a.activityId,type:'FS',lagHours:0,sourceRefs:[],diagnostics:[]}));
 const model:any={projectId,source:'xer',sourceRevisionId:'W7-REV',dataDateIso:'2031-04-01',activities,relationships,
  wbs:[0,1,2].map(i=>({wbsId:'AW'+i,name:'Area '+i,parentWbsId:null,sourceRefs:[]})),calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C0'}],diagnostics:[]};
 state.schedules.push({role:'update',format:'xer',sourceFilename:'W7-REV.xer',sourceHashSha256:'W7-REV',uploadedAt:'2031-04-01',revision:{revisionId:'W7-REV',label:'W7-REV',sequence:1,effectiveAt:'2031-04-01',model}});
 if(delayClaims)state.controls.delayClaims={projectId,evidenceRevisionId:'W7-REV',...delayClaims};
 state.testProject=true;runtimeProjects.touch(state);
 return projectId;
}
function dashboardForecast(dashboard:any){
 const completion=dashboard.projectDiagnosis?dashboard.projectDiagnosis.completion:dashboard.completionPosition;
 return dashboard.sourceInterpretation?.productivityForecast?.completionIso??completion?.independentFinishIso??completion?.submittedFinishIso??null;
}

test('F09 Portfolio card forecast and claim count equal the Dashboard',()=>{
 const projectId=scheduleProject();
 const row:any=portfolioProjectRow(projectId),dashboard:any=moduleForProject(projectId,'master-dashboard').data;
 assert.ok(row,'the project has a Portfolio row');
 assert.equal(row.forecastCompletionIso,dashboardForecast(dashboard),'card forecast is the Dashboard headline forecast');
 assert.equal(row.calendarRecalculationIso,(dashboard.projectDiagnosis?dashboard.projectDiagnosis.completion:dashboard.completionPosition)?.independentFinishIso??null);
 assert.equal(row.claimCount,dashboard.managementContext.crossModule.claimsEot.claimCount,'card claim count is the Dashboard claim count');
 assert.equal(row.claimCount,null,'no claim population: unknown, never 0');
 // P0-B: a calculable recalculation is the headline on the Dashboard, so it is the card forecast too.
 assert.equal(row.forecastLabel,'Calculated programme finish','the card follows the Dashboard headline');
 assert.equal(String(row.forecastCompletionIso).slice(0,10),String(row.calendarRecalculationIso).slice(0,10));
});
