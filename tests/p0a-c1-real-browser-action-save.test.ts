import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Cdp,chromeBinary,freePort,launchChrome,own,stop} from './real-browser-harness';

// P0-A / C1 real workflow. The real built server, a project uploaded through the
// real upload route, and real headless Chrome. The Actions required page and the
// Project review drawer are both open, so every action is rendered twice. Values
// typed in one copy are saved from that copy, the other copy holds different
// values, and the stored result is read back after a server restart.

const SERVER=join(__dirname,'../packages/runtime-api/src/project-gateway.js');
const PROJECT_ID='P0A-C1-BROWSER';
const DATA_DATE='2033-03-15';
function shiftDate(iso:string,days:number){const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function programmeXer(){
  const shifts=[['08:00','12:00'],['13:00','17:00']] as const;
  const intervals=shifts.map(([s,e],i)=>'(0||'+i+'(s|'+s+'|f|'+e+')())').join('');
  const days=[1,2,3,4,5,6,7].map(d=>'(0||'+d+'()('+(d>=2&&d<=6?intervals:'')+'))').join('');
  const calendar='(0||CalendarData()((0||DaysOfWeek()('+days+'))(0||Exceptions()())))'.replaceAll('(0||','\x7f\x7f  (0||');
  const lines=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+PROJECT_ID+'\t'+DATA_DATE,
    '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\t10\t1\t\tROOT\tMain Works',
    '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data','%R\tC1\tFive Day 8h\t8\t40\t'+calendar,
    '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct'];
  const count=12;
  for(let i=0;i<count;i++){
    const last=i===count-1,start=shiftDate(DATA_DATE,i*7),finish=shiftDate(DATA_DATE,i*7+6);
    lines.push(['%R',String(2000+i),'1','10','C1',last?'MS-FINISH':'ACT-'+(100+i),last?'Project Completion':'Works package '+(i+1),
      last?'TT_FinMile':'TT_Task','TK_NotStart',last?finish:start,finish,last?finish:start,finish,last?'0':'40',last?'0':'40','0','0'].join('\t'));
  }
  lines.push('%T\tTASKPRED','%F\ttask_pred_id\tproj_id\ttask_id\tpred_proj_id\tpred_task_id\tpred_type\tlag_hr_cnt');
  for(let i=1;i<count;i++)lines.push(['%R',String(7000+i),'1',String(2000+i),'1',String(1999+i),'PR_FS','0'].join('\t'));
  lines.push('%E');
  return lines.join('\n');
}

async function startServer(dataDir:string,port:number){
  const env:NodeJS.ProcessEnv={...process.env,CMENG_DATA_DIR:dataDir,PORT:String(port),HOST:'127.0.0.1'};
  for(const name of ['RAILWAY_VOLUME_MOUNT_PATH','NODE_TEST_CONTEXT','CMENG_PROJECT_WORKER','NODE_OPTIONS'])delete env[name];
  const child=own(spawn(process.execPath,[SERVER],{env,stdio:['ignore','pipe','pipe'],detached:true}));
  let log='';child.stdout!.on('data',d=>{log=(log+d).slice(-20000);});child.stderr!.on('data',d=>{log=(log+d).slice(-20000);});
  const deadline=Date.now()+60_000;
  for(;;){
    if(child.exitCode!==null)assert.fail('server exited during start: '+log.slice(-3000));
    try{const r=await fetch('http://127.0.0.1:'+port+'/health',{signal:AbortSignal.timeout(2000)});if(r.ok)return child;}catch{}
    if(Date.now()>deadline)assert.fail('server did not answer /health within 60 s: '+log.slice(-3000));
    await new Promise(r=>setTimeout(r,300));
  }
}
async function allActions(base:string){
  const out:any[]=[];
  for(let page=0;page<20;page++){
    const r=await fetch(base+'/api/projects/'+PROJECT_ID+'/actions?page='+page+'&pageSize=25&dataGapsPage=0&query=&category=all');
    assert.equal(r.status,200,'actions page failed');const data=await r.json() as any;
    out.push(...(data.actions||[]));if((page+1)*25>=(data.totalActionCount??data.actionCount??0)||!(data.actions||[]).length)break;
  }
  return out;
}
function collect(value:unknown,keyTest:RegExp,found:unknown[]=[],key=''):unknown[]{
  if(Array.isArray(value))value.forEach(v=>collect(v,keyTest,found,key));
  else if(value&&typeof value==='object')for(const [k,v] of Object.entries(value as Record<string,unknown>))collect(v,keyTest,found,k);
  else if(keyTest.test(key))found.push(value);
  return found;
}

