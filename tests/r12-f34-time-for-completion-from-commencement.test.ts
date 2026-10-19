// F34 (round 12, r12-sections): a Time for Completion stated as a period.
// Under FIDIC-type contracts the Time for Completion of the Works or of a Section
// is usually a period ("540 days", "12 months") counted from the Commencement
// Date. Before this fix such a date stayed unknown even when the Commencement Date
// was stated. Now one shared reader computes Commencement Date + the period on the
// contract's day basis and states that basis. With no stated Commencement Date the
// date stays unknown with the reason; a user-confirmed Commencement Date is used
// and labelled. An awarded EOT for one section extends that section only, by the
// same governing-date rule as the Works; sectional delay damages use these dates.
//
// The projects are built through the real upload path (HTTP gateway, real PDF,
// XER and register parsers). Pages are read from the real API and drawn with the
// real page renderer (renderModuleResult from the assembled browser script).
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {moduleRegistry} from '../packages/runtime-api/src/registry';
import {runInNewContext} from './browser-context';

const COMMENCEMENT='2026-01-15';
const WORKS_COMPLETION='2027-07-09';      // 2026-01-15 + 540 calendar days
const SECTION1_COMPLETION='2027-01-15';   // 2026-01-15 + 12 calendar months
const SECTION1_EXTENDED='2027-02-04';     // + 20 days awarded for Section 1 only
const SECTION1_FORECAST='2027-02-10';     // Podium Works Completion milestone

async function contractPdf(lines:string[]){
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
 const page=pdf.addPage([595,842]);
 page.drawText(lines.join('\n'),{x:45,y:790,size:10,font,lineHeight:22,maxWidth:505});
 return new Uint8Array(await pdf.save());
}
const contractLines=(commencement:boolean)=>[
 'CONSTRUCTION CONTRACT',
 'Contract Data',
 'Contract currency is SAR.',
 'Accepted Contract Amount: SAR 210,000,000.',
 ...(commencement?['Commencement Date: 15 January 2026.']:['The Commencement Date shall be stated in the Engineer\'s Notice.']),
 'Time for Completion of the Works: 540 days from the Commencement Date.',
 'SECTIONAL COMPLETION',
 'The Works comprise Section 1 (Podium Works) and Section 2 (External Works).',
 'Section 1 Time for Completion: 12 months from the Commencement Date.',
 'Section 2 Time for Completion: 90 days after the Taking-Over of Section 1.',
 'Section 1 Delay Damages SAR 35,000 per day, capped at SAR 1,000,000',
 'Section 2 Delay Damages SAR 60,000 per day, capped at SAR 21,000,000',
];
function calendarData(){
 const shifts=[['08:00','12:00'],['13:00','17:00']] as const;
 const intervals=shifts.map(([s,e],i)=>'(0||'+i+'(s|'+s+'|f|'+e+')())').join('');
 const days=[1,2,3,4,5,6,7].map(d=>'(0||'+d+'()('+(d>=2&&d<=6?intervals:'')+'))').join('');
 return '(0||CalendarData()((0||DaysOfWeek()('+days+'))(0||Exceptions()())))'.replaceAll('(0||','\x7f\x7f  (0||');
}
function programmeXer(projectCode:string){
 const lines=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+projectCode+'\t2026-09-30',
  '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\t10\t1\t\tROOT\tMain Works',
  '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data','%R\tC1\tFive Day 8h\t8\t40\t'+calendarData(),
  '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct'];
 const task=(id:number,code:string,name:string,type:string,status:string,start:string,finish:string,duration:number,remaining:number,pct:number)=>
  lines.push('%R\t'+id+'\t1\t10\tC1\t'+code+'\t'+name+'\t'+type+'\t'+status+'\t'+start+'\t'+finish+'\t'+start+'\t'+finish+'\t'+duration+'\t'+remaining+'\t0\t'+pct);
 task(1000,'POD-100','Podium structure','TT_Task','TK_Active','2026-02-01',SECTION1_FORECAST,2400,800,60);
 task(1100,'MS-110','Podium Works Completion','TT_FinMile','TK_NotStart',SECTION1_FORECAST,SECTION1_FORECAST,0,0,0);
 task(1200,'EXT-200','External landscaping','TT_Task','TK_NotStart',SECTION1_FORECAST,'2027-06-01',800,800,0);
 task(1300,'MS-130','External Works Completion','TT_FinMile','TK_NotStart','2027-06-01','2027-06-01',0,0,0);
 task(1400,'MS-140','Project Completion','TT_FinMile','TK_NotStart','2027-07-20','2027-07-20',0,0,0);
 lines.push('%T\tTASKPRED','%F\ttask_pred_id\tproj_id\ttask_id\tpred_proj_id\tpred_task_id\tpred_type\tlag_hr_cnt');
 [[1000,1100],[1100,1200],[1200,1300],[1300,1400]].forEach(([pred,succ],i)=>lines.push('%R\t'+(5000+i)+'\t1\t'+succ+'\t1\t'+pred+'\tPR_FS\t0'));
 lines.push('%E');
 return Buffer.from(lines.join('\n'));
}
const CLAIMS='Claim ID,Event,Notice Date,Days Claimed,Assessed Days,Status\nC1,Late access to the podium,2026-03-01,30,20,Determined\n';
// One awarded EOT, stated for Section 1 only.
const DETERMINATIONS='Determination ID,Claim ID,Section,Awarded EOT Days,Determination Date,Status,Authority\nD1,C1,Section 1,20,2026-06-01,Determined,Engineer\n';

