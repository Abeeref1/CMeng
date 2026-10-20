// r14 (F34 follow-up): a date stated for a named Section ("Section 1 Completion
// Date: 15 January 2027", "Section 2 Time for Completion: 15 March 2027") is a
// section value only. Before this fix the shared completion reader also took it
// as a Works (whole contract) completion candidate, so a contract with sectional
// dates got a false conflict hold (Works date unknown) or a false Works date.
// The projects are built through the real upload path (HTTP gateway, real PDF
// and XER parsers) and read from the real page API.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {moduleRegistry} from '../packages/runtime-api/src/registry';
import {contractCompletionPosition} from '../packages/runtime-api/src/contract-completion';
import {worksTimeForCompletion} from '../packages/runtime-api/src/contract-time-reader';

async function contractPdf(lines:string[]){
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
 const page=pdf.addPage([595,842]);
 page.drawText(lines.join('\n'),{x:45,y:790,size:10,font,lineHeight:22,maxWidth:505});
 return new Uint8Array(await pdf.save());
}
const SECTION_LINES=[
 'SECTIONAL COMPLETION',
 'The Works comprise Section 1 (Podium Works) and Section 2 (External Works).',
 'Section 1 Completion Date: 15 January 2027',
 'Section 2 Time for Completion: 15 March 2027',
 'Section 1 Delay Damages SAR 35,000 per day, capped at SAR 1,000,000',
 'Section 2 Delay Damages SAR 60,000 per day, capped at SAR 21,000,000',
];
const contractLines=(worksDate:boolean)=>['CONSTRUCTION CONTRACT','Contract Data','Contract currency is SAR.','Accepted Contract Amount: SAR 210,000,000.',
 ...(worksDate?['Contract Completion Date: 30 June 2027.']:[]),...SECTION_LINES];
