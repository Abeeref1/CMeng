import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {generateCommercialFeatureBlindProject,generateDelayFeatureBlindProject,generateDeliveryFeatureBlindProject} from './blind-project-generator';
import {deliveryScript} from '../packages/runtime-api/src/ui-delivery';

// R15 c5-l3 (guard L3: no page with more than 15 tables or over 20 screens when every
// collapsed section is opened). Opened detail stays short and nothing is removed:
// (a) a table of more than 25 rows inside collapsed detail shows 25 rows at a time,
//     says "Showing rows 1–25 of N", keeps all N rows, and Previous / Next reach every row once;
// (b) blocks of the same kind side by side in collapsed detail (the same ledger for each
//     register, the same table for each period, the two lists of record groups) share one
//     selector: one block is shown, every other one is one click away, every name is on screen;
// (c) the first screen is unchanged: no pager or selector is visible before a section opens;
// (d) the opened Payments, Cost Outlook and Contract pages hold no more than 15 tables;
// (e) an empty delivery record set says "None in this set." with nothing to open;
// (f) a More detail that would still pass the limit is read on detail pages: on the
//     Dashboard of each blind kind (commercial, delay, delivery) every detail page, opened,
//     is at most 20 screens and 15 tables, the list names every group on every page, each
//     group is on exactly one page, the text of all pages together equals the text of the
//     unpaged detail, a deep link opens the page that holds it, and print shows every group.
// The real built server, blind projects uploaded through the real upload route and a real
// headless Chrome over the DevTools Protocol (the same plumbing as F01).

const SERVER=join(__dirname,'../packages/runtime-api/src/project-gateway.js');
const PROJECT_ID='R15-C5-L3-OPENED';
const KINDS:[string,(seed:string,index?:number)=>Promise<{documents:{filename:string;mediaType:string;bytes:Uint8Array}[]}>][]=[
  [PROJECT_ID,generateCommercialFeatureBlindProject],['R15-C5-L3-DELAY',generateDelayFeatureBlindProject],['R15-C5-L3-DELIVERY',generateDeliveryFeatureBlindProject]];
const PAGE_TIMEOUT_MS=120_000;
const PAGES=['payments','cost-forecast','contract-particulars-bonds','master-dashboard'];
const TABLE_LIMITED=new Set(['payments','cost-forecast','contract-particulars-bonds']);

