import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import JSZip from 'jszip';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {programmeReviewScript} from '../packages/runtime-api/src/ui-programme-review';

function xer(date:string,name:string){return ['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tCONTROL\t'+date,'%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\ttask_type\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt','%R\t1\t1\tA1\t'+name+'\tTT_Task\t2031-01-01\t2031-12-31\t80\t80','%E'].join('\n');}

test('first-upload adoption is actionable on blocked pages; every pending revision survives cache and restart without replacing authority',async t=>{
 const root=mkdtempSync(join(tmpdir(),'programme-review-'));let gateway=await createProjectGateway(root,{maxWorkers:1});
 t.after(async()=>{await gateway.close();rmSync(root,{recursive:true,force:true});});
 let base='';async function listen(){await new Promise<void>(r=>gateway.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+(gateway.server.address() as any).port;}await listen();
 async function call(route:string,init?:RequestInit){const res=await fetch(base+route,init);const body:any=await res.json();assert.ok(res.ok||body.status==='blocked',JSON.stringify(body));return body;}
 const id='REVIEW-OWNER',other='REVIEW-OTHER';
 for(const projectId of [id,other])await call('/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId})});
 async function upload(name:string,date:string){const z=new JSZip();z.file('02_Programme/'+name,xer(date,name));return call('/api/projects/'+id+'/evidence/uploads',{method:'POST',headers:{'content-type':'application/zip','x-source-filename':'programmes.zip','x-upload-intent':'add_update'},body:await z.generateAsync({type:'nodebuffer'}) as any});}
 await upload('Current.xer','2031-06-30');
 const paths=['schedule/modules/near-critical','schedule/modules/quantity-scurve','schedule/modules/delay-claims','management/master-dashboard'];
 let first:any;
 for(const path of paths){const r=await call('/api/projects/'+id+'/'+path);const review=r.scheduleAuthorityReview??r.data?.scheduleAuthorityReview;assert.ok(review,path+' must disclose adoption');assert.equal(review.state,'missing');assert.equal(review.pendingSchedules.length,1);assert.equal(review.pendingSchedules[0].canAdopt,true);assert.match(review.explanation,/awaiting adoption/);first=review.pendingSchedules[0];}
 await call(first.actionPath,{method:'POST'});
 const original=await call('/api/projects/'+id+'/management/master-dashboard');assert.equal(original.data.reportingContract.programmeLabel,'Current.xer');
 for(const [name,date] of [['Same.xer','2031-06-30'],['Earlier.xer','2031-05-31'],['Later.xer','2031-07-31'],['Undated.xer',''],['DRAFT_Future.xer','2031-08-31']])await upload(name!,date!);
 async function verify(){for(const path of paths){const r=await call('/api/projects/'+id+'/'+path);const review=r.scheduleAuthorityReview??r.data?.scheduleAuthorityReview;assert.equal(review.pendingSchedules.length,4,path);assert.deepEqual(review.pendingSchedules.map((p:any)=>p.dateRelationship),['same','earlier','later','date_missing']);assert.equal(review.pendingSchedules.at(-1).canAdopt,false);assert.equal(r.data.reportingContract.newerUnadoptedSchedules.length,1);assert.equal(r.data.reportingContract.programmeRevisionId,first.revisionId);assert.equal(r.data.reportingContract.dataDateIso,'2031-06-30');}}
 await verify();await gateway.close();gateway=await createProjectGateway(root,{maxWorkers:1});await listen();await verify();
 const untouched=await call('/api/projects/'+other+'/management/master-dashboard');assert.equal(untouched.data.scheduleAuthorityReview.pendingSchedules.length,0);assert.equal(untouched.data.reportingContract.programmeLabel,null);
});

test('programme review renders action without programme/date values and preserves unknown-date guidance',()=>{
 const context:any={escapeHtml:(s:any)=>String(s).replaceAll('<','&lt;'),planningShortDate:(s:string)=>s};runInNewContext(programmeReviewScript(),context);
 const html=context.renderProgrammeReview({state:'missing',projectId:'A',explanation:'Programme uploaded and awaiting adoption.',pendingSchedules:[{filename:'Current.xer',dataDateIso:null,dateRelationship:'date_missing',canAdopt:false,adoptionBlocker:'Data Date required',revisionId:'R'}]});
 assert.match(html,/Programme adoption required/);assert.match(html,/Current.xer/);assert.match(html,/Data Date required/);assert.doesNotMatch(html,/programme-review-adopt/);
 const active=context.renderProgrammeReview({state:'established',projectId:'A',explanation:'Selected programme',pendingSchedules:[{filename:'Same.xer',dataDateIso:'2031-06-30',dateRelationship:'same',canAdopt:true,revisionId:'R'}]});
 assert.match(active,/Same Data Date/);assert.match(active,/Adopt as current/);assert.match(active,/data-project="A"/);
});
