import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {AddressInfo} from 'node:net';
import {createCmengServer} from '../packages/runtime-api/src/server';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {projectFactsForState} from '../packages/runtime-api/src/project-facts';
import {deriveControlsFromCsv,combineDelayModels} from '../packages/runtime-api/src/evidence-control-adapters';

// F06: a project with two claims/EOT register files and a notice register, all
// uploaded through the real evidence upload path.
// (1) Every claims file of the current basis is read and merged by claim id: the
//     same id in two files is one claim, the later dated file's values win field
//     by field only where it states a value, and a conflict is listed as a query.
// (2) A notice register row that states the event it notifies (event id, or the
//     exact event title) and its date becomes a notice record linked to that
//     event, labelled with its source; a notice naming no event stays unlinked
//     and listed.
// Every expected value is written by hand from the fixture text below.

process.env.CMENG_OCR_ENABLED='0';

const CLAIMS='Claim ID,Event ID,Event,Notice Date,Days Claimed,Days Granted,Status,Responsibility\n'+
 'CLM-01,EV-01,Late site access,2026-03-05,10,6,Determined,Employer\n'+
 'CLM-02,EV-02,Design change to lobby,2026-04-12,8,,Submitted,Employer\n'+
 'CLM-03,EV-03,Utility diversion,2026-05-20,12,,Submitted,Employer\n'+
 'CLM-04,EV-04,Late permit,2026-06-02,9,,Submitted,Employer';
// A separate EOT register: CLM-03 and CLM-04 are also in the claims register.
// CLM-03 adds days granted (blank in the claims register): no conflict.
// CLM-04 states 11 days claimed where the claims register states 9: one conflict.
const EOT='Claim ID,Event ID,Event,Submitted Date,Days Claimed,Days Granted,Status\n'+
 'CLM-03,EV-03,Utility diversion,2026-05-28,12,7,Submitted\n'+
 'CLM-04,EV-04,Late permit,2026-06-10,11,,Submitted\n'+
 'CLM-05,EV-05,Additional scope instruction,2026-07-01,5,,Submitted\n'+
 'CLM-06,EV-06,Unforeseen ground conditions,2026-07-15,14,,Submitted';
const NOTICES='Notice Ref,Notice Date,Event ID,Subject\n'+
 'NTC-001,2026-03-01,EV-01,Notice of delay - late site access\n'+
 'NTC-002,2026-04-10,,Design change to lobby\n'+
 'NTC-003,2026-05-18,EV-03,Notice of delay - utility diversion\n'+
 'NTC-004,2026-06-20,,Notice of delay - general weather conditions\n'+
 'NTC-005,,EV-05,Notice of delay - additional scope';
// A notice document: one letter stating its reference, its date and the event it notifies.
const LETTER='PROJECT CORRESPONDENCE\nReference: LTR-NTC-006\nDate: 2026-07-20\nSubject: Notice of delay - unforeseen ground conditions\n\n'+
 'Dear Sir,\nWe give notice under Sub-Clause 20.2 of delay event EV-06, unforeseen ground conditions found in the basement excavation.\n';
const xer=(project:string)=>['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+project+'\t2026-08-31',
 '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\t10\t1\t\tW1\tWorks',
 '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt',
 '%R\t100\t1\t10\tA1\tWork\t2026-01-01\t2027-06-30\t80\t80','%E'].join('\n');

async function withServer(fn:(base:string)=>Promise<void>){
 const server=createCmengServer();
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',()=>resolve()));
 try{await fn('http://127.0.0.1:'+(server.address() as AddressInfo).port);}
 finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}