export async function listen(gateway:Awaited<ReturnType<typeof createProjectGateway>>){
 await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));
 return 'http://127.0.0.1:'+(gateway.server.address() as AddressInfo).port;
}
export async function request(base:string,path:string,init?:RequestInit){
 const response=await fetch(base+path,init),text=await response.text();
 let body:any=null;try{body=text?JSON.parse(text):null;}catch{body=text;}
 return {status:response.status,body,text};
}
async function upload(base:string,projectId:string,filename:string,mediaType:string,bytes:Uint8Array|Buffer,contract=false){
 const response=await request(base,'/api/projects/'+encodeURIComponent(projectId)+(contract?'/contract/uploads':'/evidence/uploads'),{method:'POST',
  headers:{'content-type':mediaType,'x-source-filename-encoded':encodeURIComponent(filename),'x-source-relative-path-encoded':encodeURIComponent(filename),
   ...(contract?{'x-contract-role':'main'}:{'x-upload-intent':'add_update','x-upload-id':projectId+'-'+filename})},body:Buffer.from(bytes)});
 assert.equal(response.status,201,filename+' upload failed: '+response.text.slice(0,500));
}
export async function buildProject(base:string,projectId:string,commencement:boolean){
 const created=await request(base,'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId})});
 assert.equal(created.status,201,'project creation failed: '+created.text);
 await upload(base,projectId,'Main_Contract.pdf','application/pdf',await contractPdf(contractLines(commencement)),true);
 await upload(base,projectId,'Programme_Update.xer','text/plain',programmeXer(projectId));
 await upload(base,projectId,'Claims_Register.csv','text/csv',Buffer.from(CLAIMS));
 await upload(base,projectId,'EOT_Determinations_Register.csv','text/csv',Buffer.from(DETERMINATIONS));
}
export function pagePath(projectId:string,key:string){
 const page=moduleRegistry.find(row=>row.key===key)!;
 const api=page.apiKey||page.key;
 return '/api/projects/'+encodeURIComponent(projectId)+(page.area==='management'?'/management/'+encodeURIComponent(api):'/'+page.area+'/modules/'+encodeURIComponent(api));
}
// Minimal DOM stand-in (as in the F10 page test): every element keeps its HTML as a string.
class FakeElement{
 innerHTML='';textContent='';value='';className='';hidden=false;open=false;disabled=false;onclick:unknown=null;
 style:Record<string,string>={};dataset:Record<string,string>={};children:FakeElement[]=[];
 classList={add(){},remove(){},toggle(){},contains(){return false;}};
 insertAdjacentHTML(where:string,html:string){this.innerHTML=where==='afterbegin'||where==='beforebegin'?html+this.innerHTML:this.innerHTML+html;}
 querySelector(selector:string){return selector.startsWith(':scope>')?null:new FakeElement();}
 querySelectorAll(){return [] as FakeElement[];}
 addEventListener(){}removeEventListener(){}setAttribute(){}removeAttribute(){}getAttribute(){return null;}
 appendChild(){}remove(){}closest(){return null;}focus(){}click(){}scrollIntoView(){}
}
export function renderPage(projectId:string,result:any):string{
 const nodes=new Map<string,FakeElement>();
 const el=(id:string)=>{if(!nodes.has(id))nodes.set(id,new FakeElement());return nodes.get(id)!;};
 const storage=new Map<string,string>();
 const ctx:any={el,
  document:{getElementById:el,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>new FakeElement(),body:new FakeElement(),addEventListener(){}},
  localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,String(v)),removeItem:(k:string)=>storage.delete(k)},
  window:{location:{search:'',pathname:'/',hash:''},addEventListener(){},history:{pushState(){},replaceState(){}}},
  location:{search:'',pathname:'/',hash:''},
  setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:()=>0,console,
  overview:{projectId,latestDataDateIso:null},appView:'project',selectedRoleView:'overall',project:()=>projectId,__result:result};
 runInNewContext('renderModuleResult(__result);',ctx);
 let html=el('moduleContent').innerHTML;
 for(let pass=0;pass<3;pass++)for(const [id,node] of nodes){
  if(id==='moduleContent'||!node.innerHTML)continue;
  html=html.replace(new RegExp('(<([a-zA-Z0-9]+)[^>]*\\bid="'+id.replace(/[^a-zA-Z0-9_-]/g,'')+'"[^>]*>)(</\\2>)'),(_m,open,_tag,close)=>open+node.innerHTML+close);
 }
 return html;
}
export const textOf=(html:string)=>html.replace(/<(script|style)[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ');
const PAGES=['contract-particulars-bonds','milestones','independent-forecast','master-dashboard'] as const;

test('F34 Time for Completion as a period: Works and Section 1 dates from the stated Commencement Date, Section 1 EOT, sectional LD and every page',{timeout:600000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'cmeng-r12-sections-'));
 const gateway=await createProjectGateway(root,{maxWorkers:2}),base=await listen(gateway);
 try{
  const projectId='R12-SECTIONS-STATED';
  await buildProject(base,projectId,true);
  const pages=new Map<string,any>();
  for(const key of PAGES){
   const response=await request(base,pagePath(projectId,key));
   assert.equal(response.status,200,key+' returned '+response.status+': '+response.text.slice(0,300));
   pages.set(key,response.body);
  }
  for(const [key,body] of pages){
   const facts=body.data.projectFacts;
   assert.ok(facts,key+' carries the shared project facts');
   const time=facts.time;
   // Works: Commencement Date + 540 calendar days, with the basis stated.
   assert.equal(time.contractualCompletionIso.value,WORKS_COMPLETION,key+' Works completion from the Commencement Date and the stated period');
   assert.match(time.contractualCompletionIso.basis,new RegExp('Commencement '+COMMENCEMENT+' \\+ 540 calendar days'),key+' Works basis label');
   // The award stated for Section 1 does not extend the Works.
   assert.notEqual(time.awardedEotDays.value,20,key+' a Section 1 award is not a Works award');
   assert.equal(time.governingContractCompletionIso.value,WORKS_COMPLETION,key+' Works governing date');
   const sections=facts.contractSections;
   assert.equal(sections.length,2,key+' two contract sections');
   const s1=sections.find((s:any)=>s.sectionId==='1'),s2=sections.find((s:any)=>s.sectionId==='2');
   assert.equal(s1.contractCompletionIso,SECTION1_COMPLETION,key+' Section 1: Commencement Date + 12 calendar months');
   assert.match(s1.completionBasis,new RegExp('Commencement '+COMMENCEMENT+' \\+ 12 calendar months'),key+' Section 1 basis label');
   assert.equal(s1.awardedEotDays,20,key+' Section 1 awarded EOT');
   assert.equal(s1.governingCompletionIso,SECTION1_EXTENDED,key+' Section 1 governing date = contract date + awarded EOT');
   assert.equal(s1.scenario.dueIso,SECTION1_EXTENDED);
   assert.equal(s1.scenario.lateDays,6);
   // Section 2: its period is not counted from the Commencement Date, so it stays unknown with the reason.
   assert.equal(s2.contractCompletionIso,null,key+' Section 2 stays unknown');
   assert.equal(s2.governingCompletionIso,null);
   assert.match(s2.completionReason,/not counted from the Commencement Date/,key+' Section 2 reason');
   // Sectional delay damages use the Section 1 date that was unknown before.
   const ld=facts.commercial.sectionalLd;
   assert.ok(ld,key+' sectional LD position');
   const ld1=ld.sections.find((s:any)=>s.sectionId==='1'),ld2=ld.sections.find((s:any)=>s.sectionId==='2');
   assert.equal(ld1.lateDays,6,key+' Section 1 late days against the extended section date');
   assert.equal(ld1.cappedExposure,6*35_000,key+' Section 1 capped LD');
   assert.deepEqual(ld1.missingInputs,[],key+' Section 1 is complete');
   assert.ok(ld2.missingInputs.includes('Section contractual completion date'),key+' Section 2 date missing');
   assert.equal(ld.state,'needs_review',key+' no total while Section 2 is unknown');
   assert.equal(ld.cappedTotal,null);
  }
  // Pages show the dates and their basis.
  const html=new Map(PAGES.map(key=>[key,textOf(renderPage(projectId,pages.get(key)))]));
  const contract=html.get('contract-particulars-bonds')!,milestones=html.get('milestones')!,forecast=html.get('independent-forecast')!,dashboard=html.get('master-dashboard')!;
  assert.match(contract,new RegExp('Commencement '+COMMENCEMENT+' \\+ 12 calendar months'),'Contract Particulars: Section 1 date basis');
  assert.match(contract,/Feb 4, 2027/,'Contract Particulars: Section 1 date with the awarded EOT');
  assert.match(contract,/not counted from the Commencement Date/,'Contract Particulars: Section 2 reason');
  for(const [key,text] of [['milestones',milestones],['master-dashboard',dashboard]] as const){
   assert.match(text,/Contract completion dates/,key+': contract completion dates block');
   assert.match(text,new RegExp('Commencement '+COMMENCEMENT+' \\+ 540 calendar days'),key+': Works basis');
   assert.match(text,/Jul 9, 2027/,key+': Works date');
   assert.match(text,/Feb 4, 2027/,key+': Section 1 governing date');
   assert.match(text,/not counted from the Commencement Date/,key+': Section 2 reason');
  }
  assert.match(forecast,/Contract completion dates: see Milestones/,'Completion Forecast links to the owner page');
  assert.match(forecast,/Works Jul 9, 2027/,'Completion Forecast: Works date in the link figure');
  assert.match(forecast,/Podium Works Feb 4, 2027/,'Completion Forecast: Section 1 date in the link figure');
  assert.match(dashboard,/Sectional delay damages position/,'Dashboard: sectional LD position');
  assert.match(dashboard,/210,000/,'Dashboard: Section 1 capped LD');
 }finally{
  await gateway.close();
  await rm(root,{recursive:true,force:true});
 }
});