async function freePort(){
  return new Promise<number>((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const port=(s.address() as any).port;s.close(()=>resolve(port));});});
}
function own(child:ChildProcess){
  const pid=child.pid;if(pid!==undefined)process.once('exit',()=>{try{process.kill(-pid,'SIGKILL');}catch{}});
  return child;
}
function stop(child:ChildProcess|null){
  if(!child||child.pid===undefined||child.exitCode!==null||child.signalCode!==null)return Promise.resolve();
  const signal=(name:NodeJS.Signals)=>{try{process.kill(-child.pid!,name);}catch{try{child.kill(name);}catch{}}};
  return new Promise<void>(resolve=>{
    const timer=setTimeout(()=>{signal('SIGKILL');resolve();},8000);
    child.once('exit',()=>{clearTimeout(timer);signal('SIGKILL');resolve();});
    signal('SIGTERM');
  });
}
function chromeBinary(){
  if(process.env.CHROME_PATH)return existsSync(process.env.CHROME_PATH)?process.env.CHROME_PATH:null;
  if(existsSync('/usr/bin/google-chrome'))return '/usr/bin/google-chrome';
  const root='/opt/pw-browsers';
  if(existsSync(root))for(const dir of readdirSync(root).filter(d=>/^chromium-\d+$/.test(d)).sort().reverse()){
    const candidate=join(root,dir,'chrome-linux','chrome');if(existsSync(candidate))return candidate;}
  return null;
}
class Cdp{
  private next=1;private pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void}>();
  constructor(private socket:WebSocket){
    socket.addEventListener('message',event=>{
      const message=JSON.parse(String((event as MessageEvent).data));
      if(!message.id)return;
      const waiter=this.pending.get(message.id);if(!waiter)return;this.pending.delete(message.id);
      if(message.error)waiter.reject(new Error(message.error.message));else waiter.resolve(message.result);
    });
    socket.addEventListener('close',()=>{for(const waiter of this.pending.values())waiter.reject(new Error('DevTools socket closed'));this.pending.clear();});
  }
  static async connect(url:string){
    const socket=new WebSocket(url);
    await new Promise<void>((resolve,reject)=>{socket.addEventListener('open',()=>resolve());socket.addEventListener('error',()=>reject(new Error('DevTools connection failed '+url)));});
    return new Cdp(socket);
  }
  send(method:string,params:Record<string,unknown>={},sessionId?:string,timeoutMs=60_000):Promise<any>{
    const id=this.next++;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('DevTools '+method+' timed out'));},timeoutMs);
      this.pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});
      this.socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
    });
  }
  close(){try{this.socket.close();}catch{}}
}
async function launchChrome(binary:string,profile:string){
  const child=own(spawn(binary,['--headless=new','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--no-sandbox','--disable-gpu',
    '--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking',
    '--window-size=1366,768','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe'],detached:true}));
  const kill=()=>{try{process.kill(-child.pid!,'SIGKILL');}catch{try{child.kill('SIGKILL');}catch{}}};
  const url=await new Promise<string>((resolve,reject)=>{
    let log='',done=false;
    const finish=(error:Error|null,value?:string)=>{if(done)return;done=true;clearTimeout(timer);clearInterval(poll);
      if(error){kill();child.stderr?.destroy();reject(error);}else resolve(value!);};
    const timer=setTimeout(()=>finish(new Error('Chrome did not start within 120 s: '+log.slice(-2000))),120_000);
    const poll=setInterval(()=>{try{const [port,path]=readFileSync(join(profile,'DevToolsActivePort'),'utf8').split('\n');
      if(port&&path)finish(null,'ws://127.0.0.1:'+port.trim()+path.trim());}catch{}},250);
    child.stderr!.on('data',d=>{log=(log+d).slice(-20000);const m=/DevTools listening on (ws:\/\/\S+)/.exec(log);if(m)finish(null,m[1]!);});
    child.once('exit',code=>finish(new Error('Chrome exited '+code+': '+log.slice(-2000))));
  });
  return {child,url};
}