test('C1 real browser: each save stores the copy the user edited, from the page or the drawer, and survives a restart',{timeout:900_000},async t=>{
  const binary=chromeBinary();
  if(!binary){
    if(process.env.CI)assert.fail('C1 real-browser test needs Chrome/Chromium: set CHROME_PATH or install /usr/bin/google-chrome.');
    t.skip('No Chrome/Chromium binary found (set CHROME_PATH); this test is mandatory on CI');return;
  }
  assert.ok(existsSync(SERVER),'built server missing: '+SERVER);
  const root=await mkdtemp(join(tmpdir(),'cmeng-p0a-c1-'));
  let server:ChildProcess|null=null,chrome:ChildProcess|null=null,cdp:Cdp|null=null;
  try{
    const port=await freePort(),base='http://127.0.0.1:'+port,dataDir=join(root,'data');
    server=await startServer(dataDir,port);
    const created=await fetch(base+'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:PROJECT_ID,testProject:false})});
    assert.equal(created.status,201,'project creation failed: '+await created.text());
    const xer=programmeXer();
    const up=await fetch(base+'/api/projects/'+PROJECT_ID+'/schedule/uploads',{method:'POST',body:Buffer.from(xer,'utf8'),signal:AbortSignal.timeout(180_000),
      headers:{'content-type':'text/plain','x-source-filename-encoded':'Programme_Update.xer','x-source-relative-path-encoded':'Programme_Update.xer','x-upload-id':'C1-0',
        'x-upload-intent':'add_update','x-evidence-category':'schedule','x-schedule-role':'update','x-schedule-role-confirmed':'1'}});
    assert.equal(up.status,201,'programme upload failed: '+(await up.text()).slice(0,800));

    // The project must offer the action kinds this test exercises.
    const before=await allActions(base);
    const valueAction=before.find(a=>a.target?.kind==='contract-value'),daysAction=before.find(a=>a.target?.kind==='approved-eot-days');
    const assignAction=before.find(a=>a.category!=='information'&&a.id!==valueAction?.id&&a.id!==daysAction?.id);
    assert.ok(valueAction,'no contract-value input action: '+before.map(a=>a.target?.kind).join(','));
    assert.ok(daysAction,'no approved-EOT-days input action');
    assert.ok(assignAction,'no other open action to assign');

    const launched=await launchChrome(binary,join(root,'chrome-profile'));chrome=launched.child;
    cdp=await Cdp.connect(launched.url);
    const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:true});
    const send=(method:string,params:Record<string,unknown>={},timeoutMs?:number)=>cdp!.send(method,params,sessionId,timeoutMs);
    const posts:Array<{path:string;body:any}>=[];const inflight=new Set<string>();let lastNetwork=Date.now();const pageErrors:string[]=[];
    cdp.on((method,params,sid)=>{
      if(sid!==sessionId)return;
      if(method==='Network.requestWillBeSent'){inflight.add(params.requestId);lastNetwork=Date.now();
        const url=new URL(params.request.url);
        if(params.request.method==='POST'&&url.pathname.startsWith('/api/projects/'+PROJECT_ID+'/actions/')){
          let body:any=null;try{body=JSON.parse(params.request.postData??'null');}catch{}posts.push({path:url.pathname,body});}}
      else if(method==='Network.loadingFinished'||method==='Network.loadingFailed'){inflight.delete(params.requestId);lastNetwork=Date.now();}
      else if(method==='Runtime.exceptionThrown')pageErrors.push(String(params.exceptionDetails?.exception?.description??params.exceptionDetails?.text).slice(0,300));
    });
    await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
    const evaluate=async(expression:string)=>{
      const reply=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},90_000);
      if(reply.exceptionDetails)throw new Error('page script failed: '+(reply.exceptionDetails.exception?.description??reply.exceptionDetails.text));
      return reply.result.value;
    };
    const settle=async(ready:string,label:string)=>{
      const until=Date.now()+120_000;
      for(;;){
        const ok=await evaluate('(()=>{try{return !!('+ready+')}catch{return false}})()').catch(()=>false);
        if(ok&&inflight.size===0&&Date.now()-lastNetwork>700)return;
        if(Date.now()>until)throw new Error(label+' did not settle within 120 s');
        await new Promise(r=>setTimeout(r,250));
      }
    };
    const block=(panel:string,id:string)=>'document.querySelector("#'+panel+' [data-action-id=\\""+CSS.escape('+JSON.stringify(id)+')+"\\"]")';
    const setValue=(panel:string,id:string,selector:string,value:string)=>evaluate('(()=>{const n='+block(panel,id)+'?.querySelector('+JSON.stringify(selector)+');if(!n)return false;n.value='+JSON.stringify(value)+';n.dispatchEvent(new Event("input",{bubbles:true}));return true;})()');
    const click=(panel:string,id:string,selector:string)=>evaluate('(()=>{const n='+block(panel,id)+'?.querySelector('+JSON.stringify(selector)+');if(!n)return false;n.click();return true;})()');
    const bothCopies=async(id:string)=>{
      await settle(block('projectActionPanel',id)+'&&'+block('projectReviewPanel',id),'both copies of '+id);
      // The precondition of C1: the drawer copy comes first in the document.
      const order=await evaluate('(()=>{const all=[...document.querySelectorAll("[data-action-id=\\""+CSS.escape('+JSON.stringify(id)+')+"\\"]")];return all.map(n=>n.closest("#projectReviewPanel")?"drawer":n.closest("#projectActionPanel")?"page":"other:"+n.tagName+"."+n.className+"@"+(()=>{const c=[];let x=n.parentElement;while(x&&c.length<7){c.push(x.tagName+(x.id?"#"+x.id:"")+(typeof x.className==="string"&&x.className?"."+x.className.split(" ")[0]:""));x=x.parentElement;}return c.join("<");})());})()') as string[];
      const blocks=order.filter(o=>!o.startsWith('other:')||/ARTICLE/.test(o));
      assert.deepEqual(blocks,['drawer','page'],'expected the action block rendered in the drawer and then the page, got '+order.join(','));
    };

    await send('Page.navigate',{url:base+'/?view=project&project='+encodeURIComponent(PROJECT_ID)+'&module=source-quality'});
    await settle('document.querySelector("#projectActionPanel [data-action-id]")','Actions required page');
    await evaluate('document.getElementById("openProjectActions").click()');
    await settle('document.querySelector("#projectReviewPanel [data-action-id]")','Project review drawer');

    // 1. Typed contract value, saved from the page copy (the second copy in the document).
    await bothCopies(valueAction.id);
    assert.ok(await setValue('projectActionPanel',valueAction.id,'.action-missing-amount','12345678'));
    assert.ok(await setValue('projectActionPanel',valueAction.id,'.action-missing-currency','SAR'));
    assert.ok(await setValue('projectReviewPanel',valueAction.id,'.action-missing-amount','87654321'));
    assert.ok(await setValue('projectReviewPanel',valueAction.id,'.action-missing-currency','AED'));
    assert.ok(await click('projectActionPanel',valueAction.id,'[data-resolve-missing-value]'));
    await settle('!'+block('projectActionPanel',valueAction.id),'contract value saved');

    // 2. Approved EOT days, saved from the drawer copy.
    await bothCopies(daysAction.id);
    assert.ok(await setValue('projectActionPanel',daysAction.id,'.action-missing-days','41'));
    assert.ok(await setValue('projectReviewPanel',daysAction.id,'.action-missing-days','97'));
    assert.ok(await click('projectReviewPanel',daysAction.id,'[data-resolve-missing-value]'));
    await settle('!'+block('projectReviewPanel',daysAction.id),'EOT days saved');

    // 3. Owner and due date: once from the page copy, then again from the drawer copy.
    await bothCopies(assignAction.id);
    assert.ok(await setValue('projectActionPanel',assignAction.id,'.action-assign-owner','Page Owner C1'));
    assert.ok(await setValue('projectReviewPanel',assignAction.id,'.action-assign-owner','Drawer Owner C1'));
    assert.ok(await click('projectActionPanel',assignAction.id,'[data-assign-save]'));
    await settle(block('projectActionPanel',assignAction.id)+'&&/Page Owner C1/.test('+block('projectActionPanel',assignAction.id)+'.innerText)','first owner saved');
    await bothCopies(assignAction.id);
    assert.ok(await setValue('projectActionPanel',assignAction.id,'.action-assign-owner','Page Owner Two'));
    assert.ok(await setValue('projectReviewPanel',assignAction.id,'.action-assign-owner','Drawer Owner Two'));
    assert.ok(await click('projectReviewPanel',assignAction.id,'[data-assign-save]'));
    await settle(block('projectReviewPanel',assignAction.id)+'&&/Drawer Owner Two/.test('+block('projectReviewPanel',assignAction.id)+'.innerText)','second owner saved');

    assert.deepEqual(pageErrors,[],'page errors: '+pageErrors.join(' | '));
    const bodyOf=(suffix:string,id:string)=>posts.filter(p=>p.path.endsWith(suffix)&&p.body?.actionId===id).map(p=>p.body);
    assert.deepEqual(bodyOf('/confirm-missing-value',valueAction.id).map(b=>b.amount+'|'+b.currency),['12345678|SAR'],'contract value request did not carry the page copy');
    assert.deepEqual(bodyOf('/confirm-missing-value',daysAction.id).map(b=>b.days),['97'],'EOT days request did not carry the drawer copy');
    assert.deepEqual(bodyOf('/assign',assignAction.id).map(b=>b.owner),['Page Owner C1','Drawer Owner Two'],'owner requests did not carry the clicked copy');

    // 4. Restart the server on the same data and read the stored decisions back.
    await stop(server);server=null;
    server=await startServer(dataDir,port);
    const after=await allActions(base);
    assert.equal(after.find(a=>a.id===assignAction.id)?.assignedOwner,'Drawer Owner Two','owner after restart');
    assert.ok(!after.some(a=>a.target?.kind==='contract-value'),'contract value input is open again after restart');
    assert.ok(!after.some(a=>a.target?.kind==='approved-eot-days'),'approved EOT days input is open again after restart');
    const pages:string[]=[];
    for(const path of ['overview','commercial/modules/contract-particulars-bonds','schedule/modules/eot-assessment']){
      const r=await fetch(base+'/api/projects/'+PROJECT_ID+'/'+path);pages.push(await r.text());
    }
    const all=pages.join('\n');
    assert.match(all,/12345678/,'the saved contract value is not on any page after restart');
    assert.doesNotMatch(all,/87654321/,'the other copy\'s contract value was stored');
    const eotDays=collect(pages.map(p=>{try{return JSON.parse(p);}catch{return null;}}),/approved.*days|ApprovedEotDays/i).filter(v=>typeof v==='number');
    assert.ok(eotDays.includes(97),'approved EOT days 97 not stored; found '+JSON.stringify(eotDays.slice(0,10)));
    assert.ok(!eotDays.includes(41),'the other copy\'s EOT days were stored');
  }finally{
    cdp?.close();await stop(chrome);await stop(server);
    await rm(root,{recursive:true,force:true}).catch(()=>{});
  }
});
