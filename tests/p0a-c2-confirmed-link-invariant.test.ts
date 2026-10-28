import test from 'node:test';
import assert from 'node:assert/strict';
import {type ChildProcess} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {freePort,smallProgrammeXer,startBuiltServer,stop} from './real-browser-harness';
import {sourceCommercialEvidence} from '../packages/runtime-api/src/source-commercial-evidence';
import {linkEntityFingerprint} from '../packages/runtime-api/src/link-candidate-core';
import type {ProjectRuntimeState} from '../packages/runtime-api/src/project-state-types';

// P0-A / C2 invariant. A confirmed relationship stays valid through every
// unrelated write (owner, decision, typed value, unrelated upload, identical
// re-upload) and a restart. It becomes stale only when its own source record or
// its own target record changes, and then only that relationship does.

const PROJECT='P0A-C2-LINKS',DATA_DATE='2033-03-15';
const names=(i:number)=>'Works package '+(i+1);
const boqCsv=(secondDescription:string)=>'Item No,Description,Unit,Quantity,Rate,Amount,Currency\n'+
  '1.1,Concrete to raft slab for activity ACT-101,m3,100,50,5000,SAR\n'+
  '1.2,'+secondDescription+',m2,200,20,4000,SAR\n'+
  '1.3,General attendance,item,1,1000,1000,SAR\n';
const rfiCsv='RFI No,Subject,Raised Date,Status,Due Date\nRFI-001,Slab levels,2033-03-01,Open,2033-03-20\n';

test('C2 real server: confirmed links survive unrelated writes and a restart, and go stale only when their own records change',{timeout:900_000},async()=>{
  const root=await mkdtemp(join(tmpdir(),'cmeng-p0a-c2-'));
  let server:ChildProcess|null=null;
  // Rule-based exact references only: no AI provider is configured, so no paid call can happen.
  const env={CMENG_AI_FOR_ALL_VISITORS:'1',CMENG_ASK_AI_API_KEY:undefined,CMENG_ASK_AI_CONFIG_FILE:undefined};
  try{
    const port=await freePort(),base='http://127.0.0.1:'+port+'/api/projects/'+PROJECT,dataDir=join(root,'data');
    server=await startBuiltServer(dataDir,port,env);
    const json=async(r:Response)=>{const text=await r.text();try{return JSON.parse(text);}catch{return {raw:text};}};
    const created=await fetch('http://127.0.0.1:'+port+'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:PROJECT,testProject:false})});
    assert.equal(created.status,201,'project creation failed');
    let uploads=0;
    const upload=async(route:string,name:string,body:string,headers:Record<string,string>)=>{
      const r=await fetch(base+route,{method:'POST',body:Buffer.from(body,'utf8'),signal:AbortSignal.timeout(180_000),
        headers:{'x-source-filename-encoded':encodeURIComponent(name),'x-source-relative-path-encoded':encodeURIComponent(name),'x-upload-id':'C2-'+(uploads++),...headers}});
      assert.equal(r.status,201,name+' upload failed: '+JSON.stringify(await json(r)).slice(0,600));
    };
    const programme=(rename:(i:number)=>string,name:string,dataDate=DATA_DATE)=>upload('/schedule/uploads',name,smallProgrammeXer(PROJECT,dataDate,rename),
      {'content-type':'text/plain','x-upload-intent':'add_update','x-evidence-category':'schedule','x-schedule-role':'update','x-schedule-role-confirmed':'1'});
    const evidence=(name:string,body:string,intent='add_update')=>upload('/evidence/uploads',name,body,{'content-type':'text/csv','x-upload-intent':intent});
    await programme(names,'Programme_U01.xer');
    await evidence('BOQ_Main.csv',boqCsv('Formwork to raft edges for activity ACT-102'));

    const version=async()=>(await json(await fetch(base+'/link-candidates?kind=boq_activity'))).projectVersion as number;
    const listing=async()=>json(await fetch(base+'/link-candidates?kind=boq_activity'));
    const start=await listing();
    const source=(itemNumber:string)=>start.sourceOptions.find((s:any)=>s.reference===itemNumber);
    assert.ok(source('1.1')&&source('1.2'),'BOQ items are not offered as link sources: '+JSON.stringify(start).slice(0,600));
    const confirmLink=async(itemNumber:string,activityId:string)=>{
      const offered=await json(await fetch(base+'/link-candidates/suggest',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({kind:'boq_activity',sourceId:source(itemNumber).id,expectedVersion:await version()})}));
      const row=(offered.rows??[]).find((r:any)=>r.targetId===activityId);
      assert.ok(row,'no exact-reference candidate for '+itemNumber+': '+JSON.stringify(offered).slice(0,600));
      const reviewed=await fetch(base+'/link-candidates/review',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({id:row.id,expectedVersion:await version(),decision:'confirm',confirmed:true,reviewer:'C2 invariant reviewer'})});
      assert.equal(reviewed.status,200,'review failed: '+JSON.stringify(await json(reviewed)).slice(0,400));
      return row.id as string;
    };
    const linkA=await confirmLink('1.1','ACT-101'),linkB=await confirmLink('1.2','ACT-102');
    const currentOf=async()=>{const all:any[]=[];let offset=0;for(;;){const page=await json(await fetch(base+'/link-candidates?kind=boq_activity&offset='+offset));all.push(...page.rows);if(!page.hasMore)break;offset+=25;}
      return Object.fromEntries(all.filter(r=>r.state==='confirmed').map(r=>[r.id,r.current]));};
    const expectCurrent=async(step:string,a:boolean,b:boolean)=>{const c=await currentOf();assert.equal(c[linkA],a,step+': link 1.1 -> ACT-101');assert.equal(c[linkB],b,step+': link 1.2 -> ACT-102');};
    await expectCurrent('after confirming',true,true);

    // Unrelated writes. Each raises the project version; none touches the two linked records.
    const actions=(await json(await fetch(base+'/actions?page=0&pageSize=25&dataGapsPage=0&query=&category=all'))).actions as any[];
    const open=actions.find(a=>a.category!==undefined&&a.target?.kind!=='approved-eot-days');
    assert.ok(open,'no open action to assign');
    let r=await fetch(base+'/actions/assign',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedVersion:await version(),actionId:open.id,owner:'Planning lead',dueIso:'2033-04-01'})});
    assert.equal(r.status,200,'owner assignment failed');
    await expectCurrent('after an owner assignment',true,true);
    const days=actions.find(a=>a.target?.kind==='approved-eot-days');
    if(days){
      r=await fetch(base+'/actions/confirm-missing-value',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedVersion:await version(),actionId:days.id,days:'0'})});
      assert.equal(r.status,200,'typed value failed');
      await expectCurrent('after a typed value',true,true);
    }
    await evidence('RFI_Register.csv',rfiCsv);
    await expectCurrent('after an unrelated upload',true,true);
    await evidence('BOQ_Main.csv',boqCsv('Formwork to raft edges for activity ACT-102'));
    await expectCurrent('after re-uploading the identical BOQ',true,true);

    // Restart on the same data.
    await stop(server);server=null;server=await startBuiltServer(dataDir,port,env);
    await expectCurrent('after a restart',true,true);

    // The target of link A changes: only link A goes stale.
    // A later update becomes the current programme; its ACT-101 has a new name.
    await programme(i=>i===1?'Works package 2 resequenced pour':names(i),'Programme_U02.xer','2033-04-15');
    await expectCurrent('after ACT-101 is renamed in a new programme',false,true);
    // The source of link B changes (the revised BOQ replaces the current one): link B goes stale too.
    await evidence('BOQ_Main_Rev1.csv',boqCsv('Formwork to raft edges and kickers for activity ACT-102'),'replace_current_basis');
    const final=await currentOf();
    assert.equal(final[linkB],false,'link 1.2 -> ACT-102 must go stale when its BOQ item changes');
  }finally{
    await stop(server);await rm(root,{recursive:true,force:true}).catch(()=>{});
  }
});