// Runs in the page: the default view first, then every collapsed section opened as the guard does.
const READ_PAGE=String.raw`(async()=>{
  // Content of a closed section keeps its layout box in Chrome, so visibility is read with checkVisibility.
  const root=document.getElementById('moduleContent'),shown=e=>!!(e&&(typeof e.checkVisibility==='function'?e.checkVisibility():e.offsetParent));
  const result={key:currentModuleResult?.key,problems:[],picks:[],pagers:[]};
  const fail=text=>result.problems.push(text);
  // (c) the first screen: nothing the compact layout adds is visible before a section opens.
  result.defaultVisible=[...root.querySelectorAll('[data-table-pager],[data-page-kind-pick]')].filter(shown).length;
  for(let round=0;round<4;round++){root.querySelectorAll('details:not([open])').forEach(d=>{d.open=true;});await new Promise(r=>setTimeout(r,300));}
  result.tables=[...root.querySelectorAll('table')].filter(shown).length;
  result.height=root.scrollHeight;
  // Selectors and pagers are checked on every group: detail pages, if any, are shown together.
  const every=[...root.querySelectorAll('[data-detail-pager] .page-detail-pager-bar button')].find(b=>b.textContent==='Show all detail pages');
  if(every){every.click();for(let round=0;round<4;round++){root.querySelectorAll('details:not([open])').forEach(d=>{d.open=true;});await new Promise(r=>setTimeout(r,300));}}
  // (b) one selector per set of blocks of the same kind.
  for(const pick of root.querySelectorAll('[data-page-kind-pick]')){
    const members=[];
    for(let node=pick.nextElementSibling;node&&!node.matches('[data-page-kind-pick]');node=node.nextElementSibling)if(node.__pageKindShow)members.push(node);
    const buttons=[...pick.querySelectorAll('button.page-kind-option')],select=pick.querySelector('select');
    const labels=buttons.length?buttons.map(b=>b.textContent):[...(select?.options||[])].map(o=>o.textContent);
    result.picks.push(labels);
    if(members.length<2)fail('selector with '+members.length+' block: '+labels.join(' | '));
    if(labels.length!==members.length)fail('selector names '+labels.length+' of '+members.length+' blocks: '+labels.join(' | '));
    if(members.filter(shown).length!==1)fail('selector shows '+members.filter(shown).length+' blocks at once: '+labels.join(' | '));
    if(buttons.length&&!buttons.every(shown))fail('a block name is not on the screen: '+labels.join(' | '));
    const first=members.findIndex(shown);
    members.forEach((member,index)=>{
      if(buttons.length)buttons[index].click();else{select.value=String(index);select.dispatchEvent(new Event('change'));}
      if(!shown(member)||members.some((other,i)=>i!==index&&shown(other)))fail('choosing "'+labels[index]+'" does not show that block alone');
    });
    if(first>=0){if(buttons.length)buttons[first].click();else{select.value=String(first);select.dispatchEvent(new Event('change'));}}
  }
  // (a) a long table shows 25 rows at a time and every row is reached once.
  for(const bar of root.querySelectorAll('[data-table-pager]')){
    const table=bar.previousElementSibling.matches('table')?bar.previousElementSibling:bar.previousElementSibling.querySelector('table');
    const rows=[...table.tBodies[0].rows],status=bar.querySelector('[role="status"]'),[previous,next]=bar.querySelectorAll('button');
    const visible=()=>rows.filter(row=>shown(row));
    result.pagers.push({rows:rows.length,status:status.textContent});
    if(rows.length<=25)fail('a table of '+rows.length+' rows is paged');
    if(status.textContent!=='Showing rows 1–25 of '+rows.length)fail('pager says "'+status.textContent+'" for '+rows.length+' rows');
    const seen=new Set();let pages=0;
    for(;;){
      const now=visible();if(now.length>25||!now.length)fail('a page shows '+now.length+' rows');
      now.forEach(row=>{if(seen.has(row))fail('a row is shown on two pages');seen.add(row);});
      pages++;if(next.disabled||pages>50)break;next.click();
    }
    if(seen.size!==rows.length)fail('pages reach '+seen.size+' of '+rows.length+' rows');
    if(!/^Showing rows \d+–\d+ of \d+$/.test(status.textContent)||!status.textContent.endsWith('–'+rows.length+' of '+rows.length))fail('last page says "'+status.textContent+'"');
    while(!previous.disabled)previous.click();
    if(status.textContent!=='Showing rows 1–25 of '+rows.length)fail('Previous does not return to the first 25 rows');
  }
  return result;
})()`;

