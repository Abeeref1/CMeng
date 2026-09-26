import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {deliveryPages} from '../packages/delivery-core/src/registry';

test('Delivery HTTP workflow preserves project ownership, rejects conflicting edits, paginates sources and survives restart',async t=>{
 const root=mkdtempSync(join(tmpdir(),'delivery-http-'));let g=await createProjectGateway(root,{maxWorkers:2});t.after(async()=>{await g.close();rmSync(root,{recursive:true,force:true});});let base='';
 async function start(){await new Promise<void>(r=>g.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+(g.server.address() as any).port;}await start();
 async function call(path:string,body?:unknown){const r=await fetch(base+path,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json() as any};}
 for(const projectId of ['HTTP-A','HTTP-B'])assert.equal((await call('/api/projects',{projectId})).status,201);
 const empty=await call('/api/projects/HTTP-A/management/master-dashboard');assert.equal(empty.data.issueAssessment?.counts?.system_defect??empty.data.data.issueAssessment.counts.system_defect,0,JSON.stringify(empty.data.data.issueAssessment.issues));
 const path='/api/projects/HTTP-A/delivery/records';const initial=await call(path);let version=initial.data.projectVersion;
 const saves=await Promise.all([call(path,{action:'create',kind:'handover',expectedVersion:version,fields:{'record reference':'H1'}}),call(path,{action:'create',kind:'handover',expectedVersion:version,fields:{'record reference':'H2'}})]);assert.deepEqual(saves.map(r=>r.status).sort(),[200,409]);
 assert.equal((await call('/api/projects/HTTP-B/delivery/records')).data.total,0);const one=(await call(path)).data;assert.equal(one.total,1);version=one.projectVersion;
 const other=await call('/api/projects/HTTP-B/delivery/records/'+encodeURIComponent(one.rows[0].recordId));assert.equal(other.status,404);
 for(const [key] of deliveryPages){const r=await call('/api/projects/HTTP-A/delivery/modules/'+key);assert.ok([200,409].includes(r.status),key);assert.equal(r.data.data.projectId,'HTTP-A');assert.equal(r.data.data.projectionKey,'delivery');assert.equal(r.data.scheduleAuthorityReview.state,'missing');}
 const response=await fetch(base+'/api/projects/HTTP-A/evidence/uploads',{method:'POST',headers:{'content-type':'text/csv','x-source-filename':'Submittals.csv'},body:'Delivery Record Type,Record Reference,Description,Raised Date\n'+Array.from({length:63},(_,i)=>'submittal,S'+i+',Drawing '+i+',2031-08-01').join('\n')});assert.equal(response.status,201,await response.text());
 for(const [offset,size] of [[0,25],[25,25],[50,13]]){const r=await call(path+'?kind=submittal&limit=25&offset='+offset);assert.equal(r.data.total,63);assert.equal(r.data.rows.length,size);assert.equal(r.data.rows[0].reference,'S'+offset);assert.equal(r.data.rows[0].state,'extracted_candidate');}
 const programme=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tHTTP-A\t2031-08-31','%T\tTASK','%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt','%R\t1\t1\t1\tA1\tInstallation\tTK_NotStart\t2031-09-01\t2031-09-10\t80\t80\t16','%E'].join('\n');
 const adopted=await fetch(base+'/api/projects/HTTP-A/evidence/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'Current.xer','x-upload-intent':'replace_current_basis'},body:programme});assert.equal(adopted.status,201);
 const notices=(await call('/api/projects/HTTP-A/schedule/modules/notices-claims')).data.data;
 const commercial=(await call('/api/projects/HTTP-A/commercial/modules/commercial-claims-notices')).data.data;
 assert.equal(notices.eventCount,null);assert.equal(notices.noticeEventDateMissingCount,null);assert.equal(commercial.position.claimsNotices.noticeTimelinessCounts.event_date_missing,null);
 const exportResponse=await fetch(base+'/api/projects/HTTP-A/delivery/modules/delivery-submittals/report.xlsx');assert.equal(exportResponse.status,200);assert.match(exportResponse.headers.get('content-type')!,/spreadsheetml/);assert.ok((await exportResponse.arrayBuffer()).byteLength>1000);
 await g.close();g=await createProjectGateway(root,{maxWorkers:2});await start();assert.equal((await call(path+'?kind=submittal')).data.total,63);assert.equal((await call('/api/projects/HTTP-B/delivery/records')).data.total,0);
});