test('C2 payment relationship: a version change alone keeps it; a changed certificate or payment makes it stale',()=>{
  const money=(value:number|null)=>({value,currency:'AED',taxBasis:'exclusive',sourceRefs:[]});
  const certificate=(amount:number)=>({paymentId:'IPC-03',periodEnd:'2026-07-31',sourceStatus:'Certified',certificationDate:'2026-08-01',paymentDate:null,paymentReference:null,receipt:{documentId:'certdoc',locator:'row:1'},amounts:{netCertifiedAmount:money(amount),grossCertifiedAmount:money(amount),employerCertifiedAmount:money(null),paidAmount:money(null)}});
  const receipt={paymentId:'BANK-42',periodEnd:null,sourceStatus:'Paid',certificationDate:null,paymentDate:'2026-08-20',paymentReference:'Bank transfer 42',receipt:{documentId:'paydoc',locator:'row:2'},amounts:{netCertifiedAmount:money(null),grossCertifiedAmount:money(null),employerCertifiedAmount:money(null),paidAmount:money(100)}};
  const position:any={certificateProfile:{groups:[]},currencies:[]};
  // A legacy relationship (saved before fingerprints) is read whatever the project version is.
  const legacy={projectId:'P',version:40,evidenceDocuments:[],controls:{},linkCandidateReviews:[{id:'l',kind:'payment_certificate',state:'confirmed',basisVersion:3,sourceId:'paydoc:row:2',targetId:'certdoc:row:1'}]} as unknown as ProjectRuntimeState;
  const linked=sourceCommercialEvidence(legacy,{payments:[certificate(100),receipt],bonds:[]},position,'2026-08-31').paymentLinkage;
  assert.equal(linked.linked,1,'a later project version must not drop a confirmed payment relationship');
  // The fingerprint itself changes when the certificate's own content changes.
  const e=(amount:number)=>({id:'certdoc:row:1',projectId:'P',reference:'IPC-03',description:'Certified',currency:'AED',amount,dateIso:'2026-08-01',certified:true,sourceRefs:['certdoc:row:1']});
  assert.equal(linkEntityFingerprint('payment_certificate',e(100)),linkEntityFingerprint('payment_certificate',{...e(100),sourceRefs:['other-file:row:9']}),'re-reading the same record (new file or row) keeps the relationship');
  assert.notEqual(linkEntityFingerprint('payment_certificate',e(100)),linkEntityFingerprint('payment_certificate',e(120)),'a changed certified amount must change the binding');
});