const pause=()=>new Promise(resolve=>setTimeout(resolve,15));
async function upload(base:string,project:string,filename:string,body:string){
 await pause();
 const response=await fetch(base+'/api/projects/'+project+'/evidence/uploads',{method:'POST',headers:{'content-type':/\.txt$/.test(filename)?'text/plain':'text/csv','x-source-filename':filename,'x-source-relative-path':'Uploads/'+filename},body});
 assert.equal(response.status,201,await response.clone().text());
 return await response.json() as {documentId:string;documentType:string};
}
async function page(base:string,project:string,area:string,key:string){
 const response=await fetch(base+'/api/projects/'+project+'/'+area+'/modules/'+key);
 assert.equal(response.status,200,key+': '+await response.clone().text());
 return (await response.json() as any).data;
}
async function claimsProject(base:string,project:string,files:Array<[string,string]>){
 const schedule=await fetch(base+'/api/projects/'+project+'/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'Current.xer','x-upload-intent':'replace_current_basis'},body:xer(project)});
 assert.equal(schedule.status,201,await schedule.clone().text());
 const uploaded=[];
 for(const [filename,body] of files)uploaded.push(await upload(base,project,filename,body));
 const state:any=runtimeProjects.get(project);
 for(const document of uploaded){
  const stored=state.evidenceDocuments.find((d:any)=>d.documentId===document.documentId);
  assert.ok(['active','additive'].includes(stored.basisState),stored.sourceFilename+' is part of the current basis ('+stored.documentType+', '+stored.familyKey+', '+stored.basisState+')');
 }
 return {state,uploaded};
}
const claimsPages=[['schedule','delay-claims'],['schedule','notices-claims'],['schedule','eot-assessment'],['commercial','commercial-claims-notices']] as const;

test('F06: two claims files and a notice register uploaded through the real path: union of claims, one conflict query, notices linked to their events',async()=>{
 await withServer(async base=>{
  const project='F06-CLAIMS-FILES-UPLOAD-ORDER';
  const {state,uploaded}=await claimsProject(base,project,[['Claims_Register.csv',CLAIMS],['EOT_Register.csv',EOT],['Notice_Register.csv',NOTICES],['Notice_Letter_EV06.txt',LETTER]]);

  const delay=await page(base,project,'schedule','delay-claims');
  const notices=await page(base,project,'schedule','notices-claims');
  // Claims: CLM-01..CLM-06 (union of both files), each once.
  assert.equal(delay.claimCount,6,'every claim of both files, each id once');
  assert.equal(notices.claimCount,6);
  const claim=(id:string)=>notices.claims.find((c:any)=>c.claimId===id);
  assert.deepEqual(notices.claims.map((c:any)=>c.claimId).sort(),['CLM-01','CLM-02','CLM-03','CLM-04','CLM-05','CLM-06']);
  assert.equal(claim('CLM-04').claimedDays,11,'the later file (EOT register) states 11 days for CLM-04');
  assert.equal(claim('CLM-03').claimedDays,12,'same value in both files: no conflict');
  const register=(id:string)=>notices.claimsReporting.reported.rows.find((row:any)=>row.claimId===id);
  assert.equal(register('CLM-03').assessedDays,7,'the EOT register states days granted where the claims register is blank');
  assert.equal(register('CLM-01').assessedDays,6,'a value only in the earlier file is kept (a later file never erases it)');
  assert.equal(register('CLM-04').claimedDays,11);
  assert.equal(claim('CLM-05').claimedDays,5,'a claim only in the EOT register is read');
  // Days: claimed 10+8+12+11+5+14 = 60; register granted 6+7 = 13.
  for(const [area,key] of claimsPages){
   const data=area==='schedule'&&key==='delay-claims'?delay:area==='schedule'&&key==='notices-claims'?notices:await page(base,project,area,key);
   const r=data.claimsReporting;
   assert.ok(r,key+' carries the claims register position');
   assert.equal(r.reported.recordCount,6,key+' claim count');
   assert.equal(r.reported.claimedDays.value,60,key+' claimed days');
   assert.equal(r.reported.assessedDays.value,13,key+' assessed days');
   assert.equal(r.sourceRecordQueries.length,1,key+' lists exactly one conflict query');
   const query=r.sourceRecordQueries[0];
   assert.equal(query.kind,'claim');assert.equal(query.recordId,'CLM-04');assert.equal(query.field,'days claimed');
   assert.deepEqual(query.values.map((v:any)=>[v.sourceFilename,v.value]),[['Claims_Register.csv','9'],['EOT_Register.csv','11']],key+' both stated values are kept in the query');
   assert.equal(query.usedValue,'11');assert.equal(query.orderBasis,'upload_order');
   assert.match(query.question,/CLM-04/);assert.match(query.question,/EOT_Register\.csv/);
   assert.ok(r.reported.conflictingRows.some((row:any)=>row.claimId==='CLM-04'),key+' the conflicting claim is listed with the register conflicts');
  }
  // Facts carry the same position and the query.
  const facts:any=projectFactsForState(state);
  assert.equal(facts.claims.pipeline.recordCount,6);
  assert.equal(facts.claims.pipeline.claimedDays,60);
  assert.equal(facts.claims.pipeline.assessedDays,13);
  assert.deepEqual(facts.claims.pipeline.sourceRecordQueries.map((q:any)=>[q.recordId,q.field,q.usedValue]),[['CLM-04','days claimed','11']]);

  // Notices: the claims register gives CLM-01..04 notices; the notice register gives NTC-001..005; the letter gives LTR-NTC-006.
  assert.equal(notices.noticeCount,10,'4 claims register notices, 5 notice register rows and 1 notice letter, none dropped');
  const eventRow=(id:string)=>delay.events.find((e:any)=>e.eventId===id);
  assert.deepEqual([...eventRow('EV-01').noticeIds].sort(),['CLM-01:notice','NTC-001'],'NTC-001 states EV-01 and its date');
  assert.deepEqual([...eventRow('EV-02').noticeIds].sort(),['CLM-02:notice','NTC-002'],'NTC-002 states the exact event title');
  assert.deepEqual([...eventRow('EV-03').noticeIds].sort(),['CLM-03:notice','NTC-003']);
  assert.ok(delay.events.every((e:any)=>!e.noticeIds.includes('NTC-005')),'NTC-005 states no date, so it is not linked');
  assert.deepEqual(eventRow('EV-06').noticeIds,['LTR-NTC-006'],'the notice letter states EV-06 and its date');
  assert.ok(delay.events.every((e:any)=>!e.noticeIds.includes('NTC-004')),'NTC-004 names no event');
  const ev01=notices.events.find((e:any)=>e.eventId==='EV-01');
  assert.equal(ev01.noticeId,'NTC-001','the earliest notice of EV-01 is the notice register letter (1 Mar 2026)');
  assert.equal(ev01.noticeIssuedAt,'2026-03-01');
  for(const [area,key] of claimsPages){
   const r=(area==='schedule'&&key==='delay-claims'?delay:area==='schedule'&&key==='notices-claims'?notices:await page(base,project,area,key)).claimsReporting;
   assert.deepEqual(r.unlinkedNotices.map((n:any)=>[n.noticeId,n.sourceFilename]).sort(),[['NTC-004','Notice_Register.csv'],['NTC-005','Notice_Register.csv']],key+' unlinked notices are listed with their source');
   assert.match(r.unlinkedNotices.find((n:any)=>n.noticeId==='NTC-004').reason,/names no event/);
   assert.match(r.unlinkedNotices.find((n:any)=>n.noticeId==='NTC-005').reason,/does not state its date/);
  }
  const model=state.controls.delayClaims;
  const ntc2=model.notices.find((n:any)=>n.noticeId==='NTC-002');
  assert.equal(ntc2.eventId,'EV-02');
  assert.equal(ntc2.noticeSource.linkBasis,'exact_event_title');
  assert.equal(ntc2.noticeSource.sourceFilename,'Notice_Register.csv','the notice is labelled with its source');
  assert.equal(model.notices.find((n:any)=>n.noticeId==='NTC-001').noticeSource.linkBasis,'event_id');
  const letter=model.notices.find((n:any)=>n.noticeId==='LTR-NTC-006');
  assert.equal(letter.eventId,'EV-06');assert.equal(letter.actualIssuedAt,'2026-07-20');
  assert.equal(letter.noticeSource.kind,'notice_document');assert.equal(letter.noticeSource.sourceFilename,'Notice_Letter_EV06.txt');

  // The second claims reader (per-document adapter, combined in file order) gives the same claims and query.
  const docs=uploaded.map(u=>state.evidenceDocuments.find((d:any)=>d.documentId===u.documentId));
  const adapter=docs.filter((d:any)=>/csv/i.test(d.mediaType)).map((d:any)=>deriveControlsFromCsv({state,document:d,bytes:readFileSync(d.storedPath)}).delayClaims).filter(Boolean)
   .reduce((combined:any,next:any)=>combineDelayModels(combined,next),null) as any;
  assert.deepEqual(adapter.claims.map((c:any)=>c.claimId).sort(),['CLM-01','CLM-02','CLM-03','CLM-04','CLM-05','CLM-06'],'second reader: union of both files');
  assert.equal(adapter.claims.find((c:any)=>c.claimId==='CLM-04').claimedDays,11);
  assert.equal(adapter.claims.find((c:any)=>c.claimId==='CLM-03').assessedDays,7);
  assert.equal(adapter.claims.reduce((sum:number,c:any)=>sum+c.claimedDays,0),60);
  assert.deepEqual(adapter.sourceRecordQueries.filter((q:any)=>q.kind==='claim').map((q:any)=>[q.recordId,q.usedValue]),[['CLM-04','11']]);
  assert.equal(adapter.notices.find((n:any)=>n.noticeId==='NTC-001').eventId,'EV-01','second reader links the notice too');
 });
});

test('F06: the later report date inside the files decides which value is used, not the upload order',async()=>{
 await withServer(async base=>{
  const project='F06-CLAIMS-FILES-REPORT-DATE';
  const dated=(text:string,day:string)=>text.split('\n').map((line,index)=>line+','+(index?day:'Report Date')).join('\n');
  // The claims register is uploaded first but states the later report date.
  await claimsProject(base,project,[['Claims_Register.csv',dated(CLAIMS,'2026-08-31')],['EOT_Register.csv',dated(EOT,'2026-07-31')]]);
  const notices=await page(base,project,'schedule','notices-claims');
  assert.equal(notices.claimCount,6);
  assert.equal(notices.claims.find((c:any)=>c.claimId==='CLM-04').claimedDays,9,'the claims register has the later report date (31 Aug 2026)');
  assert.equal(notices.claimsReporting.reported.rows.find((row:any)=>row.claimId==='CLM-03').assessedDays,7,'a value stated only in the earlier dated file is still used');
  const r=notices.claimsReporting;
  assert.equal(r.reported.claimedDays.value,58);
  assert.equal(r.sourceRecordQueries.length,1,'the differing report dates are not a query; CLM-04 is');
  assert.equal(r.sourceRecordQueries[0].usedValue,'9');
  assert.equal(r.sourceRecordQueries[0].orderBasis,'report_date');
  assert.deepEqual(r.sourceRecordQueries[0].values.map((v:any)=>[v.sourceFilename,v.value]),[['EOT_Register.csv','11'],['Claims_Register.csv','9']]);
 });
});

test('F06: a notice register alone does not establish a claims population (counts stay unknown, never 0)',async()=>{
 await withServer(async base=>{
  const project='F06-NOTICE-REGISTER-ONLY';
  await claimsProject(base,project,[['Notice_Register.csv',NOTICES]]);
  const delay=await page(base,project,'schedule','delay-claims'),notices=await page(base,project,'schedule','notices-claims');
  assert.equal(delay.claimCount,null);assert.equal(notices.claimCount,null);assert.equal(notices.eventCount,null);
  assert.equal(runtimeProjects.get(project)!.controls.delayClaims,null,'no claims or event population is invented from notices');
 });
});
