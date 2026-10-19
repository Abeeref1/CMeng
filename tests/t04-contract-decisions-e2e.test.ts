import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';

// T04 end to end: real uploads, the real decision route, the real pages.
// A main contract and an undated amendment state different retention and
// completion dates (applicability unsure). The user decides through
// confirm-review; every page reads the decision; undo restores the source state.
const pdf=async(lines:string[])=>{
  const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([595,842]).drawText(lines.join('\n'),{x:45,y:790,size:10,font,lineHeight:22,maxWidth:505});
  return Buffer.from(await doc.save());
};
const xer=(project:string,date:string)=>['ERMHDR\t23.12',
  '%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+project+'\t'+date,
  '%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt',
  '%R\t1\t1\tA1\tMain works\t2031-01-01\t2031-12-31\t80\t80','%E'].join('\n');

test('T04 end to end: upload contracts, decide through the route, every page reads the decision, undo restores',async t=>{
  const root=mkdtempSync(join(tmpdir(),'t04-contract-e2e-'));const gateway=await createProjectGateway(root,{maxWorkers:1});
  t.after(async()=>{await gateway.close();rmSync(root,{recursive:true,force:true});});
  await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+(gateway.server.address() as any).port;
  const P='E2E-CF',api='/api/projects/'+P;
  const post=(path:string,body:any)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const text=async(path:string)=>{const r=await fetch(base+path);assert.equal(r.status,200,path+' '+r.status);return await r.text();};
  const workflow=async()=>JSON.parse(await text(api+'/actions')) as any;
  const find=(w:any,id:string)=>[...w.actions,...(w.information??[])].find((a:any)=>a.id===id);
  assert.equal((await post('/api/projects',{projectId:P})).status,201);
  const upload=async(name:string,role:string,lines:string[])=>{
    const r=await fetch(base+api+'/contract/uploads',{method:'POST',headers:{'content-type':'application/pdf','x-source-filename-encoded':encodeURIComponent(name),'x-source-relative-path-encoded':encodeURIComponent(name),'x-contract-role':role},body:await pdf(lines)});
    assert.equal(r.status,201,name+' upload: '+(await r.text()).slice(0,400));
  };
  await upload('Main_Contract.pdf','main',['Contract Data','Date for Completion: 2031-12-31','Retention percentage: 5%']);
  await upload('Contract_Amendment_1.pdf','amendment',['Contract Amendment No. AM-01','Revised Date for Completion: 2032-03-31','Retention percentage: 10%']);
  assert.equal((await fetch(base+api+'/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'Current programme.xer','x-upload-intent':'add_update','x-schedule-role':'update','x-schedule-role-confirmed':'1'},body:xer('2031-06-30','Current programme')})).status,201);

  const pages=[api+'/commercial/modules/contract-particulars-bonds',api+'/commercial/modules/contract-particulars-bonds/report.json',api+'/schedule/modules/eot-assessment'];
  const termRef='user-confirmation:contract-fact:retentionPercent:',completionRef='user-confirmation:contract-fact:contractualCompletion:';
  for(const page of pages){const body=await text(page);assert.ok(!body.includes(termRef)&&!body.includes(completionRef),'no decision reference before a decision: '+page);}

  let w=await workflow();
  const retention=find(w,'matter:contract-fact:retentionPercent'),completion=find(w,'matter:contract-fact:contractualCompletion');
  const seen=JSON.stringify([...w.actions,...(w.information??[])].map((a:any)=>a.id));
  assert.ok(retention,'retention decision offered; decisions seen: '+seen);
  assert.ok(completion,'completion decision offered; decisions seen: '+seen);
  assert.ok(retention.target.reviewOptions.some((o:any)=>o.value==='use:10|%'),JSON.stringify(retention.target.reviewOptions));
  assert.ok(completion.target.reviewOptions.some((o:any)=>o.value==='use:2032-03-31'),JSON.stringify(completion.target.reviewOptions));

  // Decide both through the route.
  let r=await post(api+'/actions/confirm-review',{expectedVersion:w.projectVersion,actionId:retention.id,sourceFingerprint:retention.reviewFingerprint,choice:'use:10|%'});
  assert.equal(r.status,200,'retention decision saved: '+(await r.clone().text()).slice(0,300));
  const staleVersion=w.projectVersion;
  w=await workflow();
  r=await post(api+'/actions/confirm-review',{expectedVersion:w.projectVersion,actionId:completion.id,sourceFingerprint:completion.reviewFingerprint,choice:'use:2032-03-31'});
  assert.equal(r.status,200,'completion decision saved: '+(await r.clone().text()).slice(0,300));
  // A stale version is refused and changes nothing.
  r=await post(api+'/actions/confirm-review',{expectedVersion:staleVersion,actionId:retention.id,sourceFingerprint:retention.reviewFingerprint,choice:'undo'});
  assert.equal(r.status,409,'stale version refused');

  // Every page reads the decided values.
  w=await workflow();
  assert.equal(find(w,retention.id)?.target.reviewChoice,'use:10|%','saved decision shown and reachable');
  assert.equal(find(w,completion.id)?.target.reviewChoice,'use:2032-03-31');
  const bonds=await text(pages[0]!),report=await text(pages[1]!),eot=await text(pages[2]!);
  assert.ok(bonds.includes(termRef),'contract particulars page reads the decided retention');
  assert.ok(report.includes(termRef),'the download carries the decided retention');
  assert.ok(eot.includes(completionRef)&&eot.includes('2032-03-31'),'EOT page reads the decided completion date');

  // Undo both: the source state returns on every page.
  for(const id of [retention.id,completion.id]){
    w=await workflow();const item=find(w,id);
    r=await post(api+'/actions/confirm-review',{expectedVersion:w.projectVersion,actionId:id,sourceFingerprint:item.reviewFingerprint,choice:'undo'});
    assert.equal(r.status,200,'undo '+id+': '+(await r.clone().text()).slice(0,300));
  }
  for(const page of pages){const body=await text(page);assert.ok(!body.includes(termRef)&&!body.includes(completionRef),'undo restores the source reading: '+page);}
  w=await workflow();
  assert.equal(find(w,retention.id)?.category,'confirmation','the retention decision is open again');
  assert.equal(find(w,completion.id)?.category,'confirmation','the completion decision is open again');
});