// (f) Runs in the page: walks every detail page of More detail, opened as the guard opens it.
const READ_DETAIL_PAGES=String.raw`(async()=>{
  const root=document.getElementById('moduleContent'),shown=e=>!!(e&&(typeof e.checkVisibility==='function'?e.checkVisibility():e.offsetParent));
  const out={problems:[],pages:[],groups:0};const fail=text=>out.problems.push(text);
  const openAll=async()=>{for(let round=0;round<4;round++){root.querySelectorAll('details:not([open])').forEach(d=>{d.open=true;});await new Promise(r=>setTimeout(r,300));}};
  const measure=()=>({height:root.scrollHeight,tables:[...root.querySelectorAll('table')].filter(shown).length});
  const list=root.querySelector('.page-more-detail>.page-detail-groups');
  const groups=list?[...list.children].filter(node=>node.tagName==='DETAILS'):[];out.groups=groups.length;
  const nav=root.querySelector('[data-detail-pager]');
  if(!nav){await openAll();out.pages.push(measure());return out;}
  if(!nav.closest('.page-more-detail'))fail('the detail-page control is not inside More detail');
  const title=group=>[...group.querySelector(':scope>summary').childNodes].map(n=>String(n.textContent||'').replace(/\s+/g,' ').trim()).find(Boolean)||'Further information';
  const status=nav.querySelector('[role="status"]'),buttons=[...nav.querySelectorAll('.page-detail-pager-bar button')];
  const [previous,next,every]=buttons,lines=[...nav.querySelectorAll('.page-detail-index li')],count=lines.length;
  const named=()=>[...nav.querySelectorAll('.page-detail-index button')];
  if(named().map(b=>b.textContent).join('\n')!==groups.map(title).join('\n'))fail('the list does not name every group in order');
  while(!previous.disabled)previous.click();
  const seen=new Map(),texts=[];
  for(let page=0;page<count;page++){
    if(status.textContent!=='Detail page '+(page+1)+' of '+count)fail('page '+(page+1)+' says "'+status.textContent+'"');
    if(!shown(nav)||!named().every(shown)||named().length!==groups.length)fail('page '+(page+1)+' does not name every group');
    await openAll();
    const size=measure();out.pages.push(size);
    if(size.height>14000)fail('detail page '+(page+1)+' is '+(size.height/700).toFixed(1)+' screens opened');
    if(size.tables>15)fail('detail page '+(page+1)+' holds '+size.tables+' tables opened');
    const visible=groups.filter(shown);if(!visible.length)fail('detail page '+(page+1)+' shows no group');
    visible.forEach(group=>seen.set(group,(seen.get(group)||0)+1));
    texts.push(visible.map(group=>group.innerText).join('\n'));
    if(page<count-1){if(next.disabled)fail('Next is off on page '+(page+1));next.click();}
  }
  if(!next.disabled)fail('Next is on at the last page');
  groups.forEach(group=>{if(seen.get(group)!==1)fail('"'+title(group)+'" is on '+(seen.get(group)||0)+' detail pages');});
  every.click();await openAll();
  if(groups.filter(shown).length!==groups.length)fail('Show all detail pages shows '+groups.filter(shown).length+' of '+groups.length+' groups');
  const unpaged=groups.map(group=>group.innerText).join('\n'),paged=texts.join('\n');
  if(paged!==unpaged){let at=0;while(at<paged.length&&paged[at]===unpaged[at])at++;fail('the pages together differ from the unpaged detail at '+at+': "'+paged.slice(at,at+80)+'" / "'+unpaged.slice(at,at+80)+'"');}
  out.textLength=unpaged.length;
  // A deep link to a block of the last group opens the detail page that holds it.
  every.click();while(!previous.disabled)previous.click();
  const last=groups[groups.length-1],target=last.querySelector('.page-detail-body > *, p, table')||last;
  if(shown(target))fail('the last group is already shown on detail page 1');
  openPageDetailFor(target);
  if(!shown(target))fail('a link to a block of the last group does not open its detail page');
  if(status.textContent!=='Detail page '+count+' of '+count)fail('the link opened "'+status.textContent+'"');
  while(!previous.disabled)previous.click();
  return out;
})()`;