test('F34 no Commencement Date stated: dates stay unknown with the reason; a user-confirmed Commencement Date is used and labelled',{timeout:600000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'cmeng-r12-sections-'));
 const gateway=await createProjectGateway(root,{maxWorkers:2}),base=await listen(gateway);
 try{
  const projectId='R12-SECTIONS-NO-COMMENCEMENT';
  await buildProject(base,projectId,false);
  const before=(await request(base,pagePath(projectId,'milestones'))).body.data.projectFacts;
  assert.equal(before.time.contractualCompletionIso.value,null,'no Commencement Date: the Works date stays unknown');
  assert.match(before.time.contractualCompletionIso.basis,/no Commencement Date is stated/,'the reason is stated');
  const s1=before.contractSections.find((s:any)=>s.sectionId==='1');
  assert.equal(s1.contractCompletionIso,null);
  assert.match(s1.completionReason,/no Commencement Date is stated/);
  // The user confirms the Commencement Date in Actions required.
  const actions=(await request(base,'/api/projects/'+encodeURIComponent(projectId)+'/actions')).body;
  const action=actions.actions.find((a:any)=>a.target?.kind==='commencement-date');
  assert.ok(action,'Actions required offers the Commencement Date input');
  const saved=await request(base,'/api/projects/'+encodeURIComponent(projectId)+'/actions/confirm-missing-value',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({actionId:action.id,expectedVersion:actions.projectVersion??actions.version,dateIso:COMMENCEMENT})});
  assert.equal(saved.status,200,saved.text);
  const after=(await request(base,pagePath(projectId,'milestones'))).body.data.projectFacts;
  assert.equal(after.time.contractualCompletionIso.value,WORKS_COMPLETION);
  assert.match(after.time.contractualCompletionIso.basis,new RegExp('Commencement '+COMMENCEMENT+' \\(confirmed by the user\\) \\+ 540 calendar days'));
  const a1=after.contractSections.find((s:any)=>s.sectionId==='1');
  assert.equal(a1.contractCompletionIso,SECTION1_COMPLETION);
  assert.equal(a1.governingCompletionIso,SECTION1_EXTENDED);
  assert.match(a1.completionBasis,/confirmed by the user/);
  // The input is no longer offered once the date is held.
  const reopened=(await request(base,'/api/projects/'+encodeURIComponent(projectId)+'/actions')).body;
  assert.equal(reopened.actions.some((a:any)=>a.target?.kind==='commencement-date'),false);
 }finally{
  await gateway.close();
  await rm(root,{recursive:true,force:true});
 }
});