function programmeXer(projectCode:string){
 const lines=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+projectCode+'\t2026-09-30',
  '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\t10\t1\t\tROOT\tMain Works',
  '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct'];
 const task=(id:number,code:string,name:string,type:string,status:string,start:string,finish:string,duration:number,remaining:number,pct:number)=>
  lines.push('%R\t'+id+'\t1\t10\t'+code+'\t'+name+'\t'+type+'\t'+status+'\t'+start+'\t'+finish+'\t'+start+'\t'+finish+'\t'+duration+'\t'+remaining+'\t0\t'+pct);
 task(1000,'POD-100','Podium structure','TT_Task','TK_Active','2026-02-01','2027-01-10',2400,800,60);
 task(1100,'MS-110','Podium Works Completion','TT_FinMile','TK_NotStart','2027-01-10','2027-01-10',0,0,0);
 task(1400,'MS-140','Project Completion','TT_FinMile','TK_NotStart','2027-06-20','2027-06-20',0,0,0);
 lines.push('%T\tTASKPRED','%F\ttask_pred_id\tproj_id\ttask_id\tpred_proj_id\tpred_task_id\tpred_type\tlag_hr_cnt',
  '%R\t5000\t1\t1100\t1\t1000\tPR_FS\t0','%R\t5001\t1\t1400\t1\t1100\tPR_FS\t0','%E');
 return Buffer.from(lines.join('\n'));
}
async function request(base:string,path:string,init?:RequestInit){
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
async function buildProject(base:string,projectId:string,worksDate:boolean){
 const created=await request(base,'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId})});
 assert.equal(created.status,201,'project creation failed: '+created.text);
 await upload(base,projectId,'Main_Contract.pdf','application/pdf',await contractPdf(contractLines(worksDate)),true);
 await upload(base,projectId,'Programme_Update.xer','text/plain',programmeXer(projectId));
}
function pagePath(projectId:string,key:string){
 const page=moduleRegistry.find(row=>row.key===key)!;
 const api=page.apiKey||page.key;
 return '/api/projects/'+encodeURIComponent(projectId)+(page.area==='management'?'/management/'+encodeURIComponent(api):'/'+page.area+'/modules/'+encodeURIComponent(api));
}
const PAGES=['contract-particulars-bonds','milestones','master-dashboard'] as const;

test('r14 section dates are never Works completion candidates: a Works date with two section dates, and section dates only',{timeout:600000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'cmeng-r14-secdate-'));
 const gateway=await createProjectGateway(root,{maxWorkers:2});
 await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+(gateway.server.address() as AddressInfo).port;
 try{
  await buildProject(base,'R14-WORKS-AND-SECTIONS',true);
  await buildProject(base,'R14-SECTIONS-ONLY',false);
  for(const key of PAGES){
   const withWorks=await request(base,pagePath('R14-WORKS-AND-SECTIONS',key));
   assert.equal(withWorks.status,200,key+' returned '+withWorks.status+': '+withWorks.text.slice(0,300));
   const facts=withWorks.body.data.projectFacts;
   assert.ok(facts,key+' carries the shared project facts');
   // The Works date is the one line that states the contract completion; the
   // two section dates are not competing Works dates (no false conflict hold).
   assert.equal(facts.time.contractualCompletionIso.value,'2027-06-30',key+' Works completion: '+JSON.stringify(facts.time.contractualCompletionIso));
   assert.doesNotMatch(String(facts.time.contractualCompletionIso.basis??''),/Conflicting completion dates/,key+' no false conflict');
   const sections=facts.contractSections??[];
   const s1=sections.find((s:any)=>s.sectionId==='1'),s2=sections.find((s:any)=>s.sectionId==='2');
   assert.equal(s1?.contractCompletionIso,'2027-01-15',key+' Section 1 keeps its own date');
   assert.equal(s2?.contractCompletionIso,'2027-03-15',key+' Section 2 keeps its own date');

   const only=await request(base,pagePath('R14-SECTIONS-ONLY',key));
   assert.equal(only.status,200,key+' returned '+only.status);
   const onlyFacts=only.body.data.projectFacts;
   // No Works line: the Works date stays unknown with the reason; it is never a section date.
   assert.equal(onlyFacts.time.contractualCompletionIso.value,null,key+' Works completion stays unknown: '+JSON.stringify(onlyFacts.time.contractualCompletionIso));
   assert.match(String(onlyFacts.time.contractualCompletionIso.basis??''),/Only Section completion dates are stated/,key+' the reason is stated');
   const o1=(onlyFacts.contractSections??[]).find((s:any)=>s.sectionId==='1');
   assert.equal(o1?.contractCompletionIso,'2027-01-15',key+' Section 1 date is still read');
  }
 }finally{
  await gateway.close();
  await rm(root,{recursive:true,force:true});
 }
});

test('r14 shared rule: Sectional Completion, Portion and Milestone lines are section values; Works / Contract lines stay Works',()=>{
 const state=(text:string):any=>({version:1,contractDocuments:[{documentId:'D',role:'main',result:{sections:[],pdf:{pages:[{pageNumber:1,method:'native',text}]}}}],
  evidenceDocuments:[{documentId:'D',basisState:'active',sourceFilename:'C.pdf'}],controls:{}});
 const read=(text:string)=>contractCompletionPosition(state(text),'2026-10-01');
 assert.equal(read('Completion Date: 30 June 2027').value,'2027-06-30','a plain Works completion line is unchanged');
 assert.equal(read('Contract Completion Date: 30 June 2027\nSection 1 Completion Date: 15 January 2027\nSectional Completion Date: 1 March 2027\nPortion A Completion Date: 2 March 2027\nMilestone 3 Completion Date: 3 March 2027\nCompletion Date: 4 March 2027 for Section 2').value,'2027-06-30');
 const sectionsOnly=read('Section 1 Completion Date: 15 January 2027\nSection 2 Time for Completion: 15 March 2027');
 assert.equal(sectionsOnly.value,null);assert.equal(sectionsOnly.state,'missing');assert.match(sectionsOnly.reason!,/Only Section completion dates are stated/);
 const periods=(text:string)=>worksTimeForCompletion({sections:[],pdf:{pages:[{method:'native',text,pageNumber:1}]}},'D').map(p=>p.amount);
 assert.deepEqual(periods('Time for Completion of the Works: 540 days\nSection 1 Time for Completion: 365 days\nSectional Completion Time for Completion: 200 days\nMilestone 2 Time for Completion: 100 days\nTime for Completion: 90 days for Section 2'),[540]);
});