test('L3: opened detail pages long tables by 25 rows, shows blocks of the same kind with one selector and reads a long More detail on detail pages, keeping every row, block and group',{timeout:1_200_000},async t=>{
  const binary=chromeBinary();
  if(!binary){
    if(process.env.CI)assert.fail('This test needs a Chrome/Chromium binary: set CHROME_PATH, or install /usr/bin/google-chrome.');
    t.skip('No Chrome/Chromium binary found (set CHROME_PATH); this test is mandatory on CI');return;
  }
  assert.ok(existsSync(SERVER),'built server missing: '+SERVER);
  const root=await mkdtemp(join(tmpdir(),'cmeng-c5-l3-'));
  let server:ChildProcess|null=null,chrome:ChildProcess|null=null,cdp:Cdp|null=null;
  try{
    const port=await freePort(),base='http://127.0.0.1:'+port;
    const env:NodeJS.ProcessEnv={...process.env,CMENG_DATA_DIR:join(root,'data'),PORT:String(port),HOST:'127.0.0.1',CMENG_OCR_ENABLED:'0'};
    for(const name of ['RAILWAY_VOLUME_MOUNT_PATH','NODE_TEST_CONTEXT','CMENG_PROJECT_WORKER','NODE_OPTIONS'])delete env[name];
    server=own(spawn(process.execPath,[SERVER],{env,stdio:['ignore','pipe','pipe'],detached:true}));
    let serverLog='';server.stdout!.on('data',d=>{serverLog=(serverLog+d).slice(-20000);});server.stderr!.on('data',d=>{serverLog=(serverLog+d).slice(-20000);});
    const deadline=Date.now()+60_000;
    for(;;){
      if(server.exitCode!==null)assert.fail('server exited during start: '+serverLog.slice(-3000));
      try{const r=await fetch(base+'/health',{signal:AbortSignal.timeout(2000)});if(r.ok)break;}catch{}
      if(Date.now()>deadline)assert.fail('server did not answer /health within 60 s: '+serverLog.slice(-3000));
      await new Promise(r=>setTimeout(r,300));
    }
    // The guard's three blind kinds (commercial, delay, delivery) through the real upload route.
    for(const [projectId,generate] of KINDS){
      const project=await generate('CMENG-R15-C5-L3-OPENED-DETAIL',0);
      const created=await fetch(base+'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId,testProject:true})});
      assert.equal(created.status,201,'project creation failed: '+await created.text());
      for(const [index,document] of project.documents.entries()){
        const uploaded=await fetch(base+'/api/projects/'+encodeURIComponent(projectId)+'/evidence/uploads',{method:'POST',
          headers:{'content-type':document.mediaType,'x-source-filename-encoded':encodeURIComponent(document.filename),'x-source-relative-path-encoded':encodeURIComponent(document.filename),
            'x-upload-intent':'add_update','x-upload-id':'C5-L3-'+projectId+'-'+index},body:Buffer.from(document.bytes),signal:AbortSignal.timeout(180_000)});
        assert.equal(uploaded.status,201,document.filename+' upload failed: '+(await uploaded.text()).slice(0,800));
      }
    }
    const launched=await launchChrome(binary,join(root,'chrome-profile'));chrome=launched.child;
    cdp=await Cdp.connect(launched.url);
    const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:true});
    const send=(method:string,params:Record<string,unknown>={},timeoutMs?:number)=>cdp!.send(method,params,sessionId,timeoutMs);
    await send('Page.enable');await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
    const evaluate=async(expression:string,timeoutMs=PAGE_TIMEOUT_MS)=>{
      const reply=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},timeoutMs);
      if(reply.exceptionDetails)throw new Error('page script failed: '+(reply.exceptionDetails.exception?.description??reply.exceptionDetails.text));
      return reply.result.value;
    };
    const ready=(module:string)=>'typeof currentModuleResult!=="undefined"&&currentModuleResult?.key==='+JSON.stringify(module)+
      '&&document.getElementById("moduleBadge").textContent!=="Updating"&&document.getElementById("moduleBadge").textContent!=="Calculating"&&'+
      '!document.getElementById("projectModulePanel").hidden&&!document.querySelector("#moduleContent .view-state-bar .spinner")';
    const open=async(projectId:string,module:string)=>{
      await send('Page.navigate',{url:base+'/?view=project&project='+encodeURIComponent(projectId)+'&module='+encodeURIComponent(module)});
      const until=Date.now()+PAGE_TIMEOUT_MS;
      while(!(await evaluate('(()=>{try{return !!('+ready(module)+')}catch{return false}})()',10_000).catch(()=>false))){
        if(Date.now()>until)assert.fail(module+' did not finish rendering within '+PAGE_TIMEOUT_MS/1000+' s');
        await new Promise(r=>setTimeout(r,300));
      }
      await new Promise(r=>setTimeout(r,800));
    };
    const failures:string[]=[];let picks=0,pagers=0,detailPaged=0;
    const names=new Set<string>();
    // (f) every detail page of the Dashboard of each blind kind.
    for(const [projectId] of KINDS){
      await open(projectId,'master-dashboard');
      const read=await evaluate(READ_DETAIL_PAGES) as {problems:string[];pages:{height:number;tables:number}[];groups:number;textLength?:number};
      console.log('L3 detail pages '+projectId+' master-dashboard: '+read.groups+' groups on '+read.pages.length+' detail pages: '+read.pages.map(p=>(p.height/700).toFixed(1)+' screens, '+p.tables+' tables').join(' ; '));
      for(const problem of read.problems)failures.push(projectId+' master-dashboard: '+problem);
      if(read.pages.length===1&&(read.pages[0]!.height>14000||read.pages[0]!.tables>15))failures.push(projectId+' master-dashboard: one page of '+(read.pages[0]!.height/700).toFixed(1)+' screens and '+read.pages[0]!.tables+' tables opened');
      if(read.pages.length>1)detailPaged++;
      // Print shows every group; the detail-page control is not printed.
      await send('Emulation.setEmulatedMedia',{media:'print'});
      const printed=await evaluate('(()=>{const groups=[...document.querySelectorAll("#moduleContent .page-more-detail>.page-detail-groups>details")];const nav=document.querySelector("[data-detail-pager]");return {groups:groups.length,shown:groups.filter(g=>g.checkVisibility()).length,nav:!!(nav&&nav.checkVisibility())};})()') as {groups:number;shown:number;nav:boolean};
      await send('Emulation.setEmulatedMedia',{media:''});
      if(printed.shown!==printed.groups)failures.push(projectId+' master-dashboard: print shows '+printed.shown+' of '+printed.groups+' groups');
      if(printed.nav)failures.push(projectId+' master-dashboard: the detail-page control is printed');
    }
    for(const module of PAGES){
      await open(PROJECT_ID,module);
      const read=await evaluate(READ_PAGE) as {key:string;problems:string[];picks:string[][];pagers:{rows:number;status:string}[];defaultVisible:number;tables:number;height:number};
      console.log('L3 '+module+': '+read.tables+' tables, '+(read.height/700).toFixed(1)+' screens opened; selectors: '+read.picks.map(p=>p.join(' | ')).join(' ; ')+'; pagers: '+read.pagers.map(p=>p.status).join(' ; '));
      for(const problem of read.problems)failures.push(module+': '+problem);
      if(read.defaultVisible)failures.push(module+': '+read.defaultVisible+' pager or selector visible before any section is opened (the first screen changed)');
      if(TABLE_LIMITED.has(module)&&read.tables>15)failures.push(module+': '+read.tables+' tables when every section is opened (limit 15)');
      picks+=read.picks.length;pagers+=read.pagers.length;
      for(const labels of read.picks)for(const label of labels)names.add(module+': '+label);
    }
    assert.deepEqual(failures,[],'opened detail keeps every row and block within the L3 limits');
    // The commercial ledgers for each register and the two lists of record groups share one selector.
    assert.ok([...names].some(name=>name.startsWith('payments: After Data Date, excluded from current totals')),'Payments: the ledger of each register shares one selector ('+[...names].join(' ; ')+')');
    assert.ok([...names].some(name=>name.startsWith('cost-forecast: After Data Date, excluded from current totals')),'Cost Outlook: the cost register of each register shares one selector');
    assert.ok([...names].some(name=>/^payments: Reporting record groups · \d+ defined groups$/.test(name)),'the two lists of record groups share one selector');
    assert.ok(pagers>=1,'a long table in collapsed detail pages by 25 rows');
    assert.ok(picks>=4,'blocks of the same kind share selectors ('+picks+')');
    assert.ok(detailPaged>=1,'the Dashboard of at least one blind kind is read on detail pages');
  }finally{
    if(cdp){await cdp.send('Browser.close',{},undefined,5000).catch(()=>{});cdp.close();}
    await stop(chrome);await stop(server);
    await rm(root,{recursive:true,force:true}).catch(()=>{});
  }
});

test('L3: an empty delivery record set says "None in this set." with nothing to open, search or page',()=>{
  const c:any={escapeHtml:(v:any)=>String(v),project:()=>'P'};
  runInNewContext(deliveryScript(),c);
  const html=c.deliveryObjectDetail({topPackages:[],records:[{reference:'R-1'}]});
  assert.match(html,/<dt>[^<]*<\/dt><dd><span class="delivery-none">None in this set\.<\/span><\/dd>/,'the empty set says so on its line');
  assert.equal((html.match(/data-delivery-lazy=/g)||[]).length,1,'only the set with records opens');
  assert.match(c.deliveryObjectDetail([]),/None in this set\./);
});
