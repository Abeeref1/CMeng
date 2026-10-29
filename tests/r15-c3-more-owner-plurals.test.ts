// R15 c3-more: guard A1 (a suggested update's button goes to the page where it is
// reviewed, never to the document library as a fallback) and W4 (a figure of 1 takes
// the singular unit; register names keep their real spelling). Real builders and the
// real browser functions; nothing here edits the guard.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runInNewContext} from './browser-context';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {projectActions,programmeActions,candidateDocumentReviewPages,ACTIONS_REVIEW_PAGE} from '../packages/runtime-api/src/project-actions';
import {summarizeControlIssues} from '../packages/truth-kernel/src';
import {floatHoursText,lagHoursText} from '../packages/runtime-api/src/activity-float-reconciliation';
import {deliveryScript} from '../packages/runtime-api/src/ui-delivery';

const escapeHtml=(s:unknown)=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
const text=(html:string)=>html.replace(/<[^>]+>/g,'\n').replace(/&amp;/g,'&');
function xer(date:string,name:string){return ['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tCONTROL\t'+date,'%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\ttask_type\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt','%R\t1\t1\tA1\t'+name+'\tTT_Task\t2031-01-01\t2031-12-31\t80\t80','%E'].join('\n');}

test('A1: an uploaded candidate document goes to the page where it is reviewed and approved',async t=>{
 const root=mkdtempSync(join(tmpdir(),'c3-more-owner-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false}),state=store.getOrCreate('OWNER');
 const schedule=(name:string,date:string)=>store.ingestSchedule({projectId:state.projectId,sourceFilename:name,bytes:Buffer.from(xer(date,name)),mediaType:'text/plain',uploadedAt:'2031-08-31',role:'update',uploadIntent:'add_update'});
 await schedule('Current.xer','2031-06-30');await schedule('Earlier.xer','2031-05-31');
 const register=(body:string,name:string)=>store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(body),mediaType:'text/csv',sourceFilename:name,sourceRelativePath:'shared-folder/'+name,documentType:'rfi_register',category:'engineering',uploadedAt:'2031-08-31',uploadIntent:'add_update'});
 await register('RFI ID,Subject,Status\nR1,Question,Open','RFI.csv');await register('RFI ID,Subject,Status\nR1,Question,Closed','RFI-update.csv');
 const candidates=state.evidenceDocuments.filter(d=>d.basisState==='candidate');
 assert.ok(candidates.length>0,'the fixture holds candidate documents');
 const pages=candidateDocumentReviewPages(state);
 // The rule matches the decisions the Actions list really asks for: a page exactly when an action reviews that document.
 const reviewed=new Set([...programmeActions(state),...projectActions(state,summarizeControlIssues([])).actions].map(a=>a.target.documentId).filter(Boolean));
 for(const d of candidates)assert.equal(pages.get(d.documentId)??'documents',reviewed.has(d.documentId)?ACTIONS_REVIEW_PAGE:'documents',d.sourceFilename+' ('+d.category+')');
 const scheduleCandidates=candidates.filter(d=>d.category==='schedule');
 assert.ok(scheduleCandidates.length>0&&candidates.some(d=>d.category!=='schedule'),'the fixture holds a schedule update and a register update awaiting review');
 for(const d of scheduleCandidates)assert.equal(pages.get(d.documentId),ACTIONS_REVIEW_PAGE,'before: a schedule update linked to the document library ('+d.sourceFilename+')');
});

test('A1: the suggested-update button is named after the page it opens',()=>{
 const registry=[{key:'source-quality'},{key:'contract-particulars-bonds'},{key:'master-control-programme'}];
 const names={'source-quality':'Actions required','contract-particulars-bonds':'Contract Particulars & Bonds','master-control-programme':'Master Control Programme'};
 const link=(item:any)=>runInNewContext('candidateOwnerLink(item)',{item,escapeHtml,moduleRegistry:registry,names,selected:'master-control-programme',appView:'project',deliveryRegisterOwners:{},blockOwnerEntry:()=>({owner:'source-quality'})}) as string;
 const schedule=link({type:'schedule_update',owningModule:'source-quality'});
 assert.match(schedule,/data-module="source-quality"/);assert.match(text(schedule),/Review in Actions required/);
 assert.match(text(link({type:'contract_clause',owningModule:'contract-particulars-bonds'})),/Review in Contract Particulars & Bonds/);
 const library=link({type:'rfi_register',owningModule:'documents'});
 assert.match(library,/data-module="documents"/);assert.match(text(library),/Open document library/);
 for(const html of [schedule,library])assert.doesNotMatch(text(html),/owner|owning/i,'before: "Open owner" opened the document library');
});

test('W4: a figure of 1 takes the singular unit in the float, duration and delay texts',()=>{
 const run=(code:string,row:any)=>runInNewContext(code,{row,fmt:String}) as string;
 assert.equal(run('sourceWorkingFloat(row)',{status:'in_progress',submittedTotalFloatWorkingDays:1,submittedTotalFloatHours:8}),'1 working day · 8 original h','before: "1 working days · 8 original h"');
 assert.equal(run('sourceWorkingFloat(row)',{status:'in_progress',submittedTotalFloatWorkingDays:3,submittedTotalFloatHours:24}),'3 working days · 24 original h');
 assert.equal(run('sourceWorkingDuration(row,"remainingDurationHours")',{remainingDurationHours:8,remainingDurationWorkingDays:1}),'1 working day · 8 original h');
 assert.equal(run('sourceWorkingDelay(row,"finishVarianceDays")',{finishVarianceDays:1,finishVarianceWorkingDays:1}),'+1 working day (activity calendar) · +1 elapsed day');
 assert.equal(run('sourceWorkingDelay(row,"finishVarianceDays")',{finishVarianceDays:7,finishVarianceWorkingDays:5}),'+5 working days (activity calendar) · +7 elapsed days');
 assert.equal(floatHoursText(8,8),'1 working day (activity calendar)');
 assert.equal(floatHoursText(-24,8),'-3 working days (activity calendar)');
 assert.equal(lagHoursText(8,8),'lag 1 working day (successor calendar) · 8 original h');
});

test('W4: delivery register actions keep the real register name and count their records',async t=>{
 const root=mkdtempSync(join(tmpdir(),'c3-more-register-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false}),state=store.getOrCreate('REGISTER');
 await store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from('RFI ID,Subject,Status\nR1,Question,Open'),mediaType:'text/csv',sourceFilename:'RFI.csv',sourceRelativePath:'shared-folder/RFI.csv',documentType:'rfi_register',category:'engineering',uploadedAt:'2031-08-31',uploadIntent:'add_update'});
 const action=projectActions(state,summarizeControlIssues([])).actions.find(a=>a.id==='delivery-population:design');
 // M4.1: this register has no dates and no Data Date, so the item names that blocker instead of asking for completeness.
 assert.ok(action,'the RFI & design register has its one item');
 assert.equal(action!.title,'Add the missing dates and statuses in the RFI & design register','the register name is kept as written');
 assert.equal(action!.recordCount,1,'its one record is counted');
 assert.doesNotMatch(deliveryScript(),/p\.title\.toLowerCase\(\)/,'the empty register page keeps the register name as written');
});