test('F34 the Commencement Date stated in an Engineer\'s notice of commencement gives the dates, labelled with that source',{timeout:600000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'cmeng-r12-sections-'));
 const gateway=await createProjectGateway(root,{maxWorkers:2}),base=await listen(gateway);
 try{
  const projectId='R12-SECTIONS-ENGINEER-NOTICE';
  await buildProject(base,projectId,false);
  const notice=await contractPdf(['ENGINEER\'S NOTICE OF COMMENCEMENT','Letter Ref: ENG-LET-0001','Date: 01 January 2026','From: The Engineer','To: The Contractor',
   'Subject: Notice of Commencement under Sub-Clause 8.1','The Engineer gives notice that the Commencement Date shall be 15 January 2026.']);
  await upload(base,projectId,'Letters_Notices_Engineer_Commencement.pdf','application/pdf',notice);
  const facts=(await request(base,pagePath(projectId,'milestones'))).body.data.projectFacts;
  assert.equal(facts.time.contractualCompletionIso.value,WORKS_COMPLETION,'Works date from the Engineer\'s notice and the stated period');
  assert.match(facts.time.contractualCompletionIso.basis,new RegExp('Commencement '+COMMENCEMENT+' \\(Engineer\'s notice of commencement\\) \\+ 540 calendar days'));
  const s1=facts.contractSections.find((s:any)=>s.sectionId==='1');
  assert.equal(s1.contractCompletionIso,SECTION1_COMPLETION);
  assert.equal(s1.governingCompletionIso,SECTION1_EXTENDED);
  // No Commencement Date input is asked for once a source states it.
  const actions=(await request(base,'/api/projects/'+encodeURIComponent(projectId)+'/actions')).body;
  assert.equal(actions.actions.some((a:any)=>a.target?.kind==='commencement-date'),false);
 }finally{
  await gateway.close();
  await rm(root,{recursive:true,force:true});
 }
});

import {addStatedPeriod,completionFromStatedPeriod,readStatedPeriod,sectionTimeForCompletion,worksTimeForCompletion,type CommencementDatePosition} from '../packages/runtime-api/src/contract-time-reader';
test('F34 shared period reader: counted from the Commencement Date, another event, working days and month ends',()=>{
 assert.equal(readStatedPeriod('540 days from the Commencement Date.')!.anchor,'commencement');
 assert.equal(readStatedPeriod('18 months')!.anchor,'unstated','a bare Time for Completion is counted from the Commencement Date');
 assert.equal(readStatedPeriod('90 days after the Taking-Over of Section 1')!.anchor,'other');
 assert.equal(readStatedPeriod('90 days (ninety) after the Taking-Over of Section 1')!.anchor,'other');
 assert.equal(readStatedPeriod('The Contractor shall complete the Works'),null);
 assert.deepEqual(addStatedPeriod('2026-01-31',{amount:1,unit:'months'}),{dateIso:'2026-02-28',monthEnd:true});
 assert.deepEqual(addStatedPeriod(COMMENCEMENT,{amount:540,unit:'days'}),{dateIso:WORKS_COMPLETION,monthEnd:false});
 const contract={sections:[{text:'Time for Completion: 540 days\nSection 1 Time for Completion: 12 months\nTime for Completion of Section 2: 200 days from the Commencement Date',startPage:3,sectionKey:'s'}],pdf:{pages:[]}};
 assert.deepEqual(worksTimeForCompletion(contract,'D').map(p=>p.text),['540 days'],'a Section line is never read as the Works');
 assert.deepEqual(sectionTimeForCompletion(contract,'1','D').map(p=>p.text),['12 months']);
 assert.deepEqual(sectionTimeForCompletion(contract,'2','D').map(p=>p.text),['200 days from the Commencement Date']);
 const stated:CommencementDatePosition={dateIso:COMMENCEMENT,state:'stated',sourceAnalytical:false,label:'Commencement '+COMMENCEMENT,reason:null,sourceRefs:[],candidates:[]};
 const works=worksTimeForCompletion(contract,'D');
 assert.equal(completionFromStatedPeriod('The Works',works,stated,null).dateIso,WORKS_COMPLETION);
 const working=completionFromStatedPeriod('The Works',works,stated,'working');
 assert.equal(working.dateIso,null,'a day defined as a working day is never counted as a calendar day');
 assert.match(working.reason!,/defines a day as a working day/);
 const month=completionFromStatedPeriod('Section 1',sectionTimeForCompletion(contract,'1','D'),{...stated,dateIso:'2026-01-31',label:'Commencement 2026-01-31'},null);
 assert.equal(month.dateIso,'2027-01-31');assert.match(month.basis!,/12 calendar months \(same day of the month\)/);
 const none=completionFromStatedPeriod('The Works',works,{...stated,dateIso:null,state:'missing',label:null,reason:'no Commencement Date is stated in the contract, an Engineer\'s notice of commencement or a user-confirmed decision'},null);
 assert.equal(none.dateIso,null);assert.match(none.reason!,/no Commencement Date is stated/);
});
